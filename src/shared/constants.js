/**
 * TV SnapMaster - 共享常量
 * 周期定义、选择器常量、配置
 */

// ============================================================================
// 时间周期定义
// ============================================================================

/**
 * 支持的时间周期
 * @type {readonly string[]}
 */
const INTERVALS = Object.freeze(['1m', '5m', '15m', '1h', '4h', '1D', '1W']);

/**
 * 周期显示标签
 * @type {Object.<string, string>}
 */
const INTERVAL_LABELS = Object.freeze({
  '1m': '1 分钟',
  '5m': '5 分钟',
  '15m': '15 分钟',
  '1h': '1 小时',
  '4h': '4 小时',
  '1D': '1 日',
  '1W': '1 周'
});

/**
 * TradingView 键盘输入格式
 * 用于备选的键盘输入切换周期
 * @type {Object.<string, string>}
 */
const INTERVAL_KEYBOARD_INPUT = Object.freeze({
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1D': '1D',
  '1W': '1W'
});

// ============================================================================
// 消息类型
// ============================================================================

/**
 * 插件内部消息类型
 * @type {Object.<string, string>}
 */
const MESSAGE_TYPES = Object.freeze({
  // Popup → Content Script
  CAPTURE: 'CAPTURE',
  GET_PAGE_INFO: 'GET_PAGE_INFO',
  GET_THEME: 'GET_THEME',

  // Content Script → Popup
  STATUS_UPDATE: 'STATUS_UPDATE',
  PAGE_INFO: 'PAGE_INFO',
  THEME: 'THEME',

  // Content Script → Service Worker
  CAPTURE_TAB: 'CAPTURE_TAB',

  // Service Worker → Content Script
  CAPTURE_COMPLETE: 'CAPTURE_COMPLETE'
});

// ============================================================================
// 截图状态
// ============================================================================

/**
 * 截图工作流程状态
 * @type {Object.<string, string>}
 */
const CAPTURE_STATUS = Object.freeze({
  IDLE: 'idle',
  SWITCHING: 'switching',
  LOADING: 'loading',
  CAPTURING: 'capturing',
  DOWNLOADING: 'downloading',
  COMPLETE: 'complete',
  ERROR: 'error'
});

/**
 * 状态显示消息
 * @type {Object.<string, string>}
 */
const STATUS_MESSAGES = Object.freeze({
  idle: '准备就绪',
  switching: '切换周期中...',
  loading: '等待图表加载...',
  capturing: '截图中...',
  downloading: '下载中...',
  complete: '完成！',
  error: '发生错误'
});

// ============================================================================
// 错误代码
// ============================================================================

/**
 * 错误代码定义
 * @type {Object.<string, string>}
 */
const ERROR_CODES = Object.freeze({
  NOT_TRADINGVIEW: 'NOT_TRADINGVIEW',
  INTERVAL_SWITCH_FAILED: 'INTERVAL_SWITCH_FAILED',
  LOAD_TIMEOUT: 'LOAD_TIMEOUT',
  CAPTURE_FAILED: 'CAPTURE_FAILED',
  DOWNLOAD_FAILED: 'DOWNLOAD_FAILED',
  SYMBOL_NOT_FOUND: 'SYMBOL_NOT_FOUND',
  UNKNOWN: 'UNKNOWN'
});

/**
 * 错误消息
 * @type {Object.<string, string>}
 */
const ERROR_MESSAGES = Object.freeze({
  NOT_TRADINGVIEW: '请导航到 TradingView 图表页面',
  INTERVAL_SWITCH_FAILED: '切换时间周期失败',
  LOAD_TIMEOUT: '图表加载超时',
  CAPTURE_FAILED: '截图失败',
  DOWNLOAD_FAILED: '下载截图失败',
  SYMBOL_NOT_FOUND: '无法检测品种名称',
  UNKNOWN: '发生未知错误'
});

// ============================================================================
// 配置常量
// ============================================================================

/**
 * 插件配置
 * @type {Object}
 */
const CONFIG = Object.freeze({
  /** 等待图表加载的最大时间（毫秒） */
  LOAD_TIMEOUT: 10000,

  /** 变化停止后认为图表稳定的时间（毫秒） */
  STABLE_TIME: 1000,

  /** 图表加载后截图前的缓冲时间（毫秒） */
  CAPTURE_BUFFER: 500,

  /** 重试次数 */
  MAX_RETRIES: 3,

  /** 重试延迟（毫秒） */
  RETRY_DELAY: 500,

  /** 文件名时间戳格式 */
  TIMESTAMP_FORMAT: 'YYYYMMDD_HHmmss',

  /** 品种名称中需要替换的不安全字符 */
  UNSAFE_CHARS_REGEX: /[^A-Z0-9]/gi,

  /** 不安全字符的替换字符 */
  SAFE_CHAR: '_'
});

// ============================================================================
// DOM 选择器
// ============================================================================

/**
 * TradingView DOM 选择器（按优先级排列）
 * 遵循项目宪法：data-* > aria-* > title > role > 类名
 * @type {Object}
 */
const SELECTORS = Object.freeze({
  /** 品种名称选择器 */
  SYMBOL: [
    '[data-name="legend-source-title"]',
    '[aria-label*="symbol"]',
    '[title*="symbol"]',
    '.chart-widget .symbol-info',
    '[data-symbol]'
  ],

  /** 周期按钮选择器 */
  INTERVAL_BUTTON: [
    '[data-name="time-interval-menu"]',
    '[aria-label*="时间周期"]',
    '[aria-label*="interval"]',
    'button[title*="interval"]'
  ],

  /** 加载指示器选择器 */
  LOADING_INDICATOR: [
    '.tv-spinner',
    '[class*="spinner"]',
    '[class*="loading"]',
    '[class*="loader"]',
    '[data-loading="true"]',
    '.chart-loading-overlay'
  ],

  /** 图表 Canvas 选择器 */
  CHART_CANVAS: [
    'canvas.chart-markup-table',
    'canvas[class*="chart"]',
    'canvas'
  ],

  /** 对话框选择器 */
  DIALOG: [
    '[data-dialog-name]',
    '[role="dialog"]',
    '[class*="dialog"]',
    '[class*="modal"]',
    '[class*="popup"]',
    '.tv-dialog',
    '.tv-toast'
  ],

  /** 主题类选择器模式 */
  THEME_PATTERNS: [
    /theme-(dark|light)/i,
    /(dark|light)-theme/i,
    /tv-theme-(dark|light)/i
  ]
});

/**
 * 关闭按钮文本模式
 * @type {readonly string[]}
 */
const DISMISS_BUTTON_PATTERNS = Object.freeze([
  'ok', '确定', '好的',
  'close', '关闭',
  'dismiss',
  'cancel', '取消',
  'got it', '知道了',
  'accept', '接受',
  'agree', '同意',
  'continue', '继续',
  'skip', '跳过',
  'not now', '稍后',
  'x', '×', '\u00d7'
]);
