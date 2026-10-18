"""REST API router for robot control, gesture ingestion, and network discovery."""
import socket
import time
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request
from app.models.robot import RobotCommand, RobotState, ServoAngles, GesturePayload
from app.robot.simulator import SimulatedRobotController

router = APIRouter()


def get_local_ip() -> str:
    """Detect LAN IP address to display to the user for connecting phones."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Doesn't actually send packet, just determines routing interface
        s.connect(('8.8.8.8', 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip


@router.get("/health")
def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": "Anthropomorphic Robotic Arm Controller",
        "timestamp": time.time(),
        "local_ip": get_local_ip()
    }


@router.get("/api/status")
def system_status(request: Request):
    """Overall status including robot controller and network info."""
    controller: SimulatedRobotController = request.app.state.robot_controller
    telemetry_mgr = request.app.state.telemetry_manager
    signaling_mgr = request.app.state.signaling_manager

    return {
        "status": "online",
        "mode": "SIMULATION",
        "active_rooms": len(signaling_mgr.rooms),
        "telemetry_subscribers": len(telemetry_mgr.active_connections),
        "robot_state": controller.get_state().model_dump(),
        "local_ip": get_local_ip(),
        "esp32_status": "SIMULATION_MODE",
        "hardware_ready": True
    }


@router.get("/api/network/info")
def network_info():
    """Returns local LAN IP and recommended mobile connection URLs."""
    local_ip = get_local_ip()
    return {
        "local_ip": local_ip,
        "frontend_mobile_url": f"http://{local_ip}:5173",
        "backend_api_url": f"http://{local_ip}:8000",
        "backend_ws_robot": f"ws://{local_ip}:8000/ws/robot",
        "backend_ws_signal": f"ws://{local_ip}:8000/ws/signaling"
    }


@router.get("/api/robot/state", response_model=RobotState)
def get_robot_state(request: Request):
    """Retrieve current servo angles and robot state."""
    controller: SimulatedRobotController = request.app.state.robot_controller
    return controller.get_state()


@router.post("/api/gesture")
async def receive_gesture(payload: GesturePayload, request: Request):
    """Ingest recognized gesture and acknowledge receipt."""
    return {
        "status": "received",
        "gesture": payload.gesture,
        "confidence": payload.confidence,
        "timestamp": payload.timestamp
    }


@router.post("/api/robot/command")
async def send_robot_command(cmd: RobotCommand, request: Request):
    """Execute a structured robot command and broadcast update."""
    controller: SimulatedRobotController = request.app.state.robot_controller
    telemetry_mgr = request.app.state.telemetry_manager

    updated_state = await controller.send_command(cmd)
    await telemetry_mgr.broadcast_state(updated_state)

    return {
        "status": "accepted",
        "message": "Robot command executed successfully",
        "gesture": cmd.gesture,
        "command": cmd.command,
        "servos": updated_state.servos.model_dump(),
        "timestamp": time.time()
    }


@router.post("/api/robot/manual")
async def manual_servo_adjust(servos: ServoAngles, request: Request):
    """Manually override servo angles (for calibration or evaluation)."""
    controller: SimulatedRobotController = request.app.state.robot_controller
    telemetry_mgr = request.app.state.telemetry_manager

    updated_state = await controller.set_servos(servos, source_name="MANUAL_API")
    await telemetry_mgr.broadcast_state(updated_state)

    return {
        "status": "accepted",
        "servos": updated_state.servos.model_dump(),
        "updated_at": updated_state.updated_at
    }


@router.get("/api/robot/history")
def get_command_history(request: Request):
    """Retrieve the recent command and gesture history."""
    controller: SimulatedRobotController = request.app.state.robot_controller
    return {
        "count": len(controller.get_history()),
        "history": controller.get_history()
    }


@router.post("/api/robot/history/clear")
def clear_command_history(request: Request):
    """Clear recorded command history."""
    controller: SimulatedRobotController = request.app.state.robot_controller
    controller.clear_history()
    return {"status": "cleared"}
