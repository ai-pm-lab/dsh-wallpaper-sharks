/**
 * Persisted preferences for the ocean wallpaper.
 *
 * Mirrors the option set of OGHong/dsh-ascii-sharks (MIT), plus a `base` choice
 * that selects the backdrop palette ("paper" light or "ink" dark).
 */
import type { SharkKind } from "../vendor/world";

export type Base = "paper" | "ink";

export interface OceanConfig {
  /** Whether the ocean renders at all. */
  enabled: boolean;
  /** Whole-canvas opacity, 0.1 to 1. */
  opacity: number;
  /** Density multiplier for the fish alphas, 0.2 to 1. */
  strength: number;
  /** How many sharks to seed, 1 to 5. */
  count: number;
  /** Global shark size multiplier, 0.4 to 1.8 (1 = design size). */
  sharkScale: number;
  /**
   * Selected species pool. Multi-select: the roster cycles through it, so
   * picking [classic, tiger] with 3 sharks seeds classic → tiger → classic.
   */
  species: SharkKind[];
  /** Whether the pointer scatters the fish. */
  interactive: boolean;
  /** Backdrop palette: paper (light) or ink (dark). */
  base: Base;
  /** App-surface veil opacity, 0.15 to 0.8. Lower lets the ocean through more. */
  veil: number;
  /** Target render FPS, 15–60. */
  fps: number;
  /** Device-pixel-ratio cap, 1–2. Lower is cheaper. */
  dpr: number;
}

export const STORAGE_KEY = "dsh-wallpaper-sharks:v1";

export const DEFAULTS: OceanConfig = {
  enabled: true,
  opacity: 0.72,
  strength: 0.9,
  count: 2,
  sharkScale: 1,
  species: ["classic"],
  interactive: true,
  base: "paper",
  veil: 0.35,
  fps: 30,
  dpr: 1.5,
};

const VALID_KINDS: readonly string[] = [
  "classic", "hammerhead", "greathammer", "tiger",
  "zebra", "mako", "thresher", "nurse",
];


function offDefaults(): OceanConfig {
  return { ...DEFAULTS, species: [...DEFAULTS.species] };
}

/** Read the stored configuration, falling back field by field. */
export function readStored(): OceanConfig {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw === null) return offDefaults();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return offDefaults();
  }
  if (parsed === null || typeof parsed !== "object") return offDefaults();

  const v = parsed as Record<string, unknown>;
  const enabled = typeof v.enabled === "boolean" ? v.enabled : DEFAULTS.enabled;
  const interactive = typeof v.interactive === "boolean" ? v.interactive : DEFAULTS.interactive;
  const base: Base = v.base === "ink" ? "ink" : "paper";
  const veil = typeof v.veil === "number" && Number.isFinite(v.veil)
    ? Math.min(0.8, Math.max(0.15, v.veil))
    : DEFAULTS.veil;
  const fps = typeof v.fps === "number" && Number.isFinite(v.fps)
    ? Math.min(60, Math.max(15, Math.round(v.fps)))
    : DEFAULTS.fps;
  const dpr = typeof v.dpr === "number" && Number.isFinite(v.dpr)
    ? Math.min(2, Math.max(1, v.dpr))
    : DEFAULTS.dpr;
  const sharkScale = typeof v.sharkScale === "number" && Number.isFinite(v.sharkScale)
    ? Math.min(1.8, Math.max(0.4, v.sharkScale))
    : DEFAULTS.sharkScale;
  const strength = typeof v.strength === "number" && Number.isFinite(v.strength)
    ? Math.min(1, Math.max(0.2, v.strength))
    : DEFAULTS.strength;
  const opacity = typeof v.opacity === "number" && Number.isFinite(v.opacity)
    ? Math.min(1, Math.max(0.1, v.opacity))
    : DEFAULTS.opacity;

  // Migration: the v1 shape stored a roster array (`sharks`). Turn it into a
  // count plus the unique species pool so multi-select has something to show.
  const storedSharks = Array.isArray(v.sharks)
    ? v.sharks.filter((k): k is SharkKind => VALID_KINDS.includes(k as string))
    : [];
  const count = typeof v.count === "number" && Number.isFinite(v.count)
    ? Math.min(5, Math.max(1, Math.round(v.count)))
    : storedSharks.length > 0
      ? Math.min(5, Math.max(1, storedSharks.length))
      : DEFAULTS.count;
  const species = Array.isArray(v.species)
    ? v.species.filter((k): k is SharkKind => VALID_KINDS.includes(k as string))
    : Array.from(new Set(storedSharks));

  return {
    enabled,
    interactive,
    base,
    veil,
    fps,
    dpr,
    strength,
    opacity,
    count,
    sharkScale,
    species: species.length > 0 ? species : [...DEFAULTS.species],
  };
}

/** Resolve the roster this mount should draw: count sharks, cycled through the pool. */
export function resolveRoster(config: OceanConfig): SharkKind[] {
  const count = Math.min(5, Math.max(1, config.count));
  const pool = config.species.length > 0 ? config.species : DEFAULTS.species;
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]!);
}

export interface ConfigStore {
  getSnapshot(): OceanConfig;
  subscribe(listener: () => void): () => void;
  set(next: OceanConfig): void;
}

export function createConfigStore(): ConfigStore {
  let value = readStored();
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => value,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (next) => {
      value = next;
      try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* Storage refused; the in-memory value still applies. */
      }
      for (const listener of listeners) listener();
    },
  };
}
