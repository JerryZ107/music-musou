# 音乐无双割草 — 设计大纲与领域框架

> 文档角色：`content.md` 承载愿景、系统边界、流程与待决项；术语 canon 见根目录 `CONTEXT.md`（仅词汇表，不含实现）。

## 1. 电梯陈述

玩家在俯视角（或 2.5D）场景中 **清屏割草**。一次 **Run** 绑定 **一首 Track**（BGM + Beat Map）；**单角色一条命**，Run 内可切换 **多种武器**（不同攻击模组）**但不换 Track**（ADR 0010 / 0011）。Run 使用 **Loadout**（**Track** + **Point Allocation**）；**Track Allocation Screen** 随时可改点、**Allocation Reset**，不限 Run 前。每首 Track 有独立的 **Allocation Template**（**Allocation Axis**、Base、**Allocation Point Cap**）；玩家在 Cap 内 **自由 x/y 分配**，**不必分满**；支持 **Allocation Reset**。全局共用 **Attack Template** 与少量 **Ultimate Archetype**；Track 间差异来自 **模板轴/Base/Cap/Archetype**，同曲差异来自 **加点比例**。**Beat-On Hit** 造成 **2× 伤害** 且每 Grant **2×** 充能（相对 Basic）。**Minion** 基准：不卡拍 **两刀**、卡拍 **一刀**；**Boss** 为 **Health Pool**。

**体验目标**：无双爽感 + 卡拍充能 + **换曲换武器模组/大招** + **同曲自由 x/y 加点**。

## 2. 文档地图

| 章节 | 内容 |
|------|------|
| §3 核心循环 | 单局分钟级循环 |
| §4 领域模型 | 概念、关系、边界 |
| §5 子系统框架 | 战斗、节奏、曲目、关卡、反馈 |
| §6 曲目 × 机制耦合 | 如何把「音乐结构」映射为玩法 |
| §7 Demo 切片 | 最小可验证范围 |
| §8 待决项（Grill 队列） | 需逐条拍板的决策 |
| §9 风险与约束 | 非代码可见的约束 |

---

## 3. 核心循环（Core Loop）

```mermaid
flowchart LR
  A[选 Track] --> A2[Point Allocation 于 Template]
  A2 --> B[进入 Run]
  B --> C[移动 + 清怪]
  C --> D{攻击落在 Judgment Window?}
  D -->|是| E[Beat-On Attack]
  D -->|否| F[Basic Attack]
  E --> G{Combat Hit?}
  F --> G
  G -->|是| L[Energy Grant × min(受击数, Energy Hit Cap)]
  G -->|否| C
  L --> M[Basic 1× / Beat-On 2× 每 Grant]
  M --> C
  C --> H{Rhythm Energy 足够?}
  H -->|玩家释放| I[Ultimate]
  I --> C
  H -->|否| J{Run 结束?}
  C --> J
  J -->|否| C
  J -->|是| K[结算 / 换 Track]
  K --> A
```

**单局内微循环**：读拍 → 走位 → Window 内出手充能 → 择机 Ultimate；**攻击范围 / Cap** 等由 Template + Point Allocation 决定。

---

## 4. 领域模型

### 4.1 概念一览（与 CONTEXT 对齐）

| 概念 | 一句话职责 |
|------|------------|
| **Run** | 一次从选曲到关卡结算的游玩实例 |
| **Stage** | 提供敌群与胜利条件的 playable 空间 |
| **Attack Template** | 全 Track 共用的普攻骨架 |
| **Track** | 一曲：Beat Map + Allocation Template + Ultimate Archetype |
| **武器（Attack Module）** | 攻击模组（普攻形状、滑步、大招表现）；单角色一条命携带，Run 内可切换；与 Track 解耦 |
| **Stage Audio Binding** | Run 内唯一 BGM 时间轴 + Beat Map；全武器共用 |
| **Allocation Template** | 每曲轴、Base、Cap |
| **Allocation Axis** | 如攻击范围、Energy Hit Cap |
| **Allocation Point Cap** | 该曲可分配点数总和上限 |
| **Point Allocation** | 自由 x/y；sum ≤ Cap，不必分满 |
| **Allocation Reset** | 一键清空或恢复默认分配 |
| **Beat Map** | 拍点时间表（预烘焙） |
| **Judgment Window** | 卡拍判定区间 |
| **Basic Attack** / **Beat-On Attack** | Window 外/内；共用 Template + 分配后的战斗参数 |
| **Combat Hit** | 对敌造成伤害；充能前提 |
| **Energy Grant** | 每个计入 Cap 的受击单位一次 |
| **Energy Hit Cap** | Base(Cap 轴) + 分配点数 |
| **Rhythm Energy** | Grant 累加；Beat-On 每 Grant 2× |
| **Ultimate Archetype** | 共用少量大招原型；Track 固定其一 |
| **Track Allocation Screen** | 歌曲加点界面；多入口；随时编辑 |
| **Loadout** | 当前 Track + Point Allocation（改点即更新） |
| **星元** | 可选；1 Track : 1，持久化 Point Allocation |
| **Minion** | Basic 两击 / Beat-On 一击（Demo 基准） |
| **Boss** | **Health Pool**；Beat-On 仍 2× 伤害 |

