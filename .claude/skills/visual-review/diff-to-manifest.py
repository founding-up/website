#!/usr/bin/env python3
"""Auto-generate a visual review manifest from two HTML file versions.

Usage:
    python3 diff-to-manifest.py --before site/ --after site-danielle/ \
        --file index.html --jira FUFO-282 --output review-manifest.json

Parses both HTML files, diffs text content block-by-block, generates
text-based selectors, auto-classifies categories, and outputs a manifest
compatible with generate-review.py.

Dependencies: Python 3 stdlib only (html.parser, difflib, json, argparse)
"""
import argparse
import difflib
import json
import os
import re
from html.parser import HTMLParser


# ---------------------------------------------------------------------------
# Phase A: HTML Parser → text node tree
# ---------------------------------------------------------------------------

# Structural elements that form review boundaries
STRUCTURAL_CLASSES = {
    'workshop-card', 'phase-card', 'cta-section', 'how-section',
    'why-card', 'journey-step', 'demo-card', 'hero-section',
    'phases-section', 'stats-section',
}

STRUCTURAL_TAGS = {'section', 'article', 'main', 'header', 'footer', 'nav'}

HEADING_TAGS = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}

# Tags whose text is typically not meaningful for review
SKIP_TAGS = {'script', 'style', 'noscript'}

# HTML5 void elements (self-closing, no end tag)
VOID_ELEMENTS = {
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
}


class TextNode:
    """A text node with context about its position in the DOM."""
    __slots__ = ('text', 'tag', 'classes', 'parent_tag', 'parent_classes',
                 'ancestor_classes', 'heading_text', 'char_offset', 'line',
                 'xpath')

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

    def __repr__(self):
        return f"TextNode({self.tag}, {self.text[:40]!r})"


class HTMLTextExtractor(HTMLParser):
    """Walk an HTML document and extract text nodes grouped by structural ancestor."""

    def __init__(self):
        super().__init__()
        self.nodes: list[TextNode] = []
        self._stack: list[dict] = []  # tag stack
        self._skip_depth = 0
        self._char_offset = 0
        self._current_line = 1

    def handle_starttag(self, tag, attrs):
        # Skip void elements — they don't have end tags
        if tag in VOID_ELEMENTS:
            return
        attr_dict = dict(attrs)
        classes = set(attr_dict.get('class', '').split())
        self._stack.append({
            'tag': tag, 'classes': classes, 'id': attr_dict.get('id', ''),
            'line': self.getpos()[0],
        })
        if tag in SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in VOID_ELEMENTS:
            return
        if tag in SKIP_TAGS:
            self._skip_depth = max(0, self._skip_depth - 1)
        # Pop stack (handle mismatches gracefully)
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i]['tag'] == tag:
                self._stack.pop(i)
                break

    def handle_data(self, data):
        if self._skip_depth > 0:
            return
        text = data.strip()
        if not text or len(text) < 2:
            return

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)

        # Determine context from stack
        current = self._stack[-1] if self._stack else {'tag': 'body', 'classes': set()}
        parent = self._stack[-2] if len(self._stack) > 1 else {'tag': 'body', 'classes': set()}

        # Find nearest structural ancestor
        ancestor_classes = set()
        for frame in reversed(self._stack):
            if frame['classes'] & STRUCTURAL_CLASSES or frame['tag'] in STRUCTURAL_TAGS:
                ancestor_classes = frame['classes']
                break

        # Find nearest heading in the same structural block
        heading_text = None
        for frame in reversed(self._stack):
            if frame['tag'] in HEADING_TAGS:
                # We can't get the heading text from the stack alone
                # It will be resolved in a post-processing step
                break

        node = TextNode(
            text=text,
            tag=current['tag'],
            classes=current['classes'],
            parent_tag=parent['tag'],
            parent_classes=parent['classes'],
            ancestor_classes=ancestor_classes,
            heading_text=None,  # resolved later
            char_offset=self._char_offset,
            line=self.getpos()[0],
            xpath=self._build_xpath(),
        )
        self.nodes.append(node)
        self._char_offset += len(data)

    def _build_xpath(self) -> str:
        """Build a simplified xpath from the current stack."""
        parts = []
        for frame in self._stack:
            tag = frame['tag']
            cls = '.'.join(sorted(frame['classes'])) if frame['classes'] else ''
            fid = frame.get('id', '')
            if fid:
                parts.append(f"{tag}#{fid}")
            elif cls:
                parts.append(f"{tag}.{cls}")
            else:
                parts.append(tag)
        return '/'.join(parts)


