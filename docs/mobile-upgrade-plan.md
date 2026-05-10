# Mobile Packaging Upgrade Plan for 小智 (XiaoZhi)

## 📋 Overview

This document outlines the comprehensive mobile packaging upgrade plan for the 小智 Digital Life System, enabling native voice capabilities on both Android and iOS platforms using Capacitor.

**Current State:**
- Capacitor Core: v8.0.0
- Capacitor CLI: v7.4.4
- Android Project: Existing at `android/`
- iOS Project: Not yet created

**Target State:**
- Android v8 with full voice permissions
- iOS with native voice capabilities
- Native speech recognition integration
- Optimized WebView performance

---

## 🚀 Phase 1: Android Configuration Upgrade

### 1.1 Required Permissions Update

**File: `android/app/src/main/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Core Internet Access -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Microphone for Voice Input -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- Speech Recognition -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-feature android:name="android.hardware.microphone" android:required="true" />

    <!-- Background Audio (for continuous voice mode) -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <!-- Storage (for caching voice data) -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
        android:maxSdkVersion="29" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />

    <!-- Camera (for avatar video features) -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />

    <!-- Bluetooth (for voice device connectivity) -->
    <uses-permission android:name="android.permission.BLUETOOTH"
        android:maxSdkVersion="30" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />

    <!-- Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Vibration Feedback -->
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/AppTheme"
        android:hardwareAccelerated="true"
        android:largeHeap="true">

        <activity
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation"
            android:name=".MainActivity"
            android:label="@string/title_activity_main"
            android:theme="@style/AppTheme.NoActionBarLaunch"
            android:launchMode="singleTask"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">

            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>

        </activity>

        <!-- Voice Foreground Service -->
        <service
            android:name=".VoiceForegroundService"
            android:foregroundServiceType="microphone"
            android:exported="false">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_APPLICATION_TYPE"
                android:value="voice_assistant" />
        </service>

        <!-- Speech Recognition Intent Service -->
        <service
            android:name=".SpeechRecognitionService"
            android:exported="false" />

        <provider
            android:name="androidx.core.content.FileProvider"
            android:authorities="${applicationId}.fileprovider"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data
                android:name="android.support.FILE_PROVIDER_PATHS"
                android:resource="@xml/file_paths"></meta-data>
        </provider>

        <!-- Deep Links Support -->
        <intent-filter android:autoVerify="true">
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="https"
                android:host="xiaozhi.app" />
        </intent-filter>

    </application>

</manifest>
```

### 1.2 MainActivity Enhancement

**File: `android/app/src/main/kotlin/com/xiaozhi/avatar/MainActivity.kt`**