### 4.2 关系（ cardinality 草案）

- 一次 **Run** 恰好绑定 **1 Track**、**1 Stage**（Demo 可固定 Stage）；Run 内 **不可换 Track**（换曲 = 新 Run）。
- **Stage** 可配置 **allowed_weapons**；Run 内 **Weapon Switch** 保持同一 **Stage Audio Binding**（ADR 0010 / 0011）。
- **Track** 拥有 **1 Allocation Template**、**1 Beat Map**、**1 Ultimate Archetype**（G8：**1 曲 1 模板**）。
- **Loadout** 随 **Track Allocation Screen** 保存的 **Point Allocation** 更新；**G9：无 Run 前独占窗口**，Run 中亦可打开界面改点 + Reset。
- **Energy Hit Cap** = Template 中 Cap 轴 Base + 分配到 Cap 轴的点数（换算见内容配置）。
- **Ultimate**（G3b）：共用 **Ultimate Archetype**；Track 间机制不同，同 Track 内 Ultimate 数值可随加点轴扩展（若 Template 含 Ult 轴，待扩展）。
- **Rhythm Energy**：每个 **Energy Grant** 在 Basic Hit 下为基准量，Beat-On Hit 下为 **2×**；单次攻击 Grant 数 = `min(受击单位数, Energy Hit Cap)`（G3a + G3c 已决）。
- **Beat-On Hit** 对伤害与 Grant 均为 **2×**（相对 Basic Hit）；**Minion** Demo TTK：不卡拍 **2 刀**、卡拍 **1 刀**（G12 已决）。
- **Boss** 使用 **Health Pool**；卡拍缩短击杀时间并加速充能（G12）。
- **Stage** 产生 **Horde**（含 Minion）；可含 **Boss**；Run **胜利条件** 待 G4。
- **Beat-On Attack** 与 **Basic Attack** 共享 **Attack Template**；差异为 Window、**2× 伤害/Grant** 与反馈。

### 4.3 边界（明确不属于核心域）

- **菜单、存档、 meta 成长**：Demo 外或极简占位。
- **实时音频 BPM 检测**：不属于 v0 域（Beat Map 预烘焙）。
- **音乐版权与发行**：产品约束，见 §9。

### 4.4 场景走查（Stress Test）

**场景 A — 乱按党**  
对 **Minion** 需 **两刀** 才杀，清屏慢、Grant 少、Ult 慢；仍可通过，但能感到「不跟拍很刮」。

**场景 H — Boss 战**  
Boss **Health Pool** 很长；Beat-On 每击 **2×** 扣血且 **2×** Grant。预期：跟拍 **明显缩短** Boss 战时长。

**场景 E — 卡拍但挥空**  
Window 内出手但未 Combat Hit。预期：**无 Energy Grant**；仍有 Beat-On 视听反馈（与 Basic 分档无关，G2 已决）。

**场景 F — 范围一刀五敌**  
Cap=3 时只计 3 个 Grant；Cap=5 的 Track 可计满 5 个。预期：范围 Track **清怪与攒能协同**，但不出现「无 Cap 按人头」的爆炸。

**场景 G — 同曲不同加点**  
同一 Track、**Allocation Point Cap**=10：分配 7 范围 / 3 Cap vs 3 / 7。预期：一刀覆盖 vs 攒能速度 **可感知权衡**。

**场景 B — 换武器同关（或换 Track 的对比关）**  
同一 **Stage**、同一 **Track**：武器 A（攻速向模组）vs 武器 B（范围 + Cap 向模组）。预期：**机制与大招形态** 不同，**BGM 与拍子不变**。若对比不同 Track，应通过 **两次 Run** 而非 Run 内切歌。

