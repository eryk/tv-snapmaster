/**
 * TV SnapMaster - TradingView DOM 工具
 * TradingView 专用选择器与工具函数
 */

// ============================================================================
// 品种名称提取
// ============================================================================

/**
 * 使用备选策略从 TradingView 页面提取品种
 * @returns {string} 品种名称（如 "BTCUSDT"、"AAPL"）
 */
function extractSymbol() {
  console.log('[TV SnapMaster] 开始提取品种名称...');
  console.log('[TV SnapMaster] 当前 URL:', window.location.href);
  console.log('[TV SnapMaster] 页面标题:', document.title);

  // 策略 1: 从页面标题提取（最可靠）
  // 格式通常为: "SYMBOL price ▲/▼ percent% ..." 或 "SYMBOL — Chart — TradingView"
  const titlePatterns = [
    // 匹配 "MBT1! 86,930 ▼ −1.15% default" 格式
    /^([A-Z][A-Z0-9!\.]{1,15})(?:\s+[\d,]+|\s+—|\s+▼|\s+▲)/i,
    // 匹配 "BTCUSDT — Chart" 格式
    /^([A-Z][A-Z0-9!\.]{1,15})\s+—/i,
    // 匹配纯符号开头
    /^([A-Z][A-Z0-9!\.]{1,15})(?:\s|$)/i
  ];

  for (const pattern of titlePatterns) {
    const titleMatch = document.title.match(pattern);
    if (titleMatch && titleMatch[1]) {
      const rawSymbol = titleMatch[1].trim();
      console.log('[TV SnapMaster] 策略 1 (page title): 原始 =', rawSymbol);
      const cleaned = cleanSymbolName(rawSymbol);
      if (cleaned && cleaned !== 'UNKNOWN' && cleaned.length >= 2 && cleaned.length <= 20) {
        console.log('[TV SnapMaster] 策略 1: 提取成功 =', cleaned);
        return cleaned;
      }
    }
  }

  // 策略 2: 查找图表标题区域的符号信息
  // 寻找看起来像品种代码的短文本
  const titleElements = document.querySelectorAll('[data-name="legend-source-title"], [class*="symbol"], [class*="legend"]');
  for (const el of titleElements) {
    const text = el.textContent.trim();
    if (text.length < 2 || text.length > 30) continue;

    console.log('[TV SnapMaster] 策略 2 (DOM title): 检查文本 =', text);

    // 尝试匹配期货格式: MBT1!, CL1!, ES1! 等（优先）
    const futuresMatch = text.match(/\b([A-Z]{2,5}\d+!)\b/i);
    if (futuresMatch) {
      const cleaned = cleanSymbolName(futuresMatch[1]);
      console.log('[TV SnapMaster] 策略 2a (期货): 匹配成功 =', cleaned);
      if (cleaned && cleaned !== 'UNKNOWN' && cleaned.length >= 3 && cleaned.length <= 20) {
        return cleaned;
      }
    }

    // 尝试匹配普通品种: BTCUSDT, AAPL 等
    const symbolMatch = text.match(/\b([A-Z][A-Z0-9]{1,14})\b/i);
    if (symbolMatch && symbolMatch[1].length >= 2 && symbolMatch[1].length <= 15) {
      const cleaned = cleanSymbolName(symbolMatch[1]);
      console.log('[TV SnapMaster] 策略 2b (通用): 匹配成功 =', cleaned);
      if (cleaned && cleaned !== 'UNKNOWN' && cleaned.length >= 2 && cleaned.length <= 20) {
        return cleaned;
      }
    }
  }

  // 策略 3: 从 URL 查询参数提取
  const urlParams = new URLSearchParams(window.location.search);
  const urlSymbol = urlParams.get('symbol') || urlParams.get('tvwidgetsymbol');
  if (urlSymbol) {
    console.log('[TV SnapMaster] 策略 3 (URL params): 原始 =', urlSymbol);
    const cleaned = cleanSymbolName(urlSymbol);
    if (cleaned && cleaned !== 'UNKNOWN' && cleaned.length >= 2 && cleaned.length <= 20) {
      console.log('[TV SnapMaster] 策略 3: 提取成功 =', cleaned);
      return cleaned;
    }
  }

  // 策略 4: 从 URL hash 提取
  const hashMatch = window.location.hash.match(/symbol=([^&]+)/);
  if (hashMatch && hashMatch[1]) {
    const rawSymbol = decodeURIComponent(hashMatch[1]);
    console.log('[TV SnapMaster] 策略 4 (URL hash): 原始 =', rawSymbol);
    const cleaned = cleanSymbolName(rawSymbol);
    if (cleaned && cleaned !== 'UNKNOWN' && cleaned.length >= 2 && cleaned.length <= 20) {
      console.log('[TV SnapMaster] 策略 4: 提取成功 =', cleaned);
      return cleaned;
    }
  }


  console.warn('[TV SnapMaster] 所有策略均未能提取品种名称');
  console.warn('[TV SnapMaster] 返回 unknown');
  return 'unknown';
}