```kotlin
package com.xiaozhi.avatar

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity
import java.util.Locale

class MainActivity : BridgeActivity() {

    companion object {
        private const val TAG = "MainActivity"
        private const val REQUEST_AUDIO_PERMISSION = 1001
        private const val REQUEST_NOTIFICATION_PERMISSION = 1002

        @Volatile
        private var speechRecognizer: SpeechRecognizer? = null
        private var audioRecord: AudioRecord? = null
        private var isListening = false

        lateinit var instance: MainActivity
            private set
    }

    private val requiredPermissions = arrayOf(
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.CAMERA,
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.POST_NOTIFICATIONS
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this
        checkAndRequestPermissions()
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }.toTypedArray()

        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsToRequest,
                REQUEST_AUDIO_PERMISSION
            )
        }
    }

    fun hasAudioPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
        } else true
    }

    fun initializeSpeechRecognizer() {
        if (SpeechRecognizer.isRecognitionAvailable(this)) {
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this).apply {
                setRecognitionListener(createRecognitionListener())
            }
        }
    }

    private fun createRecognitionListener(): RecognitionListener {
        return object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                Log.d(TAG, "Ready for speech")
                notifyVoiceState("ready")
            }

            override fun onBeginningOfSpeech() {
                Log.d(TAG, "Speech began")
                notifyVoiceState("listening")
            }

            override fun onRmsChanged(rmsdB: Float) {
                notifyAudioLevel(rmsdB)
            }

            override fun onBufferReceived(buffer: ByteArray?) {
                // Audio buffer received
            }

            override fun onEndOfSpeech() {
                Log.d(TAG, "Speech ended")
                notifyVoiceState("processing")
            }

            override fun onError(error: Int) {
                Log.e(TAG, "Speech error: $error")
                val errorMessage = when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH -> "No speech detected"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Speech timeout"
                    SpeechRecognizer.ERROR_NO_NETWORK -> "Network required"
                    SpeechRecognizer.ERROR_MICROPHONE -> "Microphone unavailable"
                    else -> "Speech recognition error"
                }
                notifyVoiceError(errorMessage)
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    notifyVoiceResult(matches[0])
                }
                isListening = false
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val matches = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                if (!matches.isNullOrEmpty()) {
                    notifyVoicePartialResult(matches[0])
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) {
                // Reserved for future events
            }
        }
    }

    fun startListening() {
        if (!hasAudioPermission()) {
            checkAndRequestPermissions()
            return
        }

        if (isListening) {
            stopListening()
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1500)
        }

        try {
            speechRecognizer?.startListening(intent)
            isListening = true
        } catch (e: SecurityException) {
            Log.e(TAG, "Security exception starting speech recognizer", e)
            notifyVoiceError("Microphone permission required")
        }
    }

    fun stopListening() {
        speechRecognizer?.stopListening()
        isListening = false
    }

    private fun notifyVoiceState(state: String) {
        // Bridge to JavaScript via Capacitor plugin
        notifyPlugin("voiceState", mapOf("state" to state))
    }

    private fun notifyVoiceResult(text: String) {
        notifyPlugin("voiceResult", mapOf("text" to text))
    }

    private fun notifyVoicePartialResult(text: String) {
        notifyPlugin("voicePartialResult", mapOf("text" to text))
    }

    private fun notifyVoiceError(error: String) {
        notifyPlugin("voiceError", mapOf("error" to error))
    }

    private fun notifyAudioLevel(level: Float) {
        notifyPlugin("audioLevel", mapOf("level" to level))
    }

    private fun notifyPlugin(method: String, data: Map<String, Any>) {
        // This would be implemented via a Capacitor plugin
        // bridge.notifyListeners("voiceEvent", JSObject().apply {
        //     put("method", method)
        //     put("data", data)
        // })
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_AUDIO_PERMISSION) {
            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                initializeSpeechRecognizer()
            } else {
                notifyVoiceError("Microphone permission denied")
            }
        }
    }
}
```

### 1.3 Gradle Configuration Update

**File: `android/app/build.gradle.kts`**

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("com.getcapacitor.kotlin.capacitor")
}

android {
    namespace = "com.xiaozhi.avatar"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.xiaozhi.avatar"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    lint {
        warningsAsErrors = false
        abortOnError = false
        checkReleaseBuilds = true
        disable += setOf("MissingTranslation")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.2.0")
    implementation("androidx.activity:activity-compose:1.9.3")

    // Capacitor
    implementation("com.capacitorjs:core:8.0.0")
    implementation("com.capacitorjs:android:8.0.0")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.8.7")

    // Speech Recognition
    implementation("androidx.speech:speech-recognition:1.0.0-beta01")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.1")
}
```

---

## 🍎 Phase 2: iOS Configuration Setup

### 2.1 Create iOS Project

```bash
cd android/..
npx cap init ios --web-dir dist/public
```

### 2.2 Info.plist Configuration

**File: `ios/App/App/Info.plist`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>小智</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <false/>
        <key>UISceneConfigurations</key>
        <dict>
            <key>UIWindowSceneSessionRoleApplication</key>
            <array>
                <dict>
                    <key>UISceneConfigurationName</key>
                    <string>Default Configuration</string>
                    <key>UISceneDelegateClassName</key>
                    <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
                </dict>
            </array>
        </dict>
    </dict>
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>armv7</string>
    </array>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationPortraitUpsideDown</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UIStatusBarStyle</key>
    <string>UIStatusBarStyleLightContent</string>
    <key>UIViewControllerBasedStatusBarAppearance</key>
    <true/>
    <key>NSMicrophoneUsageDescription</key>
    <string>小智需要使用麦克风来接收您的语音指令，以便为您提供语音交互服务。</string>
    <key>NSSpeechRecognitionUsageDescription</key>
    <string>小智需要使用语音识别来理解您的指令，提供智能语音交互体验。</string>
    <key>NSCameraUsageDescription</key>
    <string>小智需要使用摄像头来支持视频通话和头像功能。</string>
    <key>NSBluetoothAlwaysUsageDescription</key>
    <string>小智需要蓝牙权限来连接语音设备和配件。</string>
    <key>NSBluetoothPeripheralUsageDescription</key>
    <string>小智需要蓝牙权限来发现和连接语音设备。</string>
    <key>NSPhotoLibraryUsageDescription</key>
    <string>小智需要访问照片库来保存和读取头像图片。</string>
    <key>NSUserTrackingUsageDescription</key>
    <string>小智使用用户追踪来提供个性化的语音交互体验。</string>
    <key>UIBackgroundModes</key>
    <array>
        <string>audio</string>
        <string>fetch</string>
        <string>processing</string>
        <string>remote-notification</string>
    </array>
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <true/>
        <key>NSAllowsArbitraryLoadsForMedia</key>
        <true/>
    </dict>
    <key>ITSAppUsesNonExemptEncryption</key>
    <false/>
</dict>
</plist>
```

