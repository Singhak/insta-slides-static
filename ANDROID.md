# Android app

The Android app is a Capacitor wrapper around the same local-first editor used by the website.

## Requirements

- Node.js 22 or newer
- JDK 21
- Android Studio and Android SDK Platform 36

## Build and open

```powershell
npm ci
npm run cap:sync
npx cap open android
```

In Android Studio, run the `app` configuration on a connected device or emulator. To build a debug APK from PowerShell:

```powershell
.\android\gradlew.bat -p android assembleDebug
```

The APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`. Web assets in `www` are generated during the build and should not be edited directly.

The app uses Android's share sheet to save or share exported ZIPs and project files. Use a release signing key and verify the release build before publishing to Google Play.
