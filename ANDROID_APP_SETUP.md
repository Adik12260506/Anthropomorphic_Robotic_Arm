# Android App Setup & Capacitor Build Guide

> **Project:** AI-Enabled Vision-Based Anthropomorphic Robotic Arm  
> **Course:** Engineering Clinics — Review 2  
> **Technology:** React 19, Vite 8, TypeScript, Tailwind CSS, MediaPipe Tasks Vision, WebRTC, Capacitor 8  

---

## 1. What is Capacitor?

**Capacitor** is an open-source cross-platform native runtime created by the Ionic team. It allows modern web applications (HTML, CSS, JavaScript, React, Vue, Angular) to run natively on Android, iOS, and the Web from a single shared codebase.

Unlike legacy Cordova or heavy native rewrites, Capacitor acts as a modern bridge between a web application running inside an optimized native **Android WebView** and native Android platform APIs (such as the camera hardware, permissions, and network sockets).

---

## 2. Why Do We Use Capacitor?

1. **100% Code Reuse:** We do not rewrite the frontend in Java, Kotlin, Flutter, or React Native. The exact same React + Vite + TypeScript application runs in both the browser and inside the native Android APK.
2. **Direct Hardware Acceleration:** MediaPipe's WebAssembly (WASM) and WebGL hand landmark detection execute directly on the phone's GPU inside the Android WebView with minimal overhead.
3. **Native Permissions:** Android WebView requires system-level permissions declared in `AndroidManifest.xml` (e.g. `android.permission.CAMERA`, `android.permission.RECORD_AUDIO`, `android.permission.INTERNET`). Capacitor manages the native activity shell and permission requests.
4. **Offline Capability & Asset Packaging:** The Vite production build (`dist/`) is packaged directly inside the APK (`android/app/src/main/assets/public/`). The app loads instantly without needing to download website bundles from the internet.
5. **Two-Phone Architecture Support:** The native Android APK can run on **Phone A** (controller with front/rear camera and MediaPipe) and **Phone B** (remote observer) seamlessly.

---

## 3. How the Existing React Website Becomes an APK

The conversion pipeline operates in three distinct stages:

```
[React + Vite + TypeScript Source Code] (src/)
                     │
                     ▼ (npm run build -> tsc -b && vite build)
       [Vite Production Bundle] (dist/)
         ├── index.html
         ├── assets/index-[hash].js
         └── assets/index-[hash].css
                     │
                     ▼ (npx cap sync android)
[Copied into Android Studio Native Project]
  (android/app/src/main/assets/public/)
                     │
                     ▼ (Android Studio Gradle Build)
       [Native Android APK File (.apk)]
```

Capacitor creates a native Android Studio project (`android/`) containing:
- `MainActivity.java` extending `BridgeActivity`.
- `AndroidManifest.xml` configuring camera, audio, network permissions, and cleartext traffic.
- Gradle build scripts (`build.gradle`, `settings.gradle`) that compile the native APK and bundle the web assets into `assets/public/`.

---

## 4. Prerequisites

To build and run the Android APK on your machine, you need:

1. **Node.js**: v18+ or v20+ (Node v24 is installed on this system).
2. **Java Development Kit (JDK)**: JDK 17, JDK 21, or JDK 23 (JDK 23 is installed on this system).
3. **Android Studio**: Installed with Android SDK Platform 34 or 35 and Android SDK Build-Tools.
4. **Android Phone** (or Android Studio Emulator): Running Android 8.0 (API 26) or higher.

---

## 5. Step-by-Step Build Instructions

### Step 1: Install Dependencies
Open a command prompt in the `frontend` folder:
```bash
cd frontend
npm install
```

### Step 2: Build the React Application
Compile TypeScript and generate the production web bundle:
```bash
npm run build
```
This verifies that all TypeScript types pass and bundles the optimized HTML/JS/CSS assets into `frontend/dist/`.

### Step 3: Synchronize Capacitor
Copy the web build into the Android native project and update plugins:
```bash
npx cap sync android
```
*(Or use the combined shortcut command: `npm run build:android`)*

### Step 4: Open Android Studio
Launch Android Studio with the native Android project:
```bash
npx cap open android
```
*(Or use `npm run android:open`)*

Android Studio will open the `frontend/android/` project and automatically execute Gradle sync.

---

## 6. How to Run on a Physical Android Phone

1. **Enable Developer Options on your Android phone:**
   - Go to **Settings** > **About Phone**.
   - Tap **Build Number** 7 times until you see "You are now a developer!".
2. **Enable USB Debugging:**
   - Go to **Settings** > **System** > **Developer Options**.
   - Turn ON **USB Debugging**.
3. **Connect Phone via USB:**
   - Connect the phone to your laptop using a USB cable.
   - On the phone, accept the "Allow USB debugging?" prompt (check "Always allow from this computer").
4. **Select Device & Run in Android Studio:**
   - In Android Studio's top toolbar, select your physical Android device from the device dropdown.
   - Click the green **Run (Play)** button (`Shift + F10`).
   - The app will build, install, and launch automatically on your phone.

