# Flux Workflow

> 🎨 **flux-agent 配套可视化工具**
>
> Flux Workflow 是 [flux-agent](https://github.com/xiaoxuz/flux-agent) 的可视化编排层，提供拖拽式工作流编辑器 + 可视化 Agent 管理界面。

## 项目定位

本项目基于 **flux-agent** 框架构建，核心能力依赖：
- 工作流执行引擎
- Agent 运行框架
- 工具调用系统

📦 **flux-agent 源码**: https://github.com/xiaoxuz/flux-agent

## 功能特性

### 工作流编排
- 🔧 **可视化工作流编排** - 基于 @xyflow/react 的拖拽式编辑器
- 📊 **执行追踪** - 实时执行流 + 详细 Trace 追踪
- 📋 **仪表盘** - 全局概览，快速掌握工作流运行状态

### Agent 生态
- 🤖 **Agent 管理** - 可视化配置 ReAct Agent，支持对话调试
- 🚀 **Skill 管理** - 支持 ZIP 上传 / 在线编辑 / 实时同步至 Agent，Skill 可在 Agent 和工作流中引用
- 🌐 **MCP Server 集成** - 支持 MCP 协议的 Server 注册与管理，扩展 Agent 工具能力

### 工具与知识
- 🛠️ **工具管理** - 内置工具库 + 自定义 Python 代码工具 + MCP Server 工具
- 📚 **知识库** - RAG 向量检索节点，支持文档上传、向量化、在线检索
  - 支持多种向量库后端
  - LLM 节点可直接引用知识库进行 RAG 检索

## 访问地址

## 访问地址

- 前端：http://localhost:3000/flux-workflow/
- 后端：http://localhost:8006/flux-workflow/api/

## 快速开始

### 后端（本地开发）

```bash
cd /Users/xiaoxuz/Documents/code/python/flux-workflow
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8006 --reload
```

### 前端（本地开发）

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000/flux-workflow/

### Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d

# 仅启动后端
docker-compose up -d backend

# 构建前端（需要先构建才能部署）
docker-compose --profile build up --build
```

## 技术栈

### 核心依赖
- **[flux-agent](https://github.com/xiaoxuz/flux-agent)** - AI Agent & 工作流执行框架

### 后端
- FastAPI + SQLAlchemy + Pydantic
- aiosqlite (异步 SQLite)

### 前端
- React 18 + TypeScript
- Ant Design 5.x + @xyflow/react (工作流图编辑器)
- Zustand (状态管理)

## API 端点

| 功能 | 路径 |
|------|------|
| 健康检查 | `/flux-workflow/api/health` |
| 仪表盘 | `/flux-workflow/api/dashboard` |
| 工作流 | `/flux-workflow/api/workflows` |
| 执行 | `/flux-workflow/api/executions` |
| Agent | `/flux-workflow/api/agents` |
| 工具 | `/flux-workflow/api/tools` |
| MCP Server | `/flux-workflow/api/mcp_servers` |
| 知识库 | `/flux-workflow/api/knowledge_bases` |
| Skill | `/flux-workflow/api/skills` |