**场景 C — 窗口边缘**  
输入落在 Window 边界外 1 帧。预期：判定一致、可学习；无「随机暴击」感。

**场景 D — 延迟**  
蓝牙音频延迟未校准。预期：需 **视觉/触觉主导 cue**；是否提供 offset 校准（待决）。

---

## 5. 子系统框架

### 5.1 战斗（Combat）

| 模块 | 职责 | Demo 深度 |
|------|------|-----------|
| 移动 | 八向/自由移动，与割草密度匹配 | 必需 |
| 目标选取 | 最近威胁 / 朝向扇形 | 最近即可 |
| Basic / Beat-On | 共用 Template；Beat-On **2× 伤害** + **2× Grant** | 必需 |
| Minion | 不卡拍 2 击死 / 卡拍 1 击死（基准） | 必需 |
| Boss + Health Pool | 血条；Beat-On 2× 扣血 | Demo 建议 1 场 |
| Point Allocation | 范围/Cap 等轴 | 必需 |
| 受击与 i-frames | 避免节奏玩法变纯背板 | 简版 |

### 5.2 节奏（Rhythm）

| 模块 | 职责 | Demo 深度 |
|------|------|-----------|
| Beat Map 播放 | 与音频对齐的拍点序列 | 必需 |
| Judgment Window | 二元、**偏宽松**；每拍或指定拍型 | 必需 |
| 输入采样 | 攻击键时间戳 vs Window | 必需 |
| 反馈层 | 鼓点脉冲、UI；Beat-On 命中反馈（无 Perfect 档） | 必需 |
| 校准 | 全局 input/audio offset | 建议 |

### 5.3 曲目（Track / Loadout）

| 模块 | 职责 | Demo 深度 |
|------|------|-----------|
| Track 目录 | BPM、拍号、预览 | 2 首 |
| Allocation Template | 每曲轴、Base、**Allocation Point Cap** | 2 首各 1 模板 |
| Track Allocation Screen | 多按钮入口；随时改点 + Reset | 必需 |
| Point Allocation | Cap 内自由 x/y，不必分满 | 同 Screen |
| Ultimate Archetype | 每 Track 绑 1 原型 | 2 原型 |
| Loadout 锁定 | Track + 分配结果 | 必需 |

### 5.4 关卡与压力（Stage / Horde）

| 模块 | 职责 | Demo 深度 |
|------|------|-----------|
| 刷怪 | Minion 为主，密度上升 | 必需 |
| Boss | Health Pool | Demo 1 个 |
| 胜利条件 | 待 G4（如击败 Boss / 生存+Boss） | 待决 |
| 空间 | 单张可行走区域 | 必需 |

### 5.5 反馈（Juice）

- **节拍强化**必须比普通攻击 **更易读**（光效、震屏、音效层、伤害数字）。
- 音乐 **结构点**（Drop、副歌）可选绑定 **Wave 峰值** 或 **规则临时升级**（Demo 可不做）。

---

## 6. 曲目 × 机制耦合（设计框架）

**Allocation Template** 决定「这首歌能点什么」；**Point Allocation** 决定「这首点成什么样」。不同 Track 可用 **不同 Axis 组合**（不只范围/Cap，后续可加攻速、Ult 伤害等）。

| 音乐特征 | 玩法映射示例 |
|----------|----------------|
| 高 BPM | Template 含攻速轴；Beat Map 开窗更密 |
| 慢拍重击 | Template 偏范围/Cap Base；Archetype 偏爆发 AOE |
| 切分 | Beat Map 弱拍 Window；Template 可含 Window 宽容轴（扩展） |

**Ultimate Archetype 池（初始）**：**爆发 AOE**（清场）、**定向突进**（直线/锁定冲锋）。

Demo 建议：

| Track | Template 示例 | Archetype |
|-------|----------------|-----------|
| 快歌 | Cap 10；轴：**攻速** + **Cap** | 定向突进 |
| 范围曲 | Cap 10；轴：**攻击范围** + **Cap** | 爆发 AOE |

**Track 内容卡模板**：

