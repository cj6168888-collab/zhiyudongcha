package com.xiaozhi.avatar;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "VoicePlugin",
    permissions = {
        @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = VoicePlugin.MICROPHONE_PERMISSION)
    }
)
public class VoicePlugin extends Plugin {

    static final String MICROPHONE_PERMISSION = "microphone";

    private SpeechRecognizer speechRecognizer;
    private boolean isListening = false;
    private long lastRmsNotifyMs = 0L;
    private static final long RMS_THROTTLE_MS = 100;

    @PluginMethod
    public void setListeningMode(PluginCall call) {
        String mode = call.getString("mode", "daily");
        MainActivity activity = (MainActivity) getActivity();
        activity.setCurrentListeningMode(mode);

        if ("attentive".equals(mode)) {
            activity.triggerFeedback(new long[]{0, 30, 100, 30});
        }
        call.resolve(new JSObject().put("currentMode", mode));
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean available = SpeechRecognizer.isRecognitionAvailable(getContext());
        call.resolve(new JSObject().put("available", available));
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (getPermissionState(MICROPHONE_PERMISSION) != PermissionState.GRANTED) {
            requestPermissionForAlias(MICROPHONE_PERMISSION, call, "startListeningAfterPermission");
            return;
        }

        startListeningWithPermission(call);
    }

    @PermissionCallback
    private void startListeningAfterPermission(PluginCall call) {
        if (getPermissionState(MICROPHONE_PERMISSION) != PermissionState.GRANTED) {
            emitSpeechError(SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS, "permission_denied");
            call.reject("PERMISSION_DENIED", "permission_denied");
            return;
        }

        startListeningWithPermission(call);
    }

    private void startListeningWithPermission(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                if (isListening) {
                    call.resolve(new JSObject().put("status", "already_listening"));
                    return;
                }

                if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                    call.reject("STT_NOT_AVAILABLE", "Device does not support SpeechRecognizer");
                    return;
                }

                MainActivity activity = (MainActivity) getActivity();

                // 启动前台服务通知（让用户知道麦克风激活）
                activity.startListening();

                // 初始化 SpeechRecognizer
                speechRecognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
                speechRecognizer.setRecognitionListener(new RecognitionListener() {

                    @Override
                    public void onReadyForSpeech(Bundle params) {
                        JSObject event = new JSObject();
                        event.put("status", "ready");
                        notifyListeners("speechStatus", event);
                    }

                    @Override
                    public void onBeginningOfSpeech() {
                        JSObject event = new JSObject();
                        event.put("status", "listening");
                        notifyListeners("speechStatus", event);
                    }

                    @Override
                    public void onRmsChanged(float rmsdB) {
                        long now = System.currentTimeMillis();
                        if (now - lastRmsNotifyMs < RMS_THROTTLE_MS) return;
                        lastRmsNotifyMs = now;
                        JSObject event = new JSObject();
                        event.put("rms", rmsdB);
                        notifyListeners("speechRms", event);
                    }

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {
                        isListening = false;
                        JSObject event = new JSObject();
                        event.put("status", "processing");
                        notifyListeners("speechStatus", event);
                    }

                    @Override
                    public void onError(int error) {
                        isListening = false;
                        activity.stopListening();
                        destroySpeechRecognizer();

                        JSObject event = new JSObject();
                        event.put("code", error);
                        event.put("message", mapErrorCode(error));
                        notifyListeners("speechError", event);
                    }

                    @Override
                    public void onResults(Bundle results) {
                        isListening = false;
                        activity.stopListening();
                        destroySpeechRecognizer();

                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        float[] scores = results.getFloatArray(SpeechRecognizer.CONFIDENCE_SCORES);

                        String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        float confidence = (scores != null && scores.length > 0) ? scores[0] : 1.0f;

                        // 成功识别：触发震动反馈
                        activity.triggerFeedback(new long[]{0, 30});

                        JSObject event = new JSObject();
                        event.put("text", text);
                        event.put("confidence", confidence);
                        event.put("isFinal", true);
                        notifyListeners("speechResult", event);
                    }

                    @Override
                    public void onPartialResults(Bundle partialResults) {
                        ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = (matches != null && !matches.isEmpty()) ? matches.get(0) : "";
                        if (!text.isEmpty()) {
                            JSObject event = new JSObject();
                            event.put("text", text);
                            event.put("isFinal", false);
                            notifyListeners("speechResult", event);
                        }
                    }

                    @Override
                    public void onEvent(int eventType, Bundle params) {}
                });

                // 构建识别意图
                Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "zh-CN");
                intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
                intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);

                // attentive 模式延长静默容忍时间
                String mode = activity.getCurrentListeningMode();
                if ("attentive".equals(mode)) {
                    intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 5000L);
                    intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L);
                } else {
                    intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2000L);
                }

                isListening = true;
                speechRecognizer.startListening(intent);
                call.resolve(new JSObject().put("status", "started"));

            } catch (Exception e) {
                isListening = false;
                destroySpeechRecognizer();
                call.reject("START_FAILED", e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                if (speechRecognizer != null) {
                    speechRecognizer.stopListening();
                }
                isListening = false;
                destroySpeechRecognizer();

                MainActivity activity = (MainActivity) getActivity();
                activity.stopListening();

                call.resolve(new JSObject().put("status", "stopped"));
            } catch (Exception e) {
                call.reject("STOP_FAILED", e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        getBridge().executeOnMainThread(this::destroySpeechRecognizer);
    }

    private void destroySpeechRecognizer() {
        if (speechRecognizer != null) {
            speechRecognizer.destroy();
            speechRecognizer = null;
        }
    }

    private void emitSpeechError(int code, String message) {
        JSObject event = new JSObject();
        event.put("code", code);
        event.put("message", message);
        notifyListeners("speechError", event);
    }

    private String mapErrorCode(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:                  return "audio_error";
            case SpeechRecognizer.ERROR_CLIENT:                 return "client_error";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: return "permission_denied";
            case SpeechRecognizer.ERROR_NETWORK:                return "network_error";
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:        return "network_timeout";
            case SpeechRecognizer.ERROR_NO_MATCH:               return "no_match";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:        return "recognizer_busy";
            case SpeechRecognizer.ERROR_SERVER:                 return "server_error";
            case SpeechRecognizer.ERROR_SPEECH_TIMEOUT:         return "speech_timeout";
            default:                                             return "unknown_error";
        }
    }
}
