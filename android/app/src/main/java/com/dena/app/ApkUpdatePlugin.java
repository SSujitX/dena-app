package com.dena.app;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;

@CapacitorPlugin(name = "ApkUpdate")
public class ApkUpdatePlugin extends Plugin {

    private static final int BUFFER_SIZE = 16384;
    private static final int CONNECT_TIMEOUT_MS = 30000;
    private static final int READ_TIMEOUT_MS = 300000;

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        String fileName = call.getString("fileName", "Dena-update.apk");
        JSObject headers = call.getObject("headers", new JSObject());

        if (url == null || url.trim().isEmpty()) {
            call.reject("Missing download url");
            return;
        }

        final String safeName = fileName.replaceAll("[^a-zA-Z0-9._-]", "_");

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL downloadUrl = new URL(url.trim());
                connection = (HttpURLConnection) downloadUrl.openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
                connection.setReadTimeout(READ_TIMEOUT_MS);
                connection.setRequestMethod("GET");
                connection.setRequestProperty("User-Agent", "Dena-Android-App");

                Iterator<String> keys = headers.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    String value = headers.optString(key, "");
                    if (!value.isEmpty()) {
                        connection.setRequestProperty(key, value);
                    }
                }

                int responseCode = connection.getResponseCode();
                if (responseCode < 200 || responseCode >= 300) {
                    throw new Exception("Download failed with HTTP " + responseCode);
                }

                long contentLength = connection.getContentLengthLong();
                File updatesDir = new File(getContext().getCacheDir(), "updates");
                if (!updatesDir.exists() && !updatesDir.mkdirs()) {
                    throw new Exception("Could not create updates folder");
                }

                File outputFile = new File(updatesDir, safeName);
                try (InputStream inputStream = connection.getInputStream();
                     FileOutputStream outputStream = new FileOutputStream(outputFile, false)) {
                    byte[] buffer = new byte[BUFFER_SIZE];
                    long loaded = 0;
                    int read;
                    while ((read = inputStream.read(buffer)) != -1) {
                        outputStream.write(buffer, 0, read);
                        loaded += read;
                        emitProgress(loaded, contentLength);
                    }
                    outputStream.flush();
                }

                if (outputFile.length() < 100000L) {
                    outputFile.delete();
                    throw new Exception("Downloaded file is too small");
                }

                Uri contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    outputFile
                );

                JSObject result = new JSObject();
                result.put("uri", contentUri.toString());
                result.put("size", outputFile.length());
                result.put("path", outputFile.getAbsolutePath());
                resolveOnMainThread(call, result);
            } catch (Exception error) {
                rejectOnMainThread(call, error.getMessage() != null ? error.getMessage() : "Download failed");
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null || uriString.trim().isEmpty()) {
            call.reject("Missing APK uri");
            return;
        }

        try {
            Uri apkUri = Uri.parse(uriString.trim());
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Install intent failed: " + error.getMessage());
        }
    }

    private void emitProgress(long loaded, long total) {
        JSObject progress = new JSObject();
        progress.put("loaded", loaded);
        progress.put("total", total);
        notifyListeners("downloadProgress", progress);
    }

    private void resolveOnMainThread(PluginCall call, JSObject result) {
        getActivity().runOnUiThread(() -> call.resolve(result));
    }

    private void rejectOnMainThread(PluginCall call, String message) {
        getActivity().runOnUiThread(() -> call.reject(message));
    }
}
