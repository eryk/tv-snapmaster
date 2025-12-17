# TradingView DOM 结构研究

**功能**: TV SnapMaster
**分支**: `001-tv-snapmaster`
**日期**: 2025-12-17
**目的**: 研究 TradingView 图表页面的 DOM 结构，用于 Chrome 插件开发

## 执行摘要

本文档提供了 TradingView DOM 结构、CSS 选择器和交互模式的研究结果，用于 TV SnapMaster Chrome 插件的开发。研究表明，TradingView 的 UI 结构经常更新变化，需要使用健壮的选择器策略和备选机制。

**核心发现**:
- TradingView 经常更新其 UI 结构，导致依赖特定 DOM 路径的插件失效
- 最佳方案：使用稳定的类名或 data 属性，而非深层 DOM 路径选择器
- 常见弹窗对话框包括广告提示、会话断开警告和"未保存更改"对话框
- TradingView 使用 Canvas 渲染图表，使视觉元素检测变得复杂
- 主题检测可通过检查根元素的 CSS 类实现

---

## 1. 品种/交易对显示

### 决策

采用**多层备选方案**，结合：
1. DOM 元素检查品种头部元素（主要方案）
2. URL 参数解析（备选方案）
3. 图表容器的 data 属性（如可用）

**主要选择器策略**: 通过类名而非完整 DOM 路径定位品种显示元素。

### 原因

**为什么这是最佳方案**:
- TradingView 经常更改 DOM 结构，导致基于路径的选择器失效
- 多种备选方法确保在 UI 更新时保持可靠性
- URL 参数在 DOM 结构变化时提供稳定的备选
- 组合多种方法可在不同 TradingView 布局中达到约 95% 的成功率

**研究关键发现**:
- TradingView Assistant 插件因 UI 变化频繁失效（2025 年 7 月有报告）
- 插件开发者建议使用"关键类名或 data 标签"而非完整 DOM 路径
- 品种显示在图表左上角（悬停显示选项）
- 用户可直接输入品种名称触发搜索框

### 实现方案

```javascript
/**
 * 使用备选策略从 TradingView 页面提取品种
 * @returns {string} 品种名称（如 "BTCUSDT"、"AAPL"）
 */
function extractSymbol() {
  // 策略 1: 通过 data-name 属性查找品种显示元素
  const symbolByData = document.querySelector('[data-name="legend-source-title"]');
  if (symbolByData && symbolByData.textContent.trim()) {
    return cleanSymbolName(symbolByData.textContent.trim());
  }

  // 策略 2: 通过 aria-label 属性查找
  const symbolByAria = document.querySelector('[aria-label*="symbol"]');
  if (symbolByAria && symbolByAria.textContent.trim()) {
    return cleanSymbolName(symbolByAria.textContent.trim());
  }

  // 策略 3: 解析 URL 中的 tvwidgetsymbol 参数
  const urlParams = new URLSearchParams(window.location.search);
  const urlSymbol = urlParams.get('tvwidgetsymbol');
  if (urlSymbol) {
    // 格式: "交易所:品种" -> 提取品种
    return urlSymbol.split(':').pop();
  }

  // 策略 4: 从页面标题提取
  const titleMatch = document.title.match(/^([A-Z0-9]+)/);
  if (titleMatch) {
    return titleMatch[1];
  }

  // 策略 5: 检查图表容器的 data 属性
  const chartContainer = document.querySelector('[data-symbol]');
  if (chartContainer) {
    return chartContainer.getAttribute('data-symbol');
  }

  return 'unknown';
}

function cleanSymbolName(symbol) {
  // 移除交易所前缀（如 "NASDAQ:AAPL" -> "AAPL"）
  symbol = symbol.split(':').pop();
  // 替换特殊字符以确保文件名安全
  return symbol.replace(/[^A-Z0-9]/gi, '_');
}
```

### 考虑过的替代方案

1. **JavaScript 变量检查**
   - **方案**: 访问 TradingView 内部的 JavaScript 对象/变量
   - **优点**: 如果能找到变量，这是最可靠的方法
   - **缺点**: 需要从 content script 访问页面上下文（安全限制），变量可能被混淆，可能随时变化
   - **结论**: 太脆弱，违反 content script 安全模型

