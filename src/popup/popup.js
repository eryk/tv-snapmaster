/**
 * TV SnapMaster - Popup 脚本
 * 按钮点击处理与状态显示
 */

// ============================================================================
// DOM 元素
// ============================================================================

const elements = {
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  symbolInfo: document.getElementById('symbolInfo'),
  errorMessage: document.getElementById('errorMessage'),
  errorText: document.getElementById('errorText'),
  hint: document.getElementById('hint'),
  intervalButtons: document.querySelectorAll('.interval-btn')
};

// ============================================================================
// 状态管理
// ============================================================================

let isCapturing = false;
let currentInterval = null;

// ============================================================================
// 初始化
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[TV SnapMaster Popup] 初始化');

  // 绑定按钮事件
  elements.intervalButtons.forEach(btn => {
    btn.addEventListener('click', () => handleIntervalClick(btn));
  });

  // 获取页面信息
  await loadPageInfo();

  // 获取主题
  await loadTheme();

  // 监听状态更新
  chrome.runtime.onMessage.addListener(handleMessage);
});

// ============================================================================
// 页面信息
// ============================================================================

/**
 * 加载当前页面信息
 */
async function loadPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes('tradingview.com/chart')) {
      showError('请在 TradingView 图表页面使用此插件');
      disableAllButtons();
      return;
    }

    // 请求页面信息
    const response = await sendMessageToTab(tab.id, { type: 'GET_PAGE_INFO' });

    if (response && response.isTradingView) {
      hideError();

      if (response.symbol && response.symbol !== 'unknown') {
        elements.symbolInfo.textContent = `当前品种: ${response.symbol}`;
      }

      if (response.interval) {
        currentInterval = response.interval;
        highlightCurrentInterval(response.interval);
      }
    } else {
      showError('无法获取页面信息，请刷新 TradingView 页面');
    }

  } catch (error) {
    console.error('[TV SnapMaster Popup] 加载页面信息失败:', error);
    showError('无法连接到页面，请刷新后重试');
  }
}

/**
 * 加载主题设置
 */
async function loadTheme() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) return;

    const response = await sendMessageToTab(tab.id, { type: 'GET_THEME' });

    if (response && response.theme) {
      applyTheme(response.theme);
    }
  } catch (error) {
    console.log('[TV SnapMaster Popup] 主题加载失败，使用默认深色主题');
  }
}

/**
 * 应用主题
 * @param {string} theme - 'dark' 或 'light'
 */
function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light');
  document.body.classList.add(`theme-${theme}`);
  console.log('[TV SnapMaster Popup] 应用主题:', theme);
}

// ============================================================================
// 按钮处理
// ============================================================================

/**
 * 处理周期按钮点击
 * @param {HTMLButtonElement} button - 被点击的按钮
 */
async function handleIntervalClick(button) {
  if (isCapturing) {
    console.log('[TV SnapMaster Popup] 截图进行中，忽略点击');
    return;
  }

  const interval = button.dataset.interval;
  console.log('[TV SnapMaster Popup] 点击周期按钮:', interval);

  // 开始截图流程
  startCapture(button, interval);
}

/**
 * 开始截图
 * @param {HTMLButtonElement} button - 按钮元素
 * @param {string} interval - 时间周期
 */
async function startCapture(button, interval) {
  isCapturing = true;
  hideError();

  // 设置按钮状态
  button.classList.add('loading');
  document.body.classList.add('loading');
  disableAllButtons();

  // 更新状态显示
  updateStatus('working', '切换周期中...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('无法获取当前标签页');
    }

    // 发送截图请求
    const response = await sendMessageToTab(tab.id, {
      type: 'CAPTURE',
      payload: {
        id: generateUUID(),
        interval: interval,
        timestamp: Date.now()
      }
    });

    console.log('[TV SnapMaster Popup] 截图响应:', response);

    if (response && response.status === 'complete') {
      updateStatus('success', '截图完成！');
      setTimeout(() => {
        updateStatus('idle', '准备就绪');
      }, 2000);
    } else if (response && response.status === 'error') {
      showError(response.error?.message || '截图失败');
      updateStatus('error', '截图失败');
    }

  } catch (error) {
    console.error('[TV SnapMaster Popup] 截图错误:', error);
    showError(error.message || '发生错误');
    updateStatus('error', '发生错误');
  } finally {
    // 重置按钮状态
    button.classList.remove('loading');
    document.body.classList.remove('loading');
    enableAllButtons();
    isCapturing = false;
  }
}

// ============================================================================
// 状态显示
// ============================================================================

/**
 * 更新状态显示
 * @param {string} type - 状态类型: 'idle', 'working', 'success', 'error'
 * @param {string} text - 状态文本
 */
function updateStatus(type, text) {
  elements.statusDot.className = 'status-dot ' + type;
  elements.statusText.textContent = text;
}

/**
 * 显示错误信息
 * @param {string} message - 错误消息
 */
function showError(message) {
  elements.errorText.textContent = message;
  elements.errorMessage.style.display = 'flex';
  elements.hint.style.display = 'none';
}

/**
 * 隐藏错误信息
 */
function hideError() {
  elements.errorMessage.style.display = 'none';
  elements.hint.style.display = 'block';
}

/**
 * 高亮当前周期按钮
 * @param {string} interval - 当前周期
 */
function highlightCurrentInterval(interval) {
  elements.intervalButtons.forEach(btn => {
    if (btn.dataset.interval === interval) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// ============================================================================
// 按钮状态
// ============================================================================

/**
 * 禁用所有按钮
 */
function disableAllButtons() {
  elements.intervalButtons.forEach(btn => {
    btn.disabled = true;
  });
}

/**
 * 启用所有按钮
 */
function enableAllButtons() {
  elements.intervalButtons.forEach(btn => {
    btn.disabled = false;
  });
}

// ============================================================================
// 消息处理
// ============================================================================

/**
 * 处理来自 Content Script 的消息
 * @param {Object} message - 消息对象
 */
function handleMessage(message) {
  console.log('[TV SnapMaster Popup] 收到消息:', message);

  if (message.type === 'STATUS_UPDATE') {
    const { status, message: statusMessage } = message.payload;

    const statusMap = {
      'idle': 'idle',
      'switching': 'working',
      'loading': 'working',
      'capturing': 'working',
      'downloading': 'working',
      'complete': 'success',
      'error': 'error'
    };

    updateStatus(statusMap[status] || 'idle', statusMessage);
  }
}

/**
 * 向标签页发送消息
 * @param {number} tabId - 标签页 ID
 * @param {Object} message - 消息对象
 * @returns {Promise<any>} 响应
 */
function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成 UUID
 * @returns {string} UUID 字符串
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
