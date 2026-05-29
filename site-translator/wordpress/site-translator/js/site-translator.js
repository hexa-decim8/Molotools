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

    var widgetReady = false;
    var pendingLang = '';
    var maxWidgetLookupAttempts = 8;
    var languagePreferenceKey = 'siteTranslatorPreferredLanguage';
    var ui = {
        shell: null,
        panel: null,
        toggle: null,
        quickReset: null,
        reset: null
    };
    var conflictObserver = null;
    var conflictSyncTimer = null;
    var conflictSyncIntervalMs = 300;

    var defaultConflictSelectors = [
        '[data-site-translator-conflict]',
        '.donate-takeover',
        '.takeover',
        '.popup',
        '.modal',
        '.elementor-popup-modal',
        '.pum-container',
        '.pum-overlay',
        '[aria-modal="true"]'
    ];
    var modalConflictSelectors = [
        '.elementor-popup-modal',
        '.pum-container',
        '.pum-overlay',
        '[aria-modal="true"]'
    ];
    var maxConflictNodesPerSelector = 8;

    function getConflictSelectors() {
        var config = window.siteTranslatorConfig || {};
        if (Array.isArray(config.conflictSelectors) && config.conflictSelectors.length) {
            return config.conflictSelectors;
        }
        return defaultConflictSelectors;
    }

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

    function savePreferredLanguage(langCode) {
        try {
            window.localStorage.setItem(languagePreferenceKey, langCode);
        } catch (e) {
            // Ignore storage failures (private mode / blocked storage).
        }
    }

    function getPreferredLanguage() {
        try {
            return window.localStorage.getItem(languagePreferenceKey) || '';
        } catch (e) {
            return '';
        }
    }

    function clearPreferredLanguage() {
        try {
            window.localStorage.removeItem(languagePreferenceKey);
        } catch (e) {
            // Ignore storage failures.
        }
    }

    function setPanelOpen(open) {
        if (!ui.shell || !ui.panel || !ui.toggle) {
            return;
        }

        if (open && ui.shell.classList.contains('site-translator-shell--suspended')) {
            return;
        }

        ui.shell.classList.toggle('site-translator-shell--open', open);
        ui.panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        ui.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function isVisibleElement(el) {
        if (!el || !el.ownerDocument || !el.ownerDocument.documentElement.contains(el)) {
            return false;
        }

        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity || '1') <= 0) {
            return false;
        }

        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function looksLikeDonateTakeover(el) {
        var text = (el.textContent || '').toLowerCase();
        if (text.indexOf('donate now') === -1) {
            return false;
        }
        return text.indexOf('close') !== -1 || text.indexOf('oligarch') !== -1;
    }

    function hasConflictUI() {
        for (var m = 0; m < modalConflictSelectors.length; m++) {
            var modalNodes = document.querySelectorAll(modalConflictSelectors[m]);
            for (var j = 0; j < modalNodes.length && j < maxConflictNodesPerSelector; j++) {
                if (isVisibleElement(modalNodes[j])) {
                    return true;
                }
            }
        }

        var selectors = getConflictSelectors();

        for (var s = 0; s < selectors.length; s++) {
            if (modalConflictSelectors.indexOf(selectors[s]) !== -1) {
                continue;
            }

            var nodes = document.querySelectorAll(selectors[s]);
            for (var i = 0; i < nodes.length && i < maxConflictNodesPerSelector; i++) {
                if (!isVisibleElement(nodes[i])) {
                    continue;
                }

                if (looksLikeDonateTakeover(nodes[i])) {
                    return true;
                }
            }
        }

        return false;
    }

    function syncSuspendedState() {
        if (!ui.shell) {
            return;
        }

        var suspended = hasConflictUI();
        ui.shell.classList.toggle('site-translator-shell--suspended', suspended);
        if (suspended) {
            setPanelOpen(false);
        }
    }

    function queueSuspendedStateSync() {
        if (conflictSyncTimer) {
            return;
        }

        conflictSyncTimer = window.setTimeout(function () {
            conflictSyncTimer = null;
            syncSuspendedState();
        }, conflictSyncIntervalMs);
    }

    function bindConflictObserver() {
        syncSuspendedState();

        if (conflictObserver) {
            return;
        }

        conflictObserver = new MutationObserver(function () {
            queueSuspendedStateSync();
        });

        conflictObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-hidden']
        });

        window.addEventListener('scroll', queueSuspendedStateSync, { passive: true });
        window.addEventListener('resize', queueSuspendedStateSync);
        window.addEventListener('pagehide', function () {
            if (conflictObserver) {
                conflictObserver.disconnect();
                conflictObserver = null;
            }
            if (conflictSyncTimer) {
                window.clearTimeout(conflictSyncTimer);
                conflictSyncTimer = null;
            }
        });
    }

    function setTranslateCookie(langCode) {
        var value = '/auto/' + langCode;
        document.cookie = 'googtrans=' + value + '; path=/';
        document.cookie = 'googtrans=' + value + '; path=/; domain=' + window.location.hostname;
    }

    function triggerChange(select) {
        try {
            select.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {
            var legacyEvent = document.createEvent('HTMLEvents');
            legacyEvent.initEvent('change', true, false);
            select.dispatchEvent(legacyEvent);
        }
    }

    function getTranslateSelect() {
        var container = document.getElementById('site-translator-google');
        if (container) {
            var inContainer = container.querySelector('select.goog-te-combo');
            if (inContainer) {
                return inContainer;
            }
        }
        return document.querySelector('select.goog-te-combo');
    }

    function ensureGoogleScriptLoaded() {
        if (document.querySelector('script[data-site-translator-google]')) {
            return;
        }

        var script = document.createElement('script');
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-site-translator-google', '1');
        document.body.appendChild(script);
    }

    function ensureWidgetContainer() {
        if (document.getElementById('site-translator-google')) {
            return;
        }

        var container = document.createElement('div');
        container.id = 'site-translator-google';
        container.style.display = 'none';
        document.body.appendChild(container);
    }

    function initGoogleWidget() {
        ensureWidgetContainer();

        window.googleTranslateElementInit = function () {
            if (window.google && window.google.translate && window.google.translate.TranslateElement) {
                new window.google.translate.TranslateElement(
                    {
                        pageLanguage: 'en',
                        includedLanguages: 'es,ar',
                        autoDisplay: false,
                        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
                    },
                    'site-translator-google'
                );
                widgetReady = true;

                if (pendingLang) {
                    var lang = pendingLang;
                    pendingLang = '';
                    setLanguage(lang);
                }
            }
        };

        ensureGoogleScriptLoaded();
    }

    /* ------------------------------------------------------------------ */
    /*  Translation control                                               */
    /* ------------------------------------------------------------------ */

    /**
     * Set the Google Translate widget to the given language code.
     * Works by finding the injected <select> inside the hidden widget div
     * and programmatically changing its value + dispatching a change event.
     */
    function setLanguage(langCode, attempt, options) {
        var config = options || {};
        var shouldPersist = config.persist !== false;
        var currentAttempt = typeof attempt === 'number' ? attempt : 0;
        var select = getTranslateSelect();

        if (!select) {
            if (!widgetReady) {
                pendingLang = langCode;
                initGoogleWidget();
            }

            if (currentAttempt < maxWidgetLookupAttempts) {
                window.setTimeout(function () {
                    setLanguage(langCode, currentAttempt + 1);
                }, 250);
                return;
            }

            // Fallback: persist target language and keep UI state without reloading.
            setTranslateCookie(langCode);
            if (shouldPersist) {
                savePreferredLanguage(langCode);
            }
            updateUI(langCode);
            setPanelOpen(false);
            return;
        }

        select.value = langCode;
        triggerChange(select);
        setTranslateCookie(langCode);
        if (shouldPersist) {
            savePreferredLanguage(langCode);
        }
        updateUI(langCode);
        setPanelOpen(false);
    }

    /**
     * Reset translation back to the original page language.
     */
    function resetTranslation() {
        deleteCookie('googtrans');
        clearPreferredLanguage();

        /* Trigger the widget to revert by selecting the original language. */
        var select = getTranslateSelect();
        if (select) {
            select.value = 'en';
            triggerChange(select);
        }

        /* Also remove the Google Translate iframe/banner that may linger. */
        var frame = document.querySelector('.skiptranslate iframe');
        if (frame) {
            frame.parentNode.style.display = 'none';
        }

        updateUI('');
        setPanelOpen(false);
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

        if (ui.quickReset) {
            ui.quickReset.style.display = langCode ? '' : 'none';
        }

        if (ui.toggle) {
            ui.toggle.textContent = langCode ? 'Language: ' + langCode.toUpperCase() : 'Translate';
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Build the floating button bar                                     */
    /* ------------------------------------------------------------------ */

    function buildBar() {
        var shell = document.createElement('div');
        shell.className = 'site-translator-shell';

        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'site-translator-toggle';
        toggle.textContent = 'Translate';
        toggle.setAttribute('aria-label', 'Open translation menu');
        toggle.setAttribute('aria-expanded', 'false');

        var bar = document.createElement('div');
        bar.className = 'site-translator-bar';
        bar.setAttribute('role', 'navigation');
        bar.setAttribute('aria-label', 'Translate this page');
        bar.setAttribute('aria-hidden', 'true');

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

        /* Reset button shown whenever a non-English language is active. */
        var reset = document.createElement('button');
        reset.type = 'button';
        reset.id = 'site-translator-reset';
        reset.className = 'site-translator-btn site-translator-btn--reset';
        reset.textContent = 'English';
        reset.setAttribute('aria-label', 'Reset to English');
        reset.style.display = 'none';
        reset.addEventListener('click', function () { resetTranslation(); });
        bar.appendChild(reset);

        /* Compact quick reset stays accessible even when menu is minimized. */
        var quickReset = document.createElement('button');
        quickReset.type = 'button';
        quickReset.className = 'site-translator-quick-reset';
        quickReset.textContent = 'EN';
        quickReset.setAttribute('aria-label', 'Translate back to English');
        quickReset.style.display = 'none';
        quickReset.addEventListener('click', function () { resetTranslation(); });

        toggle.addEventListener('click', function () {
            var isOpen = shell.classList.contains('site-translator-shell--open');
            setPanelOpen(!isOpen);
        });

        document.addEventListener('click', function (event) {
            if (!shell.contains(event.target)) {
                setPanelOpen(false);
            }
        });

        shell.appendChild(bar);
        shell.appendChild(toggle);
        shell.appendChild(quickReset);

        ui.shell = shell;
        ui.panel = bar;
        ui.toggle = toggle;
        ui.quickReset = quickReset;
        ui.reset = reset;

        document.body.appendChild(shell);
    }

    /* ------------------------------------------------------------------ */
    /*  Initialise                                                        */
    /* ------------------------------------------------------------------ */

    function init() {
        buildBar();
        bindConflictObserver();

        /* Restore state from saved preference first, then cookie fallback. */
        var active = getPreferredLanguage() || getActiveLanguage();
        if (active) {
            initGoogleWidget();
            setTranslateCookie(active);
            updateUI(active);
            setLanguage(active, 0, {
                persist: false,
                allowReloadFallback: false
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