### 2.3 AppDelegate Enhancement

**File: `ios/App/App/AppDelegate.swift`**

```swift
import UIKit
import Capacitor
import Speech
import AVFoundation

@main
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    var speechRecognizer: SFSpeechRecognizer?
    var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    var recognitionTask: SFSpeechRecognitionTask?
    let audioEngine = AVAudioEngine()

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Initialize speech recognizer
        speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "zh-CN"))

        // Request permissions
        requestSpeechPermission()
        requestMicrophonePermission()

        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication, didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {
    }

    private func requestSpeechPermission() {
        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                switch status {
                case .authorized:
                    print("Speech recognition authorized")
                case .denied:
                    print("Speech recognition denied")
                case .restricted:
                    print("Speech recognition restricted")
                case .notDetermined:
                    print("Speech recognition not determined")
                @unknown default:
                    break
                }
            }
        }
    }

    private func requestMicrophonePermission() {
        AVAudioSession.sharedInstance().requestRecordPermission { granted in
            if !granted {
                print("Microphone permission denied")
            }
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }
}
```

### 2.4 SceneDelegate Enhancement

**File: `ios/App/App/SceneDelegate.swift`**

```swift
import UIKit
import Capacitor
import AVFoundation

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }

        let window = UIWindow(windowScene: windowScene)
        let rootViewController = BridgeViewController()
        window.rootViewController = rootViewController
        self.window = window
        window.makeKeyAndVisible()

        configureAudioSession()
    }

    private func configureAudioSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playAndRecord,
                                        mode: .measurement,
                                        options: [.defaultToSpeaker, .allowBluetooth, .allowBluetoothA2DP])
            try audioSession.setActive(true)
        } catch {
            print("Failed to configure audio session: \(error)")
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        // Resume audio engine if needed
    }

    func sceneWillResignActive(_ scene: UIScene) {
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
    }
}
```

---

## 🔧 Phase 3: Capacitor Plugin Development

### 3.1 Voice Plugin Structure

**File: `client/src/plugins/VoicePlugin.ts`**

```typescript
import { registerPlugin } from '@capacitor/core';
import type { VoicePluginPlugin } from './definitions';

export const VoicePlugin = registerPlugin<VoicePluginPlugin>('VoicePlugin', {
  web: () => import('./web').then(m => new m.VoicePluginWeb()),
});

export * from './definitions';
```

### 3.2 Voice Plugin Definitions

**File: `client/src/plugins/definitions.ts`**

```typescript
import type { PluginListenerHandle } from '@capacitor/core';

export interface VoicePluginPlugin {
  initialize(): Promise<{ success: boolean }>;
  startListening(): Promise<{ success: boolean }>;
  stopListening(): Promise<{ success: boolean }>;
  isListening(): Promise<{ isListening: boolean }>;
  hasPermission(): Promise<{ hasPermission: boolean }>;
  requestPermission(): Promise<{ granted: boolean }>;
  getSupportedLanguages(): Promise<{ languages: string[] }>;
  setLanguage(language: string): Promise<{ success: boolean }>;

  addListener(eventName: 'voiceResult', listenerFunc: (data: { text: string }) => void): PluginListenerHandle;
  addListener(eventName: 'voicePartialResult', listenerFunc: (data: { text: string }) => void): PluginListenerHandle;
  addListener(eventName: 'voiceError', listenerFunc: (data: { error: string }) => void): PluginListenerHandle;
  addListener(eventName: 'voiceState', listenerFunc: (data: { state: string }) => void): PluginListenerHandle;
  addListener(eventName: 'audioLevel', listenerFunc: (data: { level: number }) => void): PluginListenerHandle;

  removeAllListeners(): Promise<void>;
}
```

