/**
 * TV SnapMaster - Content Script
 * 主消息处理与截图工作流协调
 */

// ============================================================================
// 初始化
// ============================================================================

// 当前截图状态
let captureInProgress = false;
let currentRequest = null;

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

/**
 * 初始化 Content Script
 */
function initialize() {
  console.log('[TV SnapMaster] Content Script 已加载');

  // 初始化弹窗关闭观察器
  initializePopupDismissal();

  // 检查是否在 TradingView 图表页面
  if (!isTradingViewChart()) {
    console.log('[TV SnapMaster] 不在 TradingView 图表页面');
    return;
  }

  console.log('[TV SnapMaster] TradingView 图表页面已检测');
}

/**
 * 检查是否在 TradingView 图表页面
 * @returns {boolean}
 */
function isTradingViewChart() {
  const url = window.location.href;
  return url.includes('tradingview.com/chart');
}

// ============================================================================
// 消息处理
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[TV SnapMaster CS] 收到消息:', message.type);

  switch (message.type) {
    case 'CAPTURE':
      handleCaptureRequest(message.payload, sendResponse);
      return true; // 异步响应

    case 'GET_PAGE_INFO':
      sendResponse(getPageInfo());
      return false;

    case 'GET_THEME':
      sendResponse({ theme: detectTheme() });
      return false;

    default:
      console.warn('[TV SnapMaster CS] 未知消息类型:', message.type);
      return false;
  }
});

// ============================================================================
// 截图工作流
// ============================================================================

/**
 * 处理截图请求
 * @param {Object} payload - 截图请求数据
 * @param {Function} sendResponse - 响应回调
 */
async function handleCaptureRequest(payload, sendResponse) {
  const { id, interval, timestamp } = payload;

  console.log('[TV SnapMaster] 处理截图请求:', { id, interval });

  // 检查是否有正在进行的截图
  if (captureInProgress) {
    console.log('[TV SnapMaster] 截图正在进行中，请稍候');
    sendResponse(createCaptureState('error', {
      error: {
        code: 'CAPTURE_IN_PROGRESS',
        message: '截图正在进行中，请稍候'
      }
    }));
    return;
  }

  // 检查是否在 TradingView 页面
  if (!isTradingViewChart()) {
    sendResponse(createCaptureState('error', {
      error: {
        code: 'NOT_TRADINGVIEW',
        message: '请导航到 TradingView 图表页面'
      }
    }));
    return;
  }

  captureInProgress = true;
  currentRequest = payload;

  try {
    // 1. 切换周期
    sendStatusUpdate('switching', '切换周期中...');
    const switchSuccess = await switchInterval(interval);
    if (!switchSuccess) {
      throw createErrorObj('INTERVAL_SWITCH_FAILED', '切换时间周期失败');
    }

    // 2. 等待图表加载
    sendStatusUpdate('loading', '等待图表加载...');
    const loadSuccess = await waitForChartLoad(10000);
    if (!loadSuccess) {
      console.warn('[TV SnapMaster] 图表加载超时，继续截图');
    }

    // 3. 提取品种名称
    const symbol = extractSymbol();
    console.log('[TV SnapMaster] 品种名称:', symbol);

    // 4. 请求 Service Worker 截图
    sendStatusUpdate('capturing', '截图中...');
    const captureResult = await requestCapture(symbol, interval, timestamp);

    if (captureResult.success) {
      // 5. 完成
      sendStatusUpdate('complete', `已保存: ${captureResult.filename}`);
      sendResponse(createCaptureState('complete', {
        request: payload,
        symbol: symbol
      }));
    } else {
      throw createErrorObj('CAPTURE_FAILED', captureResult.error?.message || '截图失败');
    }

  } catch (error) {
    console.error('[TV SnapMaster] 截图失败:', error);
    sendStatusUpdate('error', error.message || '发生错误');
    sendResponse(createCaptureState('error', {
      request: payload,
      error: {
        code: error.code || 'UNKNOWN',
        message: error.message || '发生未知错误'
      }
    }));
  } finally {
    captureInProgress = false;
    currentRequest = null;
  }
}

/**
 * 请求 Service Worker 执行截图
 * @param {string} symbol - 品种名称
 * @param {string} interval - 时间周期
 * @param {number} timestamp - 时间戳
 * @returns {Promise<Object>} 截图结果
 */
function requestCapture(symbol, interval, timestamp) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'CAPTURE_TAB',
      payload: {
        symbol: symbol,
        interval: interval,
        timestamp: timestamp
      }
    }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({
          success: false,
          error: {
            code: 'CAPTURE_FAILED',
            message: chrome.runtime.lastError.message
          }
        });
        return;
      }
      resolve(response || { success: false });
    });
  });
}

// ============================================================================
// 状态管理
// ============================================================================

/**
 * 发送状态更新到 Popup
 * @param {string} status - 状态代码
 * @param {string} message - 状态消息
 */
function sendStatusUpdate(status, message) {
  console.log('[TV SnapMaster] 状态更新:', status, message);

  // 使用 chrome.runtime.sendMessage 发送给 popup
  // 注意: popup 可能已关闭，忽略错误
  chrome.runtime.sendMessage({
    type: 'STATUS_UPDATE',
    payload: {
      status: status,
      message: message,
      request: currentRequest
    }
  }).catch(() => {
    // Popup 可能已关闭，忽略
  });
}

/**
 * 创建截图状态对象
 * @param {string} status - 状态代码
 * @param {Object} options - 可选参数
 * @returns {Object} 状态对象
 */
function createCaptureState(status, options = {}) {
  const statusMessages = {
    idle: '准备就绪',
    switching: '切换周期中...',
    loading: '等待图表加载...',
    capturing: '截图中...',
    downloading: '下载中...',
    complete: '完成！',
    error: options.error?.message || '发生错误'
  };

  return {
    status: status,
    message: statusMessages[status] || '',
    request: options.request || null,
    error: options.error || null,
    symbol: options.symbol || null,
    currentInterval: getCurrentInterval()
  };
}

/**
 * 创建错误对象
 * @param {string} code - 错误代码
 * @param {string} message - 错误消息
 * @returns {Error} 错误对象
 */
function createErrorObj(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// ============================================================================
// 页面信息
// ============================================================================

/**
 * 获取当前页面信息
 * @returns {Object} 页面信息
 */
function getPageInfo() {
  return {
    symbol: extractSymbol(),
    interval: getCurrentInterval(),
    theme: detectTheme(),
    isLoading: hasLoadingIndicator(),
    url: window.location.href,
    isTradingView: isTradingViewChart()
  };
}

/**
 * 检查是否有加载指示器
 * @returns {boolean}
 */
function hasLoadingIndicator() {
  const indicators = [
    '.tv-spinner',
    '[class*="spinner"]',
    '[class*="loading"]',
    '[class*="loader"]'
  ];

  for (const selector of indicators) {
    const element = document.querySelector(selector);
    if (element && isElementVisible(element)) {
      return true;
    }
  }
  return false;
}
