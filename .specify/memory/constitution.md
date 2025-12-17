# 项目宪法: TV SnapMaster

**项目类型**: Chrome 浏览器插件
**目标平台**: TradingView 网页自动化
**创建日期**: 2025-12-17
**状态**: 生效中

---

## 核心原则

### 1. 语言规范 (必须遵守)

**规则**: 项目中所有文档和代码注释**必须使用简体中文 (Simplified Chinese)**。

**适用范围**:
- 规格说明书 (spec.md)
- 技术计划 (plan.md)
- 任务列表 (tasks.md)
- 研究文档 (research.md)
- 代码注释和文档字符串
- 提交信息 (commit messages)
- 用户界面文本

**例外情况**:
- 代码变量名、函数名使用英文 (JavaScript 标准)
- 技术术语可保留英文原文 (如 DOM, API, Canvas)
- 第三方库/API 名称保持原样

---

### 2. 技术规范 (必须遵守)

**规则**: 必须严格遵守 **Google Chrome Manifest V3** 标准。

**要求**:
- [ ] 使用 `manifest_version: 3`
- [ ] 后台脚本使用 Service Worker (`background.service_worker`)
- [ ] 不使用已废弃的 Manifest V2 API
- [ ] 遵循 Chrome 扩展安全策略 (CSP)

**参考资源**:
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [从 Manifest V2 迁移到 V3](https://developer.chrome.com/docs/extensions/develop/migrate)

---

### 3. 代码风格 (必须遵守)

**规则**: 使用**原生 JavaScript (ES6+)**，保持插件轻量化。

**要求**:
- [ ] 不引入 React、Vue、Angular 等前端框架
- [ ] 不引入 Webpack、Rollup 等构建工具 (除非绝对必要)
- [ ] 优先使用浏览器原生 API
- [ ] 保持代码简洁，避免过度抽象

**允许的依赖**:
- Chrome Extension APIs (原生)
- 轻量工具库 (如需要，应小于 10KB)

**例外情况**:
- 如果 UI 复杂度超出原生 JavaScript 合理管理范围，可在获得明确批准后引入轻量框架

---

### 4. 健壮性要求 (必须遵守)

**规则**: DOM 选择器必须具备**高可靠性和容错能力**。

**背景**: TradingView 的 DOM 类名可能是动态生成的（如 `css-1abc2de`），容易在版本更新后失效。

**选择器优先级** (从高到低):
1. `data-name`, `data-*` 属性
2. `aria-label`, `aria-*` 属性
3. `title` 属性
4. `role` 属性
5. 稳定的 ID (如 `#chart-container`)
6. 语义化类名 (如 `.chart-widget`)
7. 动态类名 (最后手段，需配合其他选择器)

**必需机制**:
- [ ] 每个关键 DOM 操作必须有重试机制 (最多 3 次)
- [ ] 每个选择器必须有至少一个备选方案
- [ ] 选择器失效时记录详细错误日志
- [ ] 使用 MutationObserver 处理动态加载的元素

**代码示例**:
```javascript
/**
 * 使用多策略选择元素
 * @param {string[]} selectors - 选择器优先级列表
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<Element|null>}
 */
async function findElement(selectors, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    await sleep(500); // 等待后重试
  }
  console.error('[TV SnapMaster] 元素未找到:', selectors);
  return null;
}
```

---

### 5. 权限最小化 (必须遵守)

**规则**: 只申请**绝对必要的权限**。

**允许的权限**:

| 权限 | 用途 | 必要性 |
|------|------|--------|
| `activeTab` | 访问当前活动标签页 | 必需 - 截图功能 |
| `downloads` | 下载截图文件 | 必需 - 保存截图 |
| `scripting` | 注入内容脚本 | 可选 - 动态注入 |
| `storage` | 存储用户偏好 | 可选 - 仅在需要时添加 |

**禁止的权限**:

| 权限 | 原因 |
|------|------|
| `<all_urls>` | 过于宽泛，违反最小权限原则 |
| `tabs` | 不需要访问所有标签页信息 |
| `history` | 与功能无关 |
| `cookies` | 与功能无关 |
| `webRequest` | 不需要拦截网络请求 |

**Host Permissions**:
```json
{
  "host_permissions": [
    "*://www.tradingview.com/*",
    "*://*.tradingview.com/*"
  ]
}
```
仅限 TradingView 域名，不扩展到其他网站。

---

### 6. 文件结构 (必须遵守)

**规则**: 保持清晰的目录结构，明确区分各组件。

**标准结构**:
```
src/
├── manifest.json           # 扩展配置文件
├── background/
│   └── service-worker.js   # 后台服务 (截图、下载)
├── content/
│   ├── content.js          # 主内容脚本
│   └── tradingview.js      # TradingView DOM 操作
├── popup/
│   ├── popup.html          # 弹出窗口结构
│   ├── popup.js            # 弹出窗口逻辑
│   └── popup.css           # 弹出窗口样式
├── shared/
│   ├── constants.js        # 共享常量
│   └── utils.js            # 工具函数
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png

specs/                      # 设计文档 (不包含在发布包中)
├── 001-tv-snapmaster/
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md

tests/                      # 测试文件 (不包含在发布包中)
├── unit/
└── manual/
```

**命名规范**:
- 文件名: 小写，连字符分隔 (`service-worker.js`)
- 变量/函数: camelCase (`extractSymbol`)
- 常量: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- 类名: PascalCase (`CaptureState`)

---

## 验证检查清单

在每次代码提交前，确认以下项目:

### 语言检查
- [ ] 所有新增文档使用简体中文
- [ ] 代码注释使用简体中文
- [ ] 用户可见文本使用简体中文

### 技术检查
- [ ] manifest.json 版本为 3
- [ ] 后台使用 service_worker
- [ ] 无 Manifest V2 废弃 API 调用

### 代码检查
- [ ] 无 React/Vue/Angular 依赖
- [ ] 无不必要的 npm 包
- [ ] 使用原生浏览器 API

### 健壮性检查
- [ ] DOM 选择器有备选方案
- [ ] 关键操作有重试机制
- [ ] 错误情况有日志记录

### 权限检查
- [ ] manifest.json 只声明必要权限
- [ ] host_permissions 仅限 TradingView

### 结构检查
- [ ] 文件在正确目录下
- [ ] 命名符合规范

---

## 修订历史

| 版本 | 日期 | 修改内容 |
|------|------|----------|
| 1.0 | 2025-12-17 | 初始版本 - 建立六大核心原则 |

---

**本宪法为项目的最高指导原则，所有开发活动必须遵守。如需修改，必须获得明确批准并记录在修订历史中。**
