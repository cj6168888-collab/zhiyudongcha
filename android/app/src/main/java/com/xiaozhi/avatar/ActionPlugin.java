package com.xiaozhi.avatar;

import android.content.Intent;
import android.net.Uri;
import android.provider.CalendarContract;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "Action")
public class ActionPlugin extends Plugin {

    @PluginMethod
    public void makeCall(PluginCall call) {
        String number = call.getString("number");
        Intent intent = new Intent(Intent.ACTION_DIAL);
        intent.setData(Uri.parse("tel:" + number));
        getActivity().startActivity(intent);
        call.resolve();
    }

    /**
     * 执行外交：发送带附件的邮件
     */
    @PluginMethod
    public void sendEmailWithAttachment(PluginCall call) {
        String to = call.getString("to", "");
        String subject = call.getString("subject", "来自小智的案卷归档");
        String filePath = call.getString("filePath");

        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("application/zip");
        intent.putExtra(Intent.EXTRA_EMAIL, new String[]{to});
        intent.putExtra(Intent.EXTRA_SUBJECT, subject);

        if (filePath != null) {
            File file = new File(filePath);
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }

        getActivity().startActivity(Intent.createChooser(intent, "发送邮件中..."));
        call.resolve();
    }

    @PluginMethod
    public void addToCalendar(PluginCall call) {
        String title = call.getString("title");
        String location = call.getString("location");
        long startTime = call.getLong("startTime", System.currentTimeMillis());

        Intent intent = new Intent(Intent.ACTION_INSERT)
                .setData(CalendarContract.Events.CONTENT_URI)
                .putExtra(CalendarContract.Events.TITLE, title)
                .putExtra(CalendarContract.Events.EVENT_LOCATION, location)
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, startTime)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, startTime + 7200000);

        getActivity().startActivity(intent);
        call.resolve();
    }
}