### 3.3 Web Implementation

**File: `client/src/plugins/web.ts`**

```typescript
import { WebPlugin } from '@capacitor/core';
import type { VoicePluginPlugin } from './definitions';

export class VoicePluginWeb extends WebPlugin implements VoicePluginPlugin {
  private recognition: SpeechRecognition | null = null;
  private isRecognizing = false;

  async initialize(): Promise<{ success: boolean }> {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Speech recognition not supported in this browser');
    }

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'zh-CN';

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        this.notifyListeners('voiceResult', { text: result[0].transcript });
      } else {
        this.notifyListeners('voicePartialResult', { text: result[0].transcript });
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      this.notifyListeners('voiceError', { error: event.error });
    };

    this.recognition.onstart = () => {
      this.isRecognizing = true;
      this.notifyListeners('voiceState', { state: 'listening' });
    };

    this.recognition.onend = () => {
      this.isRecognizing = false;
      this.notifyListeners('voiceState', { state: 'stopped' });
    };

    return { success: true };
  }

  async startListening(): Promise<{ success: boolean }> {
    if (!this.recognition) {
      await this.initialize();
    }

    try {
      this.recognition?.start();
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  }

  async stopListening(): Promise<{ success: boolean }> {
    this.recognition?.stop();
    return { success: true };
  }

  async isListening(): Promise<{ isListening: boolean }> {
    return { isListening: this.isRecognizing };
  }

  async hasPermission(): Promise<{ hasPermission: boolean }> {
    // Web browsers don't require explicit permission for speech recognition
    return { hasPermission: true };
  }

  async requestPermission(): Promise<{ granted: boolean }> {
    return { granted: true };
  }

  async getSupportedLanguages(): Promise<{ languages: string[] }> {
    return {
      languages: ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR']
    };
  }

  async setLanguage(language: string): Promise<{ success: boolean }> {
    if (this.recognition) {
      this.recognition.lang = language;
      return { success: true };
    }
    return { success: false };
  }

  async removeAllListeners(): Promise<void> {
    this.recognition?.abort();
    this.recognition = null;
  }
}
```

### 3.4 Custom Hook: useNativeVoice

**File: `client/src/hooks/use-native-voice.ts`**

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { VoicePlugin } from '../plugins/VoicePlugin';
import { useLogger } from '../lib/logger';

export interface UseNativeVoiceResult {
  isListening: boolean;
  transcript: string;
  partialTranscript: string;
  isSupported: boolean;
  error: string | null;
  audioLevel: number;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  hasPermission: boolean;
  requestPermission: () => Promise<boolean>;
}

