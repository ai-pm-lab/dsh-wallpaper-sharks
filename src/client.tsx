/**
 * DSH client plugin: the ascii-sharks engine as a full-screen theme wallpaper,
 * with a settings page that mirrors OGHong/dsh-ascii-sharks' option set and adds
 * a "base" choice (paper / ink).
 *
 * Engine: MIT, stackedlol/ascii-sharks (vendored under ./vendor).
 */
import { useState, useSyncExternalStore } from "react";
import { OceanEngine, PAPER_THEME, INK_THEME, type OceanTheme } from "../vendor/index";
import type { SharkKind } from "../vendor/world";
import { createConfigStore, resolveRoster, DEFAULTS, type ConfigStore, type OceanConfig, type Base } from "./store";

const NS = "dsh-wallpaper-sharks";
const BG_ID = "dsh-wallpaper-sharks-bg";

/** Toggle one kind in a multi-select pool, never letting the pool go empty. */
function toggleKind(list: SharkKind[], kind: SharkKind): SharkKind[] {
  const has = list.includes(kind);
  const next = has ? list.filter((k) => k !== kind) : [...list, kind];
  return next.length > 0 ? next : [kind];
}

const KINDS: readonly SharkKind[] = [
  "classic", "hammerhead", "greathammer", "tiger",
  "zebra", "mako", "thresher", "nurse",
];

const KIND_LABELS: Record<SharkKind, string> = {
  classic: "经典",
  hammerhead: "锤头",
  greathammer: "双髻",
  tiger: "虎鲨",
  zebra: "斑马",
  mako: "灰鲭",
  thresher: "长尾",
  nurse: "护士",
};

const CSS = `
#${BG_ID}{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:transparent}
#${BG_ID}>canvas{display:block;width:100%;height:100%;font-family:var(--ds-font-family-code,ui-monospace,Menlo,monospace)}
/* One veil for the whole shell: #root paints it, every column is transparent,
   so the sidebar and the conversation see exactly the same amount of ocean. */
#root{background:var(--dsh-wallpaper-veil,rgba(255,255,255,0.45))!important}
html body div:has(> [class*="_sidebarCol"]){background:transparent!important}
html body [class*="_sidebarCol"],
html body [class*="_centerCol"],
html body [class*="_rightbarCol"],
html body [class*="_bottomRow"]{background:transparent!important}
html body [data-phase]{background:transparent!important}
html body{--dsw-alias-bg-base:var(--dsh-wallpaper-veil,rgba(255,255,255,0.45))!important}
`;

function installStyles() {
  if (typeof document === "undefined") return;
  for (const stale of document.querySelectorAll(`style[data-plugin="${BG_ID}"]`)) stale.remove();
  const tag = document.createElement("style");
  tag.dataset.plugin = BG_ID;
  tag.dataset.pluginCss = `${BG_ID}/styles.css`;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}

function themeFor(base: Base, strength: number): OceanTheme {
  const t = base === "ink" ? INK_THEME : PAPER_THEME;
  return { ...t, strength };
}

function veilFor(base: Base, veil: number): string {
  let reduced = false;
  try {
    reduced = window.matchMedia("(prefers-reduced-transparency: reduce)").matches;
  } catch {
    reduced = false;
  }
  const paper = base !== "ink";
  if (reduced) return paper ? "#eef2f7" : "#0a0d12";
  const alpha = Math.min(0.8, Math.max(0.15, veil));
  return paper ? `rgba(255,255,255,${alpha})` : `rgba(16,18,24,${alpha})`;
}

