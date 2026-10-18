# AI-Enabled Vision-Based Anthropomorphic Robotic Arm
### B.Tech CSE (AI & ML) — Engineering Clinics Review 2 & Phase 3 Prototype

[![CI Pipeline](https://github.com/adityamohapatra1226/Anthropomorphic_Robotic_Arm/actions/workflows/ci.yml/badge.svg)](https://github.com/adityamohapatra1226/Anthropomorphic_Robotic_Arm/actions)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-00897B?style=for-the-badge&logo=google&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-333333?style=for-the-badge&logo=webrtc&logoColor=white)
![ESP32](https://img.shields.io/badge/ESP32-E7352C?style=for-the-badge&logo=espressif&logoColor=white)
![Android APK](https://img.shields.io/badge/Android_APK-3DDC84?style=for-the-badge&logo=android&logoColor=white)

A real-time, vision-driven human-robot interaction system that captures hand landmarks via computer vision, classifies gestures through vector geometry, maps them to anthropomorphic servo kinematics, and streams commands across dual WebRTC video and FastAPI WebSocket communication pipelines.

---

## 1. Project Overview

This project implements the complete software stack for an **AI-Enabled Vision-Based Anthropomorphic Robotic Arm**. The software allows a human operator on a mobile phone (or laptop/desktop camera) to control a robotic hand simply by gesturing in front of the camera. The system features:

1. **Two-Phone WebRTC Video Calling**: Connects **Phone A (Control Side)** and **Phone B (Remote Observer)** through peer-to-peer audio/video streaming.
2. **MediaPipe 21 3D Hand Landmark Tracking**: Client-side machine learning running locally at 30+ FPS without external paid APIs.
3. **Geometric Gesture Recognition**: 10+ distinct gestures classified via 3D joint flexion angles and Euclidean distance metrics (invariant to distance from camera).
4. **Temporal Gesture Debouncing**: Eliminates visual and servo flickering across frames.
5. **Gesture-to-Servo Kinematics Mapping**: Translates abstract gestures into structured robotic command payloads for 5 MG90S metal gear servos (Thumb, Index, Middle, Ring, Pinky).
6. **Articulated Robotic Arm Simulator**: Visual 2D forward-kinematics robotic hand model with real-time flexing joints and animated servo degree meters.
7. **Motion Recording & Replay Studio**: Record gesture routines, replay them dynamically through the robotic arm simulator, and export JSON sequence files.
8. **Pluggable Controller Architecture**: Ready for future ESP32 + PCA9685 hardware integration.

---

## 2. What is Currently Simulated? (Review 2 Hardware Boundary)

In accordance with Review 2 project scope, the team is divided into **Software** and **Hardware** sub-teams:

- **Physical Robotic Arm**: Hardware mechanical fabrication & 3D printing is currently underway by the hardware team. Physical hardware integration is pending for Phase 3 / Review 3.
- **ESP32 Microcontroller**: Software controller abstraction (`RobotController`) is implemented with `SimulatedRobotController` active for Review 2, and `ESP32RobotController` prepared as a pluggable bridge for future hardware connection.
- **PCA9685 PWM Driver**: The 16-channel 12-bit PWM mapping (Channels 0–4) is simulated in software.
- **Servo Angles (0°–180°)**: The angles displayed are **DEMO / SIMULATION VALUES** representing target flexion degrees. Final physical mechanical linkage calibration will be performed once servos are mounted on the 3D-printed hand.
- **Software Simulator**: The SVG/Canvas articulated hand model serves as the software replacement for the physical arm during Review 2 evaluation.

---

## 3. System Architecture

```
                  ┌─────────────────────────────────────────┐
                  │                 PHONE A                 │
                  │          USER / CONTROL SIDE            │
                  │                                         │
                  │  • Camera Feed (Front/Back)             │
                  │  • MediaPipe 21 Hand Landmarks          │
                  │  • Joint Geometry & Angle Analysis      │
                  │  • Gesture Recognizer & Debouncer       │
                  │  • Gesture-to-Robot Command Mapper      │
                  │  • Futuristic HUD Canvas Overlay        │
                  │  • WebRTC PeerConnection (Local/Remote) │
                  └──────┬───────────────────────────▲──────┘
                         │                           │
                         │ WebSocket / REST          │ WebRTC Video
                         │ Command & Telemetry       │ & Audio Stream
                         ▼                           ▼
       ┌──────────────────────────────────┐        ┌──────────────────────────────────┐
       │         FASTAPI BACKEND          │        │             PHONE B              │
       │                                  │        │      REMOTE / OBSERVER SIDE      │
       │  • WebRTC Signaling (/ws/signal) ◄────────┤                                  │
       │  • Robot Telemetry (/ws/robot)   │ WebRTC │  • Remote Video Stream (Phone A) │
       │  • REST Endpoints (/api/...)     │ Signal │  • Local Camera Stream (Phone B) │
       │  • Controller Abstraction:       │        │  • Telemetry HUD & Status        │
       │    - SimulatedRobotController    │        │  • Room Join & Video Controls    │
       │    - ESP32RobotController (Stub) │        └──────────────────────────────────┘
       └─────────────────┬────────────────┘
                         │
                         ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │                    ROBOT SIMULATOR & HARDWARE                    │
       │                                                                  │
       │  [Review 2 Active]: Articulated 5-Finger Canvas/SVG Hand Model   │
       │                     Servo Angle Gauges (Thumb, Index, Middle,    │
       │                     Ring, Pinky) + Motion Recording & Replay     │
       │                                                                  │
       │  [Future Hardware]: ESP32 Microcontroller (Wi-Fi/Serial)         │
       │                     ──► PCA9685 16-Ch 12-bit PWM Driver          │
       │                     ──► 5x TowerPro MG90S Metal Gear Servos      │
       │                     ──► 3D-Printed Anthropomorphic Robotic Hand  │
       └──────────────────────────────────────────────────────────────────┘
```

> **IMPORTANT DISTINCTION**:
> - **WebRTC** is strictly used for the **Peer-to-Peer Two-Phone Video & Audio Call**.
> - **FastAPI / WebSocket** is strictly used for the **Robotic Command & Telemetry Pipeline**.

---

## 4. Technology Stack

### Frontend:
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS with custom cybernetic glassmorphism theme
- **Icons**: Lucide React
- **Computer Vision**: Google MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)
- **Video Calling**: Browser WebRTC (`RTCPeerConnection`) with Google public STUN servers
- **Canvas Rendering**: 2D Context overlay for cybernetic landmark skeleton and articulated hand kinematics

### Backend:
- **Language**: Python 3.12+
- **Framework**: FastAPI + Uvicorn ASGI
- **Validation**: Pydantic v2
- **Real-Time Streaming**: Native WebSockets (`websockets`)
- **Network Interface**: 0.0.0.0 binding for LAN mobile connectivity

---

## 5. Folder Structure

```
Anthropomorphic_Robotic_Arm/
├── run_project.bat              # One-click Windows startup script (starts backend & frontend)
├── start_backend.bat            # Standalone backend starter
├── start_frontend.bat           # Standalone frontend starter
├── README.md                    # Detailed documentation & engineering report
│
├── backend/
│   ├── requirements.txt         # FastAPI, Uvicorn, WebSockets, Pydantic
│   └── app/
│       ├── main.py              # FastAPI app, CORS, WebSocket routing, lifecycle
│       ├── api/
│       │   ├── __init__.py
│       │   └── routes.py        # REST endpoints (/health, /api/status, /api/robot/command)
│       ├── models/
│       │   ├── __init__.py
│       │   └── robot.py         # Pydantic schemas (ServoAngles, RobotCommand, RobotState)
│       ├── robot/
│       │   ├── __init__.py
│       │   ├── controller.py    # Abstract RobotController interface
│       │   ├── simulator.py     # SimulatedRobotController with history & state
│       │   └── esp32.py         # ESP32 hardware bridge stub
│       └── websocket/
│           ├── __init__.py
│           └── manager.py       # WebRTCSignalingManager & RobotTelemetryManager
│
└── frontend/
    ├── package.json             # React, Vite, Tailwind, MediaPipe, Lucide
    ├── vite.config.ts           # Vite + Tailwind + 0.0.0.0 host binding
    ├── tsconfig.app.json        # TypeScript configuration
    ├── src/
    │   ├── App.tsx              # Main application router and universal HUD header
    │   ├── index.css            # Cybernetic HUD styles, glassmorphism, scanline animations
    │   ├── types/
    │   │   ├── robot.ts         # ServoAngles, GestureType, RobotCommand, MotionFrame
    │   │   └── webrtc.ts        # SignalingMessage, WebRTCConnectionStatus
    │   ├── vision/
    │   │   ├── mediaPipeLoader.ts # MediaPipe HandLandmarker lifecycle & GPU/CPU delegate
    │   │   └── handOverlay.ts   # Canvas 21-landmark skeleton and HUD bounding box
    │   ├── gestures/
    │   │   ├── fingerAngles.ts  # 3D vector geometry, joint angles, extension checks
    │   │   ├── gestureRecognizer.ts # 10+ gesture classification engine
    │   │   └── gestureDebouncer.ts # Sliding-window temporal majority filter
    │   ├── robot/
    │   │   ├── gestureCommands.ts # Central gesture -> robot command -> servo angle mapping
    │   │   └── motionRecorder.ts # Motion sequence recorder and replay engine
    │   ├── webrtc/
    │   │   └── webrtcManager.ts # RTCPeerConnection and WebSocket signaling client
    │   ├── services/
    │   │   └── api.ts           # REST API & WebSocket service with dynamic host resolution
    │   ├── components/
    │   │   ├── CameraFeed.tsx   # Video capture, flip camera, MediaPipe processing loop
    │   │   ├── RobotSimulator.tsx # Articulated 5-finger visual model + servo meters
    │   │   ├── GestureCard.tsx  # Prominent gesture detected card + quick test chips
    │   │   ├── RobotCommandViewer.tsx # Kinematics table + JSON spec viewer
    │   │   ├── MotionHistory.tsx # Live gesture log + Motion Sequence Studio
    │   │   ├── ConnectionStatusHUD.tsx # Telemetry bar (FPS, AI status, Latency)
    │   │   └── RoomModal.tsx    # Create / Join room dialog with LAN IP guide
    │   └── pages/
    │       ├── HomePage.tsx     # Launchpad screen (Create Room, Join Room, Demo Mode)
    │       ├── CallPage.tsx     # WebRTC dual camera call + gesture control
    │       └── RobotDashboardPage.tsx # Standalone single-device demo dashboard
```

---

## 6. How to Run Locally

### Prerequisites
- Node.js (v18+ or v24+)
- Python (v3.10, v3.11, or v3.12)
- Webcam (built-in or USB webcam)

### Quick Start (Windows)
Double-click `run_project.bat` from Windows File Explorer, or open PowerShell in the project root:
```powershell
.\run_project.bat
```
This automatically launches both the FastAPI backend and Vite frontend in separate terminal windows.

---

### Manual Setup (Step-by-Step)

#### 1. Backend Setup:
```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- Health Check: `http://localhost:8000/health`
- Swagger Interactive API Docs: `http://localhost:8000/docs`

#### 2. Frontend Setup:
```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```
- Dashboard: `http://localhost:5173`

#### 3. Frontend with Native HTTPS (Recommended for 2-Phone Mobile Camera Access):
```powershell
cd frontend
npm.cmd run dev:https
```
- Dashboard (HTTPS): `https://localhost:5173` (or `https://<laptop-ip>:5173`)

---

## 7. Camera HTTPS Requirement (Fixing "Camera Notice: Could not access camera")

### Why did the browser give this error?
In modern mobile and desktop browsers (Google Chrome, Safari, Edge, Android Chrome), the **MediaDevices API (`navigator.mediaDevices.getUserMedia`) is strictly restricted to Secure Contexts** as per W3C Web Security specifications:
1. **Permitted Secure Origins**: `localhost`, `127.0.0.1`, and any origin served over **`https://`**.
2. **Blocked Insecure Origins**: Any plain **`http://`** URL accessed via an external LAN IP address (such as `http://10.113.90.153:5174` or `http://192.168.1.x:5173`). In this insecure state, `navigator.mediaDevices` evaluates to **`undefined`**, causing the browser to reject camera initialization immediately with `"Camera Notice: Could not access camera"`.

### How to resolve camera access on mobile phones (4 options):

#### Option 1: Native HTTPS via Vite (Recommended & Built-in)
Run the Vite development server with the integrated `@vitejs/plugin-basic-ssl` plugin:
```powershell
# Using the 1-click script:
.\run_project_https.bat

# Or from the frontend directory:
npm.cmd run dev:https
```
1. Open `https://<laptop-ip>:5173` in your mobile browser.
2. The browser will show a standard local development self-signed certificate notice.
3. Tap **Advanced** (or "Details") ➔ Tap **"Proceed to site (unsafe)"**.
4. The browser will now prompt for and allow camera and microphone access normally!

#### Option 2: Chrome Insecure Origins Flag (Android Chrome)
If you prefer to stay on plain HTTP without SSL warnings:
1. Open Google Chrome on your Android phone.
2. In the URL bar, type:
   ```
   chrome://flags/#unsafely-treat-insecure-origin-as-secure
   ```
3. In the input box under **"Insecure origins treated as secure"**, enter your laptop LAN URL, for example:
   ```
   http://10.113.90.153:5174, http://<your-laptop-ip>:5173
   ```
4. Change the dropdown selection from **Disabled** to **Enabled**.
5. Tap the blue **Relaunch** button at the bottom of the screen.
6. Return to `http://<laptop-ip>:5173` — camera access will now work over plain HTTP!

#### Option 3: Localhost Testing (Single Device)
On the computer running the code, open `http://localhost:5173`. `localhost` is universally recognized as a secure context, so camera access works out of the box without HTTPS or flags.

#### Option 4: "Test Simulated Hand" Emergency Fallback Mode
If camera hardware is broken or unavailable during a live evaluation, click the **"Test Simulated Hand"** button on the Camera notice overlay or click any of the **Demo Test Gestures** (`PINCH`, `THUMBS UP`, `FIST`, `OPEN HAND`, etc.). This runs a synthetic 21-point hand skeleton through the MediaPipe overlay and gesture debouncer, driving the robotic hand simulator in real-time so your presentation is never blocked!

---

## 8. How to Connect Two Mobile Phones

1. **Connect both phones and your laptop to the same Wi-Fi network**.
2. Start the project using **`run_project_https.bat`** (or `run_project.bat` if Chrome flag is configured).
3. Check your laptop's local IP address (displayed on the top-right HUD of the dashboard, e.g., `192.168.1.15` or `10.113.90.153`).
4. **On Phone A (Control Side)**:
   - Open browser and navigate to `https://<laptop-ip>:5173`.
   - Click **`CREATE ROOM (PHONE A: CONTROL)`**.
   - Note or copy the generated Room ID (e.g., `ROBOT842`).
   - Allow camera permissions. Phone A will start local camera tracking with MediaPipe landmarks and display local controls.
5. **On Phone B (Remote Observer / Reviewer Side)**:
   - Open browser on the second phone and navigate to `https://<laptop-ip>:5173`.
   - Click **`JOIN ROOM (PHONE B: OBSERVER)`**.
   - Enter the Room ID (`ROBOT842`) and tap **Join**.
6. **Live Synchronization**:
   - **Video Exchange**: Phone A and Phone B stream live peer-to-peer video via WebRTC. Phone B displays Phone A's camera feed as the primary **REMOTE ROBOT VIEW**.
   - **Robotic Telemetry Sync**: Phone B subscribes to `/ws/robot` via WebSocket. As the user on Phone A makes hand gestures (`PINCH`, `FIST`, `THUMBS UP`), Phone B's **Anthropomorphic Hand Simulator** flexes its mechanical fingers in real-time with synchronized servo angle telemetry!
   - **View Swapping**: Either phone can tap **"Swap Feeds"** to toggle between the remote stream and local camera feed.

---

## 9. How "Demo Without Second Phone" Mode Works

For solo testing, evaluation reviews, or single-laptop demonstrations:
1. Open `http://localhost:5173`.
2. Click **`DEMO WITHOUT SECOND PHONE`**.
3. Allow camera access.
4. Show your hand to the camera:
   - Landmarks and cybernetic HUD skeleton will track your fingers.
   - Detected gesture is displayed prominently.
   - The articulated robot hand simulator flexes and curls its fingers in real-time!
5. **No Camera Available?** Use the built-in **`DEMO TEST GESTURES`** buttons (`PINCH`, `THUMBS UP`, `FIST`, `OPEN HAND`, etc.) to trigger commands and observe servo movements instantly.

---

## 10. Gesture to Robot Command Mapping (`gestureCommands.ts`)

| # | Hand Gesture | Emo | Robot Action Command | Thumb | Index | Middle | Ring | Little | Kinematic Purpose |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **OPEN HAND** | ✋ | `OPEN_ALL_FINGERS` | 0° | 0° | 0° | 0° | 0° | Fully open hand, release object / idle |
| 2 | **CLOSED FIST** | ✊ | `CLOSE_ALL_FINGERS` | 90° | 90° | 90° | 90° | 90° | Power grasp, clutching cylindrical objects |
| 3 | **THUMBS UP** | 👍 | `THUMBS_UP_POSITION` | 0° | 90° | 90° | 90° | 90° | Thumb extended, 4 fingers locked |
| 4 | **POINTING** | 👉 | `POINT_INDEX` | 80° | 0° | 90° | 90° | 90° | Precise index pointing, button pressing |
| 5 | **PINCH** | 🤏 | `PINCH_GRIP` | 65° | 70° | 20° | 20° | 20° | Fine pinch grip for delicate objects |
| 6 | **PEACE / 2 FINGERS** | ✌️ | `TWO_FINGER_POSITION` | 90° | 0° | 0° | 90° | 90° | Dual-finger scissor or clamp pose |
| 7 | **ONE FINGER** | ☝️ | `POINT_INDEX` | 85° | 0° | 85° | 85° | 85° | Single finger probe |
| 8 | **TWO FINGERS** | ✌️ | `TWO_FINGER_POSITION` | 90° | 0° | 0° | 90° | 90° | Parallel 2-finger extension |
| 9 | **THREE FINGERS** | 🤟 | `THREE_FINGER_EXTEND` | 85° | 0° | 0° | 0° | 85° | 3-finger tripod grip |
| 10 | **FOUR FINGERS** | 🖐️ | `FOUR_FINGER_EXTEND` | 90° | 0° | 0° | 0° | 0° | Flat palm scoop |
| 11 | **OK SIGN** | 👌 | `OK_PRECISION_GRIP` | 55° | 60° | 0° | 0° | 0° | Circular precision pinch |

---

## 11. How the Computer Vision Pipeline Works

1. **MediaPipe Tasks Vision**: Uses a quantized float16 neural network running on client WebAssembly/WebGL to detect 21 3D hand coordinates $(x, y, z)$.
2. **Palm Scale Normalization**:
   $$palmScale = \sqrt{(x_0 - x_9)^2 + (y_0 - y_9)^2 + (z_0 - z_9)^2}$$
   Distances are normalized by the wrist-to-middle-MCP distance, making gesture recognition completely invariant to camera distance.
3. **Joint Flexion Angle Calculation**:
   Calculates the 3D interior angle at the Proximal Interphalangeal (PIP) joint:
   $$\cos(\theta) = \frac{\vec{v}_1 \cdot \vec{v}_2}{\|\vec{v}_1\| \|\vec{v}_2\|}$$
   Fingers with $\theta > 130^\circ$ and tip-to-wrist distance exceeding PIP-to-wrist distance are marked as **EXTENDED**.
4. **Pinch Proximity Test**:
   Euclidean distance between Thumb Tip (4) and Index Tip (8) is evaluated against a threshold of $0.32 \times palmScale$.
5. **Debouncing & Temporal Majority**:
   A sliding window of 4 frames filters transient noise or frame blips, ensuring stability without introducing perceptible lag.

---

## 12. How the Robot Arm Simulator Works

- Located in `frontend/src/components/RobotSimulator.tsx`.
- Models an anthropomorphic hand with a metallic palm chassis and 5 articulated mechanical fingers.
- Each finger contains 3 distinct phalange segments (Proximal, Intermediate, Distal).
- As servo angle values change between 0° and 180°, the component applies forward kinematics:
  $$\text{curl} = \frac{\text{angle}}{90} \times 45^\circ$$
  Rotating each joint segment sequentially in 2D space so fingers curl and grip realistically.
- Includes animated progress gauges displaying current servo degrees and PCA9685 PWM channels (`CH 0` to `CH 4`).
- Provides a manual slider override mode for testing individual joint kinematics.

---

## 13. Motion Recording & Replay Studio

- **Start Recording**: Captures timestamped gesture state transitions and servo positions.
- **Stop Recording**: Saves the routine to memory.
- **Replay Routine**: Iterates through the recorded frames with exact timing offsets, driving the simulator through the recorded sequence.
- **Demo Preset**: One-click load of a pre-programmed Engineering Clinics presentation sequence.
- **Export JSON**: Downloads the recorded routine as a `.json` file for persistence or grading.

---

## 14. Future ESP32 Hardware Integration Plan (Phase 3)

The software architecture is decoupled from hardware through the `RobotController` base class:

```
FastAPI Server (/ws/robot)
        │
        ▼
   RobotController (Abstract)
   ├── SimulatedRobotController (Review 2: Active)
   └── ESP32RobotController    (Phase 3: Hardware Bridge)
               │
               ▼ (Wi-Fi WebSocket / Serial 115200 baud)
            ESP32 Microcontroller
               │ I2C Bus (GPIO 21 SDA, GPIO 22 SCL)
               ▼
            PCA9685 16-Channel 12-bit PWM Driver
               │ PWM Channels 0..4 (50 Hz / 20ms period)
               ▼
            5x TowerPro MG90S Metal Gear Servos
               │ Tendon Cables / Mechanical Linkages
               ▼
            3D-Printed Anthropomorphic Hand
```

### ESP32 Wiring Guide:
- **ESP32 3V3 / GND** ──► PCA9685 VCC / GND
- **ESP32 GPIO 21** ──► PCA9685 SDA
- **ESP32 GPIO 22** ──► PCA9685 SCL
- **External 5V 3A Power Supply** ──► PCA9685 V+ / GND (servos must NOT be powered directly from ESP32 pin!)
- **PCA9685 CH 0** ──► Thumb MG90S Servo
- **PCA9685 CH 1** ──► Index MG90S Servo
- **PCA9685 CH 2** ──► Middle MG90S Servo
- **PCA9685 CH 3** ──► Ring MG90S Servo
- **PCA9685 CH 4** ──► Little MG90S Servo

---

## 15. Known Limitations & Prototype Constraints

1. **Lighting & Occlusion**: MediaPipe requires reasonable ambient illumination. Extreme finger overlap or hands viewed edge-on may temporarily reduce landmark detection confidence.
2. **Servo Linkage Calibration**: Actual physical MG90S servos will require min/max microsecond pulse width tuning (typically 500µs–2500µs) once mounted to physical tendon strings.
3. **WebRTC NAT Traversal**: The system uses Google public STUN servers. On strict institutional/corporate firewalls that block UDP peer-to-peer traffic, a TURN relay server would be required for public internet calls. On local Wi-Fi, direct connection works out of the box.

---

## 16. Review 2 Demonstration Checklist

- [x] Welcome page with Create Room, Join Room, and Demo Mode.
- [x] Standalone Demo Mode running on a single device / laptop.
- [x] Real-time camera feed with MediaPipe 21 hand landmark tracking.
- [x] Futuristic cybernetic HUD overlay with skeleton lines and joint nodes.
- [x] 10+ recognized gestures with confidence score and debouncing.
- [x] Gesture-to-Robot command mapping with structured JSON payloads.
- [x] Beginner-friendly kinematics degree view (Thumb -> 0°, Index -> 0°, etc.).
- [x] Articulated 5-finger anthropomorphic robotic hand simulator.
- [x] Real-time animated servo angle gauges with PCA9685 channels.
- [x] Manual slider override mode.
- [x] Motion Recording, Replay, and JSON Export.
- [x] Two-phone WebRTC video calling with room creation/joining.
- [x] Phone A (Vision Controller) vs Phone B (Remote Observer) role differentiation.
- [x] Real-time robot telemetry synchronization over WebSocket (`/ws/robot`).
- [x] FastAPI REST API + WebSocket real-time command pipeline.
- [x] Pluggable ESP32 hardware abstraction architecture.
- [x] Native HTTPS Vite server support for Android & Safari mobile cameras (`run_project_https.bat`).
- [x] One-click Windows launcher (`run_project.bat`).
