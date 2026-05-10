package com.xiaozhi.avatar;

import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "Document")
public class DocumentPlugin extends Plugin {
    private static final String TAG = "DocumentPlugin";

    // 使用Map存储多个会话，支持并发扫描
    private Map<String, ScanSession> sessions = new ConcurrentHashMap<>();

    /**
     * 扫描会话数据结构
     */
    private static class ScanSession {
        String sessionId;
        List<String> pageUris = new ArrayList<>();
        long createdAt;
        String projectId;

        ScanSession(String sessionId, String projectId) {
            this.sessionId = sessionId;
            this.projectId = projectId;
            this.createdAt = System.currentTimeMillis();
        }
    }

    /**
     * 开启多页扫描会话
     */
    @PluginMethod
    public void startScanSession(PluginCall call) {
        String projectId = call.getString("projectId", "DEFAULT");
        String sessionId = "DOC_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000);

        ScanSession session = new ScanSession(sessionId, projectId);
        sessions.put(sessionId, session);

        JSObject ret = new JSObject();
        ret.put("sessionId", sessionId);
        ret.put("projectId", projectId);
        ret.put("status", "READY");
        ret.put("pageCount", 0);
        call.resolve(ret);

        Log.i(TAG, "Started scan session: " + sessionId + " for project: " + projectId);
    }

    /**
     * 添加扫描页（可多次调用）
     */
    @PluginMethod
    public void addPage(PluginCall call) {
        String sessionId = call.getString("sessionId");
        String uri = call.getString("uri");

        if (sessionId == null) {
            call.reject("SESSION_ID_REQUIRED");
            return;
        }

        ScanSession session = sessions.get(sessionId);
        if (session == null) {
            call.reject("SESSION_NOT_FOUND");
            return;
        }

        if (uri != null) {
            session.pageUris.add(uri);
            JSObject ret = new JSObject();
            ret.put("sessionId", sessionId);
            ret.put("pageCount", session.pageUris.size());
            call.resolve(ret);
        } else {
            call.reject("INVALID_URI");
        }
    }

    /**
     * 完成扫描并触发全案分析
     */
    @PluginMethod
    public void finishAndAnalyze(PluginCall call) {
        String sessionId = call.getString("sessionId");

        if (sessionId == null) {
            call.reject("SESSION_ID_REQUIRED");
            return;
        }

        ScanSession session = sessions.get(sessionId);
        if (session == null) {
            call.reject("SESSION_NOT_FOUND");
            return;
        }

        if (session.pageUris.isEmpty()) {
            call.reject("NO_PAGES_SCANNED");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("sessionId", session.sessionId);
        ret.put("projectId", session.projectId);
        ret.put("totalPages", session.pageUris.size());
        ret.put("action", "TRIGGER_BATCH_ANALYSIS");

        // 核心修复：JSArray 必须使用 put() 而非 add()
        JSArray pages = new JSArray();
        for (String uri : session.pageUris) {
            pages.put(uri);
        }
        ret.put("pages", pages);

        call.resolve(ret);

        // 清理当前会话状态
        sessions.remove(sessionId);
        Log.i(TAG, "Finished scan session: " + sessionId + " with " + session.pageUris.size() + " pages");
    }

    @PluginMethod
    public void getSessionStatus(PluginCall call) {
        String sessionId = call.getString("sessionId");

        JSObject ret = new JSObject();

        if (sessionId != null) {
            ScanSession session = sessions.get(sessionId);
            if (session != null) {
                ret.put("inSession", true);
                ret.put("sessionId", sessionId);
                ret.put("projectId", session.projectId);
                ret.put("pageCount", session.pageUris.size());
                ret.put("createdAt", session.createdAt);
            } else {
                ret.put("inSession", false);
                ret.put("sessionId", sessionId);
                ret.put("pageCount", 0);
            }
        } else {
            // 返回所有活跃会话
            ret.put("inSession", false);
            ret.put("activeSessions", sessions.size());
            ret.put("sessionIds", new ArrayList<>(sessions.keySet()));
        }

        call.resolve(ret);
    }

    /**
     * 取消会话
     */
    @PluginMethod
    public void cancelSession(PluginCall call) {
        String sessionId = call.getString("sessionId");

        if (sessionId == null) {
            call.reject("SESSION_ID_REQUIRED");
            return;
        }

        ScanSession removed = sessions.remove(sessionId);
        if (removed != null) {
            JSObject ret = new JSObject();
            ret.put("sessionId", sessionId);
            ret.put("cancelled", true);
            call.resolve(ret);
            Log.i(TAG, "Cancelled scan session: " + sessionId);
        } else {
            call.reject("SESSION_NOT_FOUND");
        }
    }
}