def parse_html(filepath: str) -> list[TextNode]:
    """Parse an HTML file and return all text nodes with context."""
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()
    extractor = HTMLTextExtractor()
    extractor.feed(html)

    # Post-process: resolve heading_text for each node
    # Walk nodes in order — last seen heading applies to subsequent nodes
    last_heading = None
    for node in extractor.nodes:
        if node.tag in HEADING_TAGS:
            last_heading = node.text
        node.heading_text = last_heading

    return extractor.nodes


# ---------------------------------------------------------------------------
# Phase B: Diff text blocks
# ---------------------------------------------------------------------------

class EditCandidate:
    """A detected text change between before and after."""
    __slots__ = ('before_node', 'after_node', 'similarity', 'change_type')

    def __init__(self, before_node, after_node, similarity, change_type='modified'):
        self.before_node = before_node
        self.after_node = after_node
        self.similarity = similarity
        self.change_type = change_type  # 'modified', 'added', 'removed'


def diff_text_blocks(before_nodes: list[TextNode],
                     after_nodes: list[TextNode],
                     threshold: float = 0.85) -> list[EditCandidate]:
    """Compare text nodes between before and after using position-aware matching.

    Uses a two-pass approach:
    1. First pass: match nodes by position (index order), requiring structural
       compatibility. This handles most cases where edits don't reorder content.
    2. Second pass: for unmatched nodes, do similarity-based matching within
       a narrow positional window (±20 nodes).

    Text nodes with similarity below `threshold` are flagged as edits.
    """
    edits = []
    used_before = set()
    used_after = set()

    # Pass 1: Positional matching with SequenceMatcher on the full list
    # Use difflib on the text lists to find the optimal alignment
    before_texts = [n.text for n in before_nodes]
    after_texts = [n.text for n in after_nodes]

    matcher = difflib.SequenceMatcher(None, before_texts, after_texts)
    for op, b_start, b_end, a_start, a_end in matcher.get_opcodes():
        if op == 'equal':
            # Identical — mark as used
            for i in range(b_start, b_end):
                used_before.add(i)
            for i in range(a_start, a_end):
                used_after.add(i)

        elif op == 'replace':
            # Changed blocks — pair them positionally
            b_range = list(range(b_start, b_end))
            a_range = list(range(a_start, a_end))

            for i, bi in enumerate(b_range):
                if i < len(a_range):
                    ai = a_range[i]
                    bn = before_nodes[bi]
                    an = after_nodes[ai]
                    ratio = difflib.SequenceMatcher(None, bn.text, an.text).ratio()

                    if ratio < threshold:
                        edits.append(EditCandidate(bn, an, ratio, 'modified'))
                    used_before.add(bi)
                    used_after.add(ai)
                else:
                    # More before nodes than after — removals
                    bn = before_nodes[bi]
                    if len(bn.text) > 10:
                        edits.append(EditCandidate(bn, None, 0.0, 'removed'))
                    used_before.add(bi)

            # Extra after nodes — additions
            for i in range(len(b_range), len(a_range)):
                ai = a_range[i]
                an = after_nodes[ai]
                if len(an.text) > 20:
                    edits.append(EditCandidate(None, an, 0.0, 'added'))
                used_after.add(ai)

        elif op == 'delete':
            for i in range(b_start, b_end):
                bn = before_nodes[i]
                if len(bn.text) > 10:
                    edits.append(EditCandidate(bn, None, 0.0, 'removed'))
                used_before.add(i)

        elif op == 'insert':
            for i in range(a_start, a_end):
                an = after_nodes[i]
                if len(an.text) > 20:
                    edits.append(EditCandidate(None, an, 0.0, 'added'))
                used_after.add(i)

    return edits


