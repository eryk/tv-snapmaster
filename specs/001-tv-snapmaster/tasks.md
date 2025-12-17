# 任务列表: TV SnapMaster

**输入**: `/specs/001-tv-snapmaster/` 目录下的设计文档
**前置条件**: plan.md (必需), spec.md (必需), research.md, data-model.md, contracts/

## 格式说明: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行执行（不同文件，无依赖）
- **[Story]**: 所属用户故事 (US1, US2, US3)
- 描述中包含具体文件路径

---

## Phase 1: 项目初始化 (Setup)

**目标**: 创建 Chrome 插件基础结构和共享模块

- [x] T001 [P] 创建项目目录结构: `src/{background,content,popup,shared,icons}/`
- [x] T002 [P] 创建 `src/manifest.json` - Chrome Manifest V3 配置文件
- [x] T003 [P] 创建占位图标文件: `src/icons/icon{16,48,128}.png`
- [x] T004 [P] 创建 `src/shared/constants.js` - 周期定义、选择器常量、配置
- [x] T005 [P] 创建 `src/shared/utils.js` - 工具函数（文件名生成、时间戳格式化、品种清理）

**检查点**: 插件可在 Chrome 中加载（显示图标，无功能）

---

## Phase 2: 核心功能实现 (US1 + US2 一键截图)

**目标**: 实现核心截图工作流程 - 周期切换、加载检测、截图、下载

### 2.1 Service Worker (后台服务)

- [x] T006 [US1] 创建 `src/background/service-worker.js` - 消息监听框架
- [x] T007 [US1] 实现 `captureVisibleTab()` 截图功能
- [x] T008 [US1] 实现 `chrome.downloads.download()` 文件保存功能
- [x] T009 [US1] 实现截图完成消息回调给 Content Script

### 2.2 Content Script (DOM 操作)

- [x] T010 [US1] 创建 `src/content/tradingview.js` - TradingView DOM 选择器与工具
- [x] T011 [US1] 实现品种名称提取（多选择器策略 + 重试机制）
- [x] T012 [US1] 实现当前周期检测
- [x] T013 [US1] 实现周期切换功能（按钮点击 + 键盘输入备选）
- [x] T014 [US1] 实现图表加载完成检测（MutationObserver）
- [x] T015 [US1] 实现弹窗对话框自动关闭
- [x] T016 [US1] 创建 `src/content/content.js` - 主消息处理与截图工作流协调

### 2.3 Popup UI (用户界面)

- [x] T017 [US1] 创建 `src/popup/popup.html` - 弹窗 HTML 结构（5 个周期按钮 + 状态区域）
- [x] T018 [US1] 创建 `src/popup/popup.css` - 基础样式（深色主题默认）
- [x] T019 [US1] 创建 `src/popup/popup.js` - 按钮点击处理与消息发送
- [x] T020 [US1] 实现状态显示更新（切换中/加载中/截图中/完成/错误）
- [x] T021 [US2] 实现忙碌状态视觉反馈（按钮禁用 + 加载指示器）

**检查点**: 完整截图流程可用 - 点击按钮 → 切换周期 → 等待加载 → 截图 → 下载

---

## Phase 3: 增强与完善 (US3 主题 + Polish)

**目标**: 主题适配、错误处理优化、代码完善

### 3.1 主题适配 (US3)

- [x] T022 [US3] 在 `src/content/tradingview.js` 中实现主题检测（深色/浅色）
- [x] T023 [US3] 更新 `src/popup/popup.css` - 添加浅色主题样式变量
- [x] T024 [US3] 更新 `src/popup/popup.js` - 打开时请求主题并应用

### 3.2 错误处理与边缘情况

- [x] T025 [P] 实现非 TradingView 页面检测与友好提示
- [x] T026 [P] 实现加载超时处理（10秒超时 + 错误提示）
- [x] T027 [P] 实现品种名称特殊字符清理（文件名安全化）

### 3.3 最终验证

- [x] T028 创建 `tests/manual/test-scenarios.md` - 手动测试清单
- [x] T029 按照 `quickstart.md` 验证开发环境搭建流程
- [x] T030 验证所有用户故事验收场景

**检查点**: 所有功能完成，手动测试通过

---

## 依赖关系与执行顺序

### Phase 依赖

- **Phase 1 (Setup)**: 无依赖 - 可立即开始，所有任务可并行
- **Phase 2 (Core)**: 依赖 Phase 1 完成
  - T006-T009 (Service Worker) 可并行开发
  - T010-T016 (Content Script) 内部有依赖，顺序执行
  - T017-T021 (Popup) 可与 Service Worker 并行开发
- **Phase 3 (Polish)**: 依赖 Phase 2 完成
  - T022-T024 (主题) 顺序执行
  - T025-T027 (错误处理) 可并行

### 并行机会

```bash
# Phase 1 - 所有任务并行:
T001, T002, T003, T004, T005

# Phase 2 - 三个子系统可并行:
# 子系统 A: Service Worker (T006 → T007 → T008 → T009)
# 子系统 B: Content Script (T010 → T011 → T012 → T013 → T014 → T015 → T016)
# 子系统 C: Popup UI (T017, T018 并行 → T019 → T020 → T021)

# Phase 3 - 错误处理可并行:
T025, T026, T027
```

---

## 实现策略

### MVP 优先 (Phase 1 + Phase 2)

1. 完成 Phase 1: Setup → 插件可加载
2. 完成 Phase 2: Core → **MVP 可用** (US1 + US2 核心功能)
3. 验证: 测试截图工作流程端到端
4. 可选: 此时可部署/演示基础功能

### 完整交付 (+ Phase 3)

1. 完成 Phase 3: Polish → 主题适配 + 错误处理
2. 验证: 按照手动测试清单完整验证
3. 最终: 所有用户故事验收场景通过

---

## 备注

- [P] 标记的任务可并行执行（不同文件，无依赖）
- [US1/US2/US3] 标记表示任务所属的用户故事
- 每个任务完成后提交代码
- 在检查点暂停以验证阶段成果
- 避免: 模糊任务、同文件冲突、跨用户故事的紧耦合依赖

---

**文档版本**: 1.0
**最后更新**: 2025-12-18
