/**
 * Site Translator – Floating translate buttons for Spanish / Arabic.
 *
 * Relies on Google Translate Element being loaded via the footer snippet.
 * Hides the default Google UI and exposes two language buttons + a reset button.
 *
 * @license GPL-2.0-or-later
 */
(function () {
    'use strict';

    /* ------------------------------------------------------------------ */
    /*  Helpers                                                           */
    /* ------------------------------------------------------------------ */

    /**
     * Read a cookie value by name. Returns empty string if not found.
     */
    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
        return match ? decodeURIComponent(match[2]) : '';
    }

    /**
     * Delete a cookie by name across common path / domain combos so
     * Google Translate's "/auto/…" cookie is reliably cleared.
     */
    function deleteCookie(name) {
        var host = window.location.hostname;
        var domains = ['', host, '.' + host];
        var paths   = ['/', ''];
        for (var d = 0; d < domains.length; d++) {
            for (var p = 0; p < paths.length; p++) {
                document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC'
                    + (paths[p] ? '; path=' + paths[p] : '')
                    + (domains[d] ? '; domain=' + domains[d] : '');
            }
        }
    }

    /**
     * Detect the currently-active Google Translate language from the cookie.
     * googtrans value looks like "/en/es" or "/auto/ar".
     */
    function getActiveLanguage() {
        var val = getCookie('googtrans');
        if (!val) return '';
        var parts = val.split('/');
        return parts.length >= 3 ? parts[2] : '';
    }

    /* ------------------------------------------------------------------ */
    /*  Translation control                                               */
    /* ------------------------------------------------------------------ */

    /**
     * Set the Google Translate widget to the given language code.
     * Works by finding the injected <select> inside the hidden widget div
     * and programmatically changing its value + dispatching a change event.
     */
    function setLanguage(langCode) {
        var container = document.getElementById('site-translator-google');
        if (!container) return;

        var select = container.querySelector('select.goog-te-combo');
        if (!select) return;

        select.value = langCode;
        select.dispatchEvent(new Event('change'));

        updateUI(langCode);
    }

    /**
     * Reset translation back to the original page language.
     */
    function resetTranslation() {
        deleteCookie('googtrans');

        /* Trigger the widget to revert by selecting the empty/original value. */
        var container = document.getElementById('site-translator-google');
        if (container) {
            var select = container.querySelector('select.goog-te-combo');
            if (select) {
                select.value = '';
                select.dispatchEvent(new Event('change'));
            }
        }

        /* Also remove the Google Translate iframe/banner that may linger. */
        var frame = document.querySelector('.skiptranslate iframe');
        if (frame) {
            frame.parentNode.style.display = 'none';
        }

        updateUI('');
    }

    /* ------------------------------------------------------------------ */
    /*  RTL + button state                                                */
    /* ------------------------------------------------------------------ */

    function updateUI(langCode) {
        var html = document.documentElement;
        var body = document.body;

        /* RTL for Arabic */
        if (langCode === 'ar') {
            html.setAttribute('dir', 'rtl');
            body.classList.add('site-translator-rtl');
        } else {
            html.setAttribute('dir', 'ltr');
            body.classList.remove('site-translator-rtl');
        }

        /* Highlight the active button */
        var buttons = document.querySelectorAll('.site-translator-btn');
        for (var i = 0; i < buttons.length; i++) {
            var btn = buttons[i];
            if (btn.dataset.lang === langCode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }

        /* Show/hide the reset button */
        var resetBtn = document.getElementById('site-translator-reset');
        if (resetBtn) {
            resetBtn.style.display = langCode ? '' : 'none';
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Build the floating button bar                                     */
    /* ------------------------------------------------------------------ */

    function buildBar() {
        var bar = document.createElement('div');
        bar.className = 'site-translator-bar';
        bar.setAttribute('role', 'navigation');
        bar.setAttribute('aria-label', 'Translate this page');

        var langs = [
            { code: 'es', label: 'Español' },
            { code: 'ar', label: 'العربية' }
        ];

        for (var i = 0; i < langs.length; i++) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'site-translator-btn';
            btn.dataset.lang = langs[i].code;
            btn.textContent = langs[i].label;
            btn.setAttribute('aria-label', 'Translate to ' + langs[i].label);
            btn.addEventListener('click', (function (code) {
                return function () { setLanguage(code); };
            })(langs[i].code));
            bar.appendChild(btn);
        }

        /* Reset / close button – hidden by default */
        var reset = document.createElement('button');
        reset.type = 'button';
        reset.id = 'site-translator-reset';
        reset.className = 'site-translator-btn site-translator-btn--reset';
        reset.textContent = '✕';
        reset.setAttribute('aria-label', 'Reset to English');
        reset.style.display = 'none';
        reset.addEventListener('click', function () { resetTranslation(); });
        bar.appendChild(reset);

        document.body.appendChild(bar);
    }

    /* ------------------------------------------------------------------ */
    /*  Initialise                                                        */
    /* ------------------------------------------------------------------ */

    function init() {
        buildBar();

        /* Restore state from cookie (survives page refresh). */
        var active = getActiveLanguage();
        if (active) {
            updateUI(active);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
