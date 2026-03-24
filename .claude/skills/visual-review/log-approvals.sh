#!/bin/bash
# Log visual review approval decisions to JIRA
# Usage: bash log-approvals.sh <approval-decisions.json> <jira-story-key>
#
# Reads the exported approval JSON from the visual review tool and:
# - Adds a comment to the JIRA story summarizing all decisions
# - Groups by category for readability

set -euo pipefail

APPROVAL_JSON="${1:?Usage: log-approvals.sh <approval-decisions.json> <jira-story-key>}"
JIRA_STORY="${2:?Usage: log-approvals.sh <approval-decisions.json> <jira-story-key>}"

# Load Atlassian credentials
EMAIL=$(cat ~/.claude/.atlassian-email)
TOKEN=$(cat ~/.claude/.atlassian-token)
BASE="https://foundingup-dan.atlassian.net"

echo "=== Logging approvals to JIRA ==="
echo "  Story: $JIRA_STORY"
echo "  Decisions: $APPROVAL_JSON"

# Build the comment body from the JSON
COMMENT=$(python3 -c "
import json, sys

with open('$APPROVAL_JSON') as f:
    data = json.load(f)

lines = []
lines.append('h3. Visual Review Results')
lines.append(f\"*{data['title']}*\")
lines.append(f\"Exported: {data['exportedAt']}\")
lines.append('')

s = data['summary']
lines.append(f\"|| Approved | {s['approved']} ||  Rejected | {s['rejected']} || Pending | {s['pending']} || Total | {s['total']} ||\")
lines.append('')

for cat in data.get('categories', []):
    approved = cat.get('approvedEdits', [])
    rejected = cat.get('rejectedEdits', [])
    if not approved and not rejected:
        continue
    lines.append(f\"h4. {cat['label']}\")
    for eid in approved:
        d = next((x for x in data['decisions'] if x['id'] == eid), None)
        if d:
            lines.append(f\"(/) *Approved:* {d['description']} ({d['file']}:{d['line']})\")
    for eid in rejected:
        d = next((x for x in data['decisions'] if x['id'] == eid), None)
        if d:
            lines.append(f\"(x) *Rejected:* {d['description']} ({d['file']}:{d['line']})\")
    lines.append('')

print('\n'.join(lines))
")

# Post comment to JIRA
PAYLOAD=$(python3 -c "
import json
comment = '''$COMMENT'''
body = {
    'body': {
        'type': 'doc',
        'version': 1,
        'content': [{'type': 'paragraph', 'content': [{'type': 'text', 'text': comment}]}]
    }
}
print(json.dumps(body))
")

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -u "$EMAIL:$TOKEN" \
  -H "Content-Type: application/json" \
  -X POST \
  -d "$PAYLOAD" \
  "$BASE/rest/api/3/issue/$JIRA_STORY/comment")

STATUS=$(echo "$RESPONSE" | tail -1)
if [[ "$STATUS" == "201" ]]; then
  echo "  Comment posted to $JIRA_STORY"
else
  echo "  FAILED to post comment (HTTP $STATUS)"
  echo "$RESPONSE" | head -5
fi

echo "=== Done ==="