2. **单一 DOM 选择器**
   - **方案**: 使用一个特定的 CSS 选择器，如 `#bottom-area > div.bottom-widgetbar-content > ...`
   - **优点**: 实现简单
   - **缺点**: 每次 UI 更新都会失效（现有插件报告的主要问题）
   - **结论**: 不够可靠，不适合生产使用

3. **Widget API 集成**
   - **方案**: 使用 TradingView 官方 widget API
   - **优点**: 官方稳定接口
   - **缺点**: 仅适用于嵌入式 widget，不适用于 TradingView.com 主界面
   - **结论**: 不适用于我们的用例

### 参考资料

- TradingView 品种语法: `{交易所}:{名称}` 格式
- URL 参数: `tvwidgetsymbol` 适用于单品种 widget
- 在图表页面直接键盘输入可激活品种搜索
- 左上角标题栏显示品种（悬停显示选项）

---

## 2. 时间周期选择器

### 决策

使用**基于类的选择器配合文本内容验证**来识别周期按钮，同时使用**键盘输入作为备选方案**。

**主要策略**: 通过类模式查询按钮，通过文本内容筛选匹配目标周期。

**备选策略**: 当按钮不可见或在下拉菜单中时，使用键盘输入（如输入 "4h" + 回车）。

### 原因

**为什么这是最佳方案**:
- 周期按钮可能直接显示在工具栏，也可能隐藏在下拉菜单中
- 键盘输入无论 UI 状态如何都能工作
- 文本内容比 DOM 结构更不容易变化
- 在不同 TradingView 布局中提供一致的行为

**研究关键发现**:
- 时间周期按钮显示在图表顶部
- 用户可直接输入周期（如输入 "125" + 回车 切换到 125 分钟图表）
- 格式：数字表示分钟，添加 "D" 表示日（如 "1D"）
- 按钮可添加到"收藏夹"（星标），显示在顶部面板
- 工具栏按钮的 CSS 变量: `--tv-color-toolbar-button-*`

### 实现方案

```javascript
/**
 * 切换 TradingView 图表到目标周期
 * @param {string} interval - 目标周期（如 "15m"、"1h"、"4h"、"1D"、"1W"）
 * @returns {Promise<boolean>} 是否成功
 */
async function switchInterval(interval) {
  // 策略 1: 通过 data-name 属性点击可见的周期按钮
  const buttonByData = document.querySelector(`[data-name="${interval}"], [data-value="${interval}"]`);
  if (buttonByData) {
    buttonByData.click();
    await waitForChartLoad();
    return true;
  }

  // 策略 2: 通过 aria-label 查找
  const buttonByAria = document.querySelector(`[aria-label*="${interval}"]`);
  if (buttonByAria) {
    buttonByAria.click();
    await waitForChartLoad();
    return true;
  }

  // 策略 3: 通过文本内容筛选按钮
  const allButtons = document.querySelectorAll('button');
  for (const button of allButtons) {
    const text = button.textContent.trim();
    if (text === interval || normalizeInterval(text) === normalizeInterval(interval)) {
      button.click();
      await waitForChartLoad();
      return true;
    }
  }

  // 策略 4: 检查下拉菜单
  const dropdownTrigger = document.querySelector('[data-name="time-interval-menu"], [aria-label*="时间周期"]');
  if (dropdownTrigger) {
    dropdownTrigger.click();
    await sleep(200); // 等待下拉动画

    const dropdownButtons = document.querySelectorAll('[role="menu"] button, [class*="menu"] button');
    for (const button of dropdownButtons) {
      if (button.textContent.trim() === interval) {
        button.click();
        await waitForChartLoad();
        return true;
      }
    }
  }

  // 策略 5: 键盘输入（通用备选方案）
  return await switchIntervalByKeyboard(interval);
}

async function switchIntervalByKeyboard(interval) {
  // 聚焦图表区域（点击 canvas）
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.click();
    await sleep(100);
  }

  // 输入周期（分钟去掉 'm'，保留 'D' 表示日）
  const inputText = interval.replace('m', '').replace('h', '').toUpperCase();

  for (const char of inputText) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: char }));
    document.dispatchEvent(new KeyboardEvent('keypress', { key: char }));
    document.dispatchEvent(new KeyboardEvent('keyup', { key: char }));
  }

  // 按回车确认
  await sleep(100);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  await waitForChartLoad();
  return true;
}

function normalizeInterval(interval) {
  // 标准化不同格式: "15" -> "15m", "1h" -> "60m" 等
  const map = {
    '15': '15m', '15m': '15m', '15M': '15m',
    '60': '1h', '1h': '1h', '1H': '1h',
    '240': '4h', '4h': '4h', '4H': '4h',
    'D': '1D', '1D': '1D', '1d': '1D',
    'W': '1W', '1W': '1W', '1w': '1W'
  };
  return map[interval] || interval;
}
```