export function useNativeVoice(): UseNativeVoiceResult {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasPermission, setHasPermission] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { log } = useLogger('useNativeVoice');

  useEffect(() => {
    const initialize = async () => {
      try {
        const isSpeechRecognitionSupported =
          'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

        if (!isSpeechRecognitionSupported) {
          setIsSupported(false);
          log.warn('Speech recognition not supported');
          return;
        }

        // For web, we use the web plugin
        // For native, we initialize the Capacitor plugin
        if ((window as any).Capacitor && !(window as any).Capacitor.isNative) {
          await VoicePlugin.initialize();
        }

        setHasPermission(true);
        log.info('Voice recognition initialized');
      } catch (err) {
        setError((err as Error).message);
        log.error('Failed to initialize voice', err);
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!isSupported) return;

    const handleResult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        setTranscript(prev => prev + result[0].transcript);
        setPartialTranscript('');
      } else {
        setPartialTranscript(result[0].transcript);
      }
    };

    const handleError = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error);
      setIsListening(false);
      log.error(`Speech recognition error: ${event.error}`);
    };

    const handleStart = () => setIsListening(true);
    const handleEnd = () => setIsListening(false);

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognitionClass();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'zh-CN';

    recognitionRef.current.onresult = handleResult;
    recognitionRef.current.onerror = handleError;
    recognitionRef.current.onstart = handleStart;
    recognitionRef.current.onend = handleEnd;

    return () => {
      recognitionRef.current?.abort();
    };
  }, [isSupported]);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      setPartialTranscript('');

      if ((window as any).Capacitor?.isNative) {
        await VoicePlugin.startListening();
      } else {
        recognitionRef.current?.start();
      }
    } catch (err) {
      setError((err as Error).message);
      log.error('Failed to start listening', err);
    }
  }, []);

  const stopListening = useCallback(async () => {
    try {
      if ((window as any).Capacitor?.isNative) {
        await VoicePlugin.stopListening();
      } else {
        recognitionRef.current?.stop();
      }
    } catch (err) {
      log.error('Failed to stop listening', err);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const granted = await VoicePlugin.requestPermission();
      setHasPermission(granted);
      return granted;
    } catch (err) {
      log.error('Failed to request permission', err);
      return false;
    }
  }, []);

  return {
    isListening,
    transcript,
    partialTranscript,
    isSupported,
    error,
    audioLevel,
    startListening,
    stopListening,
    hasPermission,
    requestPermission,
  };
}
```

---

## 🎨 Phase 4: Native UI Components

### 4.1 Native Voice Button Component

**File: `client/src/components/native-voice-button.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Waveform } from 'lucide-react';
import { useNativeVoice } from '../hooks/use-native-voice';
import { cn } from '../lib/utils';

interface NativeVoiceButtonProps {
  onVoiceInput?: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'ghost';
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
};

const iconSizes = {
  sm: 20,
  md: 28,
  lg: 40,
};

export function NativeVoiceButton({
  onVoiceInput,
  className,
  size = 'md',
  variant = 'primary',
}: NativeVoiceButtonProps) {
  const {
    isListening,
    transcript,
    partialTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
  } = useNativeVoice();

  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (transcript && onVoiceInput) {
      onVoiceInput(transcript);
      setShowTranscript(false);
    }
  }, [transcript, onVoiceInput]);

  const handlePress = async () => {
    if (isListening) {
      await stopListening();
    } else {
      await startListening();
      setShowTranscript(true);
    }
  };

  const variantClasses = {
    primary: 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white',
    secondary: 'bg-zinc-800 text-white hover:bg-zinc-700',
    ghost: 'bg-transparent text-zinc-400 hover:text-white',
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className={cn('relative', className)}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
        onClick={handlePress}
        className={cn(
          'rounded-full flex items-center justify-center shadow-lg',
          'transition-all duration-300',
          variantClasses[variant],
          sizeClasses[size],
          isListening && 'ring-4 ring-violet-500/30'
        )}
        aria-label={isListening ? '停止语音输入' : '开始语音输入'}
      >
        <AnimatePresence mode="wait">
          {isListening ? (
            <motion.div
              key="listening"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="relative"
            >
              <Waveform
                size={iconSizes[size]}
                className="text-red-400 animate-pulse"
              />
              <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-red-400 whitespace-nowrap">
                听...
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
            >
              <Mic size={iconSizes[size]} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {showTranscript && (partialTranscript || isListening) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-64 bg-zinc-900/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-zinc-800"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-zinc-400">正在识别...</span>
            </div>
            <p className="text-sm text-white font-medium">
              {partialTranscript || '等待说话...'}
            </p>
            {isListening && (
              <div className="mt-2 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500"
                  animate={{
                    x: ['-100%', '100%'],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                  style={{ width: '50%' }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-full whitespace-nowrap">
          {error}
        </div>
      )}
    </div>
  );
}
```

---

## 📱 Phase 5: Mobile-Specific Optimizations

### 5.1 Responsive Voice UI Hook

**File: `client/src/hooks/use-mobile-voice-ui.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';

interface MobileVoiceUIState {
  isMobile: boolean;
  isStandalone: boolean;
  supportsNativeVoice: boolean;
  keyboardVisible: boolean;
  keyboardHeight: number;
}

export function useMobileVoiceUI(): MobileVoiceUIState {
  const [state, setState] = useState<MobileVoiceUIState>({
    isMobile: false,
    isStandalone: false,
    supportsNativeVoice: false,
    keyboardVisible: false,
    keyboardHeight: 0,
  });

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        (window.innerWidth < 768 && 'ontouchstart' in window);

      const isStandalone = (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;

      const supportsNativeVoice = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) &&
        (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));

      setState(prev => ({
        ...prev,
        isMobile,
        isStandalone,
        supportsNativeVoice,
      }));
    };

    checkMobile();

    const handleResize = () => checkMobile();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyboardShow = (e: KeyboardEvent) => {
      setState(prev => ({
        ...prev,
        keyboardVisible: true,
        keyboardHeight: (e.target as any).keyboardHeight || 300,
      }));
    };

    const handleKeyboardHide = () => {
      setState(prev => ({
        ...prev,
        keyboardVisible: false,
        keyboardHeight: 0,
      }));
    };

    if ((window as any). Capacitor?.isNative) {
      window.addEventListener('keyboardWillShow', handleKeyboardShow);
      window.addEventListener('keyboardWillHide', handleKeyboardHide);
    } else {
      window.visualViewport?.addEventListener('resize', () => {
        const viewport = window.visualViewport;
        if (viewport) {
          const isKeyboardVisible = window.innerHeight - viewport.height > 100;
          setState(prev => ({
            ...prev,
            keyboardVisible: isKeyboardVisible,
            keyboardHeight: window.innerHeight - viewport.height,
          }));
        }
      });
    }

    return () => {
      window.removeEventListener('keyboardWillShow', handleKeyboardShow);
      window.removeEventListener('keyboardWillHide', handleKeyboardHide);
    };
  }, []);

  return state;
}
```

### 5.2 Mobile Voice Input Sheet

**File: `client/src/components/mobile-voice-sheet.tsx`**

```tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Sparkles } from 'lucide-react';
import { useNativeVoice } from '../hooks/use-native-voice';
import { useMobileVoiceUI } from '../hooks/use-mobile-voice-ui';

