# Flux Workflow - 项目结构文档

## 目录结构

```
flux-workflow/
├── api/                    # FastAPI 路由层
│   ├── __init__.py
│   ├── workflows.py        # 工作流 CRUD API
│   ├── executions.py       # 执行管理 API
│   ├── nodes.py            # 节点类型 API
│   ├── tools.py            # 工具管理 API
│   ├── knowledge_bases.py  # 知识库 API
│   └── agents.py           # Agent 管理 API
│
├── core/                   # 核心配置
│   ├── __init__.py
│   └── database.py         # 数据库连接配置
│
├── models/                 # 数据模型 (SQLAlchemy)
│   └── __init__.py         # 所有 ORM 模型定义
│
├── schemas/                # Pydantic Schema
│   └── __init__.py         # 请求/响应数据模型
│
├── services/               # 业务逻辑层
│   ├── __init__.py
│   ├── executor.py         # 工作流执行引擎
│   ├── tool_executor.py    # 工具执行器
│   ├── builtin_tools.py    # 内置工具初始化
│   └── session_manager.py  # Agent 会话管理
│
├── frontend/               # React 前端
│   ├── src/
│   │   ├── components/     # 可复用组件
│   │   │   ├── WorkflowEditor/    # 工作流编辑器
│   │   │   ├── NodeConfigPanel/   # 节点配置面板
│   │   │   └── ExecutionDetail/   # 执行详情
│   │   ├── pages/          # 页面级组件
│   │   │   ├── ToolsPage.tsx
│   │   │   ├── KnowledgeBasesPage.tsx
│   │   │   ├── AgentsPage.tsx
│   │   │   └── AgentChatPage.tsx
│   │   ├── services/       # API 调用封装
│   │   │   └── api.ts
│   │   ├── stores/         # Zustand 状态管理
│   │   │   └── index.ts
│   │   ├── types/          # TypeScript 类型定义
│   │   ├── App.tsx         # 主应用组件
│   │   ├── main.tsx        # 入口文件
│   │   └── index.css       # 全局样式
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── main.py                 # FastAPI 应用入口
├── pyproject.toml          # Python 项目配置
├── requirements.txt        # Python 依赖
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 编码规范

### Python 后端
- 使用 **Ruff** 进行代码格式化
- 行长度限制: 120 字符
- Python 版本: 3.10+
- 使用类型注解 (PEP 484)
- 异步优先 (async/await)

### TypeScript 前端
- 严格类型检查
- 函数组件使用 React.FC
- 类型定义统一放在 `types/` 目录

### API 路由规范
- 前缀: `/flux-workflow/api/`
- RESTful 风格
- 使用 tags 进行分类

### 数据库模型
- 使用 SQLAlchemy 2.0 风格
- 所有模型定义在 `models/__init__.py`
- 使用 enum 定义状态字段
- JSON 字段用于存储动态图结构

## 新功能添加指南

1. **新增 API**: 在 `api/` 目录创建新的路由文件
2. **新增模型**: 在 `models/__init__.py` 添加 ORM 模型
3. **新增 Schema**: 在 `schemas/__init__.py` 添加 Pydantic 模型
4. **新增页面**: 在 `frontend/src/pages/` 创建页面组件
5. **新增组件**: 在 `frontend/src/components/` 创建可复用组件
6. **路由注册**: 在 `main.py` 中注册新的 APIRouter
