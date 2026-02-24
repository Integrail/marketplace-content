#!/usr/bin/env bash
# FILE: pre-commit.sh
#
# Squash all local commits on current branch into ONE commit (local only),
# then open an editor to set the final commit message, then commit.
#
# Default message is the list of squashed commit subjects.
#
# Notes:
# - This rewrites local history (uses soft reset). Do NOT use if you already pushed.
# - Works from anywhere inside the repo.

set -euo pipefail

# -----------------------------
# Config
# -----------------------------
# Use an array so args work correctly (no eval).
# TextMate must use -w to block until the file is closed/saved.
COMMIT_EDITOR_CMD=(mate -w)
# Fallback option if you want:
# COMMIT_EDITOR_CMD=("${COMMIT_EDITOR_CMD[@]:-${EDITOR:-vi}}")

# -----------------------------
# Helpers
# -----------------------------
die() { echo "[pre-commit] ERROR: $*" >&2; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"; }

need_cmd git
need_cmd "${COMMIT_EDITOR_CMD[0]}"

# Find repo root
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || die "Not a git repository"
cd "$REPO_ROOT"

# Ensure clean enough state for a rewrite
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "Working tree has uncommitted changes. Commit/stash first."
fi

# Ensure branch has an upstream (needed for safe base calculation)
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || true)"
if [[ -z "$UPSTREAM" ]]; then
  die "No upstream configured for this branch. Set it first (git branch --set-upstream-to ...)."
fi

# Ensure we have commits to squash
BASE="$(git merge-base HEAD "$UPSTREAM")"
COUNT="$(git rev-list --count "${BASE}..HEAD")"

if [[ "$COUNT" -le 0 ]]; then
  die "No local commits to squash (HEAD is at upstream)."
fi

echo "[pre-commit] Repo: $REPO_ROOT"
echo "[pre-commit] Upstream: $UPSTREAM"
echo "[pre-commit] Local commits to squash: $COUNT"

# Build default message: list commit subjects (oldest -> newest)
DEFAULT_MSG="$(git log --format='%s' --reverse "${BASE}..HEAD")"

TMP_MSG_FILE="$(mktemp -t precommit_msg.XXXXXX)"
cleanup() { rm -f "$TMP_MSG_FILE"; }
trap cleanup EXIT

{
  echo "# Squashed commit message (edit below)."
  echo "#"
  echo "# Commits being squashed (oldest -> newest):"
  echo "#"
  while IFS= read -r line; do
    echo "# - $line"
  done <<< "$DEFAULT_MSG"
  echo
  echo "Squash: $COUNT commits"
  echo
  echo "$DEFAULT_MSG"
} > "$TMP_MSG_FILE"

# Soft reset back to base (keeps changes staged as a single combined diff)
git reset --soft "$BASE"

# Open editor for commit message (blocks)
"${COMMIT_EDITOR_CMD[@]}" "$TMP_MSG_FILE"

# If message file is empty or only comments, abort
FINAL_MSG="$(grep -v '^\s*#' "$TMP_MSG_FILE" | sed '/^\s*$/d' || true)"
if [[ -z "$FINAL_MSG" ]]; then
  die "Empty commit message. Aborting (your changes are still staged)."
fi

# Create the squashed commit
git commit -F "$TMP_MSG_FILE"

echo "[pre-commit] Done. Local history rewritten into one commit."
echo "[pre-commit] NOTE: If you had previously pushed these commits, you will need to force-push."