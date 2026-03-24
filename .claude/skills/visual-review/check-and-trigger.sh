#!/bin/bash
# Hook trigger for visual review — runs after HTML file edits
# Called by Claude Code's PostToolUse hook when Edit/Write targets *.html
#
# Usage: bash check-and-trigger.sh <edited-file-path>
#
# Behavior:
#   1. Checks if the edited file is in solution/portals/ or site/
#   2. Checks if a preview server is running on port 8080
#   3. If both conditions met, runs diff-to-manifest.py
#   4. Prints a summary of detected changes
#
# This hook is lightweight (<2s). Screenshots + JIRA upload are separate.

set -euo pipefail

FILE_PATH="${1:-}"
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

# Only trigger for HTML files in portal or site directories
if [[ ! "$FILE_PATH" =~ \.(html|htm)$ ]]; then
  exit 0
fi

if [[ ! "$FILE_PATH" =~ solution/portals/ ]] && [[ ! "$FILE_PATH" =~ /site/ ]]; then
  exit 0
fi

# Check if preview server is running
if ! curl -s -o /dev/null -w "" "http://localhost:8080" 2>/dev/null; then
  echo "[visual-review] Preview server not running on port 8080. Skipping auto-diff."
  exit 0
fi

# Determine before/after directories
# Before = last committed version (via git show)
# After = current working tree
FILENAME=$(basename "$FILE_PATH")
RELATIVE_DIR=$(dirname "$FILE_PATH" | sed "s|$PROJECT_ROOT/||")

# Check if file has uncommitted changes
cd "$PROJECT_ROOT"
if git diff --quiet -- "$FILE_PATH" 2>/dev/null; then
  # No changes — nothing to diff
  exit 0
fi

echo "[visual-review] HTML change detected in $FILE_PATH"
echo "[visual-review] Run diff-to-manifest.py to generate review manifest:"
echo ""
echo "  python3 $SKILL_DIR/diff-to-manifest.py \\"
echo "    --before $RELATIVE_DIR --after $RELATIVE_DIR \\"
echo "    --file $FILENAME --port 8080 \\"
echo "    --output review-manifest.json"
echo ""
echo "[visual-review] Then run: python3 $SKILL_DIR/generate-review.py review-manifest.json visual-review.html"
echo "[visual-review] For screenshots: python3 $SKILL_DIR/auto-screenshot.py --manifest review-manifest.json"
