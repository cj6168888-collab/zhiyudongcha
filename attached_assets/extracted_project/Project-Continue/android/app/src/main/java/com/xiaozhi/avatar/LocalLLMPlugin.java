package com.xiaozhi.avatar;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Capacitor Plugin for Local LLM inference using llama.cpp
 * 
 * This plugin bridges the WebView to native llama.cpp inference.
 * For production, you need to:
 * 1. Add llama.cpp Android bindings (llama-android AAR)
 * 2. Implement actual model loading and inference
 */
@CapacitorPlugin(name = "LocalLLM")
public class LocalLLMPlugin extends Plugin {
    private static final String TAG = "LocalLLM";
    private ExecutorService executor = Executors.newSingleThreadExecutor();
    private Handler mainHandler = new Handler(Looper.getMainLooper());
    
    private boolean modelLoaded = false;
    private String currentModelPath = null;
    
    // Native methods - implement with llama.cpp JNI bindings
    // static { System.loadLibrary("llama-android"); }
    // private native long llama_load_model(String modelPath, int contextLength, int gpuLayers);
    // private native String llama_chat(long modelHandle, String prompt, float temp, float topP, int maxTokens);
    // private native void llama_unload(long modelHandle);
    
    @PluginMethod
    public void checkModel(PluginCall call) {
        String modelName = call.getString("name", "");
        File modelDir = new File(getContext().getFilesDir(), "models");
        File modelFile = new File(modelDir, modelName + ".gguf");
        
        JSObject result = new JSObject();
        result.put("exists", modelFile.exists());
        result.put("path", modelFile.getAbsolutePath());
        if (modelFile.exists()) {
            result.put("sizeBytes", modelFile.length());
        }
        call.resolve(result);
    }
    
