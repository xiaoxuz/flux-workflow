# flux-workflow-backend | 端口 8006
FROM python:3.10-slim

WORKDIR /app

# 先复制依赖文件并安装（使用国内源）
COPY requirements.txt .
RUN pip install -i https://pypi.tuna.tsinghua.edu.cn/simple --no-cache-dir -r requirements.txt

# 再复制源码
COPY . .

EXPOSE 8006

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8006/flux-workflow/api/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8006"]