# 截图清单

本目录存放 README 用图，文件名已固定，改名会导致 README 图片裂开。

| 文件名 | 内容 | 状态 |
|---|---|---|
| `01-paper-light.png` | 白纸底（浅色主题）整窗，1920×1115 | ✅ |
| `02-ink-dark.png` | 墨色底（深色主题）整窗，1920×1115 | ✅ |
| `03-settings-panel.png` | 设置 → 海洋 面板（含鲨鱼多选），1920×1115 | ✅ |
| `05-interaction.gif` | 点击驱赶鲨鱼的录屏，1200×695 / 25 帧 / 5fps | ✅ |

> 原计划的 `04-sharks-multi.png` 已合并进 `03-settings-panel.png`，不再单独出图。

## 规格

- 静态图：PNG，宽 1920px，单张 ≤ 2MB
- 动图：GIF，宽 1200px，≤ 5MB
- 不要包含个人隐私（会话标题、路径、token）

## 录屏转 GIF

源视频不提交进仓库（`.gitignore` 已忽略 `*.mov`）。新录屏可以：

```bash
# 需要 ffmpeg
ffmpeg -i input.mov -vf "fps=5,scale=1200:-1:flags=lanczos" -loop 0 05-interaction.gif
```

没有 ffmpeg 时，可用 macOS 自带的 AVFoundation（Swift）抽帧，再用 ImageIO 写成 GIF。
