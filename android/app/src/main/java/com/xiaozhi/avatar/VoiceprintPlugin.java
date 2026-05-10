package com.xiaozhi.avatar;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashMap;
import java.util.Map;

@CapacitorPlugin(name = "Voiceprint")
public class VoiceprintPlugin extends Plugin {
    // 模拟声纹特征库：存储主人标识与特征哈希
    private Map<String, String> ownerVoiceprints = new HashMap<>();
    private boolean isLoyaltyModeEnabled = true;

    @PluginMethod
    public void registerOwnerVoice(PluginCall call) {
        // 实际应提取MFCC特征，此处预留逻辑
        ownerVoiceprints.put("owner", "vprint_feature_hash_001");
        call.resolve(new JSObject().put("status", "registered"));
    }

    /**
     * 判定说话人身份：在连续聆听中使用
     */
    @PluginMethod
    public void identifySpeaker(PluginCall call) {
        // 模拟识别逻辑
        boolean isOwner = true; // 实际由底层声纹引擎返回
        JSObject ret = new JSObject();
        ret.put("isOwner", isOwner);
        ret.put("identity", isOwner ? "Master" : "Stranger");
        call.resolve(ret);
    }

    @PluginMethod
    public void setLoyaltyMode(PluginCall call) {
        this.isLoyaltyModeEnabled = call.getBoolean("enabled", true);
        call.resolve();
    }
}
