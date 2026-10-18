"""Simulated robot controller implementation for Review 2 software prototype."""
import time
from typing import List, Dict, Any
from app.models.robot import RobotCommand, RobotState, ServoAngles
from app.robot.controller import RobotController


class SimulatedRobotController(RobotController):
    """In-memory simulated controller representing the anthropomorphic robotic hand.
    Maintains servo states, executes gesture-mapped commands, and logs command history.
    """

    def __init__(self):
        self._servos = ServoAngles(thumb=0.0, index=0.0, middle=0.0, ring=0.0, little=0.0)
        self._last_command = "OPEN_ALL_FINGERS"
        self._last_gesture = "OPEN_HAND"
        self._is_connected = True
        self._history: List[Dict[str, Any]] = []
        self._max_history = 100

    async def connect(self) -> bool:
        self._is_connected = True
        return True

    async def disconnect(self) -> None:
        self._is_connected = False

    async def send_command(self, cmd: RobotCommand) -> RobotState:
        """Process incoming robot command and update simulated servos."""
        self._servos = cmd.servos
        self._last_command = cmd.command
        self._last_gesture = cmd.gesture

        # Append to history
        self._history.insert(0, {
            "timestamp": time.time(),
            "gesture": cmd.gesture,
            "command": cmd.command,
            "servos": cmd.servos.model_dump(),
            "client_id": cmd.client_id or "UNKNOWN"
        })
        if len(self._history) > self._max_history:
            self._history.pop()

        return self.get_state()

    async def set_servos(self, servos: ServoAngles, source_name: str = "MANUAL") -> RobotState:
        """Set individual or all servos directly (e.g. manual slider calibration)."""
        self._servos = servos
        self._last_command = f"MANUAL_ADJUST ({source_name})"
        self._last_gesture = "MANUAL"

        self._history.insert(0, {
            "timestamp": time.time(),
            "gesture": "MANUAL",
            "command": self._last_command,
            "servos": servos.model_dump(),
            "client_id": source_name
        })
        if len(self._history) > self._max_history:
            self._history.pop()

        return self.get_state()

    def get_state(self) -> RobotState:
        """Return the current robot state."""
        return RobotState(
            mode="SIMULATION",
            servos=self._servos,
            last_command=self._last_command,
            last_gesture=self._last_gesture,
            is_connected=self._is_connected,
            hardware_target="PCA9685 / MG90S (Software Simulation)",
            updated_at=time.time()
        )

    def get_history(self) -> List[Dict[str, Any]]:
        return self._history

    def clear_history(self) -> None:
        self._history.clear()
