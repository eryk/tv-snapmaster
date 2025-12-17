# 实现计划: TV SnapMaster

**分支**: `001-tv-snapmaster` | **日期**: 2025-12-17 | **规格**: [spec.md](./spec.md)
**输入**: 功能规格来自 `/specs/001-tv-snapmaster/spec.md`

## 概述

TV SnapMaster 是一个 Chrome 浏览器插件，使交易者能够快速截取指定时间周期的 TradingView 图表截图。插件采用 Chrome Manifest V3 架构，使用 Service Worker 处理截图功能，Content Script 负责 TradingView 页面的 DOM 操作，以及 Popup UI 进行用户交互。核心功能包括一键切换周期、自动检测图表加载完成、以及智能生成包含品种/周期/时间戳的文件名。

## 技术上下文

**语言/版本**: JavaScript ES2020+ (Chrome Extension Manifest V3)
**主要依赖**: Chrome Extension APIs (tabs, downloads, storage, scripting)
**存储**: chrome.storage.local（用于用户偏好设置，如需要）
**测试**: Chrome DevTools 手动测试，Jest 单元测试（可选）
**目标平台**: Chrome 浏览器 (支持 Manifest V3，Chrome 88+)
**项目类型**: 浏览器插件 (popup + background service worker + content script)
**性能目标**: 截图完成时间：同周期 < 5秒，切换周期 < 15秒
**约束**: 必须在 Chrome 插件安全模型内运行，无外部服务器依赖
**规模范围**: 单用户本地插件，无后端基础设施

## 宪法检查

*关卡: 必须在 Phase 0 研究前通过。Phase 1 设计后重新检查。*

已加载宪法文件 (`.specify/memory/constitution.md`)，检查结果:
- [x] 语言规范: 所有文档使用简体中文
- [x] 技术规范: 使用 Manifest V3，service worker
- [x] 代码风格: 原生 JavaScript ES6+，无框架
- [x] 健壮性: DOM 选择器使用稳定属性，包含重试机制
- [x] 权限最小化: 仅申请 activeTab, downloads
- [x] 文件结构: 清晰区分 popup/content/background

## 项目结构

### 文档 (本功能)

```text
specs/001-tv-snapmaster/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出 - TradingView DOM 研究
├── data-model.md        # Phase 1 输出 - 插件数据结构
├── quickstart.md        # Phase 1 输出 - 开发环境搭建指南
├── contracts/           # Phase 1 输出 - 消息传递接口
└── tasks.md             # Phase 2 输出 (由 /speckit.tasks 创建)
```

### 源代码 (仓库根目录)

```text
src/
├── manifest.json            # Chrome 插件配置文件 (V3)
├── background/
│   └── service-worker.js    # 截图与下载逻辑
├── content/
│   ├── content.js           # TradingView DOM 操作主脚本
│   └── tradingview.js       # TradingView 专用选择器与工具
├── popup/
│   ├── popup.html           # 插件弹窗 UI 结构
│   ├── popup.js             # 弹窗交互逻辑
│   └── popup.css            # 弹窗样式 (深色/浅色主题)
├── shared/
│   ├── constants.js         # 周期定义、选择器常量
│   └── utils.js             # 工具函数
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png

tests/
├── unit/
│   ├── filename-generator.test.js
│   └── symbol-parser.test.js
└── manual/
    └── test-scenarios.md
```

**结构决策**: 采用标准 Chrome Manifest V3 浏览器插件结构。职责分离：background（特权 API）、content（DOM 访问）、popup（UI）、shared（共享工具）。

## 复杂度追踪

无宪法违规 - 架构最小化，遵循标准模式。

## 架构概览

### 通信流程

```
┌──────────────┐     点击      ┌──────────────┐
│    Popup     │ ─────────────> │   Content    │
│  (popup.js)  │                │  Script (CS) │
└──────┬───────┘                └──────┬───────┘
       │                               │
       │  chrome.tabs.sendMessage      │ 1. 切换周期
       │                               │ 2. 等待加载
       │                               │ 3. 关闭弹窗
       │                               │
       │                        ┌──────▼───────┐
       │  状态更新              │  TradingView │
       │<─────────────────────  │     DOM      │
       │                        └──────────────┘
       │                               │
       │                               │ "准备就绪" 信号
       │                               │
       │                        ┌──────▼───────┐
       └──────────────────────> │   Service    │
         chrome.runtime         │   Worker     │
         .sendMessage           │ (background) │
                                └──────┬───────┘
                                       │
                                       │ captureVisibleTab()
                                       │ downloads.download()
                                       │
                                ┌──────▼───────┐
                                │    截图      │
                                │   (PNG)      │
                                └──────────────┘
```

### 关键技术决策

1. **Manifest V3**: 新 Chrome 插件的强制要求。使用 Service Worker 替代持久后台页面。

2. **captureVisibleTab API**: Chrome 原生截图 API，能够准确截取 Canvas 元素（TradingView 图表使用 Canvas 渲染）。

3. **Content Script 注入**: 在 TradingView 页面上下文中运行，负责：
   - 从 DOM 读取当前品种
   - 读取当前周期
   - 点击周期按钮
   - 检测加载状态
   - 关闭弹出对话框

4. **消息传递**: 标准 Chrome 插件消息机制，连接 popup ↔ content script ↔ service worker。

5. **主题检测**: Content Script 读取 TradingView 的主题类名，发送给 popup 用于样式适配。

### DOM 选择器策略 (遵循宪法)

根据项目宪法第 4 条，选择器优先级如下：

```javascript
// 品种名称选择器 - 按优先级排列
const SYMBOL_SELECTORS = [
  '[data-name="legend-source-title"]',      // data-* 属性 (最稳定)
  '[aria-label*="symbol"]',                  // aria-* 属性
  '[title*="symbol"]',                       // title 属性
  '.chart-widget .symbol-info',              // 语义化类名
];

// 周期按钮选择器 - 按优先级排列
const INTERVAL_SELECTORS = [
  '[data-name="time-interval-menu"]',        // data-* 属性
  '[aria-label*="时间周期"]',                 // aria-* 属性
  'button[title*="interval"]',               // title 属性
];
```

### 重试机制 (遵循宪法)

```javascript
/**
 * 使用多策略和重试机制查找元素
 * @param {string[]} selectors - 选择器优先级列表
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Element|null>}
 */
async function findElementWithRetry(selectors, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && isVisible(element)) {
        console.log(`[TV SnapMaster] 找到元素: ${selector}`);
        return element;
      }
    }
    console.log(`[TV SnapMaster] 重试 ${attempt + 1}/${maxRetries}...`);
    await sleep(500);
  }
  console.error('[TV SnapMaster] 元素未找到:', selectors);
  return null;
}
```
