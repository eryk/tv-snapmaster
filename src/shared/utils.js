/**
 * TV SnapMaster - 工具函数
 * 文件名生成、时间戳格式化、品种清理
 */

// ============================================================================
// 品种名称处理
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
  return withoutExchange.replace(CONFIG.UNSAFE_CHARS_REGEX, CONFIG.SAFE_CHAR).toUpperCase();
}

// ============================================================================
// 时间戳处理
// ============================================================================

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

// ============================================================================
// 文件名生成
// ============================================================================

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
// 周期验证
// ============================================================================

/**
 * 验证周期值是否有效
 * @param {*} value - 待验证的值
 * @returns {boolean} 是否为有效周期
 */
function isValidInterval(value) {
  return typeof value === 'string' && INTERVALS.includes(value);
}

/**
 * 标准化周期格式
 * @param {string} interval - 周期字符串
 * @returns {string|null} 标准化后的周期
 */
function normalizeInterval(interval) {
  if (!interval || typeof interval !== 'string') {
    return null;
  }

  const normalized = interval.trim().toLowerCase();
  const map = {
    '15': '15m', '15m': '15m',
    '60': '1h', '1h': '1h',
    '240': '4h', '4h': '4h',
    'd': '1D', '1d': '1D',
    'w': '1W', '1w': '1W'
  };

  return map[normalized] || null;
}

// ============================================================================
// 通用工具
// ============================================================================

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成 UUID v4
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
 * 检查元素是否可见
 * @param {Element} element - DOM 元素
 * @returns {boolean} 是否可见
 */
function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' &&
         style.visibility !== 'hidden' &&
         style.opacity !== '0';
}

/**
 * 使用多选择器策略查找元素
 * @param {string[]} selectors - 选择器数组（按优先级排列）
 * @returns {Element|null} 找到的元素或 null
 */
function findElement(selectors) {
  for (const selector of selectors) {
    try {
      const element = document.querySelector(selector);
      if (element && isVisible(element)) {
        return element;
      }
    } catch (e) {
      // 选择器无效，继续尝试下一个
      console.warn('[TV SnapMaster] 无效选择器:', selector);
    }
  }
  return null;
}

/**
 * 使用多选择器策略和重试机制查找元素
 * @param {string[]} selectors - 选择器数组（按优先级排列）
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Element|null>} 找到的元素或 null
 */
async function findElementWithRetry(selectors, maxRetries = CONFIG.MAX_RETRIES) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const element = findElement(selectors);
    if (element) {
      console.log(`[TV SnapMaster] 找到元素 (尝试 ${attempt + 1})`);
      return element;
    }
    console.log(`[TV SnapMaster] 重试 ${attempt + 1}/${maxRetries}...`);
    await sleep(CONFIG.RETRY_DELAY);
  }
  console.error('[TV SnapMaster] 元素未找到:', selectors);
  return null;
}

/**
 * 创建错误对象
 * @param {string} code - 错误代码
 * @param {string} [details] - 额外详情
 * @returns {Object} 错误对象
 */
function createError(code, details = '') {
  return {
    code: code,
    message: ERROR_MESSAGES[code] || ERROR_MESSAGES.UNKNOWN,
    details: details
  };
}

/**
 * 创建状态对象
 * @param {string} status - 状态代码
 * @param {Object} [options] - 可选参数
 * @returns {Object} 状态对象
 */
function createState(status, options = {}) {
  return {
    status: status,
    message: STATUS_MESSAGES[status] || '',
    request: options.request || null,
    error: options.error || null,
    symbol: options.symbol || null,
    currentInterval: options.currentInterval || null
  };
}
