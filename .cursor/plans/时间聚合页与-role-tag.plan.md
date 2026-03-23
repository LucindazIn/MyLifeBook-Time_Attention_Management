---
name: 时间聚合页与 Role Tag
overview: 将「统计/总结」从设置拆出为独立「时间聚合」页并预留共创区；在时间聚合中拆解指标并按身份统计能量消耗；为日程增加 Role（角色）维度及日历筛选/高亮。
todos: []
isProject: false
---

# 时间聚合页与 Role Tag 推进方案

## 一、需求 1：Collection of Moment / 时间聚合

### 1.1 目标

- 将 Stats & Summary 从 SettingsModal 中移出，作为独立「时间聚合」页展示。
- 导航栏在「设置」与「搜索」之间增加入口按钮，点击进入该页。
- 页面采用栅格/卡片布局：左侧（或上方）固定「当前统计数据」卡片，右侧预留「即将推出的共创功能区」占位，为后续「user's life books 共创」预留接口。

### 1.2 指标拆解与各身份能量消耗（新增）

在 Collection of Moment 中**不只统计时间**，需将 **metrics 拆解**，并增加**按身份（Role）的能量消耗**统计：

- **指标拆解**
  - 将现有「概览」拆成可独立展示的模块（如：本周事件数、本周已完成、有记录天数、标签排行、近期完成列表等），每个模块可作为单独卡片，便于与「按身份」维度组合。
  - 支持「总览」与「按身份拆解」两种视角：总览 = 当前 StatsSummaryView 的聚合数据；按身份 = 上述同一批指标按 Role 维度分组展示。

- **各身份的能量消耗**
  - 在时间聚合页中增加「各身份能量消耗」区块：
    - 数据来源：依赖事件上的 `role` 字段（与需求 2 Role Tag 一致）。能量消耗可先采用**事件数量**或**事件总时长（start–end）**作为代理指标；若后续有每日 DayVibes 的 energy/mood/focus，可再扩展为「某身份下参与的天数 × 当日能量」等聚合。
  - 展示形式：按 Role 列表（预设 + 用户自定义过的 role）展示每个身份的本周/本月事件数（或总时长），可用条形图、进度条或数字卡片，并搭配该 Role 的色系（与 Role Tag 预设颜色一致）。
  - 与「时间统计」并列：左栏或上半部分为「时间维度统计」（总览 + 可选的按身份拆解），右栏或下半部分为「各身份能量消耗」卡片；或同一栅格内「时间统计」卡片与「身份能量」卡片并排。

- **实现要点**
  - CollectionView 需接收 `events`（含 `role`）、`dayTags`、`completedInstances`、`language`，以及**预设 Role 列表**（用于取颜色与名称）。
  - 将 StatsSummaryView 内容拆成可复用子组件（如 OverviewCards、CompletionBar、TagRanking、RecentCompletions），再在 CollectionView 中组合；并新增 ByRoleEnergyCard（或类似）组件，按 `event.role` 聚合后渲染。
  - 指标拆解后，总览与「按身份」可共用同一套子组件，仅传入「全部事件」或「某 role 过滤后的事件」即可。

### 1.3 实现要点（入口与布局）

**入口与路由/状态**

- 在 App.tsx 的 header 中，在 Settings 与 Search 之间增加一个图标按钮，点击后进入「时间聚合」视图。
- 采用视图模式扩展：`viewMode === 'collection'`，主内容区切换为 CollectionView。

**页面布局（栅格/卡片）**

- 新建 `src/components/CollectionView.tsx`。
- 布局：桌面端两列栅格。左列：当前统计数据（总览 + 按身份拆解可选）+ 各身份能量消耗卡片。右列：占位「即将推出的共创功能区」。移动端单列，统计在上，共创占位在下。
- 从 SettingsModal 中移除 Stats/Summary 整块，CollectionView 接收 events、dayTags、completedInstances、language、roles 等。

**预留接口**

- 共创功能区预留插槽或占位组件，便于后续接入「user's life books」等。

### 1.4 涉及文件

| 文件 | 变更 |
|------|------|
| App.tsx | 增加 collection 入口；viewMode 含 'collection'；主内容区渲染 CollectionView；传入 events/dayTags/completedInstances/language/roles。 |
| CollectionView.tsx | 新建。栅格布局；统计卡片（可拆解为总览+按身份）；各身份能量消耗卡片；共创占位。 |
| StatsSummaryView.tsx | 可拆为子组件（OverviewCards、CompletionBar、TagRanking、RecentCompletions），供 CollectionView 与 ByRole 复用。 |
| SettingsModal.tsx | 移除 Stats/Summary section 及对 StatsSummaryView 的引用。 |

---

## 二、需求 2：Role Tag 功能

### 2.1 数据模型

- ScheduleEvent 增加 `role?: string`（单 Role，与 tags/label 并存）。
- 预设 Role 列表：id、nameZh、nameEn、description、color；色系：创作者暖色、学者冷色、执行者中性等。

### 2.2 创建/编辑入口

- AddEventModal 增加 Role 单选（预设 + 自定义），展示 description，写入 event.role；持久化与导出兼容。

### 2.3 日历视图：按 Role 筛选与高亮/隐藏

- App 增加 selectedFilterRole、roleFilterMode；视图接收并实现高亮/dim/隐藏及角色色展示。

### 2.4 涉及文件

- types.ts、lib/constants/roles.ts、AddEventModal、App、CalendarView、YearView、Timeline、eventsRepo、exportRepo。

---

## 三、推进顺序建议

1. **需求 2 数据与表单**：类型 + 预设 Role + AddEventModal 选 Role，持久化。这样 Collection 的「各身份能量消耗」才有 event.role 可用。
2. **需求 1 时间聚合页**：入口 + CollectionView + 统计卡片（含指标拆解）+ **各身份能量消耗**卡片 + 共创占位；从设置移除 Stats/Summary。
3. **需求 2 日历筛选**：selectedFilterRole + 各视图高亮/dim/隐藏。

这样 Collection 中的「按身份能量消耗」与「指标按身份拆解」能直接复用 Role 数据与预设色系。
