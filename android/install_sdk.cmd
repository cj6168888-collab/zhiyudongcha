@echo off
set ANDROID_SDK_HOME=%~dp0\.android
set ANDROID_SDK_ROOT=%~dp0\sdk
set ANDROID_HOME=%ANDROID_SDK_ROOT%
set USERPROFILE=%~dp0\android-userhome
cd /d %~dp0
sdk\cmdline-tools\bin\sdkmanager.bat --sdk_root=%ANDROID_SDK_ROOT% platform-tools platforms;android-35 build-tools;34.0.0
