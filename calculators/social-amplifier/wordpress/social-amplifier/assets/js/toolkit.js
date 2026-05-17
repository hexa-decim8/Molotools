/**
 * Social Amplifier — Embeddable Share Toolkit Widget
 *
 * WordPress version. Drop into any page with the shortcode:
 *   [social_amplifier_toolkit id="TOOLKIT_ID"]
 *
 * Or embed manually:
 *   <div id="sa-toolkit-{TOOLKIT_ID}"></div>
 *   <script src="{PLUGIN_URL}/assets/js/toolkit.js"
 *           data-toolkit-id="{TOOLKIT_ID}"
 *           data-api="{REST_API_BASE}"
 *           async></script>
 *
 * The widget fetches toolkit data from the WordPress REST API and renders
 * share buttons for each content item × platform combination.
 *
 * No external dependencies. Vanilla JS only.
 */
(function () {
  'use strict';

  // Find the most-recently-added script tag with data-toolkit-id.
  var scripts = document.querySelectorAll('script[data-toolkit-id]');
  var script = scripts[scripts.length - 1];
  if (!script) return;

  var toolkitId = script.getAttribute('data-toolkit-id');
  var apiBase   = (script.getAttribute('data-api') || '').replace(/\/$/, '');

  // ── Platform icons (inline SVG) ─────────────────────────────────────────

  var PLATFORM_ICONS = {
    facebook:
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
    instagram:
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
    x:
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    tiktok:
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
  };

  var PLATFORM_COLORS = {
    facebook: '#1877F2',
    instagram: '#E4405F',
    x: '#000000',
    tiktok: '#000000',
  };

  var PLATFORM_LABELS = {
    facebook: 'Facebook',
    instagram: 'Instagram',
    x: 'X (Twitter)',
    tiktok: 'TikTok',
  };

  // ── Fetch toolkit data ───────────────────────────────────────────────────

  fetch(apiBase + '/share/toolkit/' + encodeURIComponent(toolkitId))
    .then(function (res) {
      if (!res.ok) throw new Error('Toolkit not found');
      return res.json();
    })
    .then(renderToolkit)
    .catch(function (err) {
      console.error('[Social Amplifier] Failed to load toolkit:', err);
    });

  // ── Render ───────────────────────────────────────────────────────────────

  function renderToolkit(toolkit) {
    var container = document.getElementById('sa-toolkit-' + toolkitId);
    if (!container) {
      container = document.createElement('div');
      container.id = 'sa-toolkit-' + toolkitId;
      script.parentNode.insertBefore(container, script);
    }

    // Scoped styles.
    var style = document.createElement('style');
    style.textContent = buildStyles(toolkit.theme_color || '#1a73e8');
    container.appendChild(style);

    // Optional header.
    if (toolkit.header_text) {
      var header = document.createElement('div');
      header.className = 'sa-header';
      header.textContent = toolkit.header_text;
      container.appendChild(header);
    }

    // Content cards.
    var items = toolkit.content || [];
    items.forEach(function (item) {
      container.appendChild(buildCard(item, toolkit));
    });

    container.className = 'sa-toolkit';
  }

  function buildCard(item, toolkit) {
    var card = document.createElement('div');
    card.className = 'sa-card';

    // Media.
    if (item.media_url) {
      var img = document.createElement('img');
      img.src = item.media_url;
      img.alt = item.title;
      img.className = 'sa-media';
      card.appendChild(img);
    }

    // Text block.
    var text = document.createElement('div');
    text.className = 'sa-text';

    var title = document.createElement('h3');
    title.className = 'sa-title';
    title.textContent = item.title;
    text.appendChild(title);

    if (item.body) {
      var desc = document.createElement('p');
      desc.className = 'sa-desc';
      desc.textContent = item.body;
      text.appendChild(desc);
    }

    card.appendChild(text);

    // Share buttons.
    var buttons = document.createElement('div');
    buttons.className = 'sa-buttons';
    buttons.setAttribute('role', 'group');
    buttons.setAttribute('aria-label', 'Share options');

    var platforms = toolkit.platforms || [];
    platforms.forEach(function (platform) {
      var shareUrl = (item.share_urls || {})[platform];
      // Instagram has no share URL — widget handles via clipboard.
      if (!shareUrl && platform !== 'instagram') return;

      var btn = buildShareButton(platform, toolkit.cta_text || 'Share');
      btn.addEventListener('click', function () {
        trackShare(item.id, platform, toolkit);

        if (platform === 'instagram') {
          copyText(item.body || item.title);
          showToast(btn, 'Copied! Paste into Instagram');
        } else {
          window.open(shareUrl, '_blank', 'width=620,height=450,scrollbars=yes,resizable=yes');
        }
      });
      buttons.appendChild(btn);
    });

    // Copy button.
    var copyBtn = document.createElement('button');
    copyBtn.className = 'sa-btn sa-btn-copy';
    copyBtn.type = 'button';
    copyBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>' +
      '<span>Copy</span>';
    copyBtn.addEventListener('click', function () {
      copyText(item.body || item.title);
      trackShare(item.id, 'copy', toolkit);
      showToast(copyBtn, 'Copied!');
    });
    buttons.appendChild(copyBtn);

    card.appendChild(buttons);
    return card;
  }

  function buildShareButton(platform, ctaText) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sa-btn sa-btn-' + platform;
    btn.style.backgroundColor = PLATFORM_COLORS[platform] || '#333';
    btn.setAttribute('aria-label', 'Share on ' + (PLATFORM_LABELS[platform] || platform));
    btn.innerHTML =
      (PLATFORM_ICONS[platform] || '') +
      '<span>' + escapeHtml(ctaText) + '</span>';
    return btn;
  }

  // ── Analytics ────────────────────────────────────────────────────────────

  function trackShare(contentId, platform, toolkit) {
    var isNativePlatform = ['facebook', 'instagram', 'x', 'tiktok'].indexOf(platform) !== -1;
    fetch(apiBase + '/analytics/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toolkit_id:   toolkitId,
        content_id:   contentId,
        platform:     isNativePlatform ? platform : 'x',
        share_method: platform === 'copy' ? 'copy' : 'native',
      }),
    }).catch(function () { /* silent — never block the user */ });
  }

  // ── Utilities ────────────────────────────────────────────────────────────

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(function () {
        legacyCopy(text);
      });
    } else {
      legacyCopy(text);
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
  }

  function showToast(btn, message) {
    var original = btn.innerHTML;
    var originalStyle = btn.style.backgroundColor;
    btn.innerHTML = '<span>' + escapeHtml(message) + '</span>';
    btn.classList.add('sa-btn-success');
    btn.style.backgroundColor = '#38a169';
    setTimeout(function () {
      btn.innerHTML = original;
      btn.classList.remove('sa-btn-success');
      btn.style.backgroundColor = originalStyle;
    }, 2200);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  function buildStyles(themeColor) {
    return [
      '.sa-toolkit{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;max-width:640px;margin:0 auto;}',
      '.sa-header{font-size:1.25rem;font-weight:700;color:' + themeColor + ';margin-bottom:1rem;padding:.75rem 0;border-bottom:2px solid ' + themeColor + ';}',
      '.sa-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:1.25rem;margin-bottom:1rem;box-shadow:0 1px 3px rgba(0,0,0,.1);}',
      '.sa-media{width:100%;max-height:300px;object-fit:cover;border-radius:8px;margin-bottom:.75rem;display:block;}',
      '.sa-text{margin-bottom:1rem;}',
      '.sa-title{font-size:1rem;font-weight:600;margin:0 0 .5rem;color:#1a202c;}',
      '.sa-desc{font-size:.875rem;color:#4a5568;margin:0;line-height:1.5;}',
      '.sa-buttons{display:flex;gap:.5rem;flex-wrap:wrap;}',
      '.sa-btn{display:inline-flex;align-items:center;gap:.375rem;padding:.5rem 1rem;border:none;border-radius:8px;color:#fff;font-size:.8125rem;font-weight:500;cursor:pointer;transition:opacity .15s,transform .1s;line-height:1;}',
      '.sa-btn:hover{opacity:.88;transform:translateY(-1px);}',
      '.sa-btn:active{transform:translateY(0);}',
      '.sa-btn:focus-visible{outline:2px solid ' + themeColor + ';outline-offset:2px;}',
      '.sa-btn-copy{background:#718096;}',
      '.sa-btn-success{background:#38a169!important;}',
      '.sa-btn svg{flex-shrink:0;}',
    ].join('');
  }
})();
