#!/usr/bin/env python3
"""
Utility to transmit recorded motion routines (JSON) to the Anthropomorphic Robotic Arm
via FastAPI backend WebSocket/REST or directly to ESP32 over Wi-Fi.

Usage:
    python transmit_routine.py --file <path_to_routine.json> --backend http://localhost:8000
    python transmit_routine.py --file <path_to_routine.json> --esp32 http://192.168.1.150
"""

import sys
import time
import json
import argparse
import urllib.request
import urllib.parse


def transmit_to_backend(routine: dict, backend_url: str):
    endpoint = f"{backend_url.rstrip('/')}/api/robot/command"
    frames = routine.get("frames", [])
    if not frames:
        print("[!] No frames found in sequence.")
        return

    print(f"[*] Streaming {len(frames)} frames to FastAPI Backend: {endpoint}")
    start_time = time.time()

    for idx, frame in enumerate(frames):
        target_offset_s = frame.get("timestamp_offset_ms", 0) / 1000.0
        elapsed = time.time() - start_time
        if target_offset_s > elapsed:
            time.sleep(target_offset_s - elapsed)

        payload = {
            "gesture": frame.get("gesture", "RECORDED_REPLAY"),
            "command": "ROUTINE_PLAYBACK",
            "servos": frame.get("servos", {}),
            "timestamp": time.time(),
            "client_id": "Python-Routine-Transmitter"
        }

        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            with urllib.request.urlopen(req, timeout=2) as resp:
                pass
            s = frame.get("servos", {})
            print(f"[{idx+1}/{len(frames)}] Offset {frame.get('timestamp_offset_ms')}ms -> "
                  f"T:{s.get('thumb')} I:{s.get('index')} M:{s.get('middle')} R:{s.get('ring')} L:{s.get('little')}")
        except Exception as e:
            print(f"[!] Error transmitting frame {idx+1}: {e}")

    print("[✓] Routine playback completed successfully!")


def transmit_to_esp32_direct(routine: dict, esp32_url: str):
    base = esp32_url.rstrip('/')
    frames = routine.get("frames", [])
    if not frames:
        print("[!] No frames found in sequence.")
        return

    print(f"[*] Streaming {len(frames)} frames directly to ESP32: {base}")
    start_time = time.time()

    for idx, frame in enumerate(frames):
        target_offset_s = frame.get("timestamp_offset_ms", 0) / 1000.0
        elapsed = time.time() - start_time
        if target_offset_s > elapsed:
            time.sleep(target_offset_s - elapsed)

        s = frame.get("servos", {})
        params = urllib.parse.urlencode({
            "t": s.get("thumb", 0),
            "i": s.get("index", 0),
            "m": s.get("middle", 0),
            "r": s.get("ring", 0),
            "l": s.get("little", 0)
        })
        url = f"{base}/set?{params}"
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                pass
            print(f"[{idx+1}/{len(frames)}] Sent to ESP32: {params}")
        except Exception as e:
            print(f"[!] Frame {idx+1} failed: {e}")

    print("[✓] Direct ESP32 playback completed successfully!")


def main():
    parser = argparse.ArgumentParser(description="Transmit recorded motion routine to ESP32")
    parser.add_argument("--file", "-f", required=True, help="Path to exported routine JSON file")
    parser.add_argument("--backend", "-b", default="http://localhost:8000", help="FastAPI backend URL")
    parser.add_argument("--esp32", "-e", help="Direct ESP32 IP address (e.g. http://192.168.1.150)")

    args = parser.parse_args()

    try:
        with open(args.file, "r") as f:
            routine = json.load(f)
    except Exception as e:
        print(f"[!] Failed to read file {args.file}: {e}")
        sys.exit(1)

    if args.esp32:
        transmit_to_esp32_direct(routine, args.esp32)
    else:
        transmit_to_backend(routine, args.backend)


if __name__ == "__main__":
    main()
