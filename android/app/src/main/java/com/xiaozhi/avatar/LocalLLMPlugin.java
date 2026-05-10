package com.xiaozhi.avatar;

import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AIEngine")
public class LocalLLMPlugin extends Plugin {

    private static final String TAG = "AIEngine";
    private final ExecutorService executor = Executors.newFixedThreadPool(4);
    private String autoDetectedMode = "IDLE";

    // LAN 候选端口（Ollama 兼容协议）
    private static final int LAN_PROBE_TIMEOUT_MS = 500;
    private static final int LAN_READ_TIMEOUT_MS = 30_000;
    private static final String[] LAN_HOSTS = {
        "192.168.1.100", "192.168.0.100", "192.168.1.1", "10.0.0.1"
    };
    private static final int LAN_PORT = 11434;

    // ─────────────────────────────────────────────
    //  情境感知（保持原有逻辑）
    // ─────────────────────────────────────────────
    @PluginMethod
    public void evaluateSituationalAwareness(PluginCall call) {
        String text = call.getString("text", "").toLowerCase();

        executor.execute(() -> {
            JSObject intelligence = new JSObject();

            if (text.contains("包厢") || text.contains("订位") || text.contains("餐厅") || text.contains("聚餐")) {
                autoDetectedMode = "LIFESTYLE";
                intelligence.put("suggestion", "检测到预订需求，正在为您搜索最优餐厅并准备拨号。");
                intelligence.put("autoPersona", "mobile_assistant");
                intelligence.put("actionHint", "CALENDAR_AND_CALL");
            } else if (text.contains("法律") || text.contains("违约") || text.contains("合同")) {
                autoDetectedMode = "LEGAL";
                intelligence.put("autoPersona", "wise_strategist");
                intelligence.put("suggestion", "涉及法律条款，已调取本地法条库。");
            } else if (text.contains("钱") || text.contains("报销") || text.contains("成本")) {
                autoDetectedMode = "FINANCE";
                intelligence.put("suggestion", "涉及财务核算，开启精算分析。");
            }

            intelligence.put("currentMode", autoDetectedMode);
            notifyListeners("intelligenceUpdate", intelligence);
            call.resolve(intelligence);
        });
    }

    // ─────────────────────────────────────────────
    //  四级算力路由 — 核心推理入口
    // ─────────────────────────────────────────────
    @PluginMethod
    public void processQuery(PluginCall call) {
        String prompt = call.getString("prompt", "");
        String systemPrompt = call.getString("systemPrompt",
            "你是领航者(Navigator-X)的私人助理小智，思维敏锐、行动果断。");
        int maxTokens = call.getInt("maxTokens", 512);

        if (prompt.isEmpty()) {
            call.reject("EMPTY_PROMPT");
            return;
        }

        executor.execute(() -> {
            QueryResult result = routeQuery(prompt, systemPrompt, maxTokens);
            JSObject ret = new JSObject();
            ret.put("result", result.text);
            ret.put("tier", result.tier);
            ret.put("tierName", result.tierName);
            ret.put("routed", !result.text.equals("ROUTE_TO_CLOUD"));
            call.resolve(ret);
        });
    }

    // ─────────────────────────────────────────────
    //  引擎状态查询
    // ─────────────────────────────────────────────
    @PluginMethod
    public void getEngineStatus(PluginCall call) {
        executor.execute(() -> {
            JSObject status = new JSObject();

            // Tier 1：本地 GGUF 模型
            boolean tier1 = false;
            String tier1Info = "NOT_LOADED";
            try {
                tier1 = LocalLLMJNI.isModelLoaded();
                if (tier1) tier1Info = LocalLLMJNI.getModelInfo();
            } catch (UnsatisfiedLinkError e) {
                tier1Info = "SO_MISSING";
            }
            status.put("tier1_local", tier1);
            status.put("tier1_info", tier1Info);

            // Tier 2：局域网 PC 推理服务
            String lanEndpoint = detectLanEndpoint();
            status.put("tier2_lan", lanEndpoint != null);
            status.put("tier2_endpoint", lanEndpoint != null ? lanEndpoint : "");

            // Tier 3/4：网络云端（后端路由）
            status.put("tier3_online", isNetworkAvailable());
            status.put("currentMode", autoDetectedMode);

            call.resolve(status);
        });
    }

