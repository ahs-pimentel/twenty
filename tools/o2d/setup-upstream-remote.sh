#!/usr/bin/env bash
# Configures the git remote for the Twenty upstream, reading the single
# source of truth in .o2d/upstream.json (doc 21). Idempotent.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
UPSTREAM_JSON="$REPO_ROOT/.o2d/upstream.json"

if [ ! -f "$UPSTREAM_JSON" ]; then
  echo "error: $UPSTREAM_JSON not found" >&2
  exit 1
fi

REMOTE_NAME="$(node -p "require('$UPSTREAM_JSON').remote.name")"
REMOTE_URL="$(node -p "require('$UPSTREAM_JSON').remote.url")"
BASE_COMMIT="$(node -p "require('$UPSTREAM_JSON').baseCommit")"

if git remote get-url "$REMOTE_NAME" > /dev/null 2>&1; then
  git remote set-url "$REMOTE_NAME" "$REMOTE_URL"
else
  git remote add "$REMOTE_NAME" "$REMOTE_URL"
fi

echo "remote '$REMOTE_NAME' -> $REMOTE_URL"
echo "declared base commit: $BASE_COMMIT"

if git cat-file -e "$BASE_COMMIT^{commit}" 2> /dev/null; then
  echo "base commit present in local history"
else
  echo "base commit not in local history — run: git fetch $REMOTE_NAME"
fi
