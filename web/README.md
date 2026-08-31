# 曲无双 — Web/H5

React + Vite 菜单/HUD，PixiJS 实时场景。三个角色（武士 / 枪客 / 弓使）共用一条命；近战为旋斩 / 半扫，弓使射锁敌矢。不画格子地和圆心扇形。

**在线试玩：** https://jerryz107.github.io/music-musou/

```bash
cd web
npm install
npm run dev
```

浏览器打开终端提示的本地地址。手机可与电脑同一局域网访问。

## 部署

| 命令 / 配置 | 用途 |
|---|---|
| `npm run build:pages` | GitHub Pages 构建（base `/music-musou/`） |
| `npm run build` | Vercel / 本地静态包 |
| `.github/workflows/deploy-pages.yml` | 推 main 自动发布 |
| `vercel.json` | Vercel SPA 重写 |

## 局内留存反馈

- **连击**：连续命中显示 `连击 ×N`（2.4s 断连清零）
- **伤害飘字**：世界坐标弹出数值，卡拍带 `!`
- **三星结算**：胜利 overlay 显示星级、分数、连击/输出/卡拍
- **成绩分享**：一键复制含在线链接的分享文案

## 操作

- 本机 **Account** + 三个 **Save Slot**（localStorage）
- 选 Track 与角色后进训练场，`T` 进实战
- WASD 移动，Enter 普攻，Shift 滑步，空格 角色大招，`1/2/3` 换角色
- `[` `]` 调音频延迟
