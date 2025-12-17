# 数据模型: TV SnapMaster

**功能**: TV SnapMaster Chrome 插件
**分支**: `001-tv-snapmaster`
**日期**: 2025-12-17

## 概述

本文档定义了插件各组件（popup、content script、service worker）之间通信使用的数据结构，以及截图状态管理。

---

## 核心实体

### 1. CaptureRequest（截图请求）

表示用户从 popup 发起的截图请求，发送给 content script。

```typescript
interface CaptureRequest {
  /** 唯一请求标识符 */
  id: string;

  /** 图表目标时间周期 */
  interval: Interval;

  /** 请求发起时间戳 */
  timestamp: number;
}
```

**验证规则**:
- `id` 必须是有效的 UUID v4
- `interval` 必须是支持的周期之一
- `timestamp` 必须是有效的 Unix 毫秒时间戳

---

### 2. Interval（时间周期）

支持的图表时间周期。

```typescript
type Interval = '15m' | '1h' | '4h' | '1D' | '1W';

const INTERVALS: readonly Interval[] = ['15m', '1h', '4h', '1D', '1W'];

const INTERVAL_LABELS: Record<Interval, string> = {
  '15m': '15 分钟',
  '1h': '1 小时',
  '4h': '4 小时',
  '1D': '1 日',
  '1W': '1 周'
};

/** TradingView 键盘输入格式 */
const INTERVAL_KEYBOARD_INPUT: Record<Interval, string> = {
  '15m': '15',
  '1h': '60',
  '4h': '240',
  '1D': '1D',
  '1W': '1W'
};
```

---

### 3. CaptureState（截图状态）

截图工作流程的当前状态。

```typescript
type CaptureStatus =
  | 'idle'           // 空闲 - 无截图进行中
  | 'switching'      // 切换中 - 正在切换到目标周期
  | 'loading'        // 加载中 - 等待图表加载
  | 'capturing'      // 截图中 - 正在截取屏幕
  | 'downloading'    // 下载中 - 正在保存文件
  | 'complete'       // 完成 - 成功完成
  | 'error';         // 错误 - 操作失败

interface CaptureState {
  /** 当前状态 */
  status: CaptureStatus;

  /** 关联的请求（如有） */
  request: CaptureRequest | null;

  /** UI 显示的进度消息 */
  message: string;

  /** 错误详情（当 status === 'error' 时） */
  error: CaptureError | null;

  /** 当前品种（从页面提取） */
  symbol: string | null;

  /** 页面上检测到的当前周期 */
  currentInterval: Interval | null;
}
```

**状态转换**:
```
idle → switching → loading → capturing → downloading → complete → idle
                                                    ↘ error → idle
```

---

### 4. CaptureError（截图错误）

截图失败时的错误信息。

```typescript
interface CaptureError {
  /** 错误代码，用于程序化处理 */
  code: ErrorCode;

  /** 人类可读的错误消息 */
  message: string;

  /** 额外上下文信息 */
  details?: string;
}

type ErrorCode =
  | 'NOT_TRADINGVIEW'      // 不在 TradingView 图表页面
  | 'INTERVAL_SWITCH_FAILED' // 无法切换到目标周期
  | 'LOAD_TIMEOUT'         // 图表加载超时
  | 'CAPTURE_FAILED'       // 截图 API 失败
  | 'DOWNLOAD_FAILED'      // 文件下载失败
  | 'SYMBOL_NOT_FOUND'     // 无法检测品种名称
  | 'UNKNOWN';             // 未知错误

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  NOT_TRADINGVIEW: '请导航到 TradingView 图表页面',
  INTERVAL_SWITCH_FAILED: '切换时间周期失败',
  LOAD_TIMEOUT: '图表加载超时',
  CAPTURE_FAILED: '截图失败',
  DOWNLOAD_FAILED: '下载截图失败',
  SYMBOL_NOT_FOUND: '无法检测品种名称',
  UNKNOWN: '发生未知错误'
};
```

---

### 5. Screenshot（截图）

截取的截图元数据。

```typescript
interface Screenshot {
  /** 品种名称（已清理，适合文件名） */
  symbol: string;

  /** 时间周期 */
  interval: Interval;

  /** 截图时间戳 */
  timestamp: number;

  /** 生成的文件名 */
  filename: string;

  /** 截取图片的 Data URL */
  dataUrl: string;
}
```

**文件名格式**: `{品种}_{周期}_{YYYYMMDD}_{HHmmss}.png`

**示例**: `BTCUSDT_4h_20251217_143052.png`

---

### 6. PageInfo（页面信息）

从 TradingView 页面提取的信息。

```typescript
interface PageInfo {
  /** 图表上显示的当前品种 */
  symbol: string;

  /** 当前时间周期 */
  interval: Interval | null;

  /** 当前主题 */
  theme: Theme;

  /** 图表是否正在加载 */
  isLoading: boolean;

  /** 页面 URL */
  url: string;
}

type Theme = 'dark' | 'light';
```

---

## 消息类型

通过 `chrome.runtime.sendMessage` 和 `chrome.tabs.sendMessage` 在插件组件之间交换的消息。

### Popup → Content Script

```typescript
/** 请求在指定周期截图 */
interface CaptureMessage {
  type: 'CAPTURE';
  payload: CaptureRequest;
}

/** 请求当前页面信息 */
interface GetPageInfoMessage {
  type: 'GET_PAGE_INFO';
}

/** 请求当前主题 */
interface GetThemeMessage {
  type: 'GET_THEME';
}
```

### Content Script → Popup