```text
Track ID:
拍号 / BPM:
Allocation Template:
  Axes: （攻击范围 | Energy Hit Cap | …）
  Base per axis:
  Allocation Point Cap: （如 10；多轴共享、不够全部拉满）
Point Allocation 示例: （x 范围, y Cap；可 sum < Cap）
Energy Hit Cap 结算: Base(Cap) + y
攻击范围结算: Base(范围) + x
Judgment Window: （相对宽松；二元，无 Perfect/Good）
Ultimate Archetype + 固定参数:
玩家可复述: （换曲 vs 同曲换 x/y）
```

---

## 7. Demo 切片（MVP）

### 7.1 像素原型（Attack Module v0）

与 **Track** 解耦的 **基础武器模组**（Demo 以 1/2/3 模板实现，对应三把武器），先用固定规格跑通「拍子 2× + 蓄大 + 清屏结束」；后续再挂 **Allocation Template** / 多 **Track**。

| 元素 | 规格 |
|------|------|
| **主角** | **1 格** 绿色像素；**HP=10**；默认攻击范围 **周围 2 格** |
| **接触伤害** | 怪物像素与主角像素重叠时，每 **0.5s** 最多 **-1 HP** |
| **音乐** | 任意 **Track**（Demo 可调 BPM / 可选音频）；**Beat-On 2× 伤害** + **2× Grant** 与 canon 一致 |
| **Minion ×10** | 各 **2×2 = 4 格** 黄色像素；**Basic 2 击 / Beat-On 1 击** |
| **Boss ×1** | **3×3 = 9 格** 橙色像素；**Health Pool = 12** |
| **Run 结束** | **主角 HP=0** → 失败；**怪物死光** → 胜利（画面暂停，**R** 重开，非崩溃） |

实现入口：`web/`（React + Vite + PixiJS）。Pygame 像素原型已迁至 `music-musou-pygame`。

### 7.2 后续 MVP（内容向）

**目标**：验证 §4.4 场景 A/B 的「好玩差异」，而非完整产品。

| 包含 | 不包含 |
|------|--------|
| 1 Stage、持续 Horde | 多 Stage、装备、Roguelike meta |
| 2 Tracks + 各 1 Template + 2 Archetype | 实时 BPM 分析、多 Stage |
| 拍点 UI + **BGM 循环**（`demo/assets/demo_loop.wav`） | 在线排行、DLC |
| Point Allocation + Reset（Cap 10 双轴 Demo） | 完整 Cap 成长、星元 meta |

**成功标准（Playtest）**：

1. 试玩者能 **用一句话说明两首歌打法不同**。
2. 对 **Minion** 能感知 **卡拍一刀 / 不卡两刀**。
3. 乱按仍能推进，但 **Boss 战或清怪** 明显更拖。
4. 同一 Track 改 x/y 后范围 vs Cap **可感知**。

---

## 8. 待决项（Grill 队列）

按依赖顺序排列；**#1 未决则伤害模型与场景 A 无法定稿**。

| ID | 状态 | 问题 | 影响面 |
|----|------|------|--------|
| G1 | **已决** | Window 外 = Basic Attack（Template+Modifier），无惩罚 | 场景 A |
| G2 | **已决** | **二元判定**；Window **偏宽松**；Grant 仅 Beat-On 2× / Basic 1× | 节奏 UX |
| G3a | **已决** | 仅 **Combat Hit** 充能；Basic Hit 基准，Beat-On Hit **2×** | 节奏 + 走位 |
| G3c | **已决** | 按受击单位 Grant，`min(受击数, Energy Hit Cap)`；Track 可提高 Cap | 范围 build |
| G3b | **已决** | Ultimate Archetype 混合；**Allocation Template** + **Point Allocation** | 内容 |
| G8 | **已决** | **1 Track : 1 Allocation Template**；Cap 内自由 x/y | 结构 |
| G11 | **已决** | **Allocation Point Cap** 上限；**不必分满**；**Allocation Reset** | UI |
| G9 | **已决** | **随时** 可进 **Track Allocation Screen** 改点（多 UI 入口） | UX |
| G10 | 待决 | Demo：最小 Screen（双轴+Reset）是否足够 | 范围 |
| G12 | **已决** | Minion：Basic **2 击** / Beat-On **1 击**；Boss **Health Pool**；Beat-On **2× 伤害**（与 Grant 一致） | 战斗意义 |
| G4 | **已决** | **怪物死光** = 胜；**主角死亡** = 败（像素 Demo §7.1） | Stage |
| G5 | 待决 | PC 键鼠优先还是手柄？ | Window 宽度 |
| G6 | **已决（Demo0）** | 像素原型：`demo/prototype.py` + Pygame | 实现 |
| G7 | 待决 | 非攻击动作是否进 Window 充能？ | 复杂度 |

