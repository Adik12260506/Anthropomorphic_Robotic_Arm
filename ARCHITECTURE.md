# System Architecture & Technical Specifications

> **Project:** AI-Enabled Vision-Based Anthropomorphic Robotic Arm  
> **Course:** Engineering Clinics — Review 2  
> **Architecture Overview:** Dual-Phone WebRTC Teleoperation & Vision-to-Servo Pipeline  

---

## 1. Primary Vision-to-Robot Kinematic Pipeline

This pipeline details how human hand motions captured on the mobile device are translated into kinematic servo angles for the anthropomorphic robotic hand.

```
                  ┌─────────────────────────────────────┐
                  │               PHONE A               │
                  │  (User / Hand Motion Controller)    │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │               CAMERA                │
                  │ (Live Video Feed: Front or Rear)    │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │              MEDIAPIPE              │
                  │    Tasks Vision HandLandmarker      │
                  │   21 3D Coordinate Landmarks        │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │         GESTURE RECOGNITION         │
                  │  Geometric Joint Vector Analysis    │
                  │     & Multi-Frame Debouncer         │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │            ROBOT COMMAND            │
                  │  Structured Action & Servo Angles   │
                  │   Safety Threshold Check (≥ 0.65)   │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │          API / WEBSOCKET            │
                  │  FastAPI REST: /api/robot/command   │
                  │  WebSocket Telemetry: /ws/robot     │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │           ROBOT SIMULATOR           │
                  │   Current Software Prototype Mode   │
                  │  Articulated 2D Forward Kinematics  │
                  └──────────────────┬──────────────────┘
                                     │ (Future Hardware Hand-off)
                                     ▼
                  ┌─────────────────────────────────────┐
                  │            FUTURE ESP32             │
                  │ Microcontroller Unit (UART/Wi-Fi)   │
                  └──────────────────┬──────────────────┘
                                     │ (I2C Bus)
                                     ▼
                  ┌─────────────────────────────────────┐
                  │               PCA9685               │
                  │ 16-Channel 12-Bit PWM Servo Driver  │
                  └──────────────────┬──────────────────┘
                                     │ (5 PWM Channels)
                                     ▼
                  ┌─────────────────────────────────────┐
                  │              MG90S × 5              │
                  │  Metal Gear Micro Servos (0°–180°)  │
                  │   Thumb, Index, Middle, Ring, Pinky │
                  └──────────────────┬──────────────────┘
                                     │ (Mechanical Tendons)
                                     ▼
                  ┌─────────────────────────────────────┐
                  │            ROBOTIC HAND             │
                  │  3D-Printed 5-Finger Anthropomorphic│
                  │              Mechanism              │
                  └─────────────────────────────────────┘
```

---

## 2. WebRTC Two-Phone Teleoperation Architecture

This independent communication channel provides direct real-time peer-to-peer audio and video transmission between the controller and the remote viewer.

```
  ┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
  │             PHONE A             │                 │             PHONE B             │
  │   (Controller / Transferee)     │                 │   (Remote Viewer / Evaluator)   │
  │                                 │                 │                                 │
  │  • Live Camera Feed             │                 │  • Remote Video Display (Full)  │
  │  • MediaPipe 21 Landmarks       │                 │  • Synced Servo Angles Display  │
  │  • Real-Time Gesture Engine     │                 │  • Dual-Feed Picture-in-Picture │
  └────────────────┬────────────────┘                 └────────────────┬────────────────┘
                   │                                                   │
                   │               ┌───────────────────┐               │
                   └──────────────►│ FASTAPI SIGNALING │◄──────────────┘
                                   │  WebSocket Server │
                                   │  /ws/signaling/{id}│
                                   └─────────┬─────────┘
                                             │ (SDP Offer / Answer & ICE Candidates)
                                             ▼
                   ▲═══════════════════════════════════════════════════▲
                   ║              PEER-TO-PEER WEBRTC                  ║
                   ║           Encrypted Audio / Video                 ║
                   ║      (STUN: stun.l.google.com:19302)              ║
                   ╚═══════════════════════════════════════════════════╝
```