function mountBackground(store: ConfigStore, ctx: any): () => void {
  if (typeof document === "undefined" || document.body === null) return () => {};
  const host = document.createElement("div");
  host.id = BG_ID;
  host.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  host.appendChild(canvas);
  document.body.insertBefore(host, document.body.firstChild);

  let engine: OceanEngine | null = null;
  let rosterKey = "";
  let lastBase: Base | null = null;

  /**
   * "Ink" is a full dark theme, not a backdrop swap: switch the shell's own
   * theme so text, inputs, code blocks, buttons, icons and borders all flip.
   */
  const applyAppTheme = (base: Base) => {
    if (base === lastBase) return;
    lastBase = base;
    const dark = base === "ink";
    const theme = ctx?.get?.("theme");
    if (theme !== void 0 && typeof theme.setTheme === "function") {
      theme.setTheme(dark ? "dark" : "light");
      return;
    }
    if (typeof document !== "undefined") {
      if (dark) document.body.setAttribute("data-ds-dark-theme", "");
      else document.body.removeAttribute("data-ds-dark-theme");
    }
  };

  const apply = (config: OceanConfig) => {
    applyAppTheme(config.base);
    host.style.display = config.enabled ? "" : "none";
    document.documentElement.style.setProperty("--dsh-wallpaper-veil", veilFor(config.base, config.veil));
    if (!config.enabled) {
      engine?.pause(true);
      return;
    }
    engine?.pause(false);
    engine?.setTheme(themeFor(config.base, config.strength));
    engine?.setOpacity(config.opacity);
    engine?.setPointerEnabled(config.interactive);
    engine?.setFps(config.fps);
    engine?.setMaxDpr(config.dpr);
    engine?.setSharkScale(config.sharkScale);
  };

  const rebuild = (config: OceanConfig) => {
    const key = `${config.species.join(",")}|${config.count}`;
    if (key === rosterKey && engine !== null) return;
    rosterKey = key;
    engine?.destroy();
    engine = null;
    const roster = resolveRoster(config);
    engine = new OceanEngine(canvas, roster.map((kind, i) => ({ kind, size: 1 - i * 0.1 })));
    engine.setCellWidth(8);
  };

  const sync = () => {
    const config = store.getSnapshot();
    rebuild(config);
    apply(config);
  };

  const unsubscribe = store.subscribe(sync);
  sync();

  return () => {
    unsubscribe();
    engine?.destroy();
    engine = null;
    host.remove();
  };
}

const stepBtn: Record<string, string | number> = {
  width: 28,
  height: 24,
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))",
  background: "transparent",
  color: "var(--dsw-alias-label-primary, #111)",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
};

const selectStyle: Record<string, string | number> = {
  fontSize: 12,
  padding: "4px 8px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))",
  background: "var(--dsw-specific-menu, #fff)",
  color: "var(--dsw-alias-label-primary, #111)",
};

const restoreBtn: Record<string, string | number> = {
  fontSize: 12,
  padding: "5px 12px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))",
  background: "transparent",
  color: "var(--dsw-alias-label-secondary, #666)",
  cursor: "pointer",
};

