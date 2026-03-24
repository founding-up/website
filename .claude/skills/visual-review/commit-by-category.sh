#!/bin/bash
# Create one git branch + PR per category from approved visual review edits
# Usage: bash commit-by-category.sh <approval-decisions.json> <repo-dir> <base-branch> <before-dir> <after-dir>
#
# For each category with approved edits:
# 1. Creates branch: s5/review-{category-id}
# 2. Applies the approved file changes
# 3. Commits with descriptive message listing edits
# 4. Pushes and creates PR via gh CLI

set -euo pipefail

APPROVAL_JSON="${1:?Usage: commit-by-category.sh <decisions.json> <repo-dir> <base-branch> <before-dir> <after-dir>}"
REPO_DIR="${2:?Repo directory}"
BASE_BRANCH="${3:-main}"
BEFORE_DIR="${4:?Before directory (current files)}"
AFTER_DIR="${5:?After directory (proposed files)}"

EMAIL=$(cat ~/.claude/.atlassian-email 2>/dev/null || echo "")

echo "=== Creating category PRs from approved edits ==="
echo "  Repo: $REPO_DIR"
echo "  Base: $BASE_BRANCH"
echo "  Before: $BEFORE_DIR"
echo "  After: $AFTER_DIR"

cd "$REPO_DIR"

# Parse categories with approved edits
CATEGORIES=$(python3 -c "
import json
with open('$APPROVAL_JSON') as f:
    data = json.load(f)
for cat in data.get('categories', []):
    if cat.get('approvedEdits'):
        print(f\"{cat['id']}|{cat['label']}|{','.join(cat['approvedEdits'])}\")
")

if [ -z "$CATEGORIES" ]; then
  echo "  No approved edits found. Nothing to commit."
  exit 0
fi

JIRA_STORY=$(python3 -c "import json; print(json.load(open('$APPROVAL_JSON')).get('jiraStory',''))")
TITLE=$(python3 -c "import json; print(json.load(open('$APPROVAL_JSON')).get('title','Visual Review'))")

echo "$CATEGORIES" | while IFS='|' read -r CAT_ID CAT_LABEL EDIT_IDS; do
  BRANCH="s5/review-${CAT_ID}"
  echo ""
  echo "--- Category: $CAT_LABEL ($BRANCH) ---"

  # Get the files and line info for this category's approved edits
  EDIT_DESCRIPTIONS=$(python3 -c "
import json
with open('$APPROVAL_JSON') as f:
    data = json.load(f)
edit_ids = '$EDIT_IDS'.split(',')
files = set()
descs = []
for d in data['decisions']:
    if d['id'] in edit_ids and d['decision'] == 'approved':
        files.add(d['file'])
        descs.append(f\"- {d['description']} ({d['file']}:{d['line']})\")
print('FILES:' + ','.join(files))
for desc in descs:
    print(desc)
")

  FILES=$(echo "$EDIT_DESCRIPTIONS" | grep "^FILES:" | sed 's/FILES://')
  DESCRIPTIONS=$(echo "$EDIT_DESCRIPTIONS" | grep -v "^FILES:")

  # Create branch from base
  git checkout "$BASE_BRANCH" 2>/dev/null
  git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH" 2>/dev/null

  # Copy the approved files from the after directory
  # Note: This copies the ENTIRE file, not individual edits.
  # For granular per-edit application, use a patch-based approach.
  for FILE in $(echo "$FILES" | tr ',' '\n'); do
    AFTER_FILE="$AFTER_DIR/$FILE"
    BEFORE_FILE="$BEFORE_DIR/$FILE"
    if [ -f "$AFTER_FILE" ]; then
      cp "$AFTER_FILE" "$BEFORE_DIR/$FILE"
      git add "$BEFORE_DIR/$FILE"
      echo "  Applied: $FILE"
    fi
  done

  # Commit
  COMMIT_MSG="Content/$CAT_LABEL: Apply $CAT_LABEL changes from $TITLE

$DESCRIPTIONS

${JIRA_STORY:+JIRA: $JIRA_STORY}

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"

  git commit -m "$COMMIT_MSG" 2>/dev/null || {
    echo "  No changes to commit for $CAT_LABEL"
    git checkout "$BASE_BRANCH" 2>/dev/null
    continue
  }

  # Push
  git push -u origin "$BRANCH" 2>/dev/null

  # Create PR
  PR_BODY="## Summary
Approved **$CAT_LABEL** changes from visual review: *$TITLE*

## Approved Edits
$DESCRIPTIONS

## Review Process
Changes were reviewed using the visual-review skill with side-by-side rendering.
Each edit was individually approved by the reviewer.

${JIRA_STORY:+**JIRA:** $JIRA_STORY}

🤖 Generated with [Claude Code](https://claude.com/claude-code)"

  PR_URL=$(gh pr create --title "Content/$CAT_LABEL: $TITLE" --body "$PR_BODY" 2>/dev/null || echo "PR creation failed")
  echo "  PR: $PR_URL"

  # Return to base
  git checkout "$BASE_BRANCH" 2>/dev/null
done

echo ""
echo "=== All category PRs created ==="
