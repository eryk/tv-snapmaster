# Instructions

## constitution

这是一个 Chrome 浏览器插件项目，专注于 TradingView 网页的自动化操作。
1. **语言规范**：项目的所有文档（包括规格说明书、技术计划、任务列表）以及代码中的注释，**必须强制使用简体中文 (Simplified Chinese)** 撰写。
2. **技术规范**：必须严格遵守 Google Chrome Manifest V3 标准。
3. **代码风格**：使用原生 JavaScript (ES6+) 以保持插件轻量化，不引入庞大的框架（如 React/Vue），除非 UI 非常复杂。
4. **健壮性**：由于 TradingView 的 DOM 类名可能是动态生成的，选择器必须优先使用稳定的属性（如 `data-name`, `aria-label`, `title` 等），并包含重试机制。
5. **权限最小化**：只申请必要的权限（如 activeTab, downloads, scripting）。
6. **文件结构**：保持清晰的结构，区分 `popup`, `content_scripts`, `background`。

## specify

开发一个名为 "TV SnapMaster" 的 Chrome 插件。
用户场景：
1. 用户打开 TradingView 的图表页面（任意品种）。
2. 用户点击浏览器插件图标，弹出一个简洁的控制面板。
3. 面板上有一组预设的时间周期按钮（例如：15m, 1h, 4h, 1D, 1W）。
4. 用户点击某个周期按钮（例如 "4h"）：
    - 插件自动在当前页面查找并点击 TradingView 顶部工具栏对应的时间周期按钮。
    - 插件智能等待图表加载完成（检测 Loading 状态消失或等待固定缓冲时间）。
    - 插件自动截取当前可视区域（Capture Visible Tab）。
    - 图片自动下载保存，文件名格式为：`{品种名称}_{周期}_{时间戳}.png`。

非功能需求：
- 需要处理 TradingView 可能会弹出的“未保存更改”或其他干扰弹窗。
- 如果当前已经是目标周期，则直接截图。
- UI 需要适配 TradingView 的暗色模式。

## plan

技术实现方案：
1. **Manifest V3**：使用 `service_worker` (background.js) 处理截图 API (`chrome.tabs.captureVisibleTab`) 和下载 API (`chrome.downloads`)。
2. **Content Script**：
    - 负责 DOM 操作：解析页面获取当前品种名称（从左上角 ticker info 获取）。
    - 负责模拟点击：找到顶部的时间周期菜单。注意：如果周期被折叠在下拉菜单中，需要先模拟点击下拉菜单。
    - 负责通信：通过 `chrome.runtime.sendMessage` 通知 Background 脚本进行截图。
3. **通信流程**：
    Popup (用户点击) -> Content Script (切换周期 -> 等待 -> 发送"准备好"信号) -> Background (截图 -> 下载) -> Popup (显示完成状态)。
4. **截图策略**：由于 TradingView 主要使用 Canvas，直接 HTML2Canvas 可能效果不好，必须使用 Chrome 原生的 `captureVisibleTab` 接口以获得高质量截图。
