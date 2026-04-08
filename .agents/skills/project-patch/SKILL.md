---
name: project-patch
description: 项目补丁工具。为现有项目添加项目名 Path（URL 前缀）支持，并按照标准项目规范进行改造。当用户说"给现有项目加上项目名"、"修改项目支持多项目部署"、"项目加个 path"、"规范化项目"、"按标准改造项目"或类似表述时使用此技能。该技能会扫描项目文件，找出需要修改的地方，批量添加项目名 Path 层并检查其他规范。需要修改的文件包括：vite.config.js（base 配置）、前端 API 请求封装（baseURL）、Nginx 配置、README.md、Dockerfile、docker-compose.yml 等。
---

# 项目补丁工具

为现有项目添加项目名 Path（URL 前缀）支持，并按照标准项目规范进行改造。

## ⭐ 核心原则

**所有项目的访问必须带有一层项目名 Path**，这是多项目共享同一域名的部署方式。

### 为什么需要项目名 Path

- 宿主机只有一个域名（如 `example.com`）
- 通过第二级 Path 区分不同项目：`example.com/项目名/xxx`
- 例如：
  - `example.com/my-app/` → 前端首页
  - `example.com/my-app/api/hello` → 后端接口

## 输入信息

用户会提供以下信息：

| 信息 | 说明 | 示例 |
|------|------|------|
| 项目路径 | 现有项目所在目录 | /opt/projects/my-app |
| 项目名称 | 英文，用于目录名和 URL 路径前缀 | my-app |
| 后端端口号 | 数字（如果需要生成 Nginx 配置） | 8003 |

**如果用户没提供某项信息，必须主动询问！**

## 修改流程

### 1. 扫描项目结构

首先查看项目有哪些文件，确定技术栈：

```bash
ls -la 项目路径/
ls -la 项目路径/backend/  # 如果有
ls -la 项目路径/frontend/  # 如果有
```

### 2. 检查清单

对每个需要检查/修改的项目，使用下方表格：

| 检查项 | 文件 | 期望状态 |
|--------|------|---------|
| 项目名 Path | `vite.config.js` | 必须有 `base: '/项目名/'` |
| 项目名 Path | 前端 API 封装 | `baseURL: '/项目名/api'` |
| 项目名 Path | `README.md` | 访问地址包含 `/项目名/` |
| Dockerfile | `backend/Dockerfile` | 存在且符合规范 |
| Dockerfile | `frontend/Dockerfile` | 存在且符合规范（如果有前端） |
| Docker 配置 | `docker-compose.yml` | 存在且符合规范 |
| 健康检查 | 后端入口 | 有 `/health` 接口 |
| 非 root 用户 | Dockerfile | 必须创建非 root 用户运行 |

### 3. 项目名 Path 必须覆盖的地方

| 文件 | 必须包含的内容 |
|------|---------------|
| `vite.config.js` | `base: '/项目名/'` |
| `src/api/request.js` | `baseURL: '/项目名/api'` |
| `src/api/index.js` | 同上 |
| `src/utils/request.js` | 同上 |
| Nginx 配置 | `location /项目名/` 和 `location /项目名/api/` |
| `README.md` | 访问地址为 `域名/项目名/` |

**⚠️ 警告：修改代码时必须确保上述所有位置都包含项目名，不能遗漏任何一处！**

### 4. 详细修改规范

#### 4.1 vite.config.js / vite.config.ts

查找现有的 `base` 配置：
- 如果已有 `base: 'xxx'`，替换为 `base: '/项目名/'`
- 如果没有 `base` 字段，在 `defineConfig({})` 内添加 `base: '/项目名/',`

```javascript
// 修改前
export default defineConfig({
  plugins: [vue()],
  server: { ... }
})

// 修改后
export default defineConfig({
  base: '/项目名/',  // 添加这一行
  plugins: [vue()],
  server: { ... }
})
```

#### 4.2 vue.config.js

查找现有的 `publicPath` 配置：
- 如果已有 `publicPath: 'xxx'`，替换为 `publicPath: '/项目名/'`
- 如果没有，添加 `publicPath: '/项目名/'`

#### 4.3 前端 API 请求封装

查找 axios 或 fetch 封装，修改 `baseURL`：

```javascript
// 修改前
const request = axios.create({
  baseURL: '/api',  // 或者没有 baseURL
  timeout: 10000
})

// 修改后
const request = axios.create({
  baseURL: '/项目名/api',
  timeout: 10000
})
```

**注意**：可能存在多个 API 文件，需要全部修改。

#### 4.4 Nginx 配置

生成项目名 path 的 location 块供用户添加到宿主 Nginx：

