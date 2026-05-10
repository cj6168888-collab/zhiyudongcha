package com.xiaozhi.avatar;

import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

@CapacitorPlugin(name = "FileProcessor")
public class FileProcessorPlugin extends Plugin {
    private static final String TAG = "FileProcessor";
    private static final int BUFFER_SIZE = 16384;
    private static final long MAX_UNZIP_BYTES = 500L * 1024 * 1024; // 500 MB 解压安全上限

    // ─────────────────────────────────────────────
    //  导出接口
    // ─────────────────────────────────────────────

    @PluginMethod
    public void createSimpleDocx(PluginCall call) {
        String content  = call.getString("content", "");
        String fileName = call.getString("fileName", "Exported_Doc.docx");

        File docxFile = new File(getContext().getExternalFilesDir("exports"), fileName);
        docxFile.getParentFile().mkdirs();

        try (FileOutputStream fos = new FileOutputStream(docxFile)) {
            fos.write(content.getBytes(StandardCharsets.UTF_8));
            JSObject res = new JSObject();
            res.put("path", docxFile.getAbsolutePath());
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "createSimpleDocx failed", e);
            call.reject("DOCX_CREATE_FAILED", e.getMessage());
        }
    }

    @PluginMethod
    public void zipProject(PluginCall call) {
        String projectDirName = call.getString("projectDir");
        String zipFileName    = call.getString("zipName", "Project_Bundle.zip");

        if (projectDirName == null || projectDirName.isEmpty()) {
            call.reject("PROJECT_DIR_REQUIRED");
            return;
        }

        File projectDir = new File(getContext().getExternalFilesDir("projects"), projectDirName);
        File zipFile    = new File(getContext().getExternalFilesDir("exports"), zipFileName);
        zipFile.getParentFile().mkdirs();

        if (!projectDir.exists()) { call.reject("PROJECT_NOT_FOUND"); return; }

        try (ZipOutputStream zos = new ZipOutputStream(
                new BufferedOutputStream(new FileOutputStream(zipFile)))) {
            zipFolder(projectDir, projectDir.getName(), zos);
            JSObject res = new JSObject();
            res.put("zipPath", zipFile.getAbsolutePath());
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "zipProject failed", e);
            call.reject("ZIP_FAILED", e.getMessage());
        }
    }

    // ─────────────────────────────────────────────
    //  读取接口
    // ─────────────────────────────────────────────

    /** 列出 ZIP 包内容（不解压）*/
    @PluginMethod
    public void inspectZip(PluginCall call) {
        String zipPath = call.getString("zipPath");
        if (zipPath == null || zipPath.isEmpty()) {
            call.reject("ZIP_PATH_REQUIRED");
            return;
        }

        File zipFile = new File(zipPath);
        if (!zipFile.exists()) { call.reject("ZIP_NOT_FOUND"); return; }

        JSArray entries = new JSArray();
        long totalSize  = 0;

        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                JSObject item = new JSObject();
                item.put("name",         entry.getName());
                item.put("isDirectory",  entry.isDirectory());
                item.put("size",         entry.getSize());
                item.put("compressedSize", entry.getCompressedSize());
                if (!entry.isDirectory() && entry.getSize() > 0) totalSize += entry.getSize();
                entries.put(item);
                zis.closeEntry();
            }
        } catch (Exception e) {
            Log.e(TAG, "inspectZip failed", e);
            call.reject("INSPECT_FAILED", e.getMessage());
            return;
        }

        JSObject result = new JSObject();
        result.put("entries",    entries);
        result.put("entryCount", entries.length());
        result.put("totalUncompressedBytes", totalSize);
        call.resolve(result);
    }

    /** 将 ZIP 包解压到目标目录 */
    @PluginMethod
    public void unzip(PluginCall call) {
        String zipPath = call.getString("zipPath");
        String destDir = call.getString("destDir");

        if (zipPath == null || destDir == null) {
            call.reject("PARAMS_REQUIRED", "zipPath and destDir are required");
            return;
        }

        File zipFile = new File(zipPath);
        if (!zipFile.exists()) { call.reject("ZIP_NOT_FOUND"); return; }

        File dest = new File(destDir);
        dest.mkdirs();

        long extractedBytes = 0;
        int  fileCount      = 0;

        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zipFile))) {
            ZipEntry entry;
            byte[] buffer = new byte[BUFFER_SIZE];

            while ((entry = zis.getNextEntry()) != null) {
                // 安全校验：防止 Zip Slip 路径遍历
                File outFile = new File(dest, entry.getName());
                String canonicalDest = dest.getCanonicalPath() + File.separator;
                if (!outFile.getCanonicalPath().startsWith(canonicalDest)) {
                    call.reject("ZIP_SLIP_DETECTED", "Illegal path: " + entry.getName());
                    return;
                }

                if (entry.isDirectory()) {
                    outFile.mkdirs();
                } else {
                    outFile.getParentFile().mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        int count;
                        while ((count = zis.read(buffer)) != -1) {
                            extractedBytes += count;
                            if (extractedBytes > MAX_UNZIP_BYTES) {
                                call.reject("ZIP_BOMB_DETECTED",
                                    "Extraction exceeded " + MAX_UNZIP_BYTES + " bytes");
                                return;
                            }
                            fos.write(buffer, 0, count);
                        }
                    }
                    fileCount++;
                }
                zis.closeEntry();
            }
        } catch (Exception e) {
            Log.e(TAG, "unzip failed", e);
            call.reject("UNZIP_FAILED", e.getMessage());
            return;
        }

        JSObject result = new JSObject();
        result.put("destDir",        dest.getAbsolutePath());
        result.put("filesExtracted", fileCount);
        result.put("totalBytes",     extractedBytes);
        call.resolve(result);
    }

    /**
     * 提取办公文档 / PDF 中的纯文本内容。
     * - .txt / .md / .csv：直接读取
     * - .docx：解析 word/document.xml（去除 XML 标签）
     * - .pdf：逐页读取可见字节流（仅纯文本 PDF；加密 PDF 需独立库）
     * - 其他格式：返回 UNSUPPORTED_FORMAT
     */
    @PluginMethod
    public void extractOfficeText(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.isEmpty()) {
            call.reject("FILE_PATH_REQUIRED");
            return;
        }

        File file = new File(filePath);
        if (!file.exists()) { call.reject("FILE_NOT_FOUND"); return; }

        String lower = filePath.toLowerCase();
        String text;

        try {
            if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".csv")) {
                text = readPlainText(file);
            } else if (lower.endsWith(".docx")) {
                text = extractDocxText(file);
            } else if (lower.endsWith(".pdf")) {
                text = extractPdfTextBasic(file);
            } else {
                call.reject("UNSUPPORTED_FORMAT",
                    "Supported: .txt .md .csv .docx .pdf");
                return;
            }

            JSObject result = new JSObject();
            result.put("text",      text);
            result.put("charCount", text.length());
            result.put("filePath",  filePath);
            call.resolve(result);

        } catch (Exception e) {
            Log.e(TAG, "extractOfficeText failed for: " + filePath, e);
            call.reject("EXTRACT_FAILED", e.getMessage());
        }
    }

    // ─────────────────────────────────────────────
    //  内部工具
    // ─────────────────────────────────────────────

    private void zipFolder(File folder, String parentName, ZipOutputStream zos) throws Exception {
        File[] files = folder.listFiles();
        if (files == null) return;
        for (File file : files) {
            if (file.isDirectory()) {
                zipFolder(file, parentName + "/" + file.getName(), zos);
                continue;
            }
            zos.putNextEntry(new ZipEntry(parentName + "/" + file.getName()));
            try (FileInputStream fis = new FileInputStream(file)) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int count;
                while ((count = fis.read(buffer)) != -1) zos.write(buffer, 0, count);
            }
            zos.closeEntry();
        }
    }

    private String readPlainText(File file) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
        }
        return sb.toString().trim();
    }

    /** 从 .docx (ZIP) 解析 word/document.xml，去除所有 XML 标签 */
    private String extractDocxText(File docxFile) throws Exception {
        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(docxFile))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                if ("word/document.xml".equals(entry.getName())) {
                    StringBuilder sb = new StringBuilder();
                    byte[] buffer = new byte[BUFFER_SIZE];
                    int count;
                    while ((count = zis.read(buffer)) != -1) {
                        sb.append(new String(buffer, 0, count, StandardCharsets.UTF_8));
                    }
                    // 去除 XML 标签，保留文本节点
                    String raw = sb.toString();
                    String noTags = raw.replaceAll("<[^>]+>", "");
                    // 合并多余空白
                    return noTags.replaceAll("[ \\t]+", " ")
                                 .replaceAll("\\n{3,}", "\n\n")
                                 .trim();
                }
                zis.closeEntry();
            }
        }
        return "";
    }

    /**
     * 简单 PDF 文本提取（仅适用于非加密纯文本 PDF）。
     * 扫描字节流中 BT...ET 内容块里的括号字符串 (text) 或 <hex> 字节。
     * 复杂 PDF（压缩流、嵌入字体）需 iText/PdfBox，此处提供基础能力。
     */
    private String extractPdfTextBasic(File pdfFile) throws Exception {
        byte[] bytes = readFileBytes(pdfFile);
        String raw = new String(bytes, StandardCharsets.ISO_8859_1);

        StringBuilder out = new StringBuilder();
        int pos = 0;
        while (pos < raw.length()) {
            int btStart = raw.indexOf("BT", pos);
            if (btStart < 0) break;
            int etEnd = raw.indexOf("ET", btStart);
            if (etEnd < 0) break;
            String block = raw.substring(btStart, etEnd);

            // 提取 (parenthesis strings)
            int i = 0;
            while (i < block.length()) {
                int open = block.indexOf('(', i);
                if (open < 0) break;
                int close = findClosingParen(block, open + 1);
                if (close < 0) break;
                String token = block.substring(open + 1, close);
                out.append(token).append(' ');
                i = close + 1;
            }

            pos = etEnd + 2;
        }
        return out.toString().replaceAll("\\s{2,}", " ").trim();
    }

    private int findClosingParen(String s, int start) {
        int depth = 1;
        for (int i = start; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\') { i++; continue; } // skip escaped char
            if (c == '(') depth++;
            else if (c == ')') { if (--depth == 0) return i; }
        }
        return -1;
    }

    private byte[] readFileBytes(File file) throws Exception {
        byte[] buffer = new byte[(int) file.length()];
        try (FileInputStream fis = new FileInputStream(file)) {
            int totalRead = 0;
            while (totalRead < buffer.length) {
                int read = fis.read(buffer, totalRead, buffer.length - totalRead);
                if (read < 0) break;
                totalRead += read;
            }
        }
        return buffer;
    }
}
