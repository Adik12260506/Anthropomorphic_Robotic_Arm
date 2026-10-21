/*
 * =========================================================================================
 * Anthropomorphic Robotic Arm - ESP32 Wi-Fi Servo Controller
 * =========================================================================================
 * 
 * Hardware Supported:
 *   - ESP32 (NodeMCU / ESP-WROOM-32)
 *   - PCA9685 16-Channel 12-Bit I2C PWM Driver (Default)
 *   - 5x TowerPro MG90S / SG90 Micro Servos (0° - 180°)
 *
 * Channel Mapping:
 *   - Channel 0: Thumb
 *   - Channel 1: Index
 *   - Channel 2: Middle
 *   - Channel 3: Ring
 *   - Channel 4: Little (Pinky)
 * =========================================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>
#include <ESPmDNS.h> // Enables http://robotarm.local on your Mac!

// -----------------------------------------------------------------------------
// 1. WI-FI & BACKEND CONFIGURATION
// -----------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_NAME";        // Your 2.4GHz phone hotspot name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";    // Your hotspot password
const char* BACKEND_IP   = "10.165.78.54";          // Your Mac's verified LAN IP
const int   BACKEND_PORT = 8000;
const char* BACKEND_WS   = "/ws/robot";

// -----------------------------------------------------------------------------
// 2. HARDWARE & SERVO CONFIGURATION
// -----------------------------------------------------------------------------
Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver(0x40);

#define SERVOMIN   105  // ~500 us (0° Closed Fist)
#define SERVOMAX   510  // ~2500 us (180° Open Hand)
#define SERVO_FREQ 50   // 50 Hz analog servos

// Reverse finger direction if mechanical tendon pulls backward:
// { Thumb, Index, Middle, Ring, Little }
bool INVERT_SERVO[5] = { false, false, false, false, false };

const int ONBOARD_LED = 2; // Blue LED on most ESP32 Dev boards

// -----------------------------------------------------------------------------
// 3. GLOBAL OBJECTS & STATE
// -----------------------------------------------------------------------------
WebSocketsClient webSocket;
WebServer server(80);

float currentAngles[5] = { 180.0, 180.0, 180.0, 180.0, 180.0 };
float targetAngles[5]  = { 180.0, 180.0, 180.0, 180.0, 180.0 };
const float SMOOTHING  = 0.35;
unsigned long lastUpdateMs  = 0;
unsigned long lastIpPrintMs = 0;

int angleToPulse(float angle) {
  angle = constrain(angle, 0.0f, 180.0f);
  return map((int)angle, 0, 180, SERVOMIN, SERVOMAX);
}

void writePhysicalServo(int channel, float angle) {
  angle = constrain(angle, 0.0f, 180.0f);
  if (INVERT_SERVO[channel]) angle = 180.0f - angle;
  pwm.setPWM(channel, 0, angleToPulse(angle));
}

void applyTargetAngles(float t, float i, float m, float r, float l) {
  targetAngles[0] = constrain(t, 0.0f, 180.0f);
  targetAngles[1] = constrain(i, 0.0f, 180.0f);
  targetAngles[2] = constrain(m, 0.0f, 180.0f);
  targetAngles[3] = constrain(r, 0.0f, 180.0f);
  targetAngles[4] = constrain(l, 0.0f, 180.0f);
}

void updateServoSmoothing() {
  unsigned long now = millis();
  if (now - lastUpdateMs < 16) return;
  lastUpdateMs = now;

  for (int ch = 0; ch < 5; ch++) {
    currentAngles[ch] += (targetAngles[ch] - currentAngles[ch]) * SMOOTHING;
    writePhysicalServo(ch, currentAngles[ch]);
  }
}

// -----------------------------------------------------------------------------
// 4. WEBSOCKET JSON PARSER
// -----------------------------------------------------------------------------
void parseRobotTelemetry(uint8_t * payload, size_t length) {
#if ARDUINOJSON_VERSION_MAJOR >= 7
  JsonDocument doc;
#else
  StaticJsonDocument<1024> doc;
#endif

  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) return;

  const char* type = doc["type"];
  if (type && strcmp(type, "state_update") == 0) {
    JsonObject servos = doc["state"]["servos"];
    if (!servos.isNull()) {
      float t = servos["thumb"]  | currentAngles[0];
      float i = servos["index"]  | currentAngles[1];
      float m = servos["middle"] | currentAngles[2];
      float r = servos["ring"]   | currentAngles[3];
      float l = servos["little"] | currentAngles[4];
      applyTargetAngles(t, i, m, r, l);

      const char* gesture = doc["state"]["last_gesture"] | "UNKNOWN";
      Serial.printf("[VISION] Gesture: %-12s | T:%.0f I:%.0f M:%.0f R:%.0f L:%.0f\n", 
                    gesture, t, i, m, r, l);
    }
  }
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected from Backend. Reconnecting...");
      break;
    case WStype_CONNECTED:
      Serial.printf("[WS] Connected to ws://%s:%d%s\n", BACKEND_IP, BACKEND_PORT, BACKEND_WS);
      webSocket.sendTXT("{\"type\":\"esp32_handshake\",\"device\":\"AnthropomorphicArmESP32\"}");
      break;
    case WStype_TEXT:
      parseRobotTelemetry(payload, length);
      break;
    default:
      break;
  }
}

// -----------------------------------------------------------------------------
// 5. DIRECT HTTP REST ENDPOINTS
// -----------------------------------------------------------------------------
void handleHttpSet() {
  float t = server.hasArg("t") ? server.arg("t").toFloat() : targetAngles[0];
  float i = server.hasArg("i") ? server.arg("i").toFloat() : targetAngles[1];
  float m = server.hasArg("m") ? server.arg("m").toFloat() : targetAngles[2];
  float r = server.hasArg("r") ? server.arg("r").toFloat() : targetAngles[3];
  float l = server.hasArg("l") ? server.arg("l").toFloat() : targetAngles[4];

  applyTargetAngles(t, i, m, r, l);
  server.send(200, "application/json", "{\"status\":\"ok\"}");
}

void handleHttpStatus() {
  String res = "{\"device\":\"ESP32_Robotic_Hand\",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
  server.send(200, "application/json", res);
}

// -----------------------------------------------------------------------------
// 6. SETUP
// -----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  pinMode(ONBOARD_LED, OUTPUT);
  digitalWrite(ONBOARD_LED, LOW);
  delay(500);

  Serial.println("\n==========================================");
  Serial.println("  ESP32 Anthropomorphic Robotic Hand Driver");
  Serial.println("==========================================");

  // Initialize PCA9685 I2C with timeout protection
  Wire.begin(21, 22);
  Wire.setTimeOut(100);
  pwm.begin();
  pwm.setPWMFreq(SERVO_FREQ);
  delay(100);

  // Gentle staggered startup: 1 finger every 100ms prevents current spikes
  Serial.println("[HW] Soft-starting servos (0° Open Hand)...");
  for (int ch = 0; ch < 5; ch++) {
    currentAngles[ch] = 0.0f;
    targetAngles[ch]  = 0.0f;
    writePhysicalServo(ch, 0.0f);
    delay(100);
  }

  // Connect to Local Wi-Fi
  Serial.printf("[WIFI] Connecting to: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(ONBOARD_LED, HIGH); // Solid blue LED = Connected!
    
    // Start local name resolver: allows using http://robotarm.local on your Mac!
    if (MDNS.begin("robotarm")) {
      Serial.println("\n[MDNS] Mac Domain Active: http://robotarm.local");
    }

    Serial.println("\n=======================================================");
    Serial.printf("  🎉 ESP32 IS ONLINE!\n");
    Serial.printf("  📍 IP Address:   http://%s\n", WiFi.localIP().toString().c_str());
    Serial.printf("  🍎 Mac Shortcut: http://robotarm.local\n");
    Serial.println("=======================================================");

    server.on("/set", handleHttpSet);
    server.on("/status", handleHttpStatus);
    server.begin();

    webSocket.begin(BACKEND_IP, BACKEND_PORT, BACKEND_WS);
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(3000);
  } else {
    Serial.println("\n[WIFI] Could not connect. Check SSID / Password.");
  }
}

// -----------------------------------------------------------------------------
// 7. MAIN LOOP
// -----------------------------------------------------------------------------
void loop() {
  webSocket.loop();
  server.handleClient();
  updateServoSmoothing();

  // ---------------------------------------------------------------------------
  // CONTINUOUS IP BROADCAST:
  // Prints the IP address in Serial Monitor every 5 seconds so you can always see it!
  // ---------------------------------------------------------------------------
  unsigned long now = millis();
  if (now - lastIpPrintMs >= 5000) {
    lastIpPrintMs = now;
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("-------------------------------------------------------");
      Serial.printf(">>> ESP32 IP: http://%s  (or http://robotarm.local) <<<\n", WiFi.localIP().toString().c_str());
      Serial.printf("👉 OPEN HAND:   http://%s/set?t=180&i=180&m=180&r=180&l=180\n", WiFi.localIP().toString().c_str());
      Serial.printf("👉 CLOSED FIST: http://%s/set?t=0&i=0&m=0&r=0&l=0\n", WiFi.localIP().toString().c_str());
      Serial.println("-------------------------------------------------------");
    } else {
      Serial.println("[WIFI] Reconnecting to Wi-Fi...");
      WiFi.reconnect();
    }
  }
}