/**
 * 清理品种名称
 * @param {string} symbol - 原始品种名称
 * @returns {string} 清理后的名称
 */
function cleanSymbolName(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    console.warn('[TV SnapMaster] cleanSymbolName: 输入无效', symbol);
    return 'UNKNOWN';
  }

  // 移除交易所前缀（如 "NASDAQ:AAPL" -> "AAPL", "BINANCE:BTCUSDT" -> "BTCUSDT"）
  let cleaned = symbol.split(':').pop().trim();

  // 移除常见后缀（如价格、时间等信息）
  // 匹配第一个单词或符号名称部分（允许感叹号）
  const symbolMatch = cleaned.match(/^([A-Z0-9][A-Z0-9\/\-\.!]*[A-Z0-9!])/i);
  if (symbolMatch) {
    cleaned = symbolMatch[1];
  }

  // 替换特殊字符为下划线（斜杠、点、横线、感叹号）
  cleaned = cleaned.replace(/[\/\.\-!]/g, '_');

  // 移除其他特殊字符
  cleaned = cleaned.replace(/[^A-Z0-9_]/gi, '');

  // 移除首尾下划线
  cleaned = cleaned.replace(/^_+|_+$/g, '');

  // 转换为大写
  cleaned = cleaned.toUpperCase();

  console.log('[TV SnapMaster] cleanSymbolName: 输入 =', symbol, ', 输出 =', cleaned);

  return cleaned || 'UNKNOWN';
}

// ============================================================================
// 周期检测与切换
// ============================================================================

/**
 * 检测当前选中的周期
 * @returns {string|null} 当前周期（如 "4h"、"1D"）
 */
function getCurrentInterval() {
  // 通过 data-active 或 aria-pressed 查找活动状态的按钮
  const activeSelectors = [
    '[data-active="true"][data-name*="interval"]',
    'button[aria-pressed="true"][class*="interval"]',
    'button[class*="active"][class*="interval"]',
    '[data-name="time-interval-menu"] [class*="active"]'
  ];

  for (const selector of activeSelectors) {
    try {
      const activeButton = document.querySelector(selector);
      if (activeButton) {
        const text = activeButton.textContent.trim();
        const normalized = normalizeIntervalText(text);
        if (normalized) {
          return normalized;
        }
      }
    } catch (e) {
      // 继续尝试下一个选择器
    }
  }

  // 尝试从 URL 中提取周期信息
  const urlMatch = window.location.href.match(/interval=(\w+)/);
  if (urlMatch) {
    return normalizeIntervalText(urlMatch[1]);
  }

  return null;
}

/**
 * 标准化周期文本
 * @param {string} text - 周期文本
 * @returns {string|null} 标准化后的周期
 */
function normalizeIntervalText(text) {
  if (!text) return null;

  const normalized = text.trim().toLowerCase();
  const map = {
    '1': '1m', '1m': '1m', '1分': '1m', '1分钟': '1m',
    '5': '5m', '5m': '5m', '5分': '5m', '5分钟': '5m',
    '15': '15m', '15m': '15m', '15分': '15m', '15分钟': '15m',
    '60': '1h', '1h': '1h', '1小时': '1h',
    '240': '4h', '4h': '4h', '4小时': '4h',
    'd': '1D', '1d': '1D', '日': '1D', '1日': '1D',
    'w': '1W', '1w': '1W', '周': '1W', '1周': '1W'
  };

  return map[normalized] || null;
}

/**
 * 切换 TradingView 图表到目标周期
 * @param {string} interval - 目标周期（如 "15m"、"1h"、"4h"、"1D"、"1W"）
 * @returns {Promise<boolean>} 是否成功
 */
