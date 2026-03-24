#!/usr/bin/env python3
"""Generate a visual review HTML tool from a change manifest JSON file.

Usage:
    python3 generate-review.py <manifest.json> <output.html>

The manifest JSON should contain:
    - title: Review title
    - beforeDir: URL path to current version (e.g., "/site/")
    - afterDir: URL path to proposed version (e.g., "/site-danielle/")
    - baseFile: The HTML file being compared (e.g., "index.html")
    - categories: Array of {id, label, color}
    - edits: Array of edit objects with id, category, file, line, selector, scrollY, oldText, newText, reasoning
"""
import json
import sys
import os

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 generate-review.py <manifest.json> <output.html>")
        sys.exit(1)

    manifest_path = sys.argv[1]
    output_path = sys.argv[2]

    # Load manifest
    with open(manifest_path, 'r') as f:
        manifest = json.load(f)

    # Load template
    skill_dir = os.path.dirname(os.path.abspath(__file__))
    template_path = os.path.join(skill_dir, 'templates', 'review-template.html')

    with open(template_path, 'r') as f:
        template = f.read()

    # Build URLs
    before_url = manifest.get('beforeDir', '/site/') + manifest.get('baseFile', 'index.html')
    after_url = manifest.get('afterDir', '/site-danielle/') + manifest.get('baseFile', 'index.html')

    # Substitute placeholders
    html = template.replace('{{TITLE}}', manifest.get('title', 'Visual Review'))
    html = html.replace('{{BEFORE_URL}}', before_url)
    html = html.replace('{{AFTER_URL}}', after_url)
    html = html.replace('{{MANIFEST_JSON}}', json.dumps(manifest, indent=2))

    # Write output
    with open(output_path, 'w') as f:
        f.write(html)

    print(f"Review tool generated: {output_path}")
    print(f"  {len(manifest.get('edits', []))} edits across {len(manifest.get('categories', []))} categories")
    print(f"  Before: {before_url}")
    print(f"  After: {after_url}")
    print(f"  Keyboard: Arrow keys to navigate, A to approve, R to reject")

if __name__ == '__main__':
    main()