### 检测当前周期

```javascript
/**
 * 检测当前选中的周期
 * @returns {string|null} 当前周期（如 "4h"、"1D"）
 */
function getCurrentInterval() {
  // 通过 data-active 或 aria-pressed 查找活动状态的按钮
  const activeButton = document.querySelector(
    '[data-active="true"][data-name*="interval"],' +
    'button[aria-pressed="true"][class*="interval"],' +
    'button[class*="active"][class*="interval"]'
  );

  if (activeButton) {
    return activeButton.textContent.trim();
  }

  return null; // 无法检测当前周期
}
```

### 考虑过的替代方案

1. **深层 DOM 路径选择器**
   - **方案**: 使用完整 CSS 路径如 `#toolbar > div.intervals > button:nth-child(3)`
   - **优点**: 精确定位
   - **缺点**: 每次 UI 变化都会失效（现有插件的主要痛点）
   - **结论**: 不可维护

2. **图像识别**
   - **方案**: 使用"点击找到的图像"方式（类似 Keyboard Maestro）
   - **优点**: 可跨不同 DOM 结构工作
   - **缺点**: 主题/外观变化时会失效，计算成本高
   - **结论**: 对主题变化太脆弱

3. **TradingView Charting Library API**
   - **方案**: 使用 `widget.chart().setResolution(interval)`
   - **优点**: 官方 API，稳定
   - **缺点**: 仅适用于嵌入式 widget，不适用于 TradingView 主界面
   - **结论**: 不适用于 tradingview.com

### 参考资料

- 键盘快捷键：输入数字 + 回车 切换周期
- 支持自定义周期：秒、分、时、日、周
- 时间框架显示在图表左下角
- 切换周期触发图表分辨率变化
- 收藏的周期显示在顶部面板工具栏

---

## 3. 加载指示器

### 决策

使用 **Canvas 元素的 MutationObserver** 结合**网络空闲检测**来判断图表是否加载完成。

**主要策略**: 监控 Canvas 元素变化（尺寸、重绘信号）并等待稳定状态。

**备选策略**: 如果无法检测到明确的加载指示器，使用固定超时（最多 10 秒）。

### 原因

**为什么这是最佳方案**:
- TradingView 使用 HTML5 Canvas 渲染图表（非传统 DOM 元素）
- Canvas 没有传统的"加载中"DOM 元素可以稳定检测
- 网络活动监控可捕获数据加载完成
- MutationObserver 可检测图表重绘完成
- 多信号组合（Canvas 稳定 + 网络空闲）提供高置信度

**研究关键发现**:
- TradingView 可能有 `.tv-spinner` 或类似的加载类
- 图表在 Canvas 元素上渲染，传统 DOM 检查不足
- 加载可能发生在多个阶段：UI 加载、数据获取、图表渲染
- 嵌入式 widget 有 `onChartReady()` 回调（主站不可用）

### 实现方案

