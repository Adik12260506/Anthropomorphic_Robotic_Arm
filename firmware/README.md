# ESP32 Wi-Fi Hardware Integration Guide

This directory contains the firmware and utilities to connect the **AI-Enabled Anthropomorphic Robotic Arm** vision interface to your physical hardware via an **ESP32** microcontroller over Wi-Fi.

---

## 1. How Angle Extraction Works in This System

There are **two modes** of angle extraction in the project:

### Mode A: Real-Time Live Vision Extraction (Continuous Streaming)
1. **Camera Feed & MediaPipe (`frontend/src/components/CameraFeed.tsx`):**
   - MediaPipe Tasks Vision extracts **21 3D hand coordinates** at 30–60 FPS.
2. **Joint Angle & Gesture Analysis (`frontend/src/gestures/`):**
   - Joint vectors are computed for MCP, PIP, and DIP joints (`fingerAngles.ts`).
   - A multi-frame debouncer stabilizes the gesture (`gestureDebouncer.ts`).
3. **Servo Mapping (`frontend/src/robot/gestureCommands.ts`):**
   - The recognized gesture maps to 5 target servo angles (`0°` = fully flexed/closed, `180°` = fully extended/open):
     - `Thumb`: Channel 0
     - `Index`: Channel 1
     - `Middle`: Channel 2
     - `Ring`: Channel 3
     - `Little (Pinky)`: Channel 4
4. **Transmission Pipeline:**
   - The frontend dispatches `POST /api/robot/command` to the FastAPI backend (`backend/app/main.py`).
   - The backend updates state and immediately broadcasts the angles over WebSocket (`ws://<COMPUTER_IP>:8000/ws/robot`).
   - The **ESP32**, connected to the same Wi-Fi, receives this WebSocket stream in **< 20ms** and drives the physical servos!

### Mode B: Exporting Recorded Routines (Offline / Replayable Sequences)
1. Open the web interface (`http://localhost:5173` or your mobile LAN URL).
2. Go to **Robot Dashboard** or **Call Page** and find the **Motion Recording & Recent History** section.
3. Click the red **Record** button (circle icon).
4. Perform hand gestures in front of the camera (or use the simulation buttons).
5. Click **Stop** (square icon).
6. Click **Export JSON** (download icon).
   - This downloads a file named `robot-motion-routine-<timestamp>.json`.
   - Each frame in the file contains the timestamp offset and the 5 servo angles:
     ```json
     {
       "timestamp_offset_ms": 1200,
       "gesture": "CLOSED_FIST",
       "servos": { "thumb": 0, "index": 0, "middle": 0, "ring": 0, "little": 0 }
     }
     ```

---

## 2. Hardware Wiring Diagram

### Connecting ESP32 to PCA9685 I2C Servo Driver:

```
 ESP32 (30-pin NodeMCU)             PCA9685 16-Ch PWM Driver
 ┌──────────────────────┐           ┌────────────────────────┐
 │                      │           │                        │
 │  3V3 (or 5V)         ├───────────► VCC (Logic Power)      │
 │  GND                 ├───────────► GND (Logic Ground)     │
 │  GPIO 21 (SDA)       ├───────────► SDA (I2C Data)         │
 │  GPIO 22 (SCL)       ├───────────► SCL (I2C Clock)        │
 │                      │           │                        │
 └──────────────────────┘           │  V+  (Servo Power) ◄───┼── External +5V to +6V Power Supply
                                    │  GND (Servo Ground)◄───┼── External Power Supply GND
                                    └───────────┬────────────┘
                                                │
       ┌───────────────────┬────────────────────┼───────────────────┬───────────────────┐
       ▼ (CH 0)            ▼ (CH 1)             ▼ (CH 2)            ▼ (CH 3)            ▼ (CH 4)
 ┌───────────┐       ┌───────────┐        ┌───────────┐       ┌───────────┐       ┌───────────┐
 │ MG90S #1  │       │ MG90S #2  │        │ MG90S #3  │       │ MG90S #4  │       │ MG90S #5  │
 │  (Thumb)  │       │  (Index)  │        │ (Middle)  │       │  (Ring)   │       │  (Pinky)  │
 └───────────┘       └───────────┘        └───────────┘       └───────────┘       └───────────┘
```

