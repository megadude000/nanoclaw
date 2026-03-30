#!/usr/bin/env bash
# Qdrant Vector Database setup for NanoClaw Cortex
# Pulls and runs qdrant/qdrant as a Docker container with persistent storage.
# Idempotent: safe to run multiple times.

set -euo pipefail

CONTAINER_NAME="nanoclaw-qdrant"
IMAGE="qdrant/qdrant:latest"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${PROJECT_DIR}/data/qdrant"

# Ensure data directory exists
mkdir -p "$DATA_DIR"

# Check if container already exists
EXISTING=$(docker ps -a --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}' 2>/dev/null || true)

if [ -n "$EXISTING" ]; then
  # Container exists -- check if running
  RUNNING=$(docker ps --filter "name=^${CONTAINER_NAME}$" --format '{{.Names}}' 2>/dev/null || true)
  if [ -n "$RUNNING" ]; then
    echo "Qdrant container '${CONTAINER_NAME}' is already running."
    exit 0
  else
    echo "Starting stopped Qdrant container '${CONTAINER_NAME}'..."
    docker start "$CONTAINER_NAME"
    exit 0
  fi
fi

# Pull image if not present
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "Pulling ${IMAGE}..."
  docker pull "$IMAGE"
fi

echo "Creating and starting Qdrant container '${CONTAINER_NAME}'..."
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart=unless-stopped \
  -v "${DATA_DIR}:/qdrant/storage:z" \
  -p 127.0.0.1:6333:6333 \
  -p 127.0.0.1:6334:6334 \
  "$IMAGE"

echo "Qdrant container '${CONTAINER_NAME}' started."