### Protocol Separation
- **WebRTC Video/Audio Channel:** Used exclusively for live video exchange between Phone A and Phone B.
- **WebSocket / REST Robot Channel:** Used exclusively for telemetry, state updates, and servo command dispatch.

---

## 3. Gesture-to-Servo Angle Mapping Specification

Each recognized human gesture maps deterministically to targeted angles for the 5 MG90S servo motors:

| Gesture Name | Emoji | Robot Command | Thumb (CH 0) | Index (CH 1) | Middle (CH 2) | Ring (CH 3) | Little (CH 4) | Action Description |
|---|:---:|---|:---:|:---:|:---:|:---:|:---:|---|
| `OPEN_HAND` | ✋ | `OPEN_ALL_FINGERS` | 0° | 0° | 0° | 0° | 0° | Fully extends all five fingers |
| `CLOSED_FIST` | ✊ | `CLOSE_ALL_FINGERS` | 90° | 90° | 90° | 90° | 90° | Flexes all five fingers into grip |
| `THUMBS_UP` | 👍 | `THUMBS_UP_POSITION` | 0° | 90° | 90° | 90° | 90° | Thumb up; four fingers curled |
| `POINTING` | 👉 | `POINT_INDEX` | 80° | 0° | 90° | 90° | 90° | Extends index finger forward |
| `PINCH` | 🤏 | `PINCH_GRIP` | 65° | 70° | 20° | 20° | 20° | Thumb & index tips meet |
| `PEACE` | ✌️ | `TWO_FINGER_POSITION` | 90° | 0° | 0° | 90° | 90° | Extends index & middle fingers |
| `ONE_FINGER` | ☝️ | `EXTEND_INDEX_ONLY` | 85° | 0° | 85° | 85° | 85° | Extends index only |
| `TWO_FINGERS` | ✌️ | `EXTEND_TWO_FINGERS` | 90° | 0° | 0° | 90° | 90° | Extends index & middle |
| `THREE_FINGERS`| 🤟 | `THREE_FINGER_EXTEND` | 85° | 0° | 0° | 0° | 85° | Extends index, middle, ring |
| `FOUR_FINGERS` | 🖐️ | `FOUR_FINGER_EXTEND` | 90° | 0° | 0° | 0° | 0° | Extends four fingers; thumb folded |
| `OK_SIGN` | 👌 | `OK_PRECISION_GRIP` | 55° | 60° | 0° | 0° | 0° | Precision circle with thumb & index |
| `UNKNOWN` | 🔄 | `HOLD_POSITION` | — | — | — | — | — | Transition state; holds current angle |
| `NO_HAND` | ❓ | `STANDBY_REST` | 0° | 0° | 0° | 0° | 0° | Standby neutral pose |

---

## 4. Hardware Actuation Flow (Phase 3 Hardware Milestone)

```
[FastAPI Backend / Direct Phone Wi-Fi]
                 │
                 ▼ (HTTP JSON / UDP Packet)
[ESP32 Microcontroller]
  • Firmware: Arduino C++ / FreeRTOS
  • Receives: {"thumb": 0, "index": 90, "middle": 90, "ring": 90, "little": 90}
                 │
                 ▼ (I2C Bus: SDA = GPIO 21, SCL = GPIO 22)
[PCA9685 16-Channel 12-Bit PWM Driver]
  • Operating Frequency: 50 Hz (20 ms period for analog servos)
  • Pulse Width: 500 μs (0°) to 2500 μs (180°)
                 │
                 ▼ (Individual PWM Channels 0–4)
[5 × TowerPro MG90S Micro Servos]
  • CH 0: Thumb flexor tendon
  • CH 1: Index flexor tendon
  • CH 2: Middle flexor tendon
  • CH 3: Ring flexor tendon
  • CH 4: Little flexor tendon
                 │
                 ▼
[Physical 3D-Printed Robotic Arm]
  • High-strength elastic return cords for finger extension
  • Braided nylon tendons for finger flexion
```
