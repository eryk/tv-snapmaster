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
  intervalCheckboxes: document.querySelectorAll('.interval-checkbox'),
  intervalItems: document.querySelectorAll('.interval-item'),
  batchCaptureBtn: document.getElementById('batchCaptureBtn')
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

  // 绑定复选框事件
  elements.intervalCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', handleCheckboxChange);
  });

  // 绑定批量截图按钮
  elements.batchCaptureBtn.addEventListener('click', handleBatchCapture);

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
// 复选框和批量截图处理
// ============================================================================

/**
 * 处理复选框变化
 */
function handleCheckboxChange() {
  const selectedIntervals = getSelectedIntervals();

  // 更新批量截图按钮状态
  elements.batchCaptureBtn.disabled = selectedIntervals.length === 0;

  // 更新按钮文本
  if (selectedIntervals.length === 0) {
    elements.batchCaptureBtn.textContent = '批量截图';
  } else if (selectedIntervals.length === 1) {
    elements.batchCaptureBtn.textContent = '截图';
  } else {
    elements.batchCaptureBtn.textContent = `批量截图 (${selectedIntervals.length})`;
  }
}

/**
 * 获取选中的周期
 * @returns {string[]} 选中的周期数组
 */
function getSelectedIntervals() {
  return Array.from(elements.intervalCheckboxes)
    .filter(checkbox => checkbox.checked)
    .map(checkbox => checkbox.dataset.interval);
}

/**
 * 处理批量截图
 */
async function handleBatchCapture() {
  if (isCapturing) {
    console.log('[TV SnapMaster Popup] 截图进行中，忽略点击');
    return;
  }

  const intervals = getSelectedIntervals();

  if (intervals.length === 0) {
    showError('请至少选择一个周期');
    return;
  }

  console.log('[TV SnapMaster Popup] 开始批量截图:', intervals);

  // 开始批量截图流程
  await startBatchCapture(intervals);
}

/**
 * 开始批量截图
 * @param {string[]} intervals - 周期数组
 */
async function startBatchCapture(intervals) {
  isCapturing = true;
  hideError();

  // 设置UI状态
  elements.batchCaptureBtn.classList.add('loading');
  document.body.classList.add('loading');
  disableAllCheckboxes();

  const total = intervals.length;
  let completed = 0;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('无法获取当前标签页');
    }

    // 依次处理每个周期
    for (let i = 0; i < intervals.length; i++) {
      const interval = intervals[i];

      // 更新进度状态
      updateStatus('working', `正在处理 ${i + 1}/${total}: ${interval}`);

      // 高亮当前处理的周期
      highlightProcessingInterval(interval);

      try {
        // 发送截图请求
        const response = await sendMessageToTab(tab.id, {
          type: 'CAPTURE',
          payload: {
            id: generateUUID(),
            interval: interval,
            timestamp: Date.now()
          }
        });

        console.log(`[TV SnapMaster Popup] 截图响应 ${interval}:`, response);

        if (response && response.status === 'complete') {
          completed++;
        } else if (response && response.status === 'error') {
          console.error(`[TV SnapMaster Popup] 截图失败 ${interval}:`, response.error);
          // 继续处理下一个，不中断整个流程
        }

        // 等待一小段时间再进行下一个截图
        if (i < intervals.length - 1) {
          await sleep(500);
        }

      } catch (error) {
        console.error(`[TV SnapMaster Popup] 处理周期 ${interval} 时出错:`, error);
        // 继续处理下一个
      }
    }

    // 全部完成
    updateStatus('success', `完成！已截图 ${completed}/${total} 个周期`);

    setTimeout(() => {
      updateStatus('idle', '准备就绪');
      clearHighlights();
    }, 3000);

  } catch (error) {
    console.error('[TV SnapMaster Popup] 批量截图错误:', error);
    showError(error.message || '发生错误');
    updateStatus('error', '发生错误');
  } finally {
    // 重置UI状态
    elements.batchCaptureBtn.classList.remove('loading');
    document.body.classList.remove('loading');
    enableAllCheckboxes();
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
 * 高亮当前周期
 * @param {string} interval - 当前周期
 */
function highlightCurrentInterval(interval) {
  clearHighlights();
  elements.intervalItems.forEach(item => {
    const checkbox = item.querySelector('.interval-checkbox');
    if (checkbox && checkbox.dataset.interval === interval) {
      item.classList.add('active');
    }
  });
}

/**
 * 高亮正在处理的周期
 * @param {string} interval - 正在处理的周期
 */
function highlightProcessingInterval(interval) {
  clearHighlights();
  elements.intervalItems.forEach(item => {
    const checkbox = item.querySelector('.interval-checkbox');
    if (checkbox && checkbox.dataset.interval === interval) {
      item.classList.add('active');
    }
  });
}

/**
 * 清除所有高亮
 */
function clearHighlights() {
  elements.intervalItems.forEach(item => {
    item.classList.remove('active');
  });
}

// ============================================================================
// 复选框和按钮状态
// ============================================================================

/**
 * 禁用所有复选框
 */
function disableAllCheckboxes() {
  elements.intervalCheckboxes.forEach(checkbox => {
    checkbox.disabled = true;
  });
  elements.batchCaptureBtn.disabled = true;
}

/**
 * 启用所有复选框
 */
function enableAllCheckboxes() {
  elements.intervalCheckboxes.forEach(checkbox => {
    checkbox.disabled = false;
  });
  // 批量截图按钮状态取决于是否有选中的周期
  handleCheckboxChange();
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

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
