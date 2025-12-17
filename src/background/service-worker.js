/**
 * TV SnapMaster - Service Worker
 * 处理截图与下载逻辑
 */

// ============================================================================
// 消息监听
// ============================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[TV SnapMaster SW] 收到消息:', message.type);

  switch (message.type) {
    case 'CAPTURE_TAB':
      handleCaptureTab(message.payload, sender.tab)
        .then(result => sendResponse(result))
        .catch(error => {
          console.error('[TV SnapMaster SW] 截图失败:', error);
          sendResponse({
            success: false,
            error: {
              code: 'CAPTURE_FAILED',
              message: '截图失败',
              details: error.message
            }
          });
        });
      return true; // 保持消息通道开启用于异步响应

    default:
      console.warn('[TV SnapMaster SW] 未知消息类型:', message.type);
      return false;
  }
});

// ============================================================================
// 截图功能
// ============================================================================

/**
 * 处理截图请求
 * @param {Object} payload - 截图请求数据
 * @param {chrome.tabs.Tab} tab - 发送请求的标签页
 * @returns {Promise<Object>} 截图结果
 */
async function handleCaptureTab(payload, tab) {
  const { symbol, interval, timestamp } = payload;

  console.log('[TV SnapMaster SW] 开始截图:', { symbol, interval, timestamp });

  try {
    // 1. 截取可见标签页
    const dataUrl = await captureVisibleTab(tab);

    if (!dataUrl) {
      throw new Error('captureVisibleTab 返回空数据');
    }

    // 2. 生成文件名
    const filename = generateFilename(symbol, interval, timestamp);

    // 3. 下载截图
    const downloadId = await downloadScreenshot(dataUrl, filename);

    console.log('[TV SnapMaster SW] 截图完成:', { filename, downloadId });

    return {
      success: true,
      filename: filename,
      downloadId: downloadId
    };

  } catch (error) {
    console.error('[TV SnapMaster SW] 截图过程出错:', error);
    throw error;
  }
}

/**
 * 截取可见标签页
 * @param {chrome.tabs.Tab} tab - 标签页对象
 * @returns {Promise<string>} Base64 编码的图片数据 URL
 */
async function captureVisibleTab(tab) {
  return new Promise((resolve, reject) => {
    // 获取标签页所在的窗口
    const windowId = tab ? tab.windowId : chrome.windows.WINDOW_ID_CURRENT;

    chrome.tabs.captureVisibleTab(windowId, {
      format: 'png',
      quality: 100
    }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (!dataUrl) {
        reject(new Error('截图数据为空'));
        return;
      }

      resolve(dataUrl);
    });
  });
}

// ============================================================================
// 下载功能
// ============================================================================

/**
 * 下载截图到本地
 * @param {string} dataUrl - Base64 编码的图片数据 URL
 * @param {string} filename - 文件名
 * @returns {Promise<number>} 下载 ID
 */
async function downloadScreenshot(dataUrl, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false, // 自动保存，不弹出对话框
      conflictAction: 'uniquify' // 文件名冲突时自动重命名
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (downloadId === undefined) {
        reject(new Error('下载 ID 为空'));
        return;
      }

      resolve(downloadId);
    });
  });
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 清理品种名称以生成安全的文件名
 * @param {string} symbol - 原始品种名称
 * @returns {string} 清理后的品种名称
 */
function sanitizeSymbol(symbol) {
  if (!symbol || typeof symbol !== 'string') {
    return 'unknown';
  }

  // 移除交易所前缀（如 "NASDAQ:AAPL" → "AAPL"）
  const withoutExchange = symbol.split(':').pop() || symbol;

  // 替换不安全字符
  return withoutExchange.replace(/[^A-Z0-9]/gi, '_').toUpperCase();
}

/**
 * 格式化时间戳用于文件名
 * @param {Date} date - 日期对象
 * @returns {string} 格式化的时间戳 (YYYYMMDD_HHmmss)
 */
function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * 生成截图文件名
 * @param {string} symbol - 品种名称
 * @param {string} interval - 时间周期
 * @param {number} timestamp - Unix 毫秒时间戳
 * @returns {string} 生成的文件名
 */
function generateFilename(symbol, interval, timestamp) {
  const sanitizedSymbol = sanitizeSymbol(symbol);
  const date = new Date(timestamp);
  const dateStr = formatTimestamp(date);
  return `${sanitizedSymbol}_${interval}_${dateStr}.png`;
}

// ============================================================================
// 初始化
// ============================================================================

console.log('[TV SnapMaster SW] Service Worker 已启动');
