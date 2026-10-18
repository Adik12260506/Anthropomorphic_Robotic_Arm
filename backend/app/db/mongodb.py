"""MongoDB database connection and collection managers using Motor (async pymongo)."""
import os
import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger("robot.db")

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "robotic_arm")

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None
is_connected: bool = False


async def connect_to_mongo():
    """Initialize MongoDB connection pool on FastAPI startup."""
    global client, db, is_connected
    try:
        logger.info(f"Connecting to MongoDB at {MONGODB_URI.split('@')[-1]} (db: {MONGODB_DB_NAME})...")
        client = AsyncIOMotorClient(
            MONGODB_URI,
            serverSelectionTimeoutMS=3000,
            connectTimeoutMS=3000
        )
        db = client[MONGODB_DB_NAME]
        # Quick ping to verify connection
        await client.admin.command('ping')
        is_connected = True
        logger.info("✅ Connected to MongoDB successfully!")

        # Ensure indexes
        await db.users.create_index("google_id", unique=True, sparse=True)
        await db.users.create_index("email", unique=True)
    except Exception as e:
        is_connected = False
        logger.warning(
            f"⚠️ MongoDB connection not available: {e}. "
            "Backend will operate in in-memory mode until MONGODB_URI is provided."
        )


async def close_mongo_connection():
    """Close MongoDB connection pool on FastAPI shutdown."""
    global client, is_connected
    if client:
        logger.info("Closing MongoDB connection pool...")
        client.close()
        is_connected = False


def get_database() -> Optional[AsyncIOMotorDatabase]:
    return db


def get_is_connected() -> bool:
    return is_connected
