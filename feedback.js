/**
 * founding_up — Feedback Widget
 * Floating feedback button with screenshot capture → Google Form
 *
 * Usage: Add <script src="/feedback.js"></script> (or relative path) to any page.
 *
 * Google Form setup:
 *   1. Create a Google Form with these fields (Short answer / Paragraph):
 *      - Page URL
 *      - Feedback Type (Bug, Feature Request, General, Question)
 *      - Description
 *      - Screenshot (File upload OR paste the base64 in a paragraph field)
 *   2. Get the pre-filled link and extract entry IDs
 *   3. Update GOOGLE_FORM_CONFIG below
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════
  // CONFIG — Update these with your Google Form IDs
  // ══════════════════════════════════════════════
  var GOOGLE_FORM_CONFIG = {
    formAction: 'https://docs.google.com/forms/d/1ztCaxWIzKO4QLCxF7Ayn-j14d_ekZgXO3EL9OHmQZfs/formResponse',
    fields: {
      pageUrl:     'entry.1737414578',
      feedbackType:'entry.1776111735',
      description: 'entry.1483224424',
      screenshot:  'entry.698592321',
      userAgent:   'entry.1615642946'
    }
  };

  // ══════════════════════════════════════════════
  // STYLES
  // ══════════════════════════════════════════════
  var css = document.createElement('style');
  css.textContent = [
    /* Floating button */
    '.fu-feedback-btn {',
    '  position: fixed; bottom: 24px; right: 24px; z-index: 99999;',
    '  width: 52px; height: 52px; border-radius: 50%;',
    '  background: linear-gradient(135deg, #00E5C8, #1A6B6B);',
    '  border: none; cursor: pointer; box-shadow: 0 4px 20px rgba(0,229,200,0.35);',
    '  display: flex; align-items: center; justify-content: center;',
    '  transition: transform 0.2s, box-shadow 0.2s;',
    '}',
    '.fu-feedback-btn:hover {',
    '  transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,229,200,0.5);',
    '}',
    '.fu-feedback-btn svg { width: 22px; height: 22px; stroke: #030808; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }',
    '.fu-feedback-btn .fu-badge {',
    '  position: absolute; top: -2px; right: -2px; width: 14px; height: 14px;',
    '  background: #FF6F61; border-radius: 50%; border: 2px solid #030808;',
    '}',

    /* Tooltip */
    '.fu-feedback-btn::after {',
    '  content: "Send Feedback"; position: absolute; right: 62px; top: 50%;',
    '  transform: translateY(-50%); background: #0A1E1E; color: #fff;',
    '  padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700;',
    '  letter-spacing: 0.5px; white-space: nowrap; pointer-events: none;',
    '  opacity: 0; transition: opacity 0.2s; font-family: "DM Sans", sans-serif;',
    '  border: 1px solid rgba(0,229,200,0.15);',
    '}',
    '.fu-feedback-btn:hover::after { opacity: 1; }',

    /* Overlay */
    '.fu-feedback-overlay {',
    '  position: fixed; inset: 0; z-index: 100000;',
    '  background: rgba(3,8,8,0.7); backdrop-filter: blur(4px);',
    '  display: none; align-items: center; justify-content: center;',
    '  opacity: 0; transition: opacity 0.25s ease;',
    '}',
    '.fu-feedback-overlay.open { display: flex; }',
    '.fu-feedback-overlay.visible { opacity: 1; }',

    /* Modal */
    '.fu-feedback-modal {',
    '  background: #0A1E1E; border: 1px solid rgba(0,229,200,0.15);',
    '  border-radius: 16px; width: 90%; max-width: 480px; max-height: 90vh;',
    '  overflow-y: auto; padding: 28px 32px;',
    '  box-shadow: 0 24px 80px rgba(0,0,0,0.5);',
    '  transform: translateY(12px); transition: transform 0.25s ease;',
    '  font-family: "DM Sans", -apple-system, BlinkMacSystemFont, sans-serif;',
    '}',
    '.fu-feedback-overlay.visible .fu-feedback-modal { transform: translateY(0); }',

    /* Header */
    '.fu-feedback-modal h3 {',
    '  font-size: 1.1rem; font-weight: 800; color: #fff;',
    '  text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;',
    '}',
    '.fu-feedback-modal .fu-subtitle {',
    '  font-size: 0.78rem; color: rgba(255,255,255,0.35); margin-bottom: 20px;',
    '}',

    /* Form elements */
    '.fu-feedback-modal label {',
    '  display: block; font-size: 0.65rem; font-weight: 700;',
    '  letter-spacing: 1.5px; text-transform: uppercase;',
    '  color: rgba(255,255,255,0.4); margin-bottom: 6px;',
    '}',
    '.fu-feedback-modal .fu-field { margin-bottom: 16px; }',

    /* Type pills */
    '.fu-type-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }',
    '.fu-type-pill {',
    '  padding: 7px 16px; border-radius: 100px; border: 1px solid rgba(0,229,200,0.15);',
    '  background: transparent; color: rgba(255,255,255,0.5); font-size: 0.72rem;',
    '  font-weight: 700; cursor: pointer; transition: all 0.2s;',
    '  font-family: inherit; letter-spacing: 0.3px;',
    '}',
    '.fu-type-pill:hover { border-color: rgba(0,229,200,0.4); color: rgba(255,255,255,0.7); }',
    '.fu-type-pill.active {',
    '  background: rgba(0,229,200,0.1); border-color: #00E5C8; color: #00E5C8;',
    '}',

    /* Textarea & input */
    '.fu-feedback-modal textarea, .fu-feedback-modal input[type="text"] {',
    '  width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(0,229,200,0.1);',
    '  border-radius: 10px; padding: 12px 14px; color: #fff; font-size: 0.85rem;',
    '  font-family: inherit; resize: vertical; transition: border-color 0.2s;',
    '  outline: none;',
    '}',
    '.fu-feedback-modal textarea { min-height: 100px; }',
    '.fu-feedback-modal textarea:focus, .fu-feedback-modal input[type="text"]:focus {',
    '  border-color: rgba(0,229,200,0.4);',
    '}',
    '.fu-feedback-modal textarea::placeholder, .fu-feedback-modal input::placeholder {',
    '  color: rgba(255,255,255,0.2);',
    '}',

    /* Screenshot area */
    '.fu-screenshot-area {',
    '  border: 1px dashed rgba(0,229,200,0.15); border-radius: 10px;',
    '  padding: 14px; text-align: center; margin-bottom: 16px;',
    '  transition: border-color 0.2s; position: relative;',
    '}',
    '.fu-screenshot-area.has-capture { border-style: solid; border-color: rgba(0,229,200,0.3); }',
    '.fu-screenshot-btn {',
    '  background: rgba(0,229,200,0.08); border: 1px solid rgba(0,229,200,0.2);',
    '  border-radius: 8px; padding: 10px 18px; color: #00E5C8;',
    '  font-size: 0.75rem; font-weight: 700; cursor: pointer;',
    '  font-family: inherit; transition: all 0.2s;',
    '}',
    '.fu-screenshot-btn:hover { background: rgba(0,229,200,0.15); }',
    '.fu-screenshot-hint {',
    '  font-size: 0.68rem; color: rgba(255,255,255,0.2); margin-top: 8px;',
    '}',
    '.fu-screenshot-preview {',
    '  max-width: 100%; max-height: 160px; border-radius: 8px;',
    '  border: 1px solid rgba(0,229,200,0.1); margin-top: 8px;',
    '}',
    '.fu-screenshot-remove {',
    '  position: absolute; top: 8px; right: 8px; width: 24px; height: 24px;',
    '  border-radius: 50%; background: rgba(255,111,97,0.15); border: 1px solid rgba(255,111,97,0.3);',
    '  color: #FF6F61; font-size: 0.7rem; cursor: pointer; display: none;',
    '  align-items: center; justify-content: center; font-weight: 800;',
    '}',
    '.fu-screenshot-area.has-capture .fu-screenshot-remove { display: flex; }',

    /* Actions */
    '.fu-feedback-actions { display: flex; gap: 10px; align-items: center; margin-top: 20px; }',
    '.fu-submit-btn {',
    '  background: linear-gradient(135deg, #00E5C8, #1A6B6B); color: #030808;',
    '  border: none; padding: 12px 28px; border-radius: 100px;',
    '  font-size: 0.78rem; font-weight: 800; letter-spacing: 0.5px;',
    '  cursor: pointer; transition: opacity 0.2s, transform 0.2s;',
    '  font-family: inherit; text-transform: uppercase;',
    '}',
    '.fu-submit-btn:hover { opacity: 0.9; transform: translateY(-1px); }',
    '.fu-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }',
    '.fu-cancel-btn {',
    '  background: none; border: none; color: rgba(255,255,255,0.35);',
    '  font-size: 0.78rem; font-weight: 600; cursor: pointer;',
    '  font-family: inherit; transition: color 0.2s;',
    '}',
    '.fu-cancel-btn:hover { color: rgba(255,255,255,0.6); }',

    /* Page info */
    '.fu-page-info {',
    '  font-size: 0.65rem; color: rgba(255,255,255,0.2); margin-bottom: 16px;',
    '  padding: 8px 12px; background: rgba(255,255,255,0.02);',
    '  border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);',
    '  display: flex; align-items: center; gap: 6px;',
    '}',
    '.fu-page-info svg { width: 12px; height: 12px; stroke: rgba(255,255,255,0.2); fill: none; stroke-width: 2; }',

    /* Success state */
    '.fu-feedback-success {',
    '  text-align: center; padding: 24px 0;',
    '}',
    '.fu-feedback-success .fu-check {',
    '  width: 56px; height: 56px; border-radius: 50%;',
    '  background: rgba(0,229,200,0.1); border: 2px solid #00E5C8;',
    '  display: flex; align-items: center; justify-content: center;',
    '  margin: 0 auto 16px;',
    '}',
    '.fu-feedback-success .fu-check svg { width: 24px; height: 24px; stroke: #00E5C8; fill: none; stroke-width: 2.5; }',
    '.fu-feedback-success h4 {',
    '  font-size: 1rem; font-weight: 800; color: #fff;',
    '  text-transform: uppercase; margin-bottom: 6px;',
    '}',
    '.fu-feedback-success p {',
    '  font-size: 0.82rem; color: rgba(255,255,255,0.35); line-height: 1.6;',
    '}',

    /* Post University theme overrides */
    '[data-theme="post"] .fu-feedback-modal { background: #fff; border-color: rgba(99,45,79,0.1); }',
    '[data-theme="post"] .fu-feedback-modal h3 { color: #1a1a1a; }',
    '[data-theme="post"] .fu-feedback-modal .fu-subtitle { color: #888; }',
    '[data-theme="post"] .fu-feedback-modal label { color: #888; }',
    '[data-theme="post"] .fu-feedback-modal textarea,',
    '[data-theme="post"] .fu-feedback-modal input[type="text"] {',
    '  background: #f7f7f7; border-color: #e0e0e0; color: #1a1a1a;',
    '}',
    '[data-theme="post"] .fu-feedback-modal textarea::placeholder,',
    '[data-theme="post"] .fu-feedback-modal input::placeholder { color: #aaa; }',
    '[data-theme="post"] .fu-type-pill { border-color: #e0e0e0; color: #888; }',
    '[data-theme="post"] .fu-type-pill:hover { border-color: #632D4F; color: #632D4F; }',
    '[data-theme="post"] .fu-type-pill.active {',
    '  background: rgba(99,45,79,0.08); border-color: #632D4F; color: #632D4F;',
    '}',
    '[data-theme="post"] .fu-screenshot-area { border-color: #e0e0e0; }',
    '[data-theme="post"] .fu-screenshot-btn { background: rgba(99,45,79,0.06); border-color: rgba(99,45,79,0.2); color: #632D4F; }',
    '[data-theme="post"] .fu-submit-btn { background: linear-gradient(135deg, #FF8300, #E07000); color: #fff; }',
    '[data-theme="post"] .fu-cancel-btn { color: #888; }',
    '[data-theme="post"] .fu-page-info { background: #f7f7f7; border-color: #eee; color: #999; }',
    '[data-theme="post"] .fu-feedback-success .fu-check { background: rgba(255,131,0,0.1); border-color: #FF8300; }',
    '[data-theme="post"] .fu-feedback-success .fu-check svg { stroke: #FF8300; }',
    '[data-theme="post"] .fu-feedback-success h4 { color: #1a1a1a; }',
    '[data-theme="post"] .fu-feedback-success p { color: #888; }',
    '[data-theme="post"] .fu-feedback-btn { background: linear-gradient(135deg, #FF8300, #E07000); box-shadow: 0 4px 20px rgba(255,131,0,0.35); }',
    '[data-theme="post"] .fu-feedback-btn:hover { box-shadow: 0 6px 28px rgba(255,131,0,0.5); }',
    '[data-theme="post"] .fu-feedback-btn svg { stroke: #fff; }',
    '[data-theme="post"] .fu-feedback-btn::after { background: #fff; color: #1a1a1a; border-color: #e0e0e0; }',

    /* Light theme overrides */
    '[data-theme="light"] .fu-feedback-modal { background: #fff; border-color: #e0e0e0; }',
    '[data-theme="light"] .fu-feedback-modal h3 { color: #1a1a1a; }',
    '[data-theme="light"] .fu-feedback-modal .fu-subtitle { color: #888; }',
    '[data-theme="light"] .fu-feedback-modal label { color: #888; }',
    '[data-theme="light"] .fu-feedback-modal textarea,',
    '[data-theme="light"] .fu-feedback-modal input[type="text"] {',
    '  background: #f7f7f7; border-color: #e0e0e0; color: #1a1a1a;',
    '}',
    '[data-theme="light"] .fu-type-pill { border-color: #e0e0e0; color: #888; }',
    '[data-theme="light"] .fu-type-pill.active {',
    '  background: rgba(0,229,200,0.06); border-color: #1A6B6B; color: #1A6B6B;',
    '}',
    '[data-theme="light"] .fu-submit-btn { background: linear-gradient(135deg, #00E5C8, #1A6B6B); }',

    /* Responsive */
    '@media (max-width: 480px) {',
    '  .fu-feedback-modal { padding: 20px; border-radius: 12px; }',
    '  .fu-feedback-btn { bottom: 16px; right: 16px; width: 46px; height: 46px; }',
    '  .fu-feedback-btn::after { display: none; }',
    '  .fu-type-pills { gap: 6px; }',
    '  .fu-type-pill { padding: 6px 12px; font-size: 0.65rem; }',
    '}',
  ].join('\n');
  document.head.appendChild(css);

  // ══════════════════════════════════════════════
  // HTML
  // ══════════════════════════════════════════════
  var feedbackIcon = '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var linkIcon = '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
  var checkIcon = '<svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>';
  var cameraIcon = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:-2px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

  // Floating button
  var btn = document.createElement('button');
  btn.className = 'fu-feedback-btn';
  btn.setAttribute('aria-label', 'Send feedback');
  btn.innerHTML = feedbackIcon + '<span class="fu-badge"></span>';
  document.body.appendChild(btn);

  // Overlay + Modal
  var overlay = document.createElement('div');
  overlay.className = 'fu-feedback-overlay';
  overlay.innerHTML = [
    '<div class="fu-feedback-modal">',
    '  <div class="fu-feedback-form">',
    '    <h3>Send Feedback</h3>',
    '    <div class="fu-subtitle">Help us improve — report bugs, request features, or share ideas.</div>',
    '',
    '    <div class="fu-page-info">' + linkIcon + ' <span class="fu-current-page"></span></div>',
    '',
    '    <label>Feedback Type</label>',
    '    <div class="fu-type-pills">',
    '      <button class="fu-type-pill active" data-type="Bug">Bug</button>',
    '      <button class="fu-type-pill" data-type="Feature Request">Feature Request</button>',
    '      <button class="fu-type-pill" data-type="General">General</button>',
    '      <button class="fu-type-pill" data-type="Question">Question</button>',
    '    </div>',
    '',
    '    <div class="fu-field">',
    '      <label>Description</label>',
    '      <textarea class="fu-description" placeholder="What happened? What did you expect? Steps to reproduce..."></textarea>',
    '    </div>',
    '',
    '    <label>' + cameraIcon + ' Screenshot</label>',
    '    <div class="fu-screenshot-area">',
    '      <button class="fu-screenshot-btn" type="button">Capture Current Screen</button>',
    '      <div class="fu-screenshot-hint">Or paste an image (Ctrl/Cmd + V)</div>',
    '      <img class="fu-screenshot-preview" style="display:none" />',
    '      <button class="fu-screenshot-remove" type="button">&times;</button>',
    '    </div>',
    '',
    '    <div class="fu-feedback-actions">',
    '      <button class="fu-submit-btn" type="button">Submit Feedback</button>',
    '      <button class="fu-cancel-btn" type="button">Cancel</button>',
    '    </div>',
    '  </div>',
    '',
    '  <div class="fu-feedback-success" style="display:none">',
    '    <div class="fu-check">' + checkIcon + '</div>',
    '    <h4>Feedback Sent</h4>',
    '    <p>Thank you! The product team will review this and follow up if needed.</p>',
    '    <div style="margin-top:20px;">',
    '      <button class="fu-cancel-btn" type="button" style="color:rgba(0,229,200,0.6);">Close</button>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');
  document.body.appendChild(overlay);

  // ══════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════
  var selectedType = 'Bug';
  var screenshotData = null;
  var formEl = overlay.querySelector('.fu-feedback-form');
  var successEl = overlay.querySelector('.fu-feedback-success');

  // ══════════════════════════════════════════════
  // OPEN / CLOSE
  // ══════════════════════════════════════════════
  function openModal() {
    // Set current page info
    var pageName = document.title || window.location.pathname;
    overlay.querySelector('.fu-current-page').textContent = pageName + ' — ' + window.location.href;

    formEl.style.display = '';
    successEl.style.display = 'none';
    overlay.classList.add('open');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('visible');
      });
    });
  }

  function closeModal() {
    overlay.classList.remove('visible');
    setTimeout(function () {
      overlay.classList.remove('open');
      resetForm();
    }, 250);
  }

  function resetForm() {
    selectedType = 'Bug';
    screenshotData = null;
    overlay.querySelector('.fu-description').value = '';
    overlay.querySelectorAll('.fu-type-pill').forEach(function (p) {
      p.classList.toggle('active', p.dataset.type === 'Bug');
    });
    var area = overlay.querySelector('.fu-screenshot-area');
    area.classList.remove('has-capture');
    overlay.querySelector('.fu-screenshot-preview').style.display = 'none';
    overlay.querySelector('.fu-submit-btn').disabled = false;
    overlay.querySelector('.fu-submit-btn').textContent = 'Submit Feedback';
  }

  btn.addEventListener('click', openModal);

  // Close on overlay click (not modal)
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  // Cancel buttons
  overlay.querySelectorAll('.fu-cancel-btn').forEach(function (b) {
    b.addEventListener('click', closeModal);
  });

  // Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  // ══════════════════════════════════════════════
  // TYPE PILLS
  // ══════════════════════════════════════════════
  overlay.querySelectorAll('.fu-type-pill').forEach(function (pill) {
    pill.addEventListener('click', function () {
      overlay.querySelectorAll('.fu-type-pill').forEach(function (p) { p.classList.remove('active'); });
      pill.classList.add('active');
      selectedType = pill.dataset.type;
    });
  });

  // ══════════════════════════════════════════════
  // SCREENSHOT CAPTURE
  // ══════════════════════════════════════════════
  function setScreenshot(dataUrl) {
    screenshotData = dataUrl;
    var preview = overlay.querySelector('.fu-screenshot-preview');
    var area = overlay.querySelector('.fu-screenshot-area');
    preview.src = dataUrl;
    preview.style.display = 'block';
    area.classList.add('has-capture');
  }

  // Capture button — uses html2canvas if available, otherwise Canvas API on viewport
  overlay.querySelector('.fu-screenshot-btn').addEventListener('click', function () {
    var captureBtn = this;
    captureBtn.textContent = 'Capturing...';
    captureBtn.disabled = true;

    // Hide the overlay temporarily for capture
    overlay.style.display = 'none';

    // Try html2canvas first (if loaded), otherwise use a basic approach
    if (typeof html2canvas !== 'undefined') {
      html2canvas(document.body, {
        useCORS: true,
        scale: window.devicePixelRatio || 1,
        logging: false
      }).then(function (canvas) {
        setScreenshot(canvas.toDataURL('image/png'));
        overlay.style.display = '';
        overlay.classList.add('open', 'visible');
        captureBtn.textContent = 'Recapture Screen';
        captureBtn.disabled = false;
      }).catch(function () {
        fallbackCapture();
      });
    } else {
      fallbackCapture();
    }

    function fallbackCapture() {
      // Load html2canvas dynamically
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = function () {
        html2canvas(document.body, {
          useCORS: true,
          scale: window.devicePixelRatio || 1,
          logging: false
        }).then(function (canvas) {
          setScreenshot(canvas.toDataURL('image/png'));
          overlay.style.display = '';
          overlay.classList.add('open', 'visible');
          captureBtn.textContent = 'Recapture Screen';
          captureBtn.disabled = false;
        }).catch(function () {
          overlay.style.display = '';
          overlay.classList.add('open', 'visible');
          captureBtn.textContent = 'Capture Failed — Try Paste';
          captureBtn.disabled = false;
        });
      };
      script.onerror = function () {
        overlay.style.display = '';
        overlay.classList.add('open', 'visible');
        captureBtn.textContent = 'Capture Failed — Try Paste';
        captureBtn.disabled = false;
      };
      document.head.appendChild(script);
    }
  });

  // Remove screenshot
  overlay.querySelector('.fu-screenshot-remove').addEventListener('click', function () {
    screenshotData = null;
    var area = overlay.querySelector('.fu-screenshot-area');
    area.classList.remove('has-capture');
    overlay.querySelector('.fu-screenshot-preview').style.display = 'none';
    overlay.querySelector('.fu-screenshot-btn').textContent = 'Capture Current Screen';
  });

  // Paste image from clipboard
  document.addEventListener('paste', function (e) {
    if (!overlay.classList.contains('open')) return;
    var items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (var i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        var blob = items[i].getAsFile();
        var reader = new FileReader();
        reader.onload = function (event) {
          setScreenshot(event.target.result);
        };
        reader.readAsDataURL(blob);
        e.preventDefault();
        break;
      }
    }
  });

  // ══════════════════════════════════════════════
  // SUBMIT TO GOOGLE FORM
  // ══════════════════════════════════════════════
  overlay.querySelector('.fu-submit-btn').addEventListener('click', function () {
    var description = overlay.querySelector('.fu-description').value.trim();
    if (!description) {
      overlay.querySelector('.fu-description').style.borderColor = '#FF6F61';
      overlay.querySelector('.fu-description').setAttribute('placeholder', 'Please describe the issue or idea...');
      overlay.querySelector('.fu-description').focus();
      setTimeout(function () {
        overlay.querySelector('.fu-description').style.borderColor = '';
      }, 2000);
      return;
    }

    var submitBtn = this;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    var pageUrl = window.location.href;
    var userAgent = navigator.userAgent;
    var viewport = window.innerWidth + 'x' + window.innerHeight;
    var timestamp = new Date().toISOString();

    // Build form data for Google Forms
    var formData = new FormData();
    formData.append(GOOGLE_FORM_CONFIG.fields.pageUrl, pageUrl);
    formData.append(GOOGLE_FORM_CONFIG.fields.feedbackType, selectedType);
    formData.append(GOOGLE_FORM_CONFIG.fields.description, description);
    formData.append(GOOGLE_FORM_CONFIG.fields.userAgent, userAgent + ' | Viewport: ' + viewport + ' | ' + timestamp);

    // Screenshots are sent as base64 in the screenshot field
    if (screenshotData) {
      // Truncate if too long for Google Forms (max ~1MB text field)
      var screenshotPayload = screenshotData.length > 1000000
        ? screenshotData.substring(0, 1000000) + '...[truncated]'
        : screenshotData;
      formData.append(GOOGLE_FORM_CONFIG.fields.screenshot, screenshotPayload);
    } else {
      formData.append(GOOGLE_FORM_CONFIG.fields.screenshot, '(none)');
    }

    // Submit via fetch (no-cors since Google Forms doesn't return CORS headers)
    fetch(GOOGLE_FORM_CONFIG.formAction, {
      method: 'POST',
      body: formData,
      mode: 'no-cors'
    }).then(function () {
      showSuccess();
    }).catch(function () {
      // no-cors always "succeeds" from our perspective — show success
      showSuccess();
    });

    function showSuccess() {
      formEl.style.display = 'none';
      successEl.style.display = '';
    }
  });

  // ══════════════════════════════════════════════
  // ALSO LOG TO CONSOLE FOR DEMO / DEBUGGING
  // ══════════════════════════════════════════════
  var origSubmit = overlay.querySelector('.fu-submit-btn');
  origSubmit.addEventListener('click', function () {
    var description = overlay.querySelector('.fu-description').value.trim();
    if (description) {
      console.log('━━━━━ FEEDBACK SUBMITTED ━━━━━');
      console.log('Type:', selectedType);
      console.log('Page:', window.location.href);
      console.log('Description:', description);
      console.log('Screenshot:', screenshotData ? 'Attached (' + Math.round(screenshotData.length / 1024) + 'KB)' : 'None');
      console.log('Viewport:', window.innerWidth + 'x' + window.innerHeight);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }, true); // capture phase so it fires before the main handler

})();
