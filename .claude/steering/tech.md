# Flux Workflow - 技术栈文档

## 后端技术栈

### 核心框架
- **Python**: 3.10+
- **FastAPI**: 0.109.0+ (Web 框架)
- **Pydantic**: 2.5.0+ (数据校验)
- **uvicorn**: 0.27.0+ (ASGI 服务器)

### 数据层
- **SQLAlchemy**: 2.0.0+ (ORM)
- **aiosqlite**: 0.19.0+ (异步 SQLite)
- 数据库文件: `flux_workflow.db`

### Agent & 执行 (核心依赖)
- **flux-agent**: 0.2.0+ ⚠️ **核心执行框架**
  - 工作流执行引擎依赖 flux-agent 的编排能力
  - Agent 运行基于 flux-agent 的 ReAct 实现
  - 工具调用通过 flux-agent 的工具系统
  - **重要**: 修改执行逻辑前必须仔细阅读 flux-agent 文档和源码
- **sse-starlette**: 2.0.0+ (SSE 实时流)

### 文件上传
- **python-multipart**: 0.0.6+

## 前端技术栈

### 核心框架
- **React**: 18.2.0
- **TypeScript**: 5.3.3
- **Vite**: 5.1.4 (构建工具)

### UI 组件
- **Ant Design**: 5.15.0
- **@ant-design/icons**: 5.3.0

### 工作流编辑器
- **@xyflow/react**: 12.0.0 (React Flow，可视化图编辑器)

### 状态管理
- **Zustand**: 4.5.0

### HTTP & 工具
- **axios**: 1.6.7
- **react-markdown**: 10.1.0 (Markdown 渲染)
- **remark-gfm**: 4.0.1 (GitHub Flavored Markdown)

### 代码编辑
- **@monaco-editor/react**: 4.7.0

## 部署配置

### Docker
- Dockerfile (Python 多阶段构建)
- docker-compose.yml (多服务编排)

### 路径配置
- 项目基础路径: `/flux-workflow/`
- API 前缀: `/flux-workflow/api/`
- 后端端口: 8006
- 前端端口: 3000

## 开发工具

- **Ruff**: Python 代码格式化 (line-length: 120)
- **TypeScript**: 前端类型检查

## 开发注意事项

### flux-agent 依赖

**本项目是 flux-agent 的可视化上层工具，所有核心执行能力来自 flux-agent。**

在进行以下操作前，**必须**先阅读 flux-agent 文档和源码：
- 新增节点类型
- 修改工作流执行逻辑
- 调整 Agent 配置参数
- 扩展工具系统
- 优化执行性能
- 处理执行异常

## 性能考虑

- 工作流执行支持最大并发任务数配置
- 数据库连接池由 SQLAlchemy 自动管理
- 前端使用 Zustand 进行高效状态管理
