"""Main FastAPI application entry point for the Anthropomorphic Robotic Arm."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.auth import router as auth_router
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.robot.simulator import SimulatedRobotController
from app.websocket.manager import RobotTelemetryManager, WebRTCSignalingManager

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("robot.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Anthropomorphic Robotic Arm Controller Backend...")
    controller = SimulatedRobotController()
    await controller.connect()
    await connect_to_mongo()

    app.state.robot_controller = controller
    app.state.telemetry_manager = RobotTelemetryManager(controller)
    app.state.signaling_manager = WebRTCSignalingManager()

    logger.info("Robotic Arm Simulator initialized in SIMULATION mode.")
    logger.info("WebRTC Signaling service ready.")
    yield
    # Shutdown
    logger.info("Shutting down Robotic Arm Controller Backend...")
    await controller.disconnect()
    await close_mongo_connection()


app = FastAPI(
    title="AI-Enabled Vision-Based Anthropomorphic Robotic Arm API",
    description="FastAPI Backend for real-time WebRTC signaling, MongoDB persistence, and robotic arm servo command pipeline.",
    version="1.1.0",
    lifespan=lifespan
)

# Enable CORS for all origins so mobile devices on LAN can connect freely
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register REST & Auth routes
app.include_router(router)
app.include_router(auth_router)


# WebSocket: Real-time Robot Telemetry and Command pipeline
@app.websocket("/ws/robot")
async def websocket_robot_endpoint(websocket: WebSocket):
    telemetry_mgr: RobotTelemetryManager = app.state.telemetry_manager
    await telemetry_mgr.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            await telemetry_mgr.handle_client_message(websocket, data)
    except WebSocketDisconnect:
        telemetry_mgr.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error in /ws/robot: {e}")
        telemetry_mgr.disconnect(websocket)


# WebSocket: WebRTC Signaling for 2-phone video calls
@app.websocket("/ws/signaling/{room_id}")
async def websocket_signaling_endpoint(websocket: WebSocket, room_id: str):
    signaling_mgr: WebRTCSignalingManager = app.state.signaling_manager
    await signaling_mgr.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Forward signaling messages (offer, answer, candidate) to the other peer in room
            await signaling_mgr.broadcast_to_room(room_id, data, sender=websocket)
    except WebSocketDisconnect:
        signaling_mgr.disconnect(websocket, room_id)
    except Exception as e:
        logger.error(f"Error in /ws/signaling/{room_id}: {e}")
        signaling_mgr.disconnect(websocket, room_id)


if __name__ == "__main__":
    import uvicorn
    # Bind to 0.0.0.0 so external mobile phones on the same Wi-Fi network can connect
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