export function apply(ctx: any) {
  installStyles();
  const store = createConfigStore();

  ctx.effect(() => ctx.locale.register(NS, {
    zh: {
      nav: "海洋",
      enabled: "显示海洋背景",
      enabledHint: "关闭后页面恢复不透明",
      base: "背景底色",
      baseHint: "白纸 = 浅色界面 + 白纸海洋；墨色 = 深色界面 + 墨色海洋（文字/输入框/代码块/按钮一起变深）",
      paper: "白纸",
      ink: "墨色",
      opacity: "整层透明度",
      opacityHint: "整片海洋（鱼、鲨鱼、网格）一起变淡，调低更像水印",
      veil: "背景遮罩",
      veilHint: "应用表面的不透明度，越低海洋越深越明显（文字也越容易花）",
      strength: "鱼群浓淡",
      strengthHint: "只调鱼的颜色浓度，越高鱼线越清晰",
      fps: "帧率",
      fpsHint: "每秒重绘次数；30 帧够顺，降 GPU 首选",
      dpr: "渲染精度",
      dprHint: "画布像素密度，1× 最省电、2× 最清晰",
      count: "鲨鱼数量",
      countHint: "1–5 条，越多越挤",
      sharkScale: "鲨鱼大小",
      sharkScaleHint: "整体缩放所有鲨鱼；40%–180%，默认 100%",
      species: "鲨鱼种类（可多选）",
      speciesHint: "可同时选多种；多只鲨鱼时按选中顺序轮流分配、循环使用",
      interactive: "鼠标驱鱼",
      interactiveHint: "鼠标划过时鱼群会躲开；点击会惊散鱼群并驱赶鲨鱼",
      restore: "恢复默认",
      restoreConfirm: "确认恢复",
      cancel: "取消",
      restoreHint: "会把这页所有参数恢复为默认值，确定吗？",
    },
    en: {
      nav: "Ocean",
      enabled: "Show ocean background",
      enabledHint: "Off restores an opaque page",
      base: "Background base",
      baseHint: "Paper = light shell + paper ocean; Ink = dark shell + ink ocean",
      paper: "Paper",
      ink: "Ink",
      opacity: "Layer opacity",
      opacityHint: "Fades the whole ocean (fish, sharks, grid); lower is watermark-like",
      veil: "Surface veil",
      veilHint: "Lower gives a deeper, more visible ocean (and busier text)",
      strength: "Fish density",
      strengthHint: "Only the fish ink; higher makes the dashes clearer",
      fps: "Frame rate",
      fpsHint: "Redraws per second; 30 is smooth and the first GPU lever",
      dpr: "Render scale",
      dprHint: "Canvas pixel density; 1x is cheapest, 2x sharpest",
      count: "Shark count",
      countHint: "1–5 sharks",
      sharkScale: "Shark size",
      sharkScaleHint: "Scales every shark; 40%–180%, 100% default",
      species: "Shark species (multi)",
      speciesHint: "Pick several; the pod cycles through them in order",
      interactive: "Pointer scatters",
      interactiveHint: "Fish flee the cursor; a click scatters the school and startles sharks",
      restore: "Restore defaults",
      restoreConfirm: "Confirm restore",
      cancel: "Cancel",
      restoreHint: "This resets every option on this page. Continue?",
    },
  }), "ascii-ocean: dictionaries");
  const t = ctx.locale.bind(NS) as (key: string) => string;

  ctx.effect(() => mountBackground(store, ctx), "ascii-ocean: wallpaper layer");

  function SettingsSection() {
    const config = useSyncExternalStore(store.subscribe, store.getSnapshot);
    const [confirming, setConfirming] = useState(false);
    const patch = (p: Partial<OceanConfig>) => store.set({ ...config, ...p });
    const count = config.count;

    const row = (label: string, children: any, hint?: string) => (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 0", borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.06))" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--dsw-alias-label-primary)" }}>{label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>{children}</div>
        </div>
        {hint ? <div style={{ fontSize: 11, lineHeight: 1.5, color: "var(--dsw-alias-label-tertiary, #999)" }}>{hint}</div> : null}
      </div>
    );

    const toggle = (on: boolean, onChange: () => void) => (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={onChange}
        style={{ width: 40, height: 22, borderRadius: 999, border: "none", cursor: "pointer", position: "relative", background: on ? "var(--dsw-alias-state-business-primary, #4176e6)" : "var(--dsw-alias-bg-overlay, #ccc)" }}
      >
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .12s" }} />
      </button>
    );

    const chip = (label: string, on: boolean, onClick: () => void) => (
      <button
        type="button"
        onClick={onClick}
        style={{ fontSize: 12, padding: "3px 9px", borderRadius: 999, cursor: "pointer", border: on ? "1px solid var(--dsw-alias-state-business-primary, #4176e6)" : "1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.12))", background: on ? "var(--dsw-alias-state-business-tertiary, rgba(65,118,230,.12))" : "transparent", color: on ? "var(--dsw-alias-state-business-primary, #4176e6)" : "var(--dsw-alias-label-secondary, #666)" }}
      >
        {label}
      </button>
    );

    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {row(t("enabled"), toggle(config.enabled, () => patch({ enabled: !config.enabled })), t("enabledHint"))}
        {config.enabled ? (
          <div>
            {row(t("base"), (
              <>
                {chip(t("paper"), config.base === "paper", () => patch({ base: "paper" }))}
                {chip(t("ink"), config.base === "ink", () => patch({ base: "ink" }))}
              </>
            ), t("baseHint"))}
            {row(`${t("veil")} ${Math.round(config.veil * 100)}%`, (
              <input type="range" min={0.15} max={0.8} step={0.01} value={config.veil} onChange={(e) => patch({ veil: Number(e.currentTarget.value) })} style={{ width: 150 }} />
            ), t("veilHint"))}
            {row(`${t("opacity")} ${Math.round(config.opacity * 100)}%`, (
              <input type="range" min={0.1} max={1} step={0.01} value={config.opacity} onChange={(e) => patch({ opacity: Number(e.currentTarget.value) })} style={{ width: 150 }} />
            ), t("opacityHint"))}
            {row(`${t("strength")} ${Math.round(config.strength * 100)}%`, (
              <input type="range" min={0.2} max={1} step={0.01} value={config.strength} onChange={(e) => patch({ strength: Number(e.currentTarget.value) })} style={{ width: 150 }} />
            ), t("strengthHint"))}
            {row(t("fps"), (
              <select value={config.fps} onChange={(e) => patch({ fps: Number(e.currentTarget.value) })} style={selectStyle}>
                <option value={15}>15</option>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            ), t("fpsHint"))}
            {row(t("dpr"), (
              <select value={config.dpr} onChange={(e) => patch({ dpr: Number(e.currentTarget.value) })} style={selectStyle}>
                <option value={1}>1×</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2×</option>
              </select>
            ), t("dprHint"))}
            {row(`${t("count")} ${count}`, (
              <>
                <button type="button" style={stepBtn} disabled={count <= 1} onClick={() => patch({ count: count - 1 })}>−</button>
                <button type="button" style={stepBtn} disabled={count >= 5} onClick={() => patch({ count: count + 1 })}>+</button>
              </>
            ), t("countHint"))}
            {row(`${t("sharkScale")} ${Math.round(config.sharkScale * 100)}%`, (
              <input type="range" min={0.4} max={1.8} step={0.01} value={config.sharkScale} onChange={(e) => patch({ sharkScale: Number(e.currentTarget.value) })} style={{ width: 150 }} />
            ), t("sharkScaleHint"))}
            {row(t("species"), (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end", maxWidth: 320 }}>
                {KINDS.map((kind) => chip(
                  KIND_LABELS[kind],
                  config.species.includes(kind),
                  () => patch({ species: toggleKind(config.species, kind) }),
                ))}
              </div>
            ), t("speciesHint"))}
            {row(t("interactive"), toggle(config.interactive, () => patch({ interactive: !config.interactive })), t("interactiveHint"))}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, paddingTop: 14 }}>
          <span style={{ fontSize: 11, lineHeight: 1.5, color: confirming ? "var(--dsw-alias-state-error-primary, #e03a32)" : "transparent" }}>
            {t("restoreHint")}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {confirming ? (
              <>
                <button type="button" style={restoreBtn} onClick={() => setConfirming(false)}>{t("cancel")}</button>
                <button
                  type="button"
                  style={{ ...restoreBtn, color: "var(--dsw-alias-state-error-primary, #e03a32)", borderColor: "currentColor" }}
                  onClick={() => {
                    store.set({ ...DEFAULTS, species: [...DEFAULTS.species] });
                    setConfirming(false);
                  }}
                >
                  {t("restoreConfirm")}
                </button>
              </>
            ) : (
              <button type="button" style={restoreBtn} onClick={() => setConfirming(true)}>{t("restore")}</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  ctx.slots.inject("settings.section", () => ctx.slots.register({
    name: "settings.section",
    id: "ascii-ocean",
    order: 40,
    label: () => t("nav"),
    locale: NS,
  }, SettingsSection));
}

export const inject = ["slots", "locale"];
