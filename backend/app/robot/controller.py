"""Abstract base class for robot arm controllers."""
from abc import ABC, abstractmethod
from typing import Optional
from app.models.robot import RobotCommand, RobotState, ServoAngles


class RobotController(ABC):
    """Abstract RobotController interface.
    Defines the contract for sending commands, reading telemetry, and managing
    hardware or simulated connections to the anthropomorphic robotic hand.
    """

    @abstractmethod
    async def connect(self) -> bool:
        """Initialize connection to the controller/hardware."""
        pass

    @abstractmethod
    async def disconnect(self) -> None:
        """Gracefully close connection."""
        pass

    @abstractmethod
    async def send_command(self, cmd: RobotCommand) -> RobotState:
        """Execute a robot command and return updated state."""
        pass

    @abstractmethod
    async def set_servos(self, servos: ServoAngles, source_name: str = "MANUAL") -> RobotState:
        """Directly adjust servo angles."""
        pass

    @abstractmethod
    def get_state(self) -> RobotState:
        """Return the current robot state snapshot."""
        pass
