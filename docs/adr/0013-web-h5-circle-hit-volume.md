# ADR 0013 — Web/H5 分层 + 圆形体积碰撞

**结论**：H5 客户端用 **React + Vite** 做菜单 / HUD / 触控，用 **PixiJS** 做实时场景；存档为 **localStorage**，按 **Account** 分 **Save Slot**。战斗命中改为 **Attack Volume ∩ Hit Volume**（圆 / 半圆 / 弹体圆 vs 怪物圆），不再用像素格子 AABB。

**为啥**：像素 Demo 把攻击画成格子、把敌人当方块采样，边角能打到、圆边打不到，显示与判定对不上。圆形体积与绘制半径共用常数后，看见相交就是命中。Web 上 UI 与 60fps 场景职责不同，拆层避免把菜单塞进 Pixi。

| 谁 | 记什么 |
|----|--------|
| **前端** | Q 版身体贴合 Hit Volume；接触没有比身体更大的圈。HUD 不读格子列表。 |
| **后端** | `dist(centers) <= attackRadius + enemyRadius`（半圆再加朝向半平面，容差为敌半径）。接触伤害是 `player.r + enemy.r`，无额外半径。 |

**别做**：再用 `attack_tiles` / 格子 AABB 做命中；把 React 状态当每帧物理源。

**相关**：0009、0011、0012
