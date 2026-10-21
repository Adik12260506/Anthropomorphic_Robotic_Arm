"""WebSocket managers for WebRTC signaling and real-time robot command telemetry."""
import json
import logging
import time
from typing import Dict, Set, Any
from fastapi import WebSocket, WebSocketDisconnect
from app.models.robot import RobotCommand, RobotState
from app.robot.simulator import SimulatedRobotController

logger = logging.getLogger("websocket.manager")


class RobotTelemetryManager:
    """Manages real-time robot command subscriptions and state broadcasts."""

    def __init__(self, controller: SimulatedRobotController):
        self.controller = controller
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        # Send initial state snapshot
        state = self.controller.get_state()
        await websocket.send_json({
            "type": "state_update",
            "state": state.model_dump(),
            "timestamp": time.time()
        })

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast_state(self, state: RobotState):
        """Broadcast state to all connected telemetry clients."""
        payload = {
            "type": "state_update",
            "state": state.model_dump(),
            "timestamp": time.time()
        }
        dead_sockets = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(payload)
            except Exception:
                dead_sockets.append(connection)
        for dead in dead_sockets:
            self.disconnect(dead)

    async def handle_client_message(self, websocket: WebSocket, data: Dict[str, Any]):
        msg_type = data.get("type", "command")

        if msg_type == "ping":
            # Echo ping for real-time roundtrip latency calculation
            await websocket.send_json({
                "type": "pong",
                "client_time": data.get("client_time", 0),
                "server_time": time.time() * 1000
            })
            return

        if msg_type == "esp32_handshake":
            logger.info("ESP32 Hardware Connected via WebSocket!")
            await websocket.send_json({
                "type": "handshake_ack",
                "status": "connected",
                "device": data.get("device", "ESP32"),
                "timestamp": time.time()
            })
            return

        if msg_type == "command" or "command" in data:
            # Parse command
            try:
                cmd = RobotCommand(
                    gesture=data.get("gesture", "UNKNOWN"),
                    command=data.get("command", "IDLE"),
                    servos=data.get("servos", {}),
                    timestamp=data.get("timestamp", time.time()),
                    client_id=data.get("client_id", "web-client")
                )
                updated_state = await self.controller.send_command(cmd)
                # Acknowledge sender
                await websocket.send_json({
                    "type": "ack",
                    "status": "accepted",
                    "gesture": cmd.gesture,
                    "command": cmd.command,
                    "timestamp": time.time()
                })
                # Broadcast updated state
                await self.broadcast_state(updated_state)
            except Exception as e:
                logger.error(f"Error processing command: {e}")
                await websocket.send_json({
                    "type": "error",
                    "message": str(e)
                })


class WebRTCSignalingManager:
    """Room-based WebRTC signaling manager for 2-phone video calls.
    Facilitates SDP offer/answer exchange and ICE candidates between Phone A and Phone B.
    """

    def __init__(self):
        # room_id -> set of WebSockets
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(websocket)

        peer_count = len(self.rooms[room_id])
        logger.info(f"Client joined room '{room_id}' (peers: {peer_count})")

        # Notify peers in room about updated peer count
        await self.broadcast_to_room(room_id, {
            "type": "room_state",
            "room_id": room_id,
            "peer_count": peer_count,
            "message": f"Peer joined. Total peers: {peer_count}"
        })

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.rooms:
            self.rooms[room_id].discard(websocket)
            peer_count = len(self.rooms[room_id])
            logger.info(f"Client left room '{room_id}' (peers: {peer_count})")
            if peer_count == 0:
                del self.rooms[room_id]
            else:
                # Inform remaining peer
                pass

    async def broadcast_to_room(self, room_id: str, message: Dict[str, Any], sender: WebSocket = None):
        """Send message to other peers in the room."""
        if room_id not in self.rooms:
            return

        dead_sockets = []
        for conn in list(self.rooms[room_id]):
            if conn != sender:
                try:
                    await conn.send_json(message)
                except Exception:
                    dead_sockets.append(conn)

        for dead in dead_sockets:
            self.disconnect(dead, room_id)
