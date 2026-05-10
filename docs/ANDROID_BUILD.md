# 小智 Android APK 构建指南

本文档指导如何将小智打包成带有本地 AI 模型的 Android 应用，以及如何配置本地 GPU 服务器。

---

## 第一部分：Android App 打包

### 系统要求

- Android Studio Arctic Fox (2020.3.1) 或更高版本
- JDK 11+
- Android SDK 24+ (Android 7.0)
- 至少 8GB RAM（推荐 16GB）
- 约 10GB 磁盘空间

### 步骤 1：在 Replit 上构建 Web 资源

```bash
# 构建前端和后端
npm run build

# 同步到 Android 项目
npx cap sync android
```

### 步骤 2：导出 Android 项目

从 Replit 下载以下文件/文件夹到本地电脑：

```
xiaozhi-avatar/
├── android/                    # Android Studio 项目（必须）
├── capacitor.config.ts         # Capacitor 配置
└── docs/ANDROID_BUILD.md       # 本文档
```

**下载方式**：
1. 在 Replit 左侧文件面板，右键点击 `android` 文件夹
2. 选择 "Download as ZIP"
3. 解压到本地

### 步骤 3：在 Android Studio 中打开

1. 打开 Android Studio
2. 选择 **File > Open**
3. 选择解压后的 `android/` 文件夹
4. 等待 Gradle 同步完成（首次可能需要 5-10 分钟）

### 4. 集成本地 LLM（可选）

如需支持离线 AI 功能，需要集成 llama.cpp：

#### 4.1 添加 llama-android 依赖

在 `android/app/build.gradle` 添加：

```gradle
dependencies {
    implementation 'com.github.aspect-ai:llama-android:0.1.0'
}
```

#### 4.2 编译 llama.cpp（高级）

如需自定义编译：

```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
mkdir build-android
cd build-android
cmake .. \
  -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
  -DANDROID_ABI=arm64-v8a \
  -DANDROID_PLATFORM=android-24
make
```

### 5. 构建 APK

#### Debug 版本（测试用）

1. 在 Android Studio 中选择 `Build > Build Bundle(s) / APK(s) > Build APK(s)`
2. APK 位于 `android/app/build/outputs/apk/debug/`

#### Release 版本（发布用）

1. 创建签名密钥：
   ```bash
   keytool -genkey -v -keystore xiaozhi.keystore -alias xiaozhi -keyalg RSA -keysize 2048 -validity 10000
   ```

2. 配置签名（在 `android/app/build.gradle`）：
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file('xiaozhi.keystore')
               storePassword 'your_password'
               keyAlias 'xiaozhi'
               keyPassword 'your_password'
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
               minifyEnabled true
               proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
           }
       }
   }
   ```

3. 构建：`Build > Generate Signed Bundle / APK`

## 模型下载机制

小智 Android 版不内嵌模型（避免 APK 过大），而是首次启动时下载：

### 支持的模型

| 模型 | 大小 | 推荐设备 |
|------|------|----------|
| Qwen2.5-3B-Q4_K_M | 1.9GB | 8GB RAM+ |
| Phi-3-mini-Q4 | 2.2GB | 8GB RAM+ |

### 下载流程

1. 首次启动检测是否有本地模型
2. 显示模型选择界面
3. 后台下载并显示进度
4. 下载完成后自动加载

模型存储位置：`/data/data/com.xiaozhi.avatar/files/models/`

## 离线/在线模式

| 功能 | 离线模式 | 在线模式 |
|------|----------|----------|
| 基础对话 | ✓ 本地 3B 模型 | ✓ DashScope |
| 图像理解 | ✗ | ✓ |
| 语音识别 | ✓ 本地 Whisper | ✓ DashScope |
| 知识库搜索 | ✗ | ✓ |
| 情感记忆 | ✓ 本地缓存 | ✓ 云端同步 |

## 注意事项

### 性能优化

- 使用 Q4_K_M 量化减少内存占用
- 设置 `contextLength: 2048` 而非 4096
- 避免同时加载多个模型

### 权限配置

`AndroidManifest.xml` 已配置以下权限：

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

### 问题排查

1. **构建失败 - Gradle 版本问题**
   ```
   File > Project Structure > Project > Gradle Version: 8.0+
   ```

2. **APK 过大**
   - 启用 `minifyEnabled true`
   - 使用 App Bundle 替代 APK

3. **模型加载失败**
   - 检查设备 RAM 是否足够
   - 确认模型文件完整（校验 SHA256）

## 发布到应用商店

### Google Play

1. 创建 Google Play 开发者账号（$25）
2. 使用 App Bundle 格式上传
3. 填写应用信息和隐私政策

### 其他渠道

- 华为应用市场
- 小米应用商店
- 直接分发 APK

## 后续开发

完整的本地 LLM 集成需要：

1. 编译 llama.cpp 的 JNI 绑定
2. 实现 `LocalLLMPlugin.java` 中的 native 方法
3. 添加模型量化和优化
4. 实现流式输出（token-by-token）

参考项目：
- https://github.com/aspect-ai/llama-android
- https://github.com/nickhobbs94/llama-android

---

## 第二部分：本地 GPU 服务器配置

小智支持连接家庭 GPU 服务器运行大型 AI 模型，实现更强的推理能力。

### 硬件要求

| 模型 | 最低显存 | 推荐显存 | 用途 |
|------|----------|----------|------|
| Qwen2-7B | 8GB | 12GB | 基础对话 |
| Qwen2-14B | 12GB | 16GB | 复杂分析 |
| Qwen2-32B | 24GB | 32GB | 专业任务 |
| Qwen2-72B | 48GB | 80GB | 顶级推理 |
| AutoGLM-9B | 16GB | 24GB | 屏幕操作 |

**推荐配置**：
- GPU：NVIDIA RTX 4090 (24GB) 或 RTX 3090 (24GB)
- 内存：32GB+
- 存储：SSD 500GB+（存放模型文件）

### 步骤 1：安装 Ollama

在 GPU 服务器上安装 Ollama：

**Linux/WSL**:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Windows**:
下载安装包：https://ollama.com/download/windows

**macOS**:
```bash
brew install ollama
```

### 步骤 2：下载模型

```bash
# 对话模型（选择一个）
ollama pull qwen2:72b      # 48GB+ 显存
ollama pull qwen2:32b      # 24GB+ 显存
ollama pull qwen2:14b      # 12GB+ 显存
ollama pull qwen2:7b       # 8GB+ 显存

