# founding_up — Website

## What This Is
The production website for founding_up — an identity-driven student success platform. This repo contains the public-facing marketing site (index.html) and sales enablement page (demo.html).

**Owner:** Katie Nolan (Chief of Staff)
**Framework Advisor:** Danielle Rosenthal (Chief Researcher)

## Related Repos
- **founding-up/kungfu** — Demo portals (Student, University, Employer, Admin MVPs)
- **JIRA:** FUFO project at https://foundingup-dan.atlassian.net
- **Confluence:** FUFO space

## Team
| Name | Role | Responsibility |
|------|------|---------------|
| Katie Nolan | Chief of Staff | Content management, website updates |
| Danielle Rosenthal | Chief Researcher | Framework language, identity measurement |
| Matt Wagner | COO | Operations, visual review process |
| Dan Dillard | CEO | Final approvals |

## Change Management Process
**Every content change to index.html goes through the visual review process:**

1. Make edits on a branch (or provide edited files in `reviews/`)
2. Run: `python3 .claude/skills/visual-review/diff-to-manifest.py --before . --after reviews/danielle/ --file index.html`
3. Run: `python3 .claude/skills/visual-review/generate-review.py review-manifest.json visual-review.html`
4. Serve locally: `python3 -m http.server 8080`
5. Open `localhost:8080/visual-review.html` — review each change
6. Export approvals → create category PRs
7. Katie Nolan or Matt Wagner merges approved PRs

## Key Files
| File | Purpose |
|------|---------|
| `index.html` | Production website — the wireframe basis |
| `demo.html` | Sales enablement — showcases the product |
| `reviews/danielle/` | Danielle Rosenthal's framework edits for comparison |
| `review-manifest.json` | Current change manifest for visual review |
| `visual-review.html` | Interactive review tool (not production — review only) |

## Content Rules
1. **Identity is not discovered — it becomes visible through action.** This is the foundational reframe from Danielle Rosenthal.
2. **No numeric scores on identity.** "Target: 70/100" was removed. Identity is not scored.
3. **Evidence types are available in ALL phases.** The hierarchy is growing capacity, not a validation ladder.
4. **Cleo is a navigator, not a prescriber.** She helps students reflect, notice, and decide.
5. **"Affirming actions"** terminology — pending Decision D21 from Danielle Rosenthal.
6. **Never use "Identity Score"** — pending Decision D22 replacement term.

## FUFO Framework Reference
The 6 Psychological Factors (F1-F6) and 5 Student Outcomes (O1-O5) are defined canonically in Confluence at "FUFO — Factors & Objectives". Never duplicate definitions — link to that page.
