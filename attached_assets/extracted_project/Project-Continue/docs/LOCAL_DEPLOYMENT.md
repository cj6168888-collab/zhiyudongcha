# 小智本地部署指南

## 概述

本指南帮助您在本地环境中运行小智的核心组件，实现：
- 🧠 本地AI推理（无需云端API）
- 💾 本地数据存储（隐私保护）
- 📱 多设备协同（手机+笔记本+服务器）

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                    小智 混合智能架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
│   │  手机   │    │  笔记本  │    │  服务器  │                 │
│   │ Agent   │←──→│ Mini-Core│←──→│ Ollama  │                 │
│   └────┬────┘    └────┬────┘    └────┬────┘                 │
│        │              │              │                      │
│        └──────────────┼──────────────┘                      │
│                       ▼                                     │
│              ┌────────────────┐                             │
│              │   小智云端核心   │                             │
│              │  (Replit托管)   │                             │
│              └────────────────┘                             │
│                       │                                     │
│                       ▼                                     │
│              ┌────────────────┐                             │
│              │  DashScope API │ (云端备份)                    │
│              └────────────────┘                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 第一步：安装Ollama（本地AI引擎）

### macOS
```bash
# 使用官方安装脚本
curl -fsSL https://ollama.com/install.sh | sh

# 或使用Homebrew
brew install ollama
```

### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Windows
1. 下载安装包：https://ollama.com/download/windows
2. 运行安装程序
3. 安装完成后，Ollama会自动以服务形式运行

### 验证安装
```bash
ollama --version
# 应显示类似: ollama version 0.1.x
```

## 第二步：下载推荐模型

小智推荐以下本地模型（根据您的硬件选择）：

### 轻量级（4GB内存即可）
```bash
ollama pull phi3:mini
```
- 适合：简单对话、快速响应
- 特点：微软Phi-3迷你版，反应快

### 标准版（8GB内存推荐）
```bash
ollama pull qwen:7b
```
- 适合：中文对话、日常助手
- 特点：通义千问7B，中文表现优秀

### 增强版（16GB内存推荐）
```bash
ollama pull qwen2:7b
```
- 适合：复杂分析、专业任务
- 特点：通义千问2.0，更强推理能力

### 验证模型
```bash
# 列出已安装模型
ollama list

# 测试对话
ollama run qwen:7b "你好，请自我介绍一下"
```

## 第三步：配置小智连接本地模型

### 方式一：设置环境变量

在您的`.env`文件中添加：

```env
# 启用本地模型
LOCAL_MODEL_ENABLED=true
LOCAL_MODEL_ENDPOINT=http://localhost:11434
LOCAL_MODEL_NAME=qwen:7b

# 混合模式配置
MODEL_PREFER_LOCAL=true
MODEL_FALLBACK_TO_CLOUD=true
```

### 方式二：通过API动态配置

```bash
curl -X POST http://your-xiaozhi-server/api/config/model \
  -H "Content-Type: application/json" \
  -H "X-Avatar-Role: MASTER" \
  -H "X-Avatar-Secret: your-secret" \
  -d '{
    "provider": "HYBRID",
    "localEndpoint": "http://localhost:11434",
    "localModel": "qwen:7b",
    "preferLocal": true
  }'
```

## 第四步：搭建Mini-Core（笔记本/服务器）

Mini-Core是小智的本地代理节点，负责：
- 连接小智云端
- 调用本地Ollama模型
- 执行本地任务

### 安装Mini-Core

```bash
# 克隆代理仓库（TODO：准备发布）
git clone https://github.com/your-repo/xiaozhi-mini-core.git
cd xiaozhi-mini-core

# 安装依赖
npm install

# 配置
cp .env.example .env
# 编辑.env，填入：
# XIAOZHI_SERVER=https://your-replit-app.repl.co
# DEVICE_NAME=我的笔记本
# DEVICE_TYPE=LAPTOP
# LOCAL_MODEL_ENDPOINT=http://localhost:11434

# 启动
npm start
```

### Mini-Core配置说明

```env
# 小智云端地址
XIAOZHI_SERVER=https://your-app.replit.app

# 设备信息
DEVICE_ID=laptop-001
DEVICE_NAME=我的MacBook
DEVICE_TYPE=LAPTOP

# 本地模型配置
LOCAL_MODEL_ENDPOINT=http://localhost:11434
LOCAL_MODEL_NAME=qwen:7b

# 能力声明
CAN_RUN_LOCAL_MODEL=true
HAS_GPU=false
MEMORY_MB=16384
```

## 第五步：连接手机（可选）

### 方案一：Progressive Web App (PWA)

1. 在手机浏览器打开小智网址
2. 点击"添加到主屏幕"
3. 像原生应用一样使用

### 方案二：React Native App（开发中）

```bash
# TODO: 移动端App仓库
git clone https://github.com/your-repo/xiaozhi-mobile.git
cd xiaozhi-mobile
npm install
npm run ios  # 或 npm run android
```

## 智能路由说明

小智会根据任务复杂度自动选择处理方式：

| 任务类型 | 处理方式 | 示例 |
|---------|---------|------|
| 简单问候 | 本地快速响应 | "早安"、"谢谢" |
| 日常对话 | 本地Ollama | "今天天气怎么样" |
| 复杂分析 | 云端DashScope | "分析这份合同的风险" |
| 多专家协作 | 云端+综合 | "从法律和财务角度评估" |

### 降级策略

1. **云端不可用** → 自动切换本地模型
2. **本地不可用** → 使用云端API
3. **全部不可用** → 本地快速响应 + 友好提示

## 硬件推荐

### 入门配置
- CPU: Intel i5 / AMD Ryzen 5
- 内存: 8GB
- 存储: 20GB可用空间
- 推荐模型: phi3:mini

### 推荐配置
- CPU: Intel i7 / AMD Ryzen 7 / Apple M1
- 内存: 16GB
- 存储: 50GB可用空间
- 推荐模型: qwen:7b 或 qwen2:7b

### 高端配置
- GPU: NVIDIA RTX 3060 或更高
- 内存: 32GB
- 存储: 100GB SSD
- 推荐模型: qwen2:14b 或更大

## 常见问题

### Q: Ollama启动失败？
```bash
# 检查服务状态
systemctl status ollama  # Linux
brew services info ollama  # macOS

# 手动启动
ollama serve
```

### Q: 模型下载太慢？
- 使用国内镜像（如果可用）
- 或通过代理下载

### Q: 内存不足？
- 使用更小的模型（phi3:mini）
- 关闭其他占用内存的程序
- 减少上下文长度：`num_ctx: 1024`

### Q: GPU没被使用？
```bash
# 检查CUDA
nvidia-smi

# Ollama会自动检测GPU，确保驱动正确安装
```

## 安全建议

1. **本地端口保护**：Ollama默认只监听localhost
2. **网络隔离**：不要将Ollama暴露到公网
3. **数据加密**：敏感数据存储在本地
4. **权限控制**：使用MASTER密钥验证

## 下一步

- [ ] 完成Ollama安装和模型下载
- [ ] 配置环境变量启用本地模型
- [ ] 测试本地对话功能
- [ ] （可选）搭建Mini-Core
- [ ] （可选）连接手机设备

---

**版权所有** 陈先生出品 · cj6168888@Gmail.com
