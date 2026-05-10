# 本地小模型集成方案

## 概述

为实现"四层分布式语音交互系统"中的手机端小模型层，本文档详细说明如何在原生移动应用中集成本地AI模型。

## 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                     移动设备                             │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │                   应用层                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────┐  │  │
│  │  │ 对话UI  │  │ 洞察UI  │  │    其他功能     │  │  │
│  │  └────┬────┘  └────┬────┘  └────────┬────────┘  │  │
│  └───────┼────────────┼────────────────┼───────────┘  │
│          │            │                │              │
│  ┌───────▼────────────▼────────────────▼───────────┐  │
│  │                 AI协调层                         │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │           本地/云端路由决策器             │   │  │
│  │  └─────────────────────────────────────────┘   │  │
│  └───────┬────────────────────────────┬───────────┘  │
│          │                            │              │
│  ┌───────▼───────┐           ┌────────▼────────┐    │
│  │   本地模型层   │           │   网络通信层    │    │
│  │ ┌───────────┐ │           │ ┌────────────┐ │    │
│  │ │ 唤醒词检测 │ │           │ │  WebSocket │ │    │
│  │ │ 意图识别  │ │           │ │   HTTP/S   │ │    │
│  │ │ 关键词提取 │ │           │ └────────────┘ │    │
│  │ │ 语音唤醒  │ │           └────────┬────────┘    │
│  │ └───────────┘ │                    │              │
│  └───────────────┘                    │              │
└───────────────────────────────────────┼──────────────┘
                                        │
                            ┌───────────▼───────────┐
                            │       云端服务         │
                            │  ┌─────────────────┐  │
                            │  │ DashScope/云端AI │  │
                            │  └─────────────────┘  │
                            └───────────────────────┘
```

## iOS 本地模型集成

### 1. Core ML 模型部署

```swift
import CoreML
import NaturalLanguage

class LocalAIService {
    
    // 意图识别模型
    private var intentClassifier: MLModel?
    
    // 关键词提取模型
    private var nerModel: MLModel?
    
    // 唤醒词检测
    private var wakeWordDetector: WakeWordDetector?
    
    init() {
        loadModels()
    }
    
    private func loadModels() {
        // 加载 Core ML 模型
        if let modelURL = Bundle.main.url(forResource: "IntentClassifier", withExtension: "mlmodelc") {
            intentClassifier = try? MLModel(contentsOf: modelURL)
        }
        
        if let nerURL = Bundle.main.url(forResource: "ChineseNER", withExtension: "mlmodelc") {
            nerModel = try? MLModel(contentsOf: nerURL)
        }
        
        wakeWordDetector = WakeWordDetector(wakeWords: ["小智", "喂小智"])
    }
    
    // 本地意图识别
    func classifyIntent(_ text: String) -> (intent: String, confidence: Float, useCloud: Bool) {
        // 使用 NaturalLanguage 框架进行基础分类
        let tagger = NLTagger(tagSchemes: [.lexicalClass])
        tagger.string = text
        
        // 简单指令本地处理
        let simpleIntents = [
            "现在几点": ("get_time", 0.99, false),
            "今天天气": ("get_weather", 0.95, false),
            "设置提醒": ("set_reminder", 0.90, false),
            "打电话": ("make_call", 0.95, false)
        ]
        
        for (keyword, result) in simpleIntents {
            if text.contains(keyword) {
                return result
            }
        }
        
        // 复杂查询发送到云端
        return ("unknown", 0.0, true)
    }
    
    // 本地实体提取
    func extractEntities(_ text: String) -> [ExtractedEntity] {
        var entities: [ExtractedEntity] = []
        
        // 使用 NaturalLanguage 框架
        let tagger = NLTagger(tagSchemes: [.nameType])
        tagger.string = text
        
        tagger.enumerateTags(in: text.startIndex..<text.endIndex, 
                            unit: .word, 
                            scheme: .nameType) { tag, range in
            if let tag = tag {
                let entity = ExtractedEntity(
                    name: String(text[range]),
                    type: tag.rawValue
                )
                entities.append(entity)
            }
            return true
        }
        
        return entities
    }
}

// 唤醒词检测器
class WakeWordDetector {
    private let wakeWords: [String]
    
    init(wakeWords: [String]) {
        self.wakeWords = wakeWords
    }
    
    func detect(in audioBuffer: AVAudioPCMBuffer) -> Bool {
        // 使用 Speech 框架进行离线识别
        // 或集成 OpenWakeWord / Porcupine SDK
        return false
    }
}

struct ExtractedEntity {
    let name: String
    let type: String
}
```

### 2. 推荐的 iOS 本地模型

| 功能 | 推荐方案 | 模型大小 | 说明 |
|------|----------|----------|------|
| 唤醒词检测 | Porcupine / OpenWakeWord | ~2MB | 低功耗，高准确率 |
| 意图识别 | Core ML BERT | 20-50MB | 转换后的轻量BERT |
| 实体识别 | NaturalLanguage Framework | 内置 | 苹果原生支持 |
| 语音识别 | Speech Framework (离线) | 内置 | iOS 17+ 支持中文离线 |

## Android 本地模型集成

### 1. TensorFlow Lite 模型部署

```kotlin
package com.xiaozhi.ai