async function switchInterval(interval) {
  console.log('[TV SnapMaster] 切换周期到:', interval);

  // 检查是否已经是目标周期
  const currentInterval = getCurrentInterval();
  if (currentInterval === interval) {
    console.log('[TV SnapMaster] 当前已是目标周期，跳过切换');
    return true;
  }

  // 策略 1: 通过 data-name 或 data-value 属性点击周期按钮
  const buttonByData = document.querySelector(`[data-name="${interval}"], [data-value="${interval}"]`);
  if (buttonByData) {
    console.log('[TV SnapMaster] 周期切换策略 1: data 属性');
    buttonByData.click();
    return true;
  }

  // 策略 2: 通过 aria-label 查找
  const buttonByAria = document.querySelector(`[aria-label*="${interval}"], [aria-label*="${interval.toUpperCase()}"]`);
  if (buttonByAria) {
    console.log('[TV SnapMaster] 周期切换策略 2: aria-label');
    buttonByAria.click();
    return true;
  }

  // 策略 3: 通过文本内容筛选按钮
  const allButtons = document.querySelectorAll('button');
  for (const button of allButtons) {
    const text = button.textContent.trim();
    if (text === interval || normalizeIntervalText(text) === interval) {
      console.log('[TV SnapMaster] 周期切换策略 3: 文本内容');
      button.click();
      return true;
    }
  }

  // 策略 4: 检查下拉菜单
  const dropdownTrigger = document.querySelector('[data-name="time-interval-menu"], [aria-label*="时间周期"], [aria-label*="interval"]');
  if (dropdownTrigger) {
    console.log('[TV SnapMaster] 周期切换策略 4: 下拉菜单');
    dropdownTrigger.click();
    await tvSleep(200); // 等待下拉动画

    const dropdownButtons = document.querySelectorAll('[role="menu"] button, [role="listbox"] [role="option"], [class*="menu"] button');
    for (const button of dropdownButtons) {
      const text = button.textContent.trim();
      if (text === interval || normalizeIntervalText(text) === interval) {
        button.click();
        return true;
      }
    }
  }

  // 策略 5: 键盘输入（通用备选方案）
  console.log('[TV SnapMaster] 周期切换策略 5: 键盘输入');
  return await switchIntervalByKeyboard(interval);
}

/**
 * 通过键盘输入切换周期
 * @param {string} interval - 目标周期
 * @returns {Promise<boolean>} 是否成功
 */
async function switchIntervalByKeyboard(interval) {
  // 聚焦图表区域（点击 canvas）
  const canvas = document.querySelector('canvas');
  if (canvas) {
    canvas.click();
    await tvSleep(100);
  }

  // 转换为 TradingView 键盘输入格式
  const keyboardMap = {
    '1m': '1',
    '5m': '5',
    '15m': '15',
    '1h': '60',
    '4h': '240',
    '1D': '1D',
    '1W': '1W'
  };

  const inputText = keyboardMap[interval] || interval;

  // 模拟键盘输入
  for (const char of inputText) {
    const eventInit = {
      key: char,
      code: `Key${char.toUpperCase()}`,
      bubbles: true,
      cancelable: true
    };
    document.dispatchEvent(new KeyboardEvent('keydown', eventInit));
    document.dispatchEvent(new KeyboardEvent('keypress', eventInit));
    document.dispatchEvent(new KeyboardEvent('keyup', eventInit));
    await tvSleep(50);
  }

  // 按回车确认
  await tvSleep(100);
  const enterEvent = { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true };
  document.dispatchEvent(new KeyboardEvent('keydown', enterEvent));
  document.dispatchEvent(new KeyboardEvent('keypress', enterEvent));
  document.dispatchEvent(new KeyboardEvent('keyup', enterEvent));

  return true;
}

// ============================================================================
// 加载检测
// ============================================================================

/**
 * 等待 TradingView 图表加载完成
 * @param {number} timeout - 最大等待时间（毫秒，默认 10000）
 * @returns {Promise<boolean>} 是否加载完成
 */
async function waitForChartLoad(timeout = 10000) {
  const startTime = Date.now();
  console.log('[TV SnapMaster] 开始等待图表加载...');

  // 策略 1: 等待加载指示器消失
  await waitForLoadingIndicatorRemoved(5000);

  // 策略 2: 等待 Canvas 稳定
  const canvas = document.querySelector('canvas.chart-markup-table, canvas[class*="chart"], canvas');
  if (canvas) {
    await waitForCanvasStable(canvas, 1000);
  }

  // 策略 3: 额外安全缓冲
  await tvSleep(500);

  const elapsed = Date.now() - startTime;
  console.log(`[TV SnapMaster] 图表加载完成，耗时 ${elapsed}ms`);

  return elapsed < timeout;
}

/**
 * 等待加载指示器从 DOM 中移除
 * @param {number} timeout - 超时时间（毫秒）
 * @returns {Promise<boolean>}
 */
