---
name: visual-review
description: >
  Create side-by-side visual comparisons of HTML/website changes with approve/reject
  workflow per change. Use when reviewing design changes, content edits, framework
  updates, or any HTML modifications that need human validation before merging.
  Triggers on: "review changes", "compare versions", "visual diff", "approve edits",
  "side-by-side comparison", "validate changes", "review before merge".
  Generates categorized PRs from approved changes and logs decisions to JIRA.
tools: Read, Glob, Grep, Bash, Edit, Write
---

# Visual Review Skill

## Purpose
Provide a visual, interactive review workflow for HTML/website changes where:
1. Changes are highlighted on the actual rendered page with red rings
2. Each change is individually approved/rejected by a human reviewer
3. Approved changes are committed as categorized PRs (one per category)
4. The review overlay never ships to production
5. Each approval is logged in JIRA for sprint traceability

## Workflow

### Step 1: Generate Change Manifest
When invoked, create a change manifest JSON file describing:
- Before/after directory paths (relative to preview server root)
- Categories with color codes
- Each edit with: id, category, file, line, CSS selector, scroll position, old/new text, reasoning

Save manifest to: `{project-root}/review-manifest.json`

### Step 2: Generate Review Tool
Run: `python3 {skill-dir}/generate-review.py {manifest-path} {output-path}`

This produces a self-contained HTML file that:
- Shows two iframes: current (left) vs proposed (right)
- Injects highlight overlays (red rings) on changed elements in the right iframe
- Floating annotation card with old/new text comparison per edit
- Approve/Reject/Skip buttons per edit with state in localStorage
- Summary bar: X approved, Y rejected, Z pending
- Export button → generates approval-decisions.json

### Step 3: Serve and Review
Start the preview server and navigate to the review tool.
Human clicks through edits, approves/rejects each one.
Arrow keys for navigation. Click "Export Approvals" when done.

### Step 4: Process Approvals
Read the exported approval JSON. For each decision:
- **Approved**: Stage for commit in the appropriate category branch
- **Rejected**: Log reason, skip
- **Pending**: Flag for follow-up

### Step 5: Log to JIRA
Run: `bash {skill-dir}/log-approvals.sh {approval-json} {jira-story-key}`

Adds comments to JIRA subtasks per category with approval/rejection details.

### Step 6: Create Category PRs
Run: `bash {skill-dir}/commit-by-category.sh {approval-json} {base-branch}`

Creates one git branch and PR per category containing only approved edits.
Branch naming: `s{sprint}/review-{category-id}`

## Manifest Format

```json
{
  "title": "Review Title",
  "beforeDir": "/site/",
  "afterDir": "/site-modified/",
  "baseFile": "index.html",
  "previewPort": 8080,
  "jiraStory": "FUFO-282",
  "categories": [
    {"id": "framing", "label": "Framing", "color": "#a78bfa"}
  ],
  "edits": [
    {
      "id": "edit-1",
      "category": "framing",
      "file": "index.html",
      "line": 638,
      "selector": ".phases-intro p:first-of-type",
      "scrollY": 580,
      "description": "Core identity paragraph",
      "oldText": "...",
      "newText": "...",
      "reasoning": "Why this change matters"
    }
  ]
}
```

## Important
- NEVER include review markup (red rings, overlays, approval buttons) in committed code
- The review HTML is a tool, not a deliverable — it lives in the preview server only
- Always ask the human to review before committing. Never auto-approve.
- Category PRs should reference the JIRA story in the commit message