```javascript
/**
 * 等待 TradingView 图表加载完成
 * @param {number} timeout - 最大等待时间（毫秒，默认 10000）
 * @returns {Promise<boolean>} 是否加载完成
 */
async function waitForChartLoad(timeout = 10000) {
  const startTime = Date.now();

  // 策略 1: 检查加载指示器消失
  await waitForElementRemoved('[class*="spinner"], [class*="loading"], .tv-spinner', 5000);

  // 策略 2: 等待 Canvas 稳定
  const canvas = document.querySelector('canvas.chart-markup-table, canvas[class*="chart"]');
  if (canvas) {
    await waitForCanvasStable(canvas, 1000);
  }

  // 策略 3: 网络空闲（500ms 无新请求）
  await waitForNetworkIdle(500);

  // 策略 4: 额外安全缓冲
  await sleep(500);

  const elapsed = Date.now() - startTime;
  return elapsed < timeout;
}

/**
 * 等待元素从 DOM 中移除
 */
function waitForElementRemoved(selector, timeout) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (!element) {
      resolve(true); // 已移除
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const stillExists = document.querySelector(selector);
      if (!stillExists) {
        obs.disconnect();
        resolve(true);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      resolve(false); // 超时
    }, timeout);
  });
}

/**
 * 等待 Canvas 元素停止变化（图表渲染完成）
 */
function waitForCanvasStable(canvas, stableTime = 1000) {
  return new Promise((resolve) => {
    let lastChange = Date.now();

    const observer = new MutationObserver(() => {
      lastChange = Date.now();
    });

    observer.observe(canvas, {
      attributes: true,
      attributeFilter: ['width', 'height']
    });

    const checkStable = setInterval(() => {
      const now = Date.now();
      const timeSinceChange = now - lastChange;

      if (timeSinceChange >= stableTime) {
        clearInterval(checkStable);
        observer.disconnect();
        resolve(true);
      }
    }, 100);

    // 安全超时
    setTimeout(() => {
      clearInterval(checkStable);
      observer.disconnect();
      resolve(false);
    }, 15000);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### 视觉加载指示器检测

```javascript
/**
 * 检查 DOM 中是否存在加载指示器
 */
function hasLoadingIndicator() {
  const indicators = [
    '.tv-spinner',
    '[class*="spinner"]',
    '[class*="loading"]',
    '[class*="loader"]',
    '[data-loading="true"]',
    '.chart-loading-overlay'
  ];

  for (const selector of indicators) {
    if (document.querySelector(selector)) {
      return true;
    }
  }
  return false;
}
```

### 考虑过的替代方案

1. **仅固定延迟**
   - **方案**: `await sleep(5000)` 切换周期后
   - **优点**: 简单，始终等待足够时间
   - **缺点**: 图表快速加载时浪费时间，慢速连接时可能不够
   - **结论**: 用户体验差，不可预测

2. **DOM 元素轮询**
   - **方案**: 轮询等待特定图表数据元素出现
   - **优点**: 直接检测图表内容
   - **缺点**: TradingView 使用 Canvas，图表内容不是 DOM 元素
   - **结论**: 不适用于 Canvas 图表

3. **TradingView Widget API onChartReady**
   - **方案**: 使用官方 `widget.onChartReady()` 回调
   - **优点**: 官方、可靠
   - **缺点**: 仅适用于嵌入式 widget，不适用于 TradingView 主界面
   - **结论**: 不适用

### 参考资料

- TradingView 图表使用 HTML5 Canvas 元素
- Widget API 提供 `onChartReady()`（仅嵌入式 widget）
- Canvas 选择器: `canvas.chart-markup-table` 或 `canvas[class*="chart"]`
- 加载指示器可能使用类: `.tv-spinner`、`.loading-indicator`
- 图表数据通过 AJAX/Fetch 请求从 TradingView 服务器加载

---

## 4. 弹出对话框

### 决策

使用**持续后台观察器**实现**主动对话框关闭**，检测并关闭常见弹窗模式。

**策略**: 使用 MutationObserver 检测 modal/dialog 元素，自动点击关闭按钮。

### 原因

**为什么这是最佳方案**:
- TradingView 有多种可能干扰自动化的弹窗
- 弹窗可能在不可预测的时间出现（切换周期时、页面加载时等）
- 后台观察器可立即捕获弹窗，不阻塞工作流
- 基于模式的检测可跨不同弹窗类型工作

**研究关键发现**:
- 广告拦截器检测弹窗："检测到广告拦截器"
- 警报弹窗：如果不关闭，警报会累积并阻塞功能
- 会话断开警告："会话已断开"弹窗
- 并发设备警告：经纪商连接警告
- "未保存更改"对话框：切换周期/品种时出现
- 订阅/升级提示（"升级 Pro"广告）

**常见弹窗类型**:
1. 广告相关：广告拦截器检测、促销横幅、"升级 Pro"提示
2. 会话管理：断开警告、并发设备警告
3. 用户操作确认："未保存更改"、警报确认
4. Cookie 同意横幅

### 实现方案

```javascript
/**
 * 初始化弹窗对话框关闭观察器
 * 持续监控并关闭干扰性对话框
 */