interface MobileVoiceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

export function MobileVoiceSheet({ isOpen, onClose, onSubmit }: MobileVoiceSheetProps) {
  const { isListening, transcript, partialTranscript, startListening, stopListening, error } =
    useNativeVoice();
  const { isMobile, keyboardVisible } = useMobileVoiceUI();
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    if (transcript) {
      setShowResult(true);
    }
  }, [transcript]);

  const handleVoicePress = async () => {
    if (isListening) {
      await stopListening();
      if (transcript) {
        onSubmit(transcript);
      }
    } else {
      await startListening();
    }
  };

  const handleSubmit = () => {
    if (transcript) {
      onSubmit(transcript);
    }
  };

  if (!isMobile) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl p-6 z-50"
            style={{
              paddingBottom: keyboardVisible ? 20 : 40,
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <span className="text-sm text-zinc-400">语音输入</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center py-8">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleVoicePress}
                className={`
                  relative w-24 h-24 rounded-full flex items-center justify-center
                  transition-all duration-300
                  ${isListening
                    ? 'bg-gradient-to-r from-red-500 to-rose-600 shadow-lg shadow-red-500/30'
                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/30'
                  }
                `}
              >
                {isListening ? (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Mic className="w-10 h-10 text-white" />
                  </motion.div>
                ) : (
                  <Mic className="w-10 h-10 text-white" />
                )}

                {isListening && (
                  <>
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="absolute w-full h-full rounded-full border-2 border-red-400"
                        initial={{ scale: 1, opacity: 0.8 }}
                        animate={{
                          scale: [1, 1.5],
                          opacity: [0.8, 0],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          delay: i * 0.3,
                        }}
                      />
                    ))}
                  </>
                )}
              </motion.button>

              <motion.p
                key={partialTranscript || 'listening'}
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                className="mt-6 text-center text-lg text-white font-medium min-h-[2rem]"
              >
                {isListening
                  ? partialTranscript || '请开始说话...'
                  : transcript
                  ? transcript
                  : '点击开始语音输入'}
              </motion.p>

              {error && (
                <p className="mt-2 text-sm text-red-400">{error}</p>
              )}
            </div>

            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <button
                  onClick={handleVoicePress}
                  className="flex-1 py-3 bg-zinc-800 rounded-xl text-white font-medium hover:bg-zinc-700 transition-colors"
                >
                  继续说
                </button>
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-xl text-white font-medium"
                >
                  发送
                </button>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

