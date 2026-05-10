package com.xiaozhi.avatar;

import android.util.Log;

/**
 * 核心 JNI 桥接类
 */
public class LocalLLMJNI {
    private static final String TAG = "LocalLLMJNI";

    static {
        try {
            System.loadLibrary("llama-android");
            Log.i(TAG, "Native library llama-android loaded successfully");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "Failed to load native library llama-android: " + e.getMessage());
        }
    }

    public native static boolean initialize(String modelPath, int nCtx, int nThreads, int nGpuLayers);
    public native static boolean isModelLoaded();
    public native static String generate(String prompt, int maxTokens, float temperature, float topP, float repeatPenalty);
    public native static String chat(String systemPrompt, String userMessage, int maxTokens, float temperature, float topP, float repeatPenalty);
    public native static void unloadModel();
    public native static void setLogLevel(int level);
    public native static String getModelInfo();

    public static void logCallback(int level, String text) {
        Log.d(TAG, "[LLAMA_NATIVE] " + text);
    }
}
