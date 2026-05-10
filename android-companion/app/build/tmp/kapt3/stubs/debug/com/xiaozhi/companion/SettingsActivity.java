package com.xiaozhi.companion;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000f\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\n\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\b\n\u0000\n\u0002\u0010\u000e\n\u0002\b\u0005\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u000b\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0004\u0018\u00002\u00020\u0001B\u0005\u00a2\u0006\u0002\u0010\u0002J\u0010\u0010\u001d\u001a\u00020\u001e2\u0006\u0010\u001f\u001a\u00020 H\u0002J\u0010\u0010!\u001a\u00020\"2\u0006\u0010#\u001a\u00020 H\u0002J\b\u0010$\u001a\u00020\u001eH\u0002J\b\u0010%\u001a\u00020\u001eH\u0002J\u0012\u0010&\u001a\u00020\u001e2\b\u0010\'\u001a\u0004\u0018\u00010(H\u0014J\u0010\u0010)\u001a\u00020*2\u0006\u0010+\u001a\u00020,H\u0016J\b\u0010-\u001a\u00020\u001eH\u0002J\b\u0010.\u001a\u00020\u001eH\u0002J\b\u0010/\u001a\u00020\u001eH\u0002R\u000e\u0010\u0003\u001a\u00020\u0004X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0006X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\u0004X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\b\u001a\u00020\tX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u000bX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\f\u001a\u00020\u0004X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\r\u001a\u00020\u000eX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u000f\u001a\u00020\u0010X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0011\u001a\u00020\u0010X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0012\u001a\u00020\tX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0013\u001a\u00020\u000bX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0014\u001a\u00020\u0004X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0015\u001a\u00020\tX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0016\u001a\u00020\u000bX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0017\u001a\u00020\u0004X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0018\u001a\u00020\u0006X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0019\u001a\u00020\u0006X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u001a\u001a\u00020\u001bX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u001c\u001a\u00020\u001bX\u0082.\u00a2\u0006\u0002\n\u0000\u00a8\u00060"}, d2 = {"Lcom/xiaozhi/companion/SettingsActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "()V", "autoStartSwitch", "Landroid/widget/Switch;", "darkModeRadioGroup", "Landroid/widget/RadioGroup;", "keepScreenSwitch", "logLevelSeekBar", "Landroid/widget/SeekBar;", "logLevelValueText", "Landroid/widget/TextView;", "notificationSwitch", "prefs", "Lcom/xiaozhi/companion/utils/PreferencesManager;", "resetButton", "Lcom/google/android/material/button/MaterialButton;", "saveButton", "sensitivitySeekBar", "sensitivityValueText", "soundFeedbackSwitch", "vadSeekBar", "vadValueText", "vibrationSwitch", "visualizerColorGroup", "visualizerModeGroup", "webServerInput", "Lcom/google/android/material/textfield/TextInputEditText;", "wsServerInput", "applyDarkMode", "", "mode", "", "getLogLevelName", "", "level", "initViews", "loadSettings", "onCreate", "savedInstanceState", "Landroid/os/Bundle;", "onOptionsItemSelected", "", "item", "Landroid/view/MenuItem;", "saveSettings", "setupListeners", "setupToolbar", "app_debug"})
public final class SettingsActivity extends androidx.appcompat.app.AppCompatActivity {
    private com.xiaozhi.companion.utils.PreferencesManager prefs;
    private android.widget.SeekBar vadSeekBar;
    private android.widget.TextView vadValueText;
    private android.widget.SeekBar sensitivitySeekBar;
    private android.widget.TextView sensitivityValueText;
    private android.widget.Switch notificationSwitch;
    private android.widget.Switch soundFeedbackSwitch;
    private android.widget.Switch vibrationSwitch;
    private android.widget.Switch autoStartSwitch;
    private android.widget.Switch keepScreenSwitch;
    private android.widget.RadioGroup darkModeRadioGroup;
    private com.google.android.material.textfield.TextInputEditText webServerInput;
    private com.google.android.material.textfield.TextInputEditText wsServerInput;
    private android.widget.SeekBar logLevelSeekBar;
    private android.widget.TextView logLevelValueText;
    private android.widget.RadioGroup visualizerModeGroup;
    private android.widget.RadioGroup visualizerColorGroup;
    private com.google.android.material.button.MaterialButton saveButton;
    private com.google.android.material.button.MaterialButton resetButton;
    
    public SettingsActivity() {
        super();
    }
    
    @java.lang.Override()
    protected void onCreate(@org.jetbrains.annotations.Nullable()
    android.os.Bundle savedInstanceState) {
    }
    
    private final void setupToolbar() {
    }
    
    private final void initViews() {
    }
    
    private final void loadSettings() {
    }
    
    private final void setupListeners() {
    }
    
    private final void saveSettings() {
    }
    
    private final void applyDarkMode(int mode) {
    }
    
    private final java.lang.String getLogLevelName(int level) {
        return null;
    }
    
    @java.lang.Override()
    public boolean onOptionsItemSelected(@org.jetbrains.annotations.NotNull()
    android.view.MenuItem item) {
        return false;
    }
}