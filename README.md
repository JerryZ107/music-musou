# 曲无双（Music Musou）· Web

> **玩法与技术验证 Demo**。完整设计见 [`CONTEXT.md`](CONTEXT.md)、[`content.md`](content.md)、[`docs/adr/`](docs/adr/)。

俯视角 **音游 × 割草无双**：一首歌驱动一整局节奏，走位清怪、卡拍强化攻击与充能，攒满释放角色大招。本仓库为 **Web/H5 客户端**（React + Vite + PixiJS）。

Pygame / Android 原型已迁至同级目录 [`../music-musou-pygame`](../music-musou-pygame)。

---

## 在线试玩

| 平台 | 地址 |
|------|------|
| **GitHub Pages** | https://jerryz107.github.io/music-musou/ |
| **Vercel** | 导入仓库，Root Directory = `web`（见 [`portfolio/00_在线试玩.md`](portfolio/00_在线试玩.md)） |

推送 `main` 分支后 GitHub Actions 自动构建 Pages。首次需在仓库 Settings → Pages → Source 选 **GitHub Actions**。

---

## 本地运行

```bash
cd web
npm install
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173/`）。

- 本机账号 + 三个存档槽
- 训练场按 **T** 进入实战；角色 **1 / 2 / 3** 切换不停歌
- **WASD** 移动 · **Enter** 普攻 · **Shift** 滑步 · **空格** 大招 · **M** 静音

---

## 文档

| 文档 | 内容 |
|------|------|
| [`CONTEXT.md`](CONTEXT.md) | 术语与领域模型 |
| [`content.md`](content.md) | 设计大纲 |
| [`docs/adr/`](docs/adr/) | 架构决策记录 |
| [`web/README.md`](web/README.md) | 前端工程说明 |

**GitHub：** [github.com/JerryZ107/music-musou](https://github.com/JerryZ107/music-musou)
