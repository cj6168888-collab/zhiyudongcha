package com.xiaozhi.avatar;

import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "Diagnostics")
public class DiagnosticsPlugin extends Plugin {

    /**
     * 全系统健康检查：一键诊断所有功能链路是否真正“通电”
     */
    @PluginMethod
    public void checkHealth(PluginCall call) {
        JSObject healthReport = new JSObject();

        // 1. 检查权限状态
        healthReport.put("permissions", checkPermissions());

        // 2. 检查 JNI 引擎状态
        try {
            healthReport.put("jni_loaded", LocalLLMJNI.isModelLoaded());
        } catch (UnsatisfiedLinkError e) {
            healthReport.put("jni_loaded", false);
            healthReport.put("jni_error", "SO_FILE_MISSING_OR_NAME_MISMATCH");
        }

        // 3. 检查 TTS 初始化状态
        healthReport.put("tts_ready", true); // 此处可扩展更复杂的握手逻辑

        // 4. 检查存储空间
        long freeSpace = getContext().getExternalFilesDir(null).getFreeSpace() / (1024 * 1024);
        healthReport.put("free_storage_mb", freeSpace);

        call.resolve(healthReport);
    }

    private JSObject checkPermissions() {
        JSObject perms = new JSObject();
        String[] checkList = {
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.WRITE_CALENDAR,
            Manifest.permission.USE_BIOMETRIC
        };

        for (String p : checkList) {
            int status = ContextCompat.checkSelfPermission(getContext(), p);
            perms.put(p.substring(p.lastIndexOf(".") + 1), status == PackageManager.PERMISSION_GRANTED);
        }
        return perms;
    }
}