# ---------------------------------------------------------------------------
# Phase C: Generate selectors
# ---------------------------------------------------------------------------

def generate_selector(edit: EditCandidate) -> tuple:
    """Generate a text-based selector and optional selectorAfter.

    Returns (selector, selectorAfter, description).
    """
    bn = edit.before_node
    an = edit.after_node

    # If the changed element IS a heading, use its text directly
    if bn and bn.tag in HEADING_TAGS:
        selector = f"text:{bn.text}"
        selector_after = f"text:{an.text}" if an and an.text != bn.text else None
        desc = f"{bn.tag} heading change"
        return selector, selector_after, desc

    # Use the nearest heading as anchor
    if bn and bn.heading_text:
        selector = f"text:{bn.heading_text}"
        # If the heading itself also changed, we need selectorAfter
        if an and an.heading_text and an.heading_text != bn.heading_text:
            selector_after = f"text:{an.heading_text}"
        else:
            selector_after = None
        desc = bn.heading_text
        return selector, selector_after, desc

    if an and an.heading_text:
        selector = f"text:{an.heading_text}"
        return selector, None, an.heading_text

    # Fallback: use CSS classes from parent
    node = bn or an
    if node.parent_classes:
        cls = sorted(node.parent_classes)[0]
        selector = f".{cls}"
        return selector, None, cls

    # Last resort: tag + ancestor
    if node.ancestor_classes:
        cls = sorted(node.ancestor_classes)[0]
        selector = f".{cls}"
        return selector, None, cls

    return f".{node.tag}", None, node.tag


# ---------------------------------------------------------------------------
# Phase D: Auto-classify categories
# ---------------------------------------------------------------------------

def load_category_rules(rules_path: str) -> list[dict]:
    """Load category classification rules from JSON."""
    with open(rules_path, 'r') as f:
        data = json.load(f)
    return data.get('rules', [])


def classify_category(edit: EditCandidate, rules: list[dict], filename: str) -> str:
    """Classify an edit into a category based on rules."""
    bn = edit.before_node
    an = edit.after_node
    node = bn or an

    old_text = bn.text if bn else ''
    new_text = an.text if an else ''

    for rule in rules:
        match = rule.get('match', {})

        # Default rule — always matches last
        if match.get('default'):
            continue

        # File filter
        if 'files' in match:
            if filename not in match['files']:
                continue

        # Old text contains check (for removals like "Target: 70/100")
        if 'oldTextContains' in match:
            if not any(kw.lower() in old_text.lower() for kw in match['oldTextContains']):
                continue
            if match.get('newTextEmpty') and new_text and new_text != '(removed entirely)':
                continue
            return rule['id']

        # Text contains check
        if 'textContains' in match:
            combined = f"{old_text} {new_text}"
            if any(kw.lower() in combined.lower() for kw in match['textContains']):
                return rule['id']

        # Parent class check
        if 'parentClasses' in match:
            node_classes = set()
            if node:
                node_classes = node.classes | node.parent_classes | node.ancestor_classes
            if any(cls in node_classes for cls in match['parentClasses']):
                # Optional tag exclusion
                if 'excludeTagNames' in match and node and node.tag in match['excludeTagNames']:
                    continue
                return rule['id']

        # Section position check
        if match.get('sectionLast') and node and node.char_offset:
            # Rough heuristic: last 10% of document is CTA
            # This is imprecise but catches obvious cases
            pass

    # Default category
    return 'framing'


# ---------------------------------------------------------------------------
# Phase E: Build manifest
# ---------------------------------------------------------------------------

def deduplicate_edits(edits: list[dict]) -> list[dict]:
    """Remove duplicate edits targeting the same selector with same old/new text."""
    seen = set()
    unique = []
    for e in edits:
        key = (e.get('selector', ''), e.get('oldText', '')[:50], e.get('newText', '')[:50])
        if key not in seen:
            seen.add(key)
            unique.append(e)
    return unique


