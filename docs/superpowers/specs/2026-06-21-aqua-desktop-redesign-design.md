# Aqua Desktop — 个人主页重塑设计

**日期**: 2026-06-21
**分支**: `redesign/aqua-desktop`
**作者**: Zeyuan Zang + Claude

## 背景与动机

现有主页是一个 800px 居中的"纸张"单列（拟物 skeuomorphic，Linux Libertine 衬线体，iOS6 玻璃徽章，sepia 滤镜）。问题：**空间利用率低**——单窄列、纵向留白多，宽屏两侧全空。

目标：在保留 old-time Apple 拟物基因的前提下重塑布局，吃满横向空间，提升信息密度与趣味性。

## 核心理念

整页变成一块 **Mac OS X（Aqua 时代）桌面**。简历每个板块是一扇可拖拽的 Aqua 玻璃窗口，开局以精心编排的 bento 平铺铺满屏幕；顶部钉一条半透明菜单栏，底部浮一个反光 Dock。

## 范围内（In scope）

### 画布
- 全屏 **经典 Aqua 蓝渐变壁纸**，保留现有暗角 vignette。
- 可纵向滚动的桌面画布；菜单栏 `position: sticky/fixed` 顶部、Dock `fixed` 底部，始终可见。
- 窗口开局按预设坐标 bento 平铺，首屏即满、看起来有意编排；用户可拖拽重排。

### 窗口（每个 = 一个板块，共 7 扇）
1. About Me —— bio + 研究兴趣列表 + 个人小记（**不含头像**）
2. News —— 带日期标签的动态
3. Research & Publications —— 论文 + 课题
4. Research Experience —— 5 段实验室经历
5. Selected Projects —— DeepReader / HADAR / Digital Dude
6. Education —— BUPT / 东北育才
7. Tech Stack —— 技术徽章

每扇窗结构：
- **标题栏**：Aqua 细条纹 + 三枚红/黄/绿凝胶交通灯 + 窗口标题。
- **窗体**：沿用现有纸张/Linux Libertine 排版（内容样式直接复用 `style.css`）。

### 桌面外壳
- **菜单栏**（顶，半透明毛玻璃）：左侧  + `Zeyuan Zang` + 板块名（点击聚焦/滚动到对应窗口，并提供"Window"菜单重开已关闭窗口）；右侧**实时时钟**。
- **Dock**（底，反光凝胶）：联系方式做成 App 砖——Email / GitHub / Google Scholar / X / LinkedIn / kingz.space。**本期不含 CV 砖**。hover 用 CSS 放大 + tooltip 近似 Dock 磁化。

### 交互（纯 vanilla JS，无依赖，延续 no-build）
- **拖拽**：标题栏作把手，Pointer Events 拖动窗口，限制在画布内。
- **聚焦**：点击窗口抬升 z-index + 激活态标题栏；非激活窗标题栏淡化。
- **交通灯**：
  - 绿（zoom）：切换窗口放大/还原。
  - 黄（最小化）：缩进 Dock（或最小化区），可点回。
  - 红（关闭）：隐藏窗口，可从菜单栏 "Window" 菜单重新打开。**内容永不丢失**。
- **Dock 图标**：打开联系方式外链。
- **时钟**：菜单栏右侧每秒更新。

### 响应式
- ≤ 820px：禁用拖拽；窗口回流成**单列静态 Aqua 卡片**（保留标题栏装饰，交通灯失效）；Dock 变居中图标行（不放大）；菜单栏简化为姓名 + 时钟。所有内容线性可读。

## 范围外（Out of scope，本期不做）
- 头像 / 个人照片
- Dock 中的 CV/简历 PDF 砖
- Graphite 灰主题（仅 Aqua 蓝）
- 窗口位置持久化（localStorage 记忆布局）
- 真实"genie"最小化动画（用 CSS scale/opacity 近似即可）

## 技术结构
- 维持 no-build / vanilla JS，无打包器、无框架。
- 新增文件：
  - `css/desktop.css` —— Aqua 外壳、壁纸、菜单栏、Dock、窗口 chrome、响应式。
  - `js/desktop.js` —— 拖拽 / 聚焦 / zoom / 最小化 / 关闭 / 时钟 / 响应式守卫。
- 复用文件：`css/style.css` —— 作为窗体内的内容排版（精简旧 `.paper` 页面外壳相关规则）。
- 保留：Linux Libertine 字体、sepia 技术徽章、全部现有内容、访问统计 ping 脚本。

## 可访问性与降级
- 窗口为语义化 `<section>`，带 `aria-labelledby`。
- 菜单栏 / Dock 链接可键盘聚焦，有可见 focus 态。
- 拖拽与桌面行为仅为**渐进增强**：JS 关闭/失败时，窗口以普通文档流堆叠呈现，内容照常可读（不依赖 JS 渲染内容）。
- 交通灯按钮带 `aria-label`，关闭/最小化有可逆路径。

## 组件边界（便于独立实现与测试）
- **WindowManager**（js）：管理窗口集合、z-index 焦点栈、打开/关闭/最小化/zoom 状态。输入：DOM 中的 `.window` 节点；输出：更新它们的位置/层级/可见性。
- **DragController**（js）：给定一个窗口与其标题栏把手，处理指针拖拽与边界约束。依赖：WindowManager（聚焦）。
- **MenuBar / Dock**（html+css，少量 js）：静态结构 + 时钟更新 + 触发 WindowManager 动作。
- **Window chrome**（css）：纯样式，标题栏/交通灯/激活态。
- **Responsive guard**（js+css）：在断点下停用 DragController 并切换布局类。

## 验收标准
- 桌面在宽屏首屏铺满、无大片空白；7 扇窗内容完整且与现版一致。
- 窗口可拖拽、点击聚焦、交通灯三态可用且内容可恢复。
- 菜单栏时钟走动；Dock 链接正确跳转。
- ≤ 820px 降级为单列卡片，全部内容可读、无横向溢出。
- 禁用 JS 时内容仍可读。
- 视觉上 Aqua 风格成立（玻璃标题栏、凝胶交通灯、反光 Dock、蓝渐变壁纸），并与保留的纸张/Libertine 内容排版协调。