```nginx
# 项目名 | 技术栈 | 端口 xxxx

# 前端静态文件
location /项目名/ {
    alias /opt/projects/项目名/frontend/dist/;
    index index.html;
    try_files $uri $uri/ /项目名/index.html;
}

# 后端 API
location /项目名/api/ {
    proxy_pass http://127.0.0.1:端口号/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 60s;
    proxy_read_timeout 60s;
}
```

#### 4.5 README.md

更新访问地址：

```markdown
## 访问地址
- 前端：https://域名/项目名/
- 后端：https://域名/项目名/api/xxx
```

### 5. Dockerfile 规范检查

如果项目有 Dockerfile，检查是否符合规范：

#### backend/Dockerfile 规范

- ✅ 使用官方 alpine 镜像
- ✅ 先复制依赖文件安装依赖，再复制源码（利用 Docker 缓存）
- ✅ **创建非 root 用户，用该用户运行**
- ✅ EXPOSE 声明端口
- ✅ 添加 HEALTHCHECK 请求 `/health`

如果不符合，给出修改建议。

#### frontend/Dockerfile 规范

- ✅ 基于 `node:20-alpine`
- ✅ WORKDIR /app
- ✅ 先复制 package.json 和 package-lock.json，执行 `npm install`
- ✅ 再复制其余源码，执行 `npm run build`
- ✅ 构建产物位于 `/app/dist`
- ⚠️ 此容器仅用于构建，不需要 EXPOSE，不需要 HEALTHCHECK

### 6. 后端健康检查

检查后端是否有 `/health` 接口：

```python
# FastAPI
@app.get("/health")
def health():
    return {"status": "ok"}
```

```javascript
// Express
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});
```

如果没有，需要添加。

### 7. 验证修改

修改完成后，检查：

1. **vite.config.js** 中是否有 `base: '/项目名/'`
2. **所有 API 请求文件** 中 baseURL 是否为 `/项目名/api` 开头
3. **README.md** 中访问地址是否包含项目名
4. **Dockerfile** 是否使用非 root 用户

### 8. 输出修改报告

列出所有修改的文件和具体改动：

```markdown
## 修改报告

### 已修改文件

1. **vite.config.js**
   - 添加 `base: '/my-app/'`

2. **src/api/request.js**
   - 修改 `baseURL: '/my-app/api'`

3. **README.md**
   - 更新访问地址为 `https://example.com/my-app/`

### 建议修改（需确认）

4. **backend/Dockerfile**
   - 建议添加非 root 用户，当前以 root 运行
   - 建议添加 HEALTHCHECK

### 跳过（文件不存在）

- nginx.conf（项目中没有 Nginx 配置）
- frontend/Dockerfile（前端使用其他构建方式）
```

## 输出要求

1. **必须扫描项目完整结构**，找出所有需要修改的文件
2. **不能遗漏任何需要修改的位置**（项目名 Path 相关）
3. **检查 Dockerfile 规范**，确保非 root 用户运行
4. **检查健康检查接口**，确保有 `/health`
5. **修改前备份原文件**（可选，用户未要求时跳过）
6. **列出所有修改的文件和改动内容**
7. **如果某些文件不存在或不需要修改，明确告知用户**

## 示例对话

**用户**：帮我现有项目加上项目名 path，并按标准规范化
**你**：请提供以下信息：
- 项目路径：？
- 项目名称（英文）：？
- 后端端口号（用于 Nginx 配置）：？

**用户**：项目路径 /opt/projects/legacy-app，项目名称 legacy-app，端口 8003
**你**：[扫描项目结构，检查各项规范，修改相关文件，输出修改报告]

**你**：已完成扫描和修改，以下是报告：

### ✅ 已符合规范

- backend/Dockerfile：已有非 root 用户
- 后端：有 /health 接口
- docker-compose.yml：配置正确

### ⚠️ 需要修改

1. **vite.config.js**
   - 添加 `base: '/legacy-app/'`

2. **src/api/request.js**
   - 修改 `baseURL: '/legacy-app/api'`

3. **src/api/index.js**
   - 修改 `baseURL: '/legacy-app/api'`

4. **README.md**
   - 更新访问地址为 `https://example.com/legacy-app/`

### 📝 生成的 Nginx 配置（用户需手动添加到宿主机）

```nginx
# legacy-app | FastAPI | 端口 8003

location /legacy-app/ {
    alias /opt/projects/legacy-app/frontend/dist/;
    index index.html;
    try_files $uri $uri/ /legacy-app/index.html;
}

location /legacy-app/api/ {
    proxy_pass http://127.0.0.1:8003/;
    ...
}
```