---

## 9. 风险与约束

- **输入/音频延迟**：独立游戏常见；需视觉主导 + 可选 offset。
- **版权**：商用曲库需授权；Demo 宜自制或免版税。
- **范围**：Beat Map 手工制作成本随曲库线性增长；v0 禁止自动检测依赖。

---

## 10. 与 CONTEXT / ADR 的协作

- 术语新增或改义 → 更新 `CONTEXT.md`（表格式词表，保持简短）。
- 重要取舍 → `docs/adr/` 新增一篇，格式同现有（见 `docs/adr/README.md`）。

---

## 11. H5 Demo 内容大纲（对话对齐 · 非介绍）

> 本节 = **内容骨架**。已实装数字标「现」；目标态标「目标」；未决标「？」。

### 11.1 顶端进度条（Beat Timeline）

- **职责**：战斗顶栏显示未来拍点窗口；游标过半后钉住，条左移。
- **现 · 窗**：`BEAT_TIMELINE_WINDOW_MS = 8000`
- **现 · 判定宽**：`BEAT_WINDOW_MS = 300`（半宽 ±150ms 金环）
- **现 · 银环预警**：`BEAT_SILVER_PRE_MS = 120`（仅提示）
- **现 · 补拍**：原分析拍 + 脉冲 `670–1000ms`，去重 `120ms`
- **现 · 色**：仅武士显示绿 / 黄 / 粉（light / mid / heavy）
- **目标 · 占位模型**：
  - 开局 **全绿占满**所有拍点（= 绿技能族默认：强化普攻）
  - **解锁新技能** → 对应比例/规则的拍点 **改色**（不是新增空档拍）
  - 拍点可密、可叠；不依赖「普攻与拍点之间的空隙」
  - **潜伏档**由 **音调 + 音色混合** 预烘焙（4 档）；解锁后按档改色显示
- **已决（D1）**：**4 档**；分级方式 = **音色 + 音调混合**（非纯随机占比）
- **？**：四档正式名与色；音调维 / 音色维如何合成一档；解锁改色顺序

### 11.2 节拍技能分色（4 档 · 音调+音色 · 目标）

| 档序 | 色（暂名） | 潜伏依据（草案） | 现武士映射 |
|------|------------|------------------|------------|
| 0 | 绿（默认显示） | 全槽起步；解锁前一律显示绿 | 强化普攻 / 可替换绿技能 |
| 1 | ？ | 音调×音色合成档 A | （现 light 可迁入） |
| 2 | ？ | 音调×音色合成档 B | （现 mid 剑气可迁入） |
| 3 | ？ | 音调×音色合成档 C | （现 heavy 飞剑可迁入） |

**已决**
- 档数：**4**
- 分级：**音色 + 音调混合**（预烘焙潜伏标签；开局全绿，解锁改色揭示）

**现武士数值（卡拍触发 · 过渡三色，待迁入 4 档）**

| 档 | 效果 | 常量 |
|----|------|------|
| 绿 light | 攻击半径 ×1.7；刀光星屑 | `SAMURAI_SKILL_LIGHT_RANGE_MULT=1.7` |
| 黄 mid | 自动索敌；身上发 3 段蓝半月剑气；命中即消+消散特效 | 程 40 / 宽 **10/3** / 伤 2 / 速 36 / 间隔 70ms |
| 粉 heavy | 叠环绕飞剑 | 半径 5 / 持续 8s / 飞剑伤 2；受击最多耗 1 把挡 1 点 |
| 怒气大招 | 寻敌矮龙卷（半径=剑气半宽）；撞敌驻留 3s | 冲击 5；之后每秒 3 |

**现分配（待废）**：确定性混色 ≈50% 绿 / 32% 黄 / 18% 粉 —— **与「全绿起步 + 音频潜伏档」冲突**。

### 11.3 三角色资料表

