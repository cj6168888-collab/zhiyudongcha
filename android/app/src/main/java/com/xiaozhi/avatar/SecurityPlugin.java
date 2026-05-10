package com.xiaozhi.avatar;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "Security")
public class SecurityPlugin extends Plugin {
    private Executor executor;
    private BiometricPrompt biometricPrompt;
    private BiometricPrompt.PromptInfo promptInfo;

    @Override
    public void load() {
        executor = ContextCompat.getMainExecutor(getContext());
    }

    @PluginMethod
    public void checkBiometricAvailability(PluginCall call) {
        BiometricManager biometricManager = BiometricManager.from(getContext());
        int result = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL);

        JSObject ret = new JSObject();
        switch (result) {
            case BiometricManager.BIOMETRIC_SUCCESS:
                ret.put("available", true);
                break;
            case BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE:
                ret.put("available", false);
                ret.put("error", "NO_HARDWARE");
                break;
            case BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE:
                ret.put("available", false);
                ret.put("error", "HW_UNAVAILABLE");
                break;
            case BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED:
                ret.put("available", false);
                ret.put("error", "NONE_ENROLLED");
                break;
            default:
                ret.put("available", false);
                ret.put("error", "UNKNOWN");
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            biometricPrompt = new BiometricPrompt(getActivity(), executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    super.onAuthenticationSucceeded(result);
                    call.resolve(new JSObject().put("success", true));
                }

                @Override
                public void onAuthenticationError(int errorCode, CharSequence errString) {
                    super.onAuthenticationError(errorCode, errString);
                    call.reject(errString.toString(), String.valueOf(errorCode));
                }

                @Override
                public void onAuthenticationFailed() {
                    super.onAuthenticationFailed();
                    // Keep waiting for success or cancel
                }
            });

            promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("身份验证")
                    .setSubtitle("请验证指纹或面容以确认主人身份")
                    .setNegativeButtonText("取消")
                    .build();

            biometricPrompt.authenticate(promptInfo);
        });
    }
}