> **IMPORTANT POWER NOTE:** Do NOT power the 5 MG90S servos from the ESP32 5V/3.3V pin! 5 servos drawing stall current will cause ESP32 brownouts and resets. Connect a separate **5V–6V 3A–5A DC power supply** directly to the screw terminals (`V+` and `GND`) of the PCA9685, and connect all GNDs together (common ground).

---

## 3. Flashing Firmware Using Arduino IDE

### Step 1: Install ESP32 Board Support
1. Open **Arduino IDE**.
2. Go to **Settings / Preferences** (`Cmd + ,` on Mac or `Ctrl + ,` on Windows).
3. In **Additional Boards Manager URLs**, paste:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to **Tools** → **Board** → **Boards Manager**, search for `esp32` by Espressif Systems, and click **Install**.

### Step 2: Install Required Libraries
Go to **Sketch** → **Include Library** → **Manage Libraries...** (`Cmd + Shift + I`):
1. Search `WebSockets` by **Markus Sattler** → Click **Install**.
2. Search `ArduinoJson` by **Benoit Blanchon** → Click **Install**.
3. Search `Adafruit PWM Servo Driver Library` by **Adafruit** → Click **Install**.
4. *(Optional fallback)* If you are NOT using a PCA9685 and want direct GPIO pins, search `ESP32Servo` by **Kevin Harrington** → Click **Install**.

### Step 3: Configure Wi-Fi and Backend IP
1. Open [`esp32_robotic_hand/esp32_robotic_hand.ino`](file:///Users/adityamohapatra1226/Downloads/Anthropomorphic_Robotic_Arm/firmware/esp32_robotic_hand/esp32_robotic_hand.ino) in Arduino IDE.
2. Edit lines 63–71 with your Wi-Fi credentials and computer's LAN IP:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Name";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   const char* BACKEND_IP   = "192.168.1.XXX"; // Your PC's LAN IP
   ```
   *(To find your PC's IP, look at the terminal when starting `./start_backend.sh` or run `ifconfig` in Terminal).*

### Step 4: Upload and Monitor
1. Select your board under **Tools** → **Board** → **esp32** → **ESP32 Dev Module** (or your specific ESP32 model).
2. Select your USB port under **Tools** → **Port**.
3. Click the **Upload** arrow (`Cmd + U` / `Ctrl + U`).
4. Once flashed, open **Tools** → **Serial Monitor** and set baud rate to **`115200`**.
5. You will see:
   ```
   [HW] Initializing PCA9685 PWM Driver on I2C (SDA=21, SCL=22)...
   [HW] Moving fingers to default neutral pose (0° Open Hand)...
   [WIFI] Connected successfully!
   [WIFI] ESP32 IP Address: http://192.168.1.150
   [HTTP] REST server ready on port 80
   [WS] Connecting to backend: ws://192.168.1.100:8000/ws/robot
   [WS] Connected to ws://192.168.1.100:8000/ws/robot
   ```

---

## 4. Testing Your Setup

### Test 1: Direct Wi-Fi HTTP Control (Quick Verification)
Open your web browser on any device connected to the same Wi-Fi and visit:
```
http://<ESP32_IP>/set?t=0&i=0&m=0&r=0&l=0
```
All fingers will curl into a closed fist (0°)!
Then visit:
```
http://<ESP32_IP>/set?t=180&i=180&m=180&r=180&l=180
```
All fingers will fully open and extend (180°)!

### Test 2: Live Vision Gesture Teleoperation
1. Start the project backend and frontend:
   ```bash
   ./run_project.sh
   ```
2. Open the web app on your phone or PC.
3. Show gestures to the camera (e.g., Closed Fist, Thumbs Up, Pointing).
4. Watch the physical robotic hand mirror your hand in real time!

### Test 3: Playing Back Exported Motion Routines
If you exported a `robot-motion-routine-<timestamp>.json` from the interface, replay it through the Python helper tool:
```bash
python firmware/transmit_routine.py --file path/to/robot-motion-routine-xxx.json --backend http://localhost:8000
```
Or transmit directly to the ESP32 IP:
```bash
python firmware/transmit_routine.py --file path/to/robot-motion-routine-xxx.json --esp32 http://192.168.1.150
```