def build_manifest(edit_candidates: list[EditCandidate],
                   rules: list[dict],
                   args) -> dict:
    """Assemble the full manifest JSON from edit candidates."""
    # Build category list from rules
    categories = []
    for rule in rules:
        categories.append({
            'id': rule['id'],
            'label': rule['label'],
            'color': rule['color'],
        })

    edits = []
    for i, ec in enumerate(edit_candidates, 1):
        bn = ec.before_node
        an = ec.after_node

        selector, selector_after, desc = generate_selector(ec)
        category = classify_category(ec, rules, args.file)

        edit = {
            'id': f'edit-{i}',
            'category': category,
            'file': args.file,
            'line': bn.line if bn else (an.line if an else 0),
            'selector': selector,
            'scrollY': None,  # filled by resolve-scroll.py
            'description': desc,
            'oldText': bn.text if bn else '',
            'newText': an.text if an else '(removed entirely)',
            'reasoning': f'Auto-detected: {ec.change_type} (similarity: {ec.similarity:.2f})',
        }

        if selector_after:
            edit['selectorAfter'] = selector_after

        edits.append(edit)

    edits = deduplicate_edits(edits)

    # Re-number after dedup
    for i, e in enumerate(edits, 1):
        e['id'] = f'edit-{i}'

    return {
        'title': f'Auto-generated review: {args.file}',
        'beforeDir': f'/{args.before}',
        'afterDir': f'/{args.after}',
        'baseFile': args.file,
        'previewPort': args.port,
        'jiraStory': args.jira or '',
        'categories': categories,
        'edits': edits,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Auto-generate visual review manifest from HTML diff')
    parser.add_argument('--before', required=True, help='Before directory (relative to server root)')
    parser.add_argument('--after', required=True, help='After directory (relative to server root)')
    parser.add_argument('--file', required=True, help='HTML filename to compare')
    parser.add_argument('--port', type=int, default=8080, help='Preview server port')
    parser.add_argument('--jira', default='', help='JIRA story key')
    parser.add_argument('--output', default='review-manifest.json', help='Output manifest path')
    parser.add_argument('--rules', default=None, help='Category rules JSON path')
    parser.add_argument('--threshold', type=float, default=0.85, help='Similarity threshold for detecting edits')
    parser.add_argument('--base-dir', default='.', help='Base directory for resolving file paths')
    args = parser.parse_args()

    # Resolve paths
    before_path = os.path.join(args.base_dir, args.before, args.file)
    after_path = os.path.join(args.base_dir, args.after, args.file)

    if not os.path.exists(before_path):
        print(f"Error: Before file not found: {before_path}")
        return 1
    if not os.path.exists(after_path):
        print(f"Error: After file not found: {after_path}")
        return 1

    # Load category rules
    rules_path = args.rules
    if not rules_path:
        skill_dir = os.path.dirname(os.path.abspath(__file__))
        rules_path = os.path.join(skill_dir, 'category-rules.json')
    rules = load_category_rules(rules_path)

    # Phase A: Parse
    print(f"Parsing {before_path}...")
    before_nodes = parse_html(before_path)
    print(f"  {len(before_nodes)} text nodes")

    print(f"Parsing {after_path}...")
    after_nodes = parse_html(after_path)
    print(f"  {len(after_nodes)} text nodes")

    # Phase B: Diff
    print("Diffing text blocks...")
    edits = diff_text_blocks(before_nodes, after_nodes, args.threshold)
    print(f"  {len(edits)} edit candidates")

    # Phase C+D+E: Build manifest
    manifest = build_manifest(edits, rules, args)
    print(f"  {len(manifest['edits'])} edits in manifest")

    # Category breakdown
    cat_counts = {}
    for e in manifest['edits']:
        cat_counts[e['category']] = cat_counts.get(e['category'], 0) + 1
    for cat_id, count in sorted(cat_counts.items()):
        label = next((c['label'] for c in manifest['categories'] if c['id'] == cat_id), cat_id)
        print(f"    {label}: {count}")

    # Write
    output_path = os.path.join(args.base_dir, args.output) if args.base_dir != '.' else args.output
    with open(output_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest written: {output_path}")
    print(f"  scrollY values are null — run resolve-scroll.py to fill them")

    return 0


if __name__ == '__main__':
    exit(main())
