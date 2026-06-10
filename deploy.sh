#!/usr/bin/env bash
set -euo pipefail

IMAGE="byphil-site"
CONTAINER="byphil-site"

echo "==> Building Docker image …"
docker build -t "$IMAGE" .

echo "==> Stopping & removing old container (if any) …"
docker rm -f "$CONTAINER" 2>/dev/null || true

echo "==> Starting container on a random host port …"
docker run -d \
    --name "$CONTAINER" \
    --restart unless-stopped \
    -p 0:80 \
    "$IMAGE"

# Retrieve the randomly assigned host port
HOST_PORT=$(docker port "$CONTAINER" 80 | head -1 | sed 's/.*://')

echo ""
echo "✅ byphil.eu static site is live!"
echo "   Local:   http://localhost:$HOST_PORT"
echo ""
echo "   To stop:   docker stop $CONTAINER"
echo "   To remove: docker rm -f $CONTAINER"
echo "   To view logs: docker logs $CONTAINER"