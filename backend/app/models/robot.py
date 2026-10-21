"""Pydantic schemas and models for robot control, telemetry, and gestures."""
from typing import Dict, List, Optional, Literal
from pydantic import BaseModel, Field
import time


class ServoAngles(BaseModel):
    """Servo angles in degrees (0 to 180).
    Represents the 5 fingers of the anthropomorphic robotic hand:
    Thumb, Index, Middle, Ring, Little (Pinky).
    """
    thumb: float = Field(default=180.0, ge=0.0, le=180.0, description="Thumb servo angle (0=closed, 180=open)")
    index: float = Field(default=180.0, ge=0.0, le=180.0, description="Index finger servo angle (0=closed, 180=open)")
    middle: float = Field(default=180.0, ge=0.0, le=180.0, description="Middle finger servo angle (0=closed, 180=open)")
    ring: float = Field(default=180.0, ge=0.0, le=180.0, description="Ring finger servo angle (0=closed, 180=open)")
    little: float = Field(default=180.0, ge=0.0, le=180.0, description="Little/Pinky finger servo angle (0=closed, 180=open)")


class FingerStates(BaseModel):
    """Boolean extension state for each finger."""
    thumb: bool = False
    index: bool = False
    middle: bool = False
    ring: bool = False
    little: bool = False


class GesturePayload(BaseModel):
    """Payload representing a recognized gesture from computer vision."""
    gesture: str = Field(..., description="Recognized gesture name (e.g. OPEN_HAND, CLOSED_FIST, PINCH)")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score")
    fingers: Optional[FingerStates] = None
    timestamp: float = Field(default_factory=time.time, description="Unix epoch timestamp")


class RobotCommand(BaseModel):
    """Structured robot command mapped from a recognized gesture or manual input."""
    gesture: str = Field(..., description="Source gesture name")
    command: str = Field(..., description="Robotic action command (e.g. OPEN_ALL_FINGERS, PINCH_GRIP)")
    servos: ServoAngles = Field(..., description="Target servo angles for 5 fingers")
    timestamp: float = Field(default_factory=time.time, description="Timestamp in seconds or milliseconds")
    client_id: Optional[str] = Field(default=None, description="Sender identifier (Phone A, Web, etc.)")


class RobotState(BaseModel):
    """Current state of the robotic arm controller and simulator."""
    mode: Literal["SIMULATION", "ESP32_CONNECTED"] = "SIMULATION"
    servos: ServoAngles = Field(default_factory=ServoAngles)
    last_command: Optional[str] = "OPEN_ALL_FINGERS"
    last_gesture: Optional[str] = "OPEN_HAND"
    is_connected: bool = True
    hardware_target: str = "PCA9685 / MG90S (Simulated)"
    updated_at: float = Field(default_factory=time.time)


class MotionFrame(BaseModel):
    """A single frame in a motion recording sequence."""
    timestamp_offset_ms: int = Field(..., description="Milliseconds since recording start")
    gesture: str
    servos: ServoAngles


class MotionSequence(BaseModel):
    """Sequence of recorded motion frames for automated replay."""
    id: Optional[str] = None
    name: str = "Recorded Routine"
    total_duration_ms: int = 0
    frames: List[MotionFrame] = []