    // ─────────────────────────────────────────────
    //  模型下载触发（显示前台服务通知）
    // ─────────────────────────────────────────────
    @PluginMethod
    public void triggerModelDownload(PluginCall call) {
        getBridge().executeOnMainThread(() -> {
            try {
                MainActivity activity = (MainActivity) getActivity();
                // 复用下载专用前台服务（DATA_SYNC 类型）
                Intent downloadIntent = new android.content.Intent(
                    activity, VoiceForegroundService.class);
                downloadIntent.setAction(VoiceForegroundService.ACTION_START_DOWNLOAD);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                    activity.startForegroundService(downloadIntent);
                } else {
                    activity.startService(downloadIntent);
                }
                call.resolve(new JSObject().put("status", "download_initiated"));
            } catch (Exception e) {
                call.reject("TRIGGER_FAILED", e.getMessage());
            }
        });
    }

    // ─────────────────────────────────────────────
    //  内部：四级路由决策
    // ─────────────────────────────────────────────
    private QueryResult routeQuery(String prompt, String systemPrompt, int maxTokens) {

        // Tier 1：本地 GGUF（最快、最隐私）
        try {
            if (LocalLLMJNI.isModelLoaded()) {
                String result = LocalLLMJNI.chat(systemPrompt, prompt, maxTokens,
                    0.7f, 0.9f, 1.1f);
                if (result != null && !result.isEmpty()) {
                    Log.i(TAG, "Routed to Tier 1 (local GGUF)");
                    return new QueryResult(result, 1, "local_llm");
                }
            }
        } catch (UnsatisfiedLinkError | Exception e) {
            Log.w(TAG, "Tier 1 unavailable: " + e.getMessage());
        }

        // Tier 2：局域网 PC 推理服务（Ollama 协议）
        String lanEndpoint = detectLanEndpoint();
        if (lanEndpoint != null) {
            try {
                String result = callLanServer(lanEndpoint, prompt, systemPrompt, maxTokens);
                if (result != null && !result.isEmpty()) {
                    Log.i(TAG, "Routed to Tier 2 (LAN PC) at " + lanEndpoint);
                    return new QueryResult(result, 2, "lan_pc");
                }
            } catch (Exception e) {
                Log.w(TAG, "Tier 2 unavailable: " + e.getMessage());
            }
        }

        // Tier 3/4：云端（后端 HybridAssistant 路由，WebView 侧处理）
        Log.i(TAG, "Routing to Tier 3/4 (cloud via backend)");
        return new QueryResult("ROUTE_TO_CLOUD", 3, "cloud_api");
    }

    // ─────────────────────────────────────────────
    //  内部：局域网端点探测
    // ─────────────────────────────────────────────
    private String detectLanEndpoint() {
        if (!isNetworkAvailable()) return null;

        for (String host : LAN_HOSTS) {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, LAN_PORT), LAN_PROBE_TIMEOUT_MS);
                Log.i(TAG, "LAN endpoint found: " + host + ":" + LAN_PORT);
                return "http://" + host + ":" + LAN_PORT;
            } catch (Exception e) {
                // not available, try next
            }
        }
        return null;
    }

    // ─────────────────────────────────────────────
    //  内部：LAN 服务器调用（Ollama /api/chat）
    // ─────────────────────────────────────────────
    private String callLanServer(String endpoint, String prompt, String systemPrompt,
                                  int maxTokens) throws Exception {
        URL url = new URL(endpoint + "/api/chat");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        conn.setDoOutput(true);
        conn.setConnectTimeout(2_000);
        conn.setReadTimeout(LAN_READ_TIMEOUT_MS);

        String escapedSystem = escapeJson(systemPrompt);
        String escapedPrompt = escapeJson(prompt);
        String body = "{\"model\":\"qwen2:7b\","
            + "\"messages\":["
            + "{\"role\":\"system\",\"content\":\"" + escapedSystem + "\"},"
            + "{\"role\":\"user\",\"content\":\"" + escapedPrompt + "\"}"
            + "],"
            + "\"stream\":false,"
            + "\"options\":{\"num_predict\":" + maxTokens + "}}";

        try (OutputStream os = conn.getOutputStream()) {
            os.write(body.getBytes(StandardCharsets.UTF_8));
        }

        if (conn.getResponseCode() != 200) return null;

        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
        }

        // 从 Ollama JSON 响应中提取 message.content
        JSONObject json = new JSONObject(sb.toString());
        return json.getJSONObject("message").getString("content");
    }

    // ─────────────────────────────────────────────
    //  内部工具
    // ─────────────────────────────────────────────
    private boolean isNetworkAvailable() {
        ConnectivityManager cm = (ConnectivityManager)
            getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        android.net.Network network = cm.getActiveNetwork();
        if (network == null) return false;
        NetworkCapabilities caps = cm.getNetworkCapabilities(network);
        return caps != null && (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)
            || caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
            || caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
    }

    private static class QueryResult {
        final String text;
        final int tier;
        final String tierName;

        QueryResult(String text, int tier, String tierName) {
            this.text = text;
            this.tier = tier;
            this.tierName = tierName;
        }
    }
}