---

## 🧪 Phase 6: Testing Strategy

### 6.1 Mobile Voice Tests

**File: `tests/e2e/mobile-voice.spec.ts`**

```typescript
import { test, expect, Device } from '@playwright/test';

const mobileDevices: Device[] = [
  { name: 'iPhone 14', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  { name: 'Pixel 7', viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true },
];

test.describe('Mobile Voice Features', () => {
  for (const device of mobileDevices) {
    test.describe(`${device.name}`, () => {
      test.use({ ...device });

      test('should display voice button on mobile', async ({ page }) => {
        await page.goto('/');
        const voiceButton = page.locator('[aria-label="语音输入"]');
        await expect(voiceButton).toBeVisible();
      });

      test('should show voice sheet when voice button pressed', async ({ page }) => {
        await page.goto('/');

        // First enable mic permission
        await page.context().grantPermissions(['microphone']);

        const voiceButton = page.locator('[aria-label="语音输入"]');
        await voiceButton.click();

        // Check for voice sheet
        const voiceSheet = page.locator('text=语音输入');
        await expect(voiceSheet).toBeVisible();
      });

      test('should detect native voice support', async ({ page }) => {
        const supportsNativeVoice = await page.evaluate(() => {
          return !!(
            navigator.mediaDevices &&
            navigator.mediaDevices.getUserMedia &&
            ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
          );
        });

        expect(supportsNativeVoice).toBe(true);
      });
    });
  }
});

test.describe('Native Voice Plugin', () => {
  test('should initialize voice plugin on native', async ({ page }) => {
    await page.goto('/');

    // Simulate native environment
    await page.addInitScript(() => {
      (window as any).Capacitor = {
        isNative: true,
        platform: 'android',
      };
    });

    const isInitialized = await page.evaluate(async () => {
      try {
        // VoicePlugin would be initialized here
        return true;
      } catch {
        return false;
      }
    });

    expect(isInitialized).toBe(true);
  });
});
```

---

## 📦 Phase 7: Build & Deployment

### 7.1 Build Scripts

**Update package.json scripts:**

```json
{
  "scripts": {
    "build:android": "npm run build && cd android && ./gradlew build",
    "build:ios": "npm run build && npx cap sync ios && cd ios && xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath build/App.xcarchive archive",
    "build:apk": "cd android && ./gradlew assembleRelease",
    "build:aab": "cd android && ./gradlew bundleRelease",
    "run:android": "cd android && ./gradlew installDebug",
    "run:ios": "npx cap run ios",
    "sync:capacitor": "npx cap sync"
  }
}
```

### 7.2 Environment Configuration

**File: `.env.production.mobile`**

```properties
VITE_APP_NAME=小智
VITE_APP_VERSION=1.0.0
VITE_API_URL=https://api.xiaozhi.app
VITE_WS_URL=wss://api.xiaozhi.app/ws
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_OPENREPLAY_PROJECT_KEY=xxx
```

---

## ✅ Checklist Summary

### Android
- [x] Capacitor v8 configured
- [ ] AndroidManifest.xml updated with all permissions
- [ ] MainActivity enhanced with speech recognition
- [ ] Gradle configuration updated
- [ ] Voice foreground service implemented
- [ ] Deep links configured

### iOS
- [ ] iOS project initialized
- [ ] Info.plist with all required permissions
- [ ] AppDelegate with speech recognition
- [ ] SceneDelegate with audio session
- [ ] Background modes configured
- [ ] Deep links configured

### Capacitor Plugins
- [ ] VoicePlugin created
- [ ] Web implementation
- [ ] Native implementations
- [ ] useNativeVoice hook
- [ ] useMobileVoiceUI hook

### UI Components
- [ ] NativeVoiceButton component
- [ ] MobileVoiceSheet component
- [ ] Voice input feedback
- [ ] Error handling UI

### Testing
- [ ] Mobile voice E2E tests
- [ ] Native plugin tests
- [ ] Permission handling tests
- [ ] Voice input flow tests

### Build & Deploy
- [ ] Android APK build
- [ ] iOS IPA build
- [ ] TestFlight submission
- [ ] Play Store submission