# 屏幕操作模型（可选）
ollama pull llava:34b      # 视觉理解
```

### 步骤 3：配置 Ollama 远程访问

默认 Ollama 只监听 localhost，需要配置远程访问：

**Linux**:
```bash
# 编辑 Ollama 服务配置
sudo systemctl edit ollama

# 添加以下内容
[Service]
Environment="OLLAMA_HOST=0.0.0.0"

# 重启服务
sudo systemctl restart ollama
```

**Windows/macOS**:
设置环境变量 `OLLAMA_HOST=0.0.0.0` 后重启 Ollama。

### 步骤 4：防火墙配置

```bash
# Linux (Ubuntu/Debian)
sudo ufw allow 11434/tcp

# Windows
netsh advfirewall firewall add rule name="Ollama" dir=in action=allow protocol=tcp localport=11434
```

### 步骤 5：在小智中配置

1. 打开小智 App 或网页版
2. 进入 **灵核** 页面 (`/spirit-control`)
3. 展开 **GPU服务器集群**
4. 点击 **添加服务器**
5. 填写配置：
   - 服务器名称：如 "家庭GPU服务器"
   - Ollama端点：`http://192.168.1.xxx:11434`（替换为实际IP）
   - 模型用途：选择 "对话/分析" 或 "屏幕操作"
   - 选择模型：如 `qwen2:72b`
   - GPU显存：填写实际显存大小（MB）
6. 点击 **测试** 验证连接
7. 保存

### 双模型配置示例

如果你有足够的显存（如 2×24GB 或 1×48GB），可以同时运行两个模型：

**配置 1：对话模型**
- 端点：`http://192.168.1.100:11434`
- 模型：`qwen2:72b`
- 用途：对话/分析

**配置 2：屏幕操作模型**
- 端点：`http://192.168.1.100:11435`（第二个 Ollama 实例）
- 模型：`autoglm:9b` 或 `llava:34b`
- 用途：屏幕操作

**运行多个 Ollama 实例**：
```bash
# 实例1（默认端口）
OLLAMA_HOST=0.0.0.0:11434 ollama serve

# 实例2（第二端口，新终端）
OLLAMA_MODELS=/path/to/second/models OLLAMA_HOST=0.0.0.0:11435 ollama serve
```

### 网络拓扑

```
┌─────────────────┐     ┌─────────────────┐
│  手机 App       │────▶│  Replit 云端     │
│  (小智 Android) │     │  (API服务器)     │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  家庭 GPU 服务器 │
                        │  Ollama + 模型   │
                        └─────────────────┘
```

**注意**：GPU 服务器需要能被 Replit 云端访问：
1. 使用内网穿透（推荐 frp、Tailscale、Cloudflare Tunnel）
2. 或将 GPU 服务器端口映射到公网

### 使用 Tailscale 连接（推荐）

1. 在 GPU 服务器和手机上安装 Tailscale
2. 登录同一账号
3. 使用 Tailscale 分配的 IP（如 `100.x.x.x:11434`）

### 常见问题

**Q: 为什么连接测试失败？**
- 检查 Ollama 是否在运行：`curl http://localhost:11434/api/tags`
- 确认 `OLLAMA_HOST=0.0.0.0` 已设置
- 检查防火墙是否开放 11434 端口

**Q: 模型加载很慢？**
- 首次加载需要将模型载入显存，约 1-2 分钟
- 后续推理会很快

**Q: 显存不够怎么办？**
- 使用更小的模型（14B → 7B）
- 使用量化版本（如 `qwen2:14b-q4`）

---

## 附录：配置检查清单

### Android App 打包
- [ ] 已运行 `npm run build`
- [ ] 已运行 `npx cap sync android`
- [ ] 已下载 `android/` 文件夹
- [ ] Android Studio 已同步 Gradle
- [ ] 已创建签名密钥（Release 版本）
- [ ] 已生成 APK 或 App Bundle

### 本地服务器配置
- [ ] GPU 服务器已安装 Ollama
- [ ] 已下载所需模型
- [ ] Ollama 已配置远程访问 (`OLLAMA_HOST=0.0.0.0`)
- [ ] 防火墙已开放 11434 端口
- [ ] 小智已添加服务器配置
- [ ] 连接测试成功