---

## 7. How to Generate a Standalone Debug APK

If you want to share the `.apk` file directly (via WhatsApp, Google Drive, or email) so your teammates or professor can install it without Android Studio:

### Option A: From Android Studio
1. Open the project in Android Studio (`npx cap open android`).
2. In the top menu, go to:
   **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. When the build completes, click the **locate** link in the popup balloon.
4. The generated APK will be located at:
   ```
   frontend/android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Option B: From Command Line (with Gradle)
If Android SDK / command-line tools are configured:
```bash
cd frontend/android
gradlew.bat assembleDebug
```
The output APK is at:
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 8. Where API and WebSocket URLs are Configured

### Method 1: In-App Runtime Configuration (Recommended for Phone Testing)
Because an Android device on Wi-Fi cannot connect to `http://localhost:8000` (which refers to the phone itself), we built a runtime **Backend Server Configuration Modal**:
1. Tap the **API Active / API Offline** pill button in the top navigation header of the app.
2. Enter your computer's local Wi-Fi IP address (e.g. `http://192.168.1.50:8000`).
3. Tap **Test Connection** to verify reachability.
4. Tap **Save & Connect**.
5. The URL is persisted in `localStorage` on the phone and used for all REST requests, `/ws/robot` telemetry, and WebRTC signaling!

### Method 2: Build-Time Environment Variables (`.env`)
You can also specify the URL in `frontend/.env`:
```env
# For local Wi-Fi testing:
VITE_API_URL=http://192.168.1.50:8000
VITE_WS_URL=ws://192.168.1.50:8000/ws/robot
VITE_SIGNALING_URL=ws://192.168.1.50:8000/ws/signaling

# For public cloud deployment:
# VITE_API_URL=https://YOUR_PUBLIC_FASTAPI_BACKEND_URL
# VITE_WS_URL=wss://YOUR_PUBLIC_FASTAPI_BACKEND_URL/ws/robot
# VITE_SIGNALING_URL=wss://YOUR_PUBLIC_FASTAPI_BACKEND_URL/ws/signaling
```
After editing `.env`, run `npm run build:android` to repackage the assets into the APK.

---

## 9. Required Android Permissions

The following permissions are configured in `frontend/android/app/src/main/AndroidManifest.xml`:

| Permission | Purpose |
|---|---|
| `android.permission.INTERNET` | Communicating with FastAPI backend, WebRTC signaling, MediaPipe CDN models |
| `android.permission.ACCESS_NETWORK_STATE` | Monitoring Wi-Fi connectivity and network drops |
| `android.permission.CAMERA` | Capturing live video feed for MediaPipe hand tracking and WebRTC calling |
| `android.permission.RECORD_AUDIO` | Real-time audio during two-phone WebRTC video calls |
| `android.permission.MODIFY_AUDIO_SETTINGS` | Audio routing and speakerphone control during WebRTC calls |

### Additional Security Configuration
- `android:usesCleartextTraffic="true"`: Allows the Android app to connect to `http://192.168.x.x:8000` over the local Wi-Fi network without requiring an SSL certificate during clinic lab evaluation.
- `android:hardwareAccelerated="true"`: Enables GPU acceleration for canvas rendering and MediaPipe WebGL operations.

---

## 10. Current Limitations & Software States

1. **Single-Hand Tracking:** The vision pipeline detects 1 hand at a time (`numHands: 1`) to ensure stable 30+ FPS on mobile processors.
2. **Camera Lighting:** Hand landmark detection performs best in well-lit environments where all 5 fingers are clearly visible against the background.
3. **WebRTC NAT Traversal:** WebRTC uses Google public STUN servers (`stun:stun.l.google.com:19302`). For connections across different cellular networks or restrictive university firewalls, a TURN server would be needed in production.
4. **Safety Interlock:** If hand tracking confidence drops below 65%, or if an ambiguous transition gesture is detected, the app holds position and refuses to dispatch spurious servo movement commands.

---

## 11. Future Hardware Integration

Currently, the application runs in **SIMULATION MODE**, where 5 virtual articulated fingers simulate TowerPro MG90S servo kinematics on screen.

When the hardware team finishes mechanical assembly, the software pipeline will connect directly:
```
[React/Capacitor App] ──(HTTP/WebSocket)──> [FastAPI Backend]
                                                   │
                                        (Serial / Wi-Fi UDP)
                                                   ▼
                                            [ESP32 Microcontroller]
                                                   │ (I2C Bus)
                                                   ▼
                                         [PCA9685 16-Ch PWM Driver]
                                                   │ (5 Servo Lines)
                                                   ▼
                                       [5 × TowerPro MG90S Servos]
                                                   │
                                                   ▼
                                   [3D-Printed Anthropomorphic Hand]
```
No changes to the Android app logic will be needed; the existing JSON servo command format (`thumb`, `index`, `middle`, `ring`, `little` from 0° to 180°) is already 100% aligned with the PCA9685 servo driver spec.