function waitForLoadingIndicatorRemoved(timeout) {
  return new Promise((resolve) => {
    const indicators = [
      '.tv-spinner',
      '[class*="spinner"]',
      '[class*="loading"]',
      '[class*="loader"]',
      '[data-loading="true"]'
    ];

    const checkIndicator = () => {
      for (const selector of indicators) {
        const element = document.querySelector(selector);
        if (element && isElementVisible(element)) {
          return true; // 仍有加载指示器
        }
      }
      return false; // 没有加载指示器
    };

    // 如果当前没有加载指示器，直接返回
    if (!checkIndicator()) {
      resolve(true);
      return;
    }

    // 使用 MutationObserver 监控
    const observer = new MutationObserver(() => {
      if (!checkIndicator()) {
        observer.disconnect();
        resolve(true);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });

    // 超时处理
    setTimeout(() => {
      observer.disconnect();
      resolve(false);
    }, timeout);
  });
}

/**
 * 等待 Canvas 元素停止变化
 * @param {HTMLCanvasElement} canvas - Canvas 元素
 * @param {number} stableTime - 稳定时间（毫秒）
 * @returns {Promise<boolean>}
 */
function waitForCanvasStable(canvas, stableTime = 1000) {
  return new Promise((resolve) => {
    let lastChange = Date.now();

    const observer = new MutationObserver(() => {
      lastChange = Date.now();
    });

    observer.observe(canvas, {
      attributes: true,
      attributeFilter: ['width', 'height', 'style']
    });

    const checkStable = setInterval(() => {
      const timeSinceChange = Date.now() - lastChange;

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
      resolve(true); // 超时也认为加载完成
    }, 10000);
  });
}

// ============================================================================
// 弹窗对话框处理
// ============================================================================

/**
 * 初始化弹窗对话框关闭观察器
 */
function initializePopupDismissal() {
  const dialogSelectors = [
    '[data-dialog-name]',
    '[role="dialog"]',
    '[class*="dialog"]',
    '[class*="modal"]',
    '[class*="popup"]',
    '[class*="overlay"]',
    '.tv-dialog',
    '.tv-toast',
    '#tv-toasts'
  ];

  const dismissButtonPatterns = [
    'ok', '确定', '好的', 'close', '关闭', 'dismiss', 'cancel', '取消',
    'got it', '知道了', 'accept', '接受', 'agree', '同意',
    'continue', '继续', 'skip', '跳过', 'not now', '稍后',
    'x', '×', '\u00d7'
  ];

  // 观察 DOM 中对话框的出现
  const observer = new MutationObserver(() => {
    for (const selector of dialogSelectors) {
      const dialog = document.querySelector(selector);
      if (dialog && isElementVisible(dialog)) {
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
      if (dialog && isElementVisible(dialog)) {
        dismissDialog(dialog, dismissButtonPatterns);
      }
    }
  }, 1000);

  console.log('[TV SnapMaster] 弹窗关闭观察器已初始化');
}

/**
 * 尝试关闭对话框
 * @param {Element} dialog - 对话框元素
 * @param {string[]} buttonPatterns - 关闭按钮文本模式
 * @returns {boolean} 是否成功关闭
 */
function dismissDialog(dialog, buttonPatterns) {
  const buttons = dialog.querySelectorAll('button, [role="button"], a.close, .close-button, [class*="close"]');

  for (const button of buttons) {
    const text = (button.textContent || '').trim().toLowerCase();
    const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
    const title = (button.getAttribute('title') || '').toLowerCase();

    for (const pattern of buttonPatterns) {
      if (text.includes(pattern) || ariaLabel.includes(pattern) || title.includes(pattern)) {
        console.log('[TV SnapMaster] 自动关闭对话框:', pattern);
        button.click();
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// 主题检测
// ============================================================================

/**
 * 检测 TradingView 当前主题
 * @returns {string} 'dark' 或 'light'
 */
function detectTheme() {
  const html = document.documentElement;
  const body = document.body;

  // 策略 1: 检查 html/body 上的主题类
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
        console.log('[TV SnapMaster] 主题检测策略 1: CSS 类');
        return match[1].toLowerCase();
      }
    }
  }

  // 策略 2: 检查 data-theme 属性
  const dataTheme = html.getAttribute('data-theme') || body.getAttribute('data-theme');
  if (dataTheme && (dataTheme === 'dark' || dataTheme === 'light')) {
    console.log('[TV SnapMaster] 主题检测策略 2: data-theme');
    return dataTheme;
  }

  // 策略 3: 分析背景颜色
  return detectThemeByColor();
}

/**
 * 通过分析背景颜色检测主题
 * @returns {string} 'dark' 或 'light'
 */
function detectThemeByColor() {
  const chartArea = document.querySelector('.chart-container, [class*="chart"]') || document.body;
  const bgColor = window.getComputedStyle(chartArea).backgroundColor;

  const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const [, r, g, b] = match.map(Number);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    console.log('[TV SnapMaster] 主题检测策略 3: 背景颜色, 亮度:', brightness);
    return brightness < 128 ? 'dark' : 'light';
  }

  // 默认深色
  return 'dark';
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function tvSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查元素是否可见
 * @param {Element} element - DOM 元素
 * @returns {boolean} 是否可见
 */
function isElementVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0' &&
         element.offsetParent !== null;
}
