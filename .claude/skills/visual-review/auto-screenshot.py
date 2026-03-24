#!/usr/bin/env python3
"""Capture before/after screenshots for each edit in a visual review manifest.

Usage (standalone with Playwright):
    python3 auto-screenshot.py --manifest review-manifest.json --output-dir screenshots/

Usage (from Claude Code session — MCP mode):
    This script is called by the Claude agent using preview_eval and preview_screenshot.
    See SKILL.md for the MCP workflow.

Dependencies:
    - Standalone mode: playwright (pip install playwright && playwright install chromium)
    - MCP mode: Claude Code with preview server running
"""
import argparse
import json
import os
import sys
import time


def capture_with_playwright(manifest: dict, output_dir: str, port: int):
    """Capture screenshots using Playwright (standalone mode)."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Error: Playwright not installed. Run: pip install playwright && playwright install chromium")
        print("Alternatively, use MCP mode from a Claude Code session.")
        return False

    before_dir = manifest['beforeDir']
    after_dir = manifest['afterDir']
    base_file = manifest['baseFile']

    before_url = f"http://localhost:{port}{before_dir}{base_file}"
    after_url = f"http://localhost:{port}{after_dir}{base_file}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        for edit in manifest['edits']:
            edit_id = edit['id']
            selector = edit.get('selector', '')
            scroll_y = edit.get('scrollY') or 0

            # Determine CSS selector for Playwright
            # Convert text: selectors to JS-based element finding
            pw_selector = _to_playwright_selector(selector)

            for label, url in [('before', before_url), ('after', after_url)]:
                out_path = os.path.join(output_dir, f"{edit_id}-{label}.png")

                try:
                    page.goto(url, wait_until='networkidle', timeout=10000)
                    time.sleep(0.5)  # layout settle

                    if pw_selector:
                        try:
                            el = page.locator(pw_selector).first
                            el.scroll_into_view_if_needed()
                            time.sleep(0.3)
                            # Screenshot with 20px padding, max 800px height
                            box = el.bounding_box()
                            if box:
                                clip = {
                                    'x': max(0, box['x'] - 20),
                                    'y': max(0, box['y'] - 20),
                                    'width': min(box['width'] + 40, 1280),
                                    'height': min(box['height'] + 40, 800),
                                }
                                page.screenshot(path=out_path, clip=clip)
                            else:
                                page.screenshot(path=out_path, full_page=False)
                        except Exception:
                            # Fallback: scroll to scrollY and capture viewport
                            page.evaluate(f"window.scrollTo(0, {scroll_y})")
                            time.sleep(0.3)
                            page.screenshot(path=out_path, full_page=False)
                    else:
                        page.evaluate(f"window.scrollTo(0, {scroll_y})")
                        time.sleep(0.3)
                        page.screenshot(path=out_path, full_page=False)

                    print(f"  {edit_id}-{label}: {out_path}")
                except Exception as e:
                    print(f"  {edit_id}-{label}: FAILED ({e})")

        browser.close()

    return True


def _to_playwright_selector(selector: str) -> str:
    """Convert a visual-review selector to a Playwright locator string."""
    if not selector:
        return ''

    if selector.startswith('text:'):
        # text:headingText → find heading by text
        text = selector[5:]
        return f"h1:has-text('{text}'), h2:has-text('{text}'), h3:has-text('{text}'), h4:has-text('{text}')"

    # CSS selector — use as-is
    return selector


def generate_mcp_instructions(manifest: dict, output_dir: str) -> str:
    """Generate instructions for Claude agent to capture screenshots via MCP tools."""
    instructions = []
    instructions.append("# MCP Screenshot Capture Instructions")
    instructions.append(f"# Output directory: {output_dir}")
    instructions.append("")

    before_dir = manifest['beforeDir']
    after_dir = manifest['afterDir']
    base_file = manifest['baseFile']

    for edit in manifest['edits']:
        scroll_y = edit.get('scrollY') or 0
        selector = edit.get('selector', '')
        edit_id = edit['id']

        # JS to scroll to element
        if selector.startswith('text:'):
            text = selector[5:]
            js_find = f"""
(function() {{
  const els = document.querySelectorAll('h1,h2,h3,h4');
  for (const el of els) {{
    if (el.textContent.trim() === '{text}') {{
      const card = el.closest('.workshop-card,.phase-card,section') || el.parentElement;
      card.scrollIntoView({{block:'center'}});
      return true;
    }}
  }}
  window.scrollTo(0, {scroll_y});
  return false;
}})()"""
        else:
            js_find = f"document.querySelector('{selector}')?.scrollIntoView({{block:'center'}}) || window.scrollTo(0, {scroll_y})"

        instructions.append(f"# {edit_id}: {edit.get('description', '')}")
        instructions.append(f"# preview_eval: {js_find.strip()}")
        instructions.append(f"# preview_screenshot → save as {edit_id}-before.png / {edit_id}-after.png")
        instructions.append("")

    return '\n'.join(instructions)


def main():
    parser = argparse.ArgumentParser(description='Capture before/after screenshots for visual review')
    parser.add_argument('--manifest', required=True, help='Path to review-manifest.json')
    parser.add_argument('--output-dir', default='screenshots', help='Output directory for screenshots')
    parser.add_argument('--port', type=int, default=8080, help='Preview server port')
    parser.add_argument('--mode', choices=['playwright', 'mcp'], default='playwright',
                        help='Capture mode: playwright (standalone) or mcp (print instructions)')
    args = parser.parse_args()

    with open(args.manifest, 'r') as f:
        manifest = json.load(f)

    os.makedirs(args.output_dir, exist_ok=True)

    if args.mode == 'mcp':
        print(generate_mcp_instructions(manifest, args.output_dir))
        return 0

    print(f"Capturing screenshots for {len(manifest['edits'])} edits...")
    print(f"  Mode: Playwright")
    print(f"  Server: http://localhost:{args.port}")
    print(f"  Output: {args.output_dir}/")

    success = capture_with_playwright(manifest, args.output_dir, args.port)
    if success:
        count = len([f for f in os.listdir(args.output_dir) if f.endswith('.png')])
        print(f"\n{count} screenshots captured in {args.output_dir}/")
    return 0 if success else 1


if __name__ == '__main__':
    exit(main())
