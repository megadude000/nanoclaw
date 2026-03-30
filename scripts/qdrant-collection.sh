#!/usr/bin/env bash
# Create cortex-entries collection and payload indexes in Qdrant.
# Idempotent: skips collection creation if it already exists.
# Payload index creation is inherently idempotent in Qdrant.

set -euo pipefail

QDRANT_URL="http://localhost:6333"
COLLECTION="cortex-entries"

# Wait for Qdrant to be healthy (up to 30s)
echo "Waiting for Qdrant to be ready..."
for i in $(seq 1 30); do
  if curl -sf "${QDRANT_URL}/healthz" >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Qdrant not reachable at ${QDRANT_URL} after 30s"
    exit 1
  fi
  sleep 1
done

# Step 1: Create collection (skip if exists)
if curl -sf "${QDRANT_URL}/collections/${COLLECTION}" >/dev/null 2>&1; then
  echo "Collection '${COLLECTION}' already exists -- skipping creation."
else
  echo "Creating collection '${COLLECTION}'..."
  curl -sf -X PUT "${QDRANT_URL}/collections/${COLLECTION}" \
    -H 'Content-Type: application/json' \
    -d '{
      "vectors": {
        "size": 1536,
        "distance": "Cosine"
      },
      "hnsw_config": {
        "m": 16,
        "ef_construct": 100
      },
      "optimizers_config": {
        "indexing_threshold": 100
      }
    }' >/dev/null
  echo "Collection '${COLLECTION}' created."
fi

# Step 2: Create payload indexes (idempotent -- re-creating is a no-op)
INDEXES=("project" "cortex_level" "domain" "status")

for field in "${INDEXES[@]}"; do
  echo "Ensuring payload index on '${field}'..."
  curl -sf -X PUT "${QDRANT_URL}/collections/${COLLECTION}/index" \
    -H 'Content-Type: application/json' \
    -d "{\"field_name\": \"${field}\", \"field_schema\": \"keyword\"}" >/dev/null
done

echo "Done. Collection '${COLLECTION}' ready with payload indexes: ${INDEXES[*]}"
