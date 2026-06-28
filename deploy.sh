#!/usr/bin/env bash
set -euo pipefail

IMAGE="byphil-site"
CONTAINER="byphil-site"
TARGET_BRANCH="main"

echo "==> Fetching updates from GitHub …"
# Downloads the remote state without trying to merge it yet
git fetch origin "$TARGET_BRANCH"

echo "==> Discarding local changes and force-updating code …"
# Clears your local changes to deploy.sh and locks onto GitHub's latest code
git reset --hard "origin/$TARGET_BRANCH"

echo "==> Building Docker image …"
docker build -t "$IMAGE" .

echo "==> Stopping & removing old container (if any) …"
docker rm -f "$CONTAINER" 2>/dev/null || true

echo "==> Starting container on your target port …"
docker run -d \
    --name "$CONTAINER" \
    --restart unless-stopped \
    -p 32769:80 \
    "$IMAGE"

echo ""
echo "✅ byphil.eu static site is live!"
echo "   Local:   http://127.0.0.1:32769"
echo ""
echo "   To stop:   docker stop $CONTAINER"
echo "   To remove: docker rm -f $CONTAINER"
echo "   To view logs: docker logs $CONTAINER"