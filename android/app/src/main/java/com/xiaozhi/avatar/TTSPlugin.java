package com.xiaozhi.avatar;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.CopyOnWriteArrayList;

@CapacitorPlugin(name = "TTS")
public class TTSPlugin extends Plugin {
    private TextToSpeech tts;
    private boolean isInitialized = false;
    private AudioManager audioManager;
    private Random random = new Random();
    private final CopyOnWriteArrayList<PluginCall> pendingCalls = new CopyOnWriteArrayList<>();

    private String lastText = "";
    private int repeatCount = 0;
    private long lastSpeakTime = 0;

    // --- 职业专家语料库 ---
    private static final Map<String, Map<String, String>> EXPERT_VOCAB = new HashMap<>();
    static {
        // 1. 法务专家
        Map<String, String> law = new HashMap<>();
        law.put("我觉得", "根据合同义务推导"); law.put("没问题", "经查无合规风险");
        law.put("你负责", "相关主体需承担履约责任"); law.put("可能", "大概率存在违约风险");
        EXPERT_VOCAB.put("legal", law);

        // 2. 财务专家
        Map<String, String> finance = new HashMap<>();
        finance.put("很贵", "成本边际收益递减"); finance.put("赚钱", "实现资产增值");
        finance.put("好的", "预算已核准"); finance.put("没钱了", "现金流处于枯竭边缘");
        EXPERT_VOCAB.put("finance", finance);

        // 3. 心理专家
        Map<String, String> psych = new HashMap<>();
        psych.put("你怎么了", "我感受到了你内心的波动"); psych.put("别生气", "尝试接纳当下的负面情绪");
        psych.put("好的", "我在听，请继续释放你的想法"); psych.put("我明白", "你的潜意识正在与我产生共鸣");
        EXPERT_VOCAB.put("psychology", psych);

        // 4. 策划师
        Map<String, String> planner = new HashMap<>();
        planner.put("我想法", "这是我建模出的破局方案"); planner.put("开始做", "立即进入颗粒度拆解阶段");
        planner.put("很难", "此方案的落地维度极高"); planner.put("好的", "逻辑已闭环");
        EXPERT_VOCAB.put("planner", planner);

        // 5. 全能助理 (默认小吉语料)
        Map<String, String> assistant = new HashMap<>();
        assistant.put("我", "小吉"); assistant.put("好的", "已为您妥当安排");
        assistant.put("你在吗", "随时待命，听候差遣"); assistant.put("谢谢", "能为您效劳是我的荣幸");
        EXPERT_VOCAB.put("assistant", assistant);
    }

    // --- 基础人格映射表 ---
    private static final Map<String, Map<String, String>> PERSONA_MAPS = new HashMap<>();
    static {
        Map<String, String> daughter = new HashMap<>();
        daughter.put("我", "人家"); daughter.put("你", "爹地"); daughter.put("吃饭", "干饭饭");
        PERSONA_MAPS.put("good_daughter", daughter);
        // ... 其他人格映射逻辑在 applyPersonaLinguistic 中动态处理
    }

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        tts = new TextToSpeech(getContext(), status -> {
            if (status == TextToSpeech.SUCCESS) {
                isInitialized = true;
                setupUtteranceListener();
                getBridge().executeOnMainThread(() -> {
                    for (PluginCall call : pendingCalls) speak(call);
                    pendingCalls.clear();
                });
            }
        });
    }

    @PluginMethod
    public void speak(PluginCall call) {
        if (!isInitialized) { pendingCalls.add(call); return; }

        String text = call.getString("text", "");
        String persona = call.getString("persona", "default");
        String expert = call.getString("expert", "none");
        String emotion = call.getString("emotion", "normal");

        // 1. 职业语料一级过滤
        String step1 = applyExpertLinguistic(text, expert);
        // 2. 重复提问反思逻辑
        String step2 = applyRepetitionReflex(step1, persona);
        // 3. 基础人格二级过滤
        String processedText = applyPersonaLinguistic(step2, persona);

        lastText = text;
        lastSpeakTime = System.currentTimeMillis();

        adjustParameters(persona, emotion);
        tts.speak(processedText, TextToSpeech.QUEUE_FLUSH, null, "v_" + System.currentTimeMillis());
        call.resolve();
    }

    private String applyExpertLinguistic(String text, String expert) {
        Map<String, String> map = EXPERT_VOCAB.get(expert);
        if (map == null) return text;
        String res = text;
        for (Map.Entry<String, String> entry : map.entrySet()) {
            res = res.replace(entry.getKey(), entry.getValue());
        }
        return res;
    }

    private String applyPersonaLinguistic(String text, String persona) {
        Map<String, String> map = PERSONA_MAPS.get(persona);
        String res = text;
        if (map != null) {
            for (Map.Entry<String, String> entry : map.entrySet()) {
                res = res.replace(entry.getKey(), entry.getValue());
            }
        }
        // 特殊人格修饰
        if ("good_daughter".equals(persona)) res += "哒！";
        else if ("taiwan_girlfriend".equals(persona)) res += "哦~";
        else if ("wise_strategist".equals(persona)) res += "矣。";
        return res;
    }

    private void adjustParameters(String persona, String emotion) {
        float pitch = 1.0f; float rate = 1.0f;
        Locale locale = Locale.CHINESE;
        switch (persona) {
            case "good_daughter": pitch = 1.55f; rate = 0.88f; break;
            case "genius_boy": pitch = 1.18f; rate = 1.50f; break;
            case "wise_strategist": pitch = 0.65f; rate = 0.72f; break;
            case "ceo": pitch = 0.72f; rate = 0.88f; break;
            case "taiwan_girlfriend": pitch = 1.35f; rate = 0.85f; locale = Locale.TRADITIONAL_CHINESE; break;
            case "mobile_assistant": pitch = 1.08f; rate = 1.15f; break;
        }
        if ("happy".equals(emotion)) { pitch += 0.15f; rate += 0.1f; }
        else if ("sad".equals(emotion)) { pitch -= 0.15f; rate -= 0.2f; }

        tts.setPitch(pitch); tts.setSpeechRate(rate); tts.setLanguage(locale);
    }

    private String applyRepetitionReflex(String text, String persona) {
        long currentTime = System.currentTimeMillis();
        if (text.equals(lastText) && (currentTime - lastSpeakTime < 45000)) {
            repeatCount++;
            if (repeatCount == 1) {
                switch (persona) {
                    case "good_daughter": return "爹地怎么又问一遍呀？宝宝再说一次哦：" + text;
                    case "mobile_assistant": return "主人，可能是小吉表述不周，为您复述一次：" + text;
                    case "ceo": return "我不喜欢重复。听好最后一遍：" + text;
                    default: return "为您复述一次：" + text;
                }
            }
        } else { repeatCount = 0; }
        return text;
    }

    private void setupUtteranceListener() {
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { requestAudioFocus(); }
            @Override public void onDone(String id) { abandonAudioFocus(); }
            @Override public void onError(String id) { abandonAudioFocus(); }
        });
    }

    private void requestAudioFocus() { audioManager.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK); }
    private void abandonAudioFocus() { audioManager.abandonAudioFocus(null); }
}