import android.content.Context
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel

class LocalAIService(private val context: Context) {
    
    private var intentClassifier: Interpreter? = null
    private var nerModel: Interpreter? = null
    
    init {
        loadModels()
    }
    
    private fun loadModels() {
        try {
            intentClassifier = Interpreter(loadModelFile("intent_classifier.tflite"))
            nerModel = Interpreter(loadModelFile("chinese_ner.tflite"))
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
    
    private fun loadModelFile(modelName: String): MappedByteBuffer {
        val assetFileDescriptor = context.assets.openFd(modelName)
        val fileInputStream = FileInputStream(assetFileDescriptor.fileDescriptor)
        val fileChannel = fileInputStream.channel
        return fileChannel.map(
            FileChannel.MapMode.READ_ONLY,
            assetFileDescriptor.startOffset,
            assetFileDescriptor.declaredLength
        )
    }
    
    fun classifyIntent(text: String): IntentResult {
        // 简单指令本地处理
        val simpleIntents = mapOf(
            "现在几点" to IntentResult("get_time", 0.99f, false),
            "今天天气" to IntentResult("get_weather", 0.95f, false),
            "设置提醒" to IntentResult("set_reminder", 0.90f, false),
            "打电话" to IntentResult("make_call", 0.95f, false)
        )
        
        for ((keyword, result) in simpleIntents) {
            if (text.contains(keyword)) {
                return result
            }
        }
        
        // 复杂查询使用云端
        return IntentResult("unknown", 0f, true)
    }
    
    fun extractEntities(text: String): List<Entity> {
        // 使用 ML Kit 或自定义模型进行实体提取
        return emptyList()
    }
    
    fun release() {
        intentClassifier?.close()
        nerModel?.close()
    }
}

data class IntentResult(
    val intent: String,
    val confidence: Float,
    val useCloud: Boolean
)

data class Entity(
    val name: String,
    val type: String,
    val startIndex: Int,
    val endIndex: Int
)
```

### 2. 推荐的 Android 本地模型

| 功能 | 推荐方案 | 模型大小 | 说明 |
|------|----------|----------|------|
| 唤醒词检测 | Porcupine / Vosk | ~5MB | 支持自定义唤醒词 |
| 意图识别 | TFLite BERT | 20-50MB | 量化后的 MobileBERT |
| 实体识别 | ML Kit | 内置 | Google 原生支持 |
| 语音识别 | Vosk | ~50MB | 支持离线中文识别 |

## 本地/云端路由策略

```swift
// iOS 版本
class AIRouter {
    
    enum ProcessingTarget {
        case local
        case cloud
        case hybrid
    }
    
    func route(_ input: String) -> ProcessingTarget {
        // 1. 检查网络状态
        guard NetworkMonitor.shared.isConnected else {
            return .local
        }
        
        // 2. 检查隐私设置
        if UserPreferences.shared.preferOfflineMode {
            return .local
        }
        
        // 3. 根据任务复杂度决定
        let complexity = analyzeComplexity(input)
        
        switch complexity {
        case .simple:
            return .local
        case .medium:
            return .hybrid  // 本地预处理 + 云端确认
        case .complex:
            return .cloud
        }
    }
    
    private func analyzeComplexity(_ input: String) -> Complexity {
        // 简单指令：单一意图，明确关键词
        let simplePatterns = ["几点", "天气", "提醒我", "打电话"]
        if simplePatterns.contains(where: { input.contains($0) }) {
            return .simple
        }
        
        // 复杂指令：多轮对话、上下文依赖、创意生成
        if input.count > 50 || input.contains("帮我") || input.contains("分析") {
            return .complex
        }
        
        return .medium
    }
    
    enum Complexity {
        case simple
        case medium
        case complex
    }
}
```

## 模型训练与部署流程

### 1. 模型准备

```bash
# 使用 Python 训练意图分类模型
pip install transformers torch coremltools tensorflow

# 转换为 Core ML (iOS)
python convert_to_coreml.py --model bert-base-chinese --output IntentClassifier.mlmodel

# 转换为 TFLite (Android)
python convert_to_tflite.py --model bert-base-chinese --output intent_classifier.tflite
```

### 2. 模型优化

- **量化**: 使用 INT8 量化减少模型大小 50-75%
- **剪枝**: 移除不重要的神经元
- **蒸馏**: 使用小模型学习大模型的知识

### 3. 模型更新

```swift
class ModelUpdater {
    
    func checkForUpdates() async {
        let response = try? await NetworkManager.shared.request(
            "/api/mobile/models/versions",
            method: "GET"
        )
        
        // 比较版本，下载新模型
    }
    
    func downloadModel(name: String, version: String) async {
        // 后台下载新模型
        // 验证完整性
        // 热替换
    }
}
```

## 性能优化建议

1. **延迟加载**: 仅在首次使用时加载模型
2. **模型缓存**: 将编译后的模型缓存到磁盘
3. **批处理**: 合并多个推理请求
4. **GPU 加速**: 使用 Metal (iOS) / GPU Delegate (Android)
5. **模型选择**: 根据设备性能选择不同大小的模型

## 电量优化

- 使用 Core Motion 检测设备状态，静止时降低采样率
- 仅在充电时执行模型更新
- 使用低功耗模式时切换到更小的模型