    @PluginMethod
    public void downloadModel(PluginCall call) {
        String url = call.getString("url", "");
        String name = call.getString("name", "");
        
        if (url.isEmpty() || name.isEmpty()) {
            call.reject("Missing url or name");
            return;
        }
        
        executor.execute(() -> {
            try {
                File modelDir = new File(getContext().getFilesDir(), "models");
                if (!modelDir.exists()) modelDir.mkdirs();
                
                File modelFile = new File(modelDir, name + ".gguf");
                File tempFile = new File(modelDir, name + ".gguf.tmp");
                
                URL downloadUrl = new URL(url);
                HttpURLConnection conn = (HttpURLConnection) downloadUrl.openConnection();
                conn.setRequestProperty("User-Agent", "XiaoZhi-Avatar/1.0");
                
                int totalSize = conn.getContentLength();
                int downloaded = 0;
                
                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(tempFile)) {
                    
                    byte[] buffer = new byte[8192];
                    int bytesRead;
                    
                    while ((bytesRead = in.read(buffer)) != -1) {
                        out.write(buffer, 0, bytesRead);
                        downloaded += bytesRead;
                        
                        final int progress = (int) ((downloaded * 100L) / totalSize);
                        mainHandler.post(() -> {
                            JSObject event = new JSObject();
                            event.put("progress", progress);
                            notifyListeners("downloadProgress", event);
                        });
                    }
                }
                
                tempFile.renameTo(modelFile);
                
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("path", modelFile.getAbsolutePath());
                call.resolve(result);
                
            } catch (Exception e) {
                Log.e(TAG, "Download failed", e);
                call.reject("Download failed: " + e.getMessage());
            }
        });
    }
    
    @PluginMethod
    public void loadModel(PluginCall call) {
        String name = call.getString("name", "");
        int contextLength = call.getInt("contextLength", 4096);
        int gpuLayers = call.getInt("gpuLayers", 0);
        
        File modelDir = new File(getContext().getFilesDir(), "models");
        File modelFile = new File(modelDir, name + ".gguf");
        
        if (!modelFile.exists()) {
            call.reject("Model not found: " + name);
            return;
        }
        
        executor.execute(() -> {
            try {
                // TODO: Implement actual llama.cpp model loading
                // long handle = llama_load_model(modelFile.getAbsolutePath(), contextLength, gpuLayers);
                
                currentModelPath = modelFile.getAbsolutePath();
                modelLoaded = true;
                
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("modelPath", currentModelPath);
                call.resolve(result);
                
            } catch (Exception e) {
                Log.e(TAG, "Load failed", e);
                call.reject("Load failed: " + e.getMessage());
            }
        });
    }
    
    @PluginMethod
    public void unloadModel(PluginCall call) {
        executor.execute(() -> {
            try {
                // TODO: Implement actual model unloading
                // llama_unload(modelHandle);
                
                modelLoaded = false;
                currentModelPath = null;
                
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
                
            } catch (Exception e) {
                call.reject("Unload failed: " + e.getMessage());
            }
        });
    }
    
    @PluginMethod
    public void chat(PluginCall call) {
        if (!modelLoaded) {
            call.reject("No model loaded");
            return;
        }
        
        // Extract messages and build prompt
        // For now, return a placeholder
        executor.execute(() -> {
            try {
                // TODO: Implement actual llama.cpp inference
                // String response = llama_chat(modelHandle, prompt, temp, topP, maxTokens);
                
                String response = "这是本地模型的响应。实际部署时需要集成 llama.cpp。";
                
                JSObject result = new JSObject();
                result.put("content", response);
                result.put("success", true);
                call.resolve(result);
                
            } catch (Exception e) {
                Log.e(TAG, "Chat failed", e);
                call.reject("Chat failed: " + e.getMessage());
            }
        });
    }
    
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("loaded", modelLoaded);
        result.put("modelPath", currentModelPath);
        call.resolve(result);
    }
    
    @PluginMethod
    public void verifyModel(PluginCall call) {
        String name = call.getString("name", "");
        String expectedSha256 = call.getString("sha256", "");
        
        File modelDir = new File(getContext().getFilesDir(), "models");
        File modelFile = new File(modelDir, name + ".gguf");
        
        if (!modelFile.exists()) {
            JSObject result = new JSObject();
            result.put("valid", false);
            result.put("error", "Model file not found");
            call.resolve(result);
            return;
        }
        
        executor.execute(() -> {
            try {
                String actualSha256 = calculateSHA256(modelFile);
                
                JSObject result = new JSObject();
                result.put("actualSha256", actualSha256);
                
                if (expectedSha256.isEmpty()) {
                    result.put("valid", true);
                    result.put("warning", "No expected hash provided, skipping verification");
                } else if (actualSha256.equalsIgnoreCase(expectedSha256)) {
                    result.put("valid", true);
                } else {
                    result.put("valid", false);
                    result.put("error", "SHA256 mismatch: expected " + expectedSha256 + ", got " + actualSha256);
                }
                
                call.resolve(result);
                
            } catch (Exception e) {
                Log.e(TAG, "Verify failed", e);
                JSObject result = new JSObject();
                result.put("valid", false);
                result.put("error", "Verification failed: " + e.getMessage());
                call.resolve(result);
            }
        });
    }
    
    @PluginMethod
    public void deleteModel(PluginCall call) {
        String name = call.getString("name", "");
        
        File modelDir = new File(getContext().getFilesDir(), "models");
        File modelFile = new File(modelDir, name + ".gguf");
        
        JSObject result = new JSObject();
        
        if (modelFile.exists()) {
            if (currentModelPath != null && currentModelPath.equals(modelFile.getAbsolutePath())) {
                result.put("success", false);
                result.put("error", "Cannot delete currently loaded model. Unload first.");
                call.resolve(result);
                return;
            }
            
            boolean deleted = modelFile.delete();
            result.put("success", deleted);
            if (!deleted) {
                result.put("error", "Failed to delete model file");
            }
        } else {
            result.put("success", false);
            result.put("error", "Model not found");
        }
        
        call.resolve(result);
    }
    
    @PluginMethod
    public void listModels(PluginCall call) {
        File modelDir = new File(getContext().getFilesDir(), "models");
        
        JSObject result = new JSObject();
        
        if (!modelDir.exists() || !modelDir.isDirectory()) {
            result.put("models", new org.json.JSONArray());
            call.resolve(result);
            return;
        }
        
        File[] files = modelDir.listFiles((dir, name) -> name.endsWith(".gguf"));
        org.json.JSONArray modelsArray = new org.json.JSONArray();
        
        if (files != null) {
            for (File file : files) {
                org.json.JSONObject model = new org.json.JSONObject();
                try {
                    String name = file.getName().replace(".gguf", "");
                    model.put("name", name);
                    model.put("path", file.getAbsolutePath());
                    model.put("sizeBytes", file.length());
                    model.put("sizeMB", Math.round(file.length() / 1024.0 / 1024.0));
                    model.put("lastModified", file.lastModified());
                    modelsArray.put(model);
                } catch (Exception e) {
                    Log.w(TAG, "Error reading model info: " + e.getMessage());
                }
            }
        }
        
        result.put("models", modelsArray);
        call.resolve(result);
    }
    
    private String calculateSHA256(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            long totalRead = 0;
            long fileSize = file.length();
            
            while ((bytesRead = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
                totalRead += bytesRead;
                
                if (totalRead % (50 * 1024 * 1024) == 0) {
                    Log.d(TAG, "Hashing progress: " + (totalRead * 100 / fileSize) + "%");
                }
            }
        }
        
        byte[] hashBytes = digest.digest();
        StringBuilder hexString = new StringBuilder();
        
        for (byte b : hashBytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        
        return hexString.toString();
    }
    
    @PluginMethod
    public void getModelPath(PluginCall call) {
        File modelDir = new File(getContext().getFilesDir(), "models");
        
        JSObject result = new JSObject();
        result.put("path", modelDir.getAbsolutePath());
        result.put("exists", modelDir.exists());
        
        if (modelDir.exists()) {
            result.put("freeSpace", modelDir.getFreeSpace());
            result.put("usableSpace", modelDir.getUsableSpace());
        }
        
        call.resolve(result);
    }
}