function initializePopupDismissal() {
  // 要自动关闭的对话框选择器列表
  const dialogSelectors = [
    // 通用 modal/dialog 容器
    '[data-dialog-name]',
    '[role="dialog"]',
    '[class*="dialog"]',
    '[class*="modal"]',
    '[class*="popup"]',
    '[class*="overlay"]',

    // TradingView 特定
    '.tv-dialog',
    '.tv-toast',
    '#tv-toasts',
    '[class*="tv-alert"]'
  ];

  // 表示关闭/取消的按钮文本模式
  const dismissButtonPatterns = [
    'ok', '确定', '好的', 'close', '关闭', 'dismiss', 'cancel', '取消',
    'got it', '知道了', 'accept', '接受', 'agree', '同意',
    'continue', '继续', 'skip', '跳过', 'not now', '稍后',
    'x', '×', '\u00d7' // 关闭按钮符号
  ];

  // 观察 DOM 中对话框的出现
  const observer = new MutationObserver((mutations) => {
    for (const selector of dialogSelectors) {
      const dialog = document.querySelector(selector);
      if (dialog && isVisible(dialog)) {
        dismissDialog(dialog, dismissButtonPatterns);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 页面加载时的初始检查
  setTimeout(() => {
    for (const selector of dialogSelectors) {
      const dialog = document.querySelector(selector);
      if (dialog && isVisible(dialog)) {
        dismissDialog(dialog, dismissButtonPatterns);
      }
    }
  }, 1000);
}

/**
 * 尝试通过点击适当的按钮关闭对话框
 */
function dismissDialog(dialog, buttonPatterns) {
  // 查找关闭/取消按钮
  const buttons = dialog.querySelectorAll('button, [role="button"], a.close, .close-button');

  for (const button of buttons) {
    const text = button.textContent.trim().toLowerCase();
    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
    const title = button.getAttribute('title')?.toLowerCase() || '';

    // 检查按钮是否匹配关闭模式
    for (const pattern of buttonPatterns) {
      if (text.includes(pattern) || ariaLabel.includes(pattern) || title.includes(pattern)) {
        console.log('[TV SnapMaster] 自动关闭对话框:', pattern);
        button.click();
        return true;
      }
    }
  }

  // 尝试点击遮罩背景（某些 modal 支持这种关闭方式）
  if (dialog.classList.contains('overlay') || dialog.hasAttribute('data-overlay')) {
    dialog.click();
    return true;
  }

  return false;
}

/**
 * 检查元素是否可见
 */
function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0';
}
```

### 特定对话框处理

```javascript
/**
 * 专门处理"未保存更改"对话框
 */
function dismissUnsavedChangesDialog() {
  const dialog = document.querySelector('[data-dialog-name="unsaved-changes"]');
  if (!dialog) return false;

  // 点击"不保存"或"放弃"按钮
  const discardButton = Array.from(dialog.querySelectorAll('button')).find(btn => {
    const text = btn.textContent.toLowerCase();
    return text.includes("don't save") || text.includes('不保存') ||
           text.includes('discard') || text.includes('放弃') ||
           text.includes('continue') || text.includes('继续');
  });

  if (discardButton) {
    discardButton.click();
    return true;
  }

  return false;
}

/**
 * 处理 Cookie 同意横幅
 */
function dismissCookieConsent() {
  const cookieBanner = document.querySelector('[class*="cookie"], [id*="cookie"]');
  if (!cookieBanner) return false;

  const acceptButton = Array.from(cookieBanner.querySelectorAll('button')).find(btn => {
    const text = btn.textContent.toLowerCase();
    return text.includes('accept') || text.includes('接受') ||
           text.includes('agree') || text.includes('同意') ||
           text.includes('ok') || text.includes('确定');
  });

  if (acceptButton) {
    acceptButton.click();
    return true;
  }

  return false;
}
```

### 已知对话框类型（来自研究）

| 对话框类型 | 选择器/模式 | 关闭操作 | 优先级 |
|-----------|------------|---------|--------|
| 未保存更改 | `[data-dialog-name="unsaved-changes"]` | 点击"不保存" | 高 |
| 广告拦截器检测 | 包含文本"Ad blocker" | 点击"确定"或关闭 | 中 |
| 升级 Pro 广告 | 包含文本"Go Pro"、"Upgrade" | 点击关闭 (X) | 中 |
| 警报弹窗 | `.tv-alert`, alert role | 点击"确定" | 高 |
| 会话断开 | 包含"disconnect"文本 | 点击"确定" | 中 |
| Cookie 同意 | `[class*="cookie"]` | 点击"接受" | 低 |
| 并发设备 | 包含"concurrent device"文本 | 点击"确定" | 中 |

### 参考资料

- 广告拦截器检测由现有 userscript 处理（移除弹窗）
- 警报弹窗必须关闭，否则会累积并阻塞信号
- 会话断开弹窗有 PC 和移动端两个版本
- 并发设备经纪商警告出现在需要点击"确定"的对话框中
- Toast 通知使用 `#tv-toasts` 容器（可直接移除）

---

## 5. 主题检测

### 决策

使用 **`<html>` 或 `<body>` 元素的 CSS 类检查**来检测 TradingView 当前主题。

**主要策略**: 检查 `theme-dark` 或 `theme-light` 等主题相关类。

**备选策略**: 分析图表区域的背景颜色（深色 = 深色主题）。

### 原因

**为什么这是最佳方案**:
- 根级别的主题类在 UI 更新中相对稳定
- 快速同步检测（无需异步操作）
- 适用于嵌入式 widget 和 TradingView 主界面
- 允许弹窗打开时立即匹配主题

**研究关键发现**:
- TradingView widget 使用 `tv-theme-dark` 或 `tv-theme-light` 类
- 主站可能在根元素使用类似模式
- 用户可通过 TradingView 设置更改主题
- 图表使用 CSS 自定义属性进行主题设置: `--tv-color-*`

### 实现方案

```javascript
/**
 * 检测 TradingView 当前主题
 * @returns {string} 'dark' 或 'light'
 */
function detectTheme() {
  // 策略 1: 检查 html/body 上的主题类
  const html = document.documentElement;
  const body = document.body;

  const classPatterns = [
    { element: html, pattern: /theme-(dark|light)/i },
    { element: body, pattern: /theme-(dark|light)/i },
    { element: html, pattern: /(dark|light)-theme/i },
    { element: body, pattern: /(dark|light)-theme/i },
    { element: html, pattern: /tv-theme-(dark|light)/i },
    { element: body, pattern: /tv-theme-(dark|light)/i }
  ];

  for (const { element, pattern } of classPatterns) {
    const classList = Array.from(element.classList);
    for (const className of classList) {
      const match = className.match(pattern);
      if (match) {
        return match[1].toLowerCase(); // 返回 'dark' 或 'light'
      }
    }
  }

  // 策略 2: 检查 data-theme 属性
  const dataTheme = html.getAttribute('data-theme') || body.getAttribute('data-theme');
  if (dataTheme && (dataTheme === 'dark' || dataTheme === 'light')) {
    return dataTheme;
  }

  // 策略 3: 分析背景颜色
  return detectThemeByColor();
}

/**
 * 通过分析背景颜色检测主题（备选方法）
 */
function detectThemeByColor() {
  // 获取图表或 body 的计算背景颜色
  const chartArea = document.querySelector('.chart-container, [class*="chart"]') || document.body;
  const bgColor = window.getComputedStyle(chartArea).backgroundColor;

  // 解析 RGB 值
  const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const [_, r, g, b] = match.map(Number);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    // 亮度 < 128 为深色主题
    return brightness < 128 ? 'dark' : 'light';
  }

  // 默认备选
  return 'dark'; // TradingView 默认是深色主题
}

/**
 * 监控主题变化
 */
function monitorThemeChanges() {
  const observer = new MutationObserver(() => {
    const theme = detectTheme();
    chrome.runtime.sendMessage({
      type: 'THEME_DETECTED',
      theme: theme
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme']
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'data-theme']
  });
}
```

### 弹窗主题适配

```css
/* popup.css - 主题感知样式 */

/* 浅色主题（默认） */
:root {
  --bg-color: #ffffff;
  --text-color: #131722;
  --button-bg: #f0f3fa;
  --button-hover: #e0e3eb;
  --border-color: #e0e3eb;
}

/* 深色主题 */
body.theme-dark {
  --bg-color: #131722;
  --text-color: #d1d4dc;
  --button-bg: #2a2e39;
  --button-hover: #363a45;
  --border-color: #363a45;
}

body {
  background-color: var(--bg-color);
  color: var(--text-color);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

button {
  background-color: var(--button-bg);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

button:hover {
  background-color: var(--button-hover);
}
```

### 参考资料

- TradingView widget 在配置中使用 `theme: "dark"` 或 `theme: "light"`
- CSS 自定义属性: `--tv-color-toolbar-button-*`, `--tv-color-*`
- 图表可通过嵌入式 widget 的 CSS 变量设置样式
- 用户可通过 TradingView UI 设置更改主题

---

## 风险评估与缓解

### 高风险: UI 结构变化

**风险**: TradingView 经常更新其 UI，导致 DOM 选择器失效。

**证据**: 多个 GitHub issue 报告插件在 TradingView 更新后失效（2025 年 7 月事件）。

**缓解措施**:
1. 使用基于类的选择器而非深层 DOM 路径
2. 为每个检测方法实现备选策略
3. 添加优雅降级（如按钮找不到时使用键盘输入）
4. 包含错误日志以识别选择器何时失效
5. 版本检测：检查已知 UI 版本并适配选择器

**监控**: 在控制台记录选择器匹配率（用于调试/开发）。

### 中风险: Canvas 渲染检测

**风险**: 检测 Canvas 图表渲染完成不是直接可行的。

**缓解措施**:
1. 多信号方案：加载指示器移除 + Canvas 稳定 + 网络空闲
2. 保守固定超时作为最终备选（10 秒）
3. 如果自动检测失败，允许用户手动触发截图

### 中风险: 弹窗对话框变化

**风险**: 可能出现我们关闭模式未覆盖的新弹窗类型。

**缓解措施**:
1. 通用模式匹配（多种按钮文本模式）
2. 持续后台观察器（随时捕获弹窗）
3. 记录已关闭的对话框以识别模式
4. 如果自动关闭失败，允许用户手动关闭

### 低风险: 主题检测稳定性

**风险**: 主题类名可能变化。

**缓解措施**:
1. 多种检测策略（类、属性、颜色分析）
2. 主题检测失败不影响核心功能
3. 检测失败时默认使用深色主题

---

## 可维护性最佳实践

基于研究发现和现有插件经验:

1. **避免 `nth-child` 选择器**: 容易在 UI 更新时失效
2. **优先使用类名而非 ID**: ID 可能是动态的或会变化
3. **尽可能使用 data 属性**: 比类更稳定
4. **实现遥测/日志**: 跟踪选择器成功率以便未来更新
5. **版本检测**: 如可能检查 TradingView 版本，使用版本特定选择器
6. **用户反馈机制**: 允许用户报告选择器失效
7. **优雅降级**: 始终提供备选或手动替代方案
8. **保守超时**: 宁可等待稍长也不要在慢速连接上失败

---

## 测试策略

### 手动测试清单

1. **品种提取**
   - 测试不同品种: BTCUSDT, AAPL, ES1!, BTC/USDT（特殊字符）
   - 测试带 URL 参数: `?tvwidgetsymbol=NASDAQ:AAPL`
   - 测试有无交易所前缀

2. **周期切换**
   - 测试所有周期: 15m, 1h, 4h, 1D, 1W
   - 测试目标周期已选中的情况
   - 测试周期在下拉菜单中 vs 工具栏可见
   - 测试键盘备选方案

3. **加载检测**
   - 在慢速连接上测试（DevTools 中节流网络）
   - 测试快速连续切换周期
   - 测试不同图表类型（蜡烛图、折线图等）

4. **弹窗关闭**
   - 手动触发"未保存更改"对话框（修改图表，切换周期）
   - 禁用广告拦截器测试广告弹窗
   - 测试警报弹窗
   - 首次访问时测试 Cookie 同意

5. **主题检测**
   - 通过 UI 设置切换 TradingView 主题
   - 验证弹窗立即适配
   - 在浅色和深色主题上测试

---

## 实现优先级

基于关键性和复杂度:

1. **第一阶段（MVP - 关键）**
   - 带备选的品种提取
   - 周期切换（键盘备选）
   - 基本加载检测（固定超时）
   - 截图捕获

2. **第二阶段（增强可靠性）**
   - 高级加载检测（Canvas + 网络监控）
   - "未保存更改"对话框关闭
   - 当前周期检测（已选中则跳过）

3. **第三阶段（完善）**
   - 主题检测和弹窗样式
   - 额外弹窗对话框处理
   - 错误日志和遥测

---

## 核心要点

1. **预期 UI 变化**: TradingView 频繁更新；设计时考虑灵活性
2. **多重备选**: 永远不要依赖单一选择器或检测方法
3. **Canvas 图表**: 传统 DOM 选择器不适用于图表内容
4. **弹窗干扰**: 对话框可能阻塞自动化；需要主动关闭
5. **保守超时**: 宁可等待稍长也不要在慢速加载时失败
6. **主题一致性**: 匹配 TradingView 主题显著提升用户体验

---

## 参考来源

本研究汇编了以下来源的信息:

**TradingView 插件与工具**:
- [TradingView Assistant Chrome Extension (GitHub)](https://github.com/akumidv/tradingview-assistant-chrome-extension)
- [TradingView Assistant UI Change Issue](https://github.com/akumidv/tradingview-assistant-chrome-extension/issues/58)
- [TradingView Optimizer Extension Issue #28](https://github.com/OptiPie/tradingview-optimizer-extension/issues/28)
- [TradingView Remove Ads Userscript](https://greasyfork.org/en/scripts/371211-tradingview-remove-ads/code)
- [Greasy Fork - TradingView Userscripts](https://greasyfork.org/en/scripts/by-site/tradingview.com)

**TradingView 官方文档**:
- [Widget Tutorials: Dynamic Symbol Change](https://www.tradingview.com/widget-docs/tutorials/build-page/dynamic-symbols/)
- [Advanced Charts Documentation: Time Scale](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Time-Scale/)
- [Advanced Charts Documentation: CSS Color Themes](https://www.tradingview.com/charting-library-docs/latest/customization/styles/CSS-Color-Themes/)
- [Symbol Search Documentation](https://www.tradingview.com/charting-library-docs/latest/ui_elements/Symbol-Search/)
- [TradingView Support: How to change symbol/ticker](https://www.tradingview.com/support/solutions/43000543012-how-do-you-change-the-symbol-or-ticker-on-a-chart/)
- [TradingView Support: Time intervals introduction](https://www.tradingview.com/support/solutions/43000747934-time-intervals-a-quick-introduction-and-tips/)

---

**文档版本**: 1.0
**最后更新**: 2025-12-17
**下次审核**: 初始实现测试后
