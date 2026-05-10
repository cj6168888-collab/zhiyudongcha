# Z1 协议 - 小智 Docker 镜像
# 铁律3: 使用国内镜像源（阿里云/清华）
# 铁律4: 离线兼容

FROM registry.cn-hangzhou.aliyuncs.com/library/node:20-slim AS base

# 设置国内 npm 镜像
RUN npm config set registry https://registry.npmmirror.com

# 安装基础工具
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 设置国内 pip 镜像 (清华源)
RUN pip3 config set global.index-url https://pypi.tuna.tsinghua.edu.cn/simple \
    && pip3 config set global.trusted-host pypi.tuna.tsinghua.edu.cn

WORKDIR /app

# 复制 package.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 构建应用
RUN npm run build

# 暴露端口
EXPOSE 5000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# 启动命令
CMD ["npm", "run", "start"]

# ======================================
# 构建 GPU 版本（用于 Ollama 本地部署）
# ======================================
FROM registry.cn-hangzhou.aliyuncs.com/library/node:20-slim AS gpu-base

# 设置国内 npm 镜像
RUN npm config set registry https://registry.npmmirror.com

# 安装 CUDA 工具链（如果需要）
# 注意：完整 CUDA 镜像应使用 nvidia/cuda 基础镜像

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 5000
EXPOSE 11434

CMD ["npm", "run", "start"]
