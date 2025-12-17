# 快速入门指南: TV SnapMaster

**功能**: TV SnapMaster Chrome 插件
**分支**: `001-tv-snapmaster`
**日期**: 2025-12-17

## 前置条件

- **Google Chrome** v88+（支持 Manifest V3）
- **Node.js** v18+（用于开发工具，可选）
- **Git**（用于版本控制）

## 项目设置

### 1. 克隆仓库

```bash
git clone <仓库地址>
cd tv_plus
git checkout 001-tv-snapmaster
```

### 2. 创建源码结构

```bash
mkdir -p src/{background,content,popup,shared,icons}
mkdir -p tests/{unit,manual}
```

### 3. 创建 manifest.json

创建 `src/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "TV SnapMaster",
  "version": "1.0.0",
  "description": "快速截取 TradingView 图表截图，一键切换任意时间周期",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png"
    },
    "default_title": "TV SnapMaster"
  },
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": [
        "*://www.tradingview.com/chart/*",
        "*://*.tradingview.com/chart/*"
      ],
      "js": [
        "shared/constants.js",
        "content/tradingview.js",
        "content/content.js"
      ],
      "run_at": "document_idle"
    }
  ],
  "permissions": [
    "activeTab",
    "downloads"
  ],
  "host_permissions": [
    "*://www.tradingview.com/*",
    "*://*.tradingview.com/*"
  ]
}
```

## 开发工作流程

### 在 Chrome 中加载插件

1. 打开 Chrome，导航到 `chrome://extensions/`
2. 启用右上角的**开发者模式**
3. 点击**加载已解压的扩展程序**
4. 选择 `src/` 目录
5. 插件图标应该出现在工具栏中

### 修改后重新加载

- **代码修改**: 在 `chrome://extensions/` 点击插件卡片上的刷新图标
- **manifest.json 修改**: 需要移除并重新添加插件
- **Service Worker 修改**: 点击 "Service worker" 链接检查，然后重新加载

### 查看控制台日志

| 组件 | 位置 |
|------|------|
| Popup | 右键点击弹窗 → "检查" |
| Content Script | 在 TradingView 页面按 F12 → 控制台 |
| Service Worker | `chrome://extensions/` → "Service worker" 链接 |

## 文件结构

```
src/
├── manifest.json           # 插件配置文件
├── background/
│   └── service-worker.js   # 截图与下载逻辑
├── content/
│   ├── content.js          # 主内容脚本
│   └── tradingview.js      # TradingView DOM 工具函数
├── popup/
│   ├── popup.html          # UI 结构
│   ├── popup.js            # UI 逻辑
│   └── popup.css           # 样式（深色/浅色主题）
├── shared/
│   └── constants.js        # 共享常量与类型
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 关键实现要点

### 1. Service Worker (background/service-worker.js)

负责处理:
- `chrome.tabs.captureVisibleTab()` 截图功能
- `chrome.downloads.download()` 文件保存
- 组件间消息路由

```javascript
// 示例：处理截图请求
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_TAB') {
    captureAndDownload(message.payload)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error }));
    return true; // 保持消息通道开启用于异步响应
  }
});
```

### 2. Content Script (content/content.js)

负责处理:
- 从 TradingView DOM 提取品种名称
- 周期切换（按钮点击或键盘输入）
- 加载检测
- 弹窗对话框关闭
- 主题检测

```javascript
// 示例：页面加载时初始化
initializePopupDismissal();
monitorThemeChanges();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'CAPTURE':
      handleCaptureRequest(message.payload, sendResponse);
      return true;
    case 'GET_PAGE_INFO':
      sendResponse(getPageInfo());
      return false;
    case 'GET_THEME':
      sendResponse({ theme: detectTheme() });
      return false;
  }
});
```

### 3. Popup (popup/popup.js)

负责处理:
- 周期按钮点击
- 状态显示
- 主题适配

```javascript
// 示例：处理周期按钮点击
document.querySelectorAll('.interval-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const interval = btn.dataset.interval;
    sendCaptureRequest(interval);
  });
});
```

## 测试

### 手动测试清单

1. **基本截图**
   - [ ] 打开 TradingView 图表页面
   - [ ] 点击插件图标
   - [ ] 点击 "4h" 按钮
   - [ ] 验证截图以正确的文件名下载

2. **同周期跳过切换**
   - [ ] 手动将图表设置为 1D
   - [ ] 点击 "1D" 按钮
   - [ ] 验证截图直接完成，无需切换周期

3. **主题适配**
   - [ ] 在 TradingView 深色模式下测试
   - [ ] 在 TradingView 浅色模式下测试
   - [ ] 验证弹窗主题匹配

4. **错误处理**
   - [ ] 在非 TradingView 页面测试
   - [ ] 在慢速网络下测试（DevTools 中节流）

### 单元测试（可选）

```bash
# 安装 Jest
npm init -y
npm install --save-dev jest

# 运行测试
npm test
```

## 常见问题与解决方案

### "Service worker 注册失败"

- 确保 `service-worker.js` 没有语法错误
- 检查控制台获取具体错误信息
- 验证 manifest.json 中的文件路径正确

### "无法访问 chrome:// URL"

- 插件无法在 Chrome 内部页面运行
- 仅在 `https://www.tradingview.com/chart/*` 上测试

### "Content script 未注入"

- 验证 manifest.json 中的 URL 模式匹配
- 确认 TradingView 页面已完全加载
- 在 TradingView 页面控制台查看错误

### "captureVisibleTab 返回 undefined"

- 确保 manifest 中有 `activeTab` 权限
- 截图时标签页必须处于焦点状态
- 检查 service worker 控制台的错误

## 调试技巧

1. **大量使用 `console.log`** - 每个组件都有自己的控制台
2. **检查消息传递** - 在发送方和接收方都记录消息
3. **检查 DOM** - 使用 DevTools 在 TradingView 上查找正确的选择器
4. **增量测试** - 验证每个步骤后再进行下一步

## 后续步骤

基本设置工作后:

1. 实现带备选的健壮品种提取
2. 添加使用 MutationObserver 的加载检测
3. 实现弹窗对话框关闭
4. 添加弹窗中的状态 UI 反馈
5. 完善主题检测和弹窗样式

## 资源

- [Chrome Extension Manifest V3 文档](https://developer.chrome.com/docs/extensions/mv3/)
- [chrome.tabs API](https://developer.chrome.com/docs/extensions/reference/tabs/)
- [chrome.downloads API](https://developer.chrome.com/docs/extensions/reference/downloads/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Service Workers](https://developer.chrome.com/docs/extensions/mv3/service_workers/)

---

**文档版本**: 1.0
**最后更新**: 2025-12-17