| ID | 名 | 攻速 | 冲刺 | 攻击范围 | 被动（现） | 大招（现） |
|----|----|------|------|----------|------------|------------|
| 1 | 铁铠武士 | **8** | 15 | 15 | 飞剑挡伤（每把挡 1 点，每次受击最多 1 把）；冲刺按 15 点 | **无**（不充能） |
| 2 | 青衫枪客 | 14 | 10 | 15 | 小扇扫；卡拍扇面 45°→90° | 游龙：7 次突刺，+1 伤 +1 攻速，不计充能 |
| 3 | 灵耳弓使 | 14 | 10 | 40 | 卡拍爆裂箭 AOE | 分身：1 HP、1 伤、无爆裂 |

- **模板基准** `STAT_TEMPLATE`：攻速/冲刺/范围 = 10/10/10
- **共用**：HP 上限 5；普攻伤 1 / 卡拍伤 3；接触伤 1
- **目标**：绿技能可替换；黄/粉等靠解锁改色；武士无主动大招已决
- **？**：枪客/弓使是否共用「全绿起步→解锁改色」；各自第 2～5 技能清单

### 11.4 三种怪物设计

| 种 | 名 | HP（现） | 体半径 | 定位 | 攻击要点（现） |
|----|----|----------|--------|------|----------------|
| minion | 杂兵 | **3** | 0.6 | 海量压力 | 仅突刺；发动距 2.4；前摇 580 / 打击 150 / CD 1100；伤 1 |
| boss | 尸王 | **72**（×2 后） | 1.17 | 院落锚点 | 近突刺（伤 2）或远砸+弹幕（程 10.5，7 发散） |
| megaboss | 王中王 | **144**（×2 后） | 1.575 | 终局 | 更远环/更重弹幕；击退倍率更高 |

**刷怪（现波次）**

- 第 1 波：四院 **同出**（4 尸王 + 院落杂兵合计）
- 第 2 波（关卡 2）：中央决战（1 王中王 + 2 尸王 + 外圈杂兵）
- 关卡 1：仅院落波（无王中王）

**旧大纲冲突**：§7.1「Minion HP=2、Basic 两刀」与现 `MINION_HP=3` / 卡拍伤 3 **不一致** → 待 Grill 统一。

### 11.5 节拍相关变量与数值（速查）

| 变量 | 现 | 备注 |
|------|----|------|
| `BEAT_TIMELINE_WINDOW_MS` | 8000 | 顶栏窗 |
| `BEAT_WINDOW_MS` | 300 | 金环全宽 |
| `BEAT_SILVER_PRE_MS` | 120 | 银环 |
| `BEAT_RING_WINDOW_MS` | 4000 | 圆环窗（若启用） |
| `PULSE_PERIOD_MIN/MAX_MS` | 670 / 1000 | 补拍周期 |
| `PULSE_DEDUP_MS` | 120 | 补拍去重 |
| `TRACK_BPM_SCALE` | 1 | 音画 1:1 |
| 默认音频延迟 | 60ms | `DEFAULT_AUDIO_LATENCY_MS` |
| 卡拍伤 / 普攻伤 | 3 / 1 | |
| 大招充能次数 | 10 | 武士不充能 |

### 11.6 本 Demo Grill 缺口（从对话抽出）

| ID | 状态 | 问题 |
|----|------|------|
| D1 | **已决** | **4 档**；**音色 + 音调混合** |
| D2 | 待决 | 四档如何由音调维×音色维合成；正式色名 |
| D3 | 待决 | 绿技能「可替换」的替换池：武士首发有哪些绿技能 |
| D4 | 待决 | 枪客 / 弓使是否同一套色槽模型 |
| D5 | 待决 | Minion TTK：跟旧「2/1」还是跟现 HP3+伤1/3 |
| D6 | 目标未实装 | 全绿起步 + 解锁改色（替换现混色分配） |
| D7 | 待决 | 解锁顺序：先揭示哪一潜伏档 |
---

## 修订记录

| 日期 | 变更 |
|------|------|
| 2026-07-30 | 初稿：大纲 + 领域框架 + Grill 队列 |
| 2026-07-30 | G4 + §7.1 像素 Prototype Template |
| 2026-07-30 | G3b：Ultimate Archetype 混合；Track Module Kit；星元与 Preference Allocation |
| 2026-08-07 | Hero 模板 → 武器模组；单角色一条命 + 多武器切换 + 广告复活（ADR 0011） |
| 2026-09-09 | §11 H5 Demo 内容大纲：顶栏分色、三角色、三怪、节拍数值、全绿起步目标 |
| 2026-09-09 | D1 已决：4 档；音色+音调混合潜伏标签 |