```typescript
/** 截图过程中的状态更新 */
interface StatusUpdateMessage {
  type: 'STATUS_UPDATE';
  payload: CaptureState;
}

/** 页面信息响应 */
interface PageInfoResponse {
  type: 'PAGE_INFO';
  payload: PageInfo;
}

/** 主题响应 */
interface ThemeResponse {
  type: 'THEME';
  payload: {
    theme: Theme;
  };
}
```

### Content Script → Service Worker

```typescript
/** 请求截取可见标签页 */
interface CaptureTabMessage {
  type: 'CAPTURE_TAB';
  payload: {
    symbol: string;
    interval: Interval;
    timestamp: number;
  };
}
```

### Service Worker → Content Script / Popup

```typescript
/** 截图完成通知 */
interface CaptureCompleteMessage {
  type: 'CAPTURE_COMPLETE';
  payload: {
    success: boolean;
    filename?: string;
    error?: CaptureError;
  };
}
```

---

## 消息处理联合类型

```typescript
/** 发送到 content script 的所有消息 */
type ContentScriptMessage =
  | CaptureMessage
  | GetPageInfoMessage
  | GetThemeMessage;

/** 发送到 popup 的所有消息 */
type PopupMessage =
  | StatusUpdateMessage
  | PageInfoResponse
  | ThemeResponse
  | CaptureCompleteMessage;

/** 发送到 service worker 的所有消息 */
type ServiceWorkerMessage =
  | CaptureTabMessage;
```

---

## 存储结构

存储在 `chrome.storage.local` 中的数据（如未来功能需要）。

```typescript
interface StorageSchema {
  /** 用户偏好设置（未来功能） */
  preferences?: {
    defaultIntervals: Interval[];
    downloadPath?: string;
  };

  /** 截图历史（未来功能） */
  history?: {
    captures: Array<{
      filename: string;
      timestamp: number;
      symbol: string;
      interval: Interval;
    }>;
    maxEntries: number;
  };
}
```

**注意**: 存储对于 MVP 是可选的。核心功能无需持久化存储即可工作。

---

## 常量

```typescript
/** 插件配置 */
const CONFIG = {
  /** 等待图表加载的最大时间（毫秒） */
  LOAD_TIMEOUT: 10000,

  /** 变化停止后认为图表稳定的时间（毫秒） */
  STABLE_TIME: 1000,

  /** 图表加载后截图前的缓冲时间（毫秒） */
  CAPTURE_BUFFER: 500,

  /** 支持的 TradingView URL 模式 */
  URL_PATTERNS: [
    '*://www.tradingview.com/chart/*',
    '*://*.tradingview.com/chart/*'
  ],

  /** 文件名时间戳格式 */
  TIMESTAMP_FORMAT: 'YYYYMMDD_HHmmss',

  /** 品种名称中需要替换的不安全字符 */
  UNSAFE_CHARS_REGEX: /[^A-Z0-9]/gi,

  /** 不安全字符的替换字符 */
  SAFE_CHAR: '_'
} as const;
```

---

## 验证函数

```typescript
/** 验证周期值 */
function isValidInterval(value: unknown): value is Interval {
  return typeof value === 'string' && INTERVALS.includes(value as Interval);
}

/** 清理品种名称以生成安全的文件名 */
function sanitizeSymbol(symbol: string): string {
  // 移除交易所前缀（如 "NASDAQ:AAPL" → "AAPL"）
  const withoutExchange = symbol.split(':').pop() || symbol;
  // 替换不安全字符
  return withoutExchange.replace(CONFIG.UNSAFE_CHARS_REGEX, CONFIG.SAFE_CHAR);
}

/** 生成截图文件名 */
function generateFilename(symbol: string, interval: Interval, timestamp: number): string {
  const sanitizedSymbol = sanitizeSymbol(symbol);
  const date = new Date(timestamp);
  const dateStr = formatTimestamp(date);
  return `${sanitizedSymbol}_${interval}_${dateStr}.png`;
}

/** 格式化时间戳用于文件名 */
function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}
```

---

## 状态机图

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
              ┌──────────┐                                    │
    ─────────▶│   空闲   │◀─────────────────────────┐        │
              │  (IDLE)  │                          │        │
              └────┬─────┘                          │        │
                   │                                │        │
                   │ 截图请求                        │        │
                   ▼                                │        │
              ┌──────────┐                          │        │
              │  切换中  │───── 周期已选中 ──────────┘        │
              │(SWITCH)  │                                   │
              └────┬─────┘                                   │
                   │                                         │
                   │ 周期已切换                               │
                   ▼                                         │
              ┌──────────┐                                   │
              │  加载中  │───── 超时 ─────▶ 错误 ─────────────┤
              │(LOADING) │                                   │
              └────┬─────┘                                   │
                   │                                         │
                   │ 图表已加载                               │
                   ▼                                         │
              ┌──────────┐                                   │
              │  截图中  │───── API 错误 ──▶ 错误 ────────────┤
              │(CAPTURE) │                                   │
              └────┬─────┘                                   │
                   │                                         │
                   │ 截图完成                                 │
                   ▼                                         │
              ┌───────────┐                                  │
              │  下载中   │───── 保存错误 ──▶ 错误 ───────────┘
              │(DOWNLOAD) │
              └─────┬─────┘
                    │
                    │ 文件已保存
                    ▼
              ┌──────────┐
              │   完成   │────────────────────▶ 空闲
              │(COMPLETE)│
              └──────────┘
```

---

**文档版本**: 1.0
**最后更新**: 2025-12-17
