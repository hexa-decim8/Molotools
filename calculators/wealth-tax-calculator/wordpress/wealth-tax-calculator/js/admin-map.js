// Billionaire Wealth Tax Calculator — Michigan visitor map (admin dashboard)
// Reads wtcMichiganMap injected via wp_localize_script.
// Renders proportional city bubbles onto the inline SVG county map.
(function () {
    'use strict';

    var WTC_ANALYTICS_COLLAPSE_KEY = 'wtcAnalyticsCardStatesV1';

    function initAnalyticsCharts() {
        var toggleGroups = document.querySelectorAll('.wtc-analytics-chart-toggle');
        if (!toggleGroups.length) {
            return;
        }

        for (var i = 0; i < toggleGroups.length; i++) {
            (function (toggleGroup) {
                var chartCard = toggleGroup.closest('.wtc-analytics-chart-card');
                if (!chartCard) {
                    return;
                }

                var buttons = toggleGroup.querySelectorAll('.wtc-analytics-toggle-btn');
                var panels = chartCard.querySelectorAll('.wtc-analytics-popularity-panel');
                if (!buttons.length || !panels.length) {
                    return;
                }

                function showPanel(target) {
                    for (var p = 0; p < panels.length; p++) {
                        var panel = panels[p];
                        var isTarget = panel.getAttribute('data-wtc-panel') === target;
                        panel.hidden = !isTarget;
                        panel.classList.toggle('is-active', isTarget);
                    }

                    for (var b = 0; b < buttons.length; b++) {
                        var button = buttons[b];
                        var isActive = button.getAttribute('data-wtc-target') === target;
                        button.classList.toggle('is-active', isActive);
                        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
                    }
                }

                for (var b = 0; b < buttons.length; b++) {
                    buttons[b].addEventListener('click', function () {
                        var target = this.getAttribute('data-wtc-target');
                        if (target) {
                            showPanel(target);
                        }
                    });
                }
            }(toggleGroups[i]));
        }
    }

    function initAnalyticsScopeTabs() {
        var tabGroups = document.querySelectorAll('.wtc-analytics-section-toggle');
        if (!tabGroups.length) {
            return;
        }

        for (var i = 0; i < tabGroups.length; i++) {
            (function (tabGroup) {
                var scopeRoot = tabGroup.parentElement;
                if (!scopeRoot) {
                    return;
                }

                var buttons = tabGroup.querySelectorAll('.wtc-analytics-toggle-btn');
                var panels = scopeRoot.querySelectorAll('.wtc-analytics-section-panel');
                if (!buttons.length || !panels.length) {
                    return;
                }

                function showPanel(target) {
                    for (var p = 0; p < panels.length; p++) {
                        var panel = panels[p];
                        var isTarget = panel.getAttribute('data-wtc-section-panel') === target;
                        panel.hidden = !isTarget;
                        panel.classList.toggle('is-active', isTarget);
                    }

                    for (var b = 0; b < buttons.length; b++) {
                        var button = buttons[b];
                        var isActive = button.getAttribute('data-wtc-section-target') === target;
                        button.classList.toggle('is-active', isActive);
                        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
                    }
                }

                for (var b = 0; b < buttons.length; b++) {
                    buttons[b].addEventListener('click', function () {
                        var target = this.getAttribute('data-wtc-section-target');
                        if (target) {
                            showPanel(target);
                        }
                    });
                }
            }(tabGroups[i]));
        }
    }

    function formatNumber(value) {
        var number = parseInt(value, 10);
        if (!number || number < 0) {
            number = 0;
        }

        return number.toLocaleString();
    }

    function formatAverageRate(value) {
        var number = parseFloat(value);
        if (!number || number <= 0) {
            return '-';
        }

        return number.toFixed(1) + '%';
    }

    function buildStateTileMap(container, selectedStateCode, stateAnalytics) {
        var tileKeys;
        var maxCount = 0;
        var code;
        var i;

        if (!container) {
            return;
        }

        tileKeys = Object.keys(WTC_US_STATE_TILES);
        for (i = 0; i < tileKeys.length; i++) {
            code = tileKeys[i];
            if (!stateAnalytics[code]) {
                continue;
            }

            maxCount = Math.max(maxCount, parseInt(stateAnalytics[code].stateSessions, 10) || 0);
        }

        container.innerHTML = '';

        for (i = 0; i < tileKeys.length; i++) {
            code = tileKeys[i];
            (function (stateCode) {
                var tile = document.createElement('button');
                var tileMeta = WTC_US_STATE_TILES[stateCode];
                var stateEntry = stateAnalytics[stateCode] || {};
                var stateLabel = stateEntry.label || tileMeta.label || stateCode;
                var count = parseInt(stateEntry.stateSessions, 10) || 0;
                var level = maxCount > 0 ? Math.max(1, Math.min(5, Math.ceil((count / maxCount) * 5))) : 1;
                var isSelected = stateCode === selectedStateCode;

                tile.type = 'button';
                tile.className = 'wtc-state-tile wtc-us-level-' + level + (isSelected ? ' is-selected' : '') + (count > 0 ? ' has-data' : ' is-empty');
                tile.style.gridColumn = String(tileMeta.x + 1);
                tile.style.gridRow = String(tileMeta.y + 1);
                tile.setAttribute('data-state-code', stateCode);
                tile.setAttribute('title', getSessionLabel(stateLabel, count));
                tile.setAttribute('aria-label', getSessionLabel(stateLabel, count));
                tile.textContent = stateCode;
                container.appendChild(tile);
            }(code));
        }
    }

    function renderCountyBubbles(container, counties) {
        var maxCount = 0;
        var i;

        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (!counties || !counties.length) {
            return;
        }

        for (i = 0; i < counties.length; i++) {
            maxCount = Math.max(maxCount, parseInt(counties[i].count, 10) || 0);
        }

        counties.slice(0, 36).forEach(function (county) {
            var count = parseInt(county.count, 10) || 0;
            var ratio = maxCount > 0 ? Math.sqrt(count / maxCount) : 0;
            var size = Math.round(30 + ratio * 58);
            var bubble = document.createElement('div');
            var countEl = document.createElement('span');
            var labelEl = document.createElement('span');

            bubble.className = 'wtc-state-county-bubble';
            bubble.style.width = size + 'px';
            bubble.style.height = size + 'px';
            bubble.title = county.label + ': ' + formatNumber(count);

            countEl.className = 'wtc-state-county-bubble-count';
            countEl.textContent = formatNumber(count);

            labelEl.className = 'wtc-state-county-bubble-label';
            labelEl.textContent = county.label;

            bubble.appendChild(countEl);
            bubble.appendChild(labelEl);
            container.appendChild(bubble);
        });
    }

    function renderCountyTable(tableBody, tableEl, emptyEl, counties) {
        var i;

        if (!tableBody || !tableEl || !emptyEl) {
            return;
        }

        tableBody.innerHTML = '';

        if (!counties || !counties.length) {
            tableEl.hidden = true;
            emptyEl.hidden = false;
            return;
        }

        for (i = 0; i < counties.length && i < 20; i++) {
            var row = document.createElement('tr');
            var countyCell = document.createElement('td');
            var countCell = document.createElement('td');

            countyCell.textContent = counties[i].label;
            countCell.textContent = formatNumber(counties[i].count);

            row.appendChild(countyCell);
            row.appendChild(countCell);
            tableBody.appendChild(row);
        }

        tableEl.hidden = false;
        emptyEl.hidden = true;
    }

    function extractCountySlug(bucket, stateCode) {
        var prefix = String(stateCode || '').toLowerCase() + '_county_';
        var value = String(bucket || '').toLowerCase();
        if (value.indexOf(prefix) !== 0) {
            return '';
        }

        return value.substring(prefix.length);
    }

    function clearStateCountyGeometry(hostEl, emptyEl) {
        if (hostEl) {
            hostEl.innerHTML = '';
        }
        if (emptyEl) {
            emptyEl.hidden = false;
        }
    }

    function renderStateCountyGeometryFromTemplate(stateCode, templateId, hostEl, emptyEl, counties) {
        var templateRoot = document.getElementById(templateId);
        var svgTemplate;
        var svgEl;
        var maxCount = 0;
        var points = [];
        var bubbleGroup;
        var tooltipEl;

        if (!hostEl || !templateRoot) {
            clearStateCountyGeometry(hostEl, emptyEl);
            return;
        }

        svgTemplate = templateRoot.querySelector('svg');
        if (!svgTemplate) {
            clearStateCountyGeometry(hostEl, emptyEl);
            return;
        }

        svgEl = svgTemplate.cloneNode(true);
        svgEl.id = 'wtc-state-map-' + String(stateCode || '').toLowerCase();

        hostEl.innerHTML = '';
        hostEl.appendChild(svgEl);

        tooltipEl = document.createElement('div');
        tooltipEl.className = 'wtc-state-county-map-tooltip';
        hostEl.appendChild(tooltipEl);

        counties.forEach(function (county) {
            var count = parseInt(county.count, 10) || 0;
            var slug;
            var path;
            var bbox;

            if (count <= 0) {
                return;
            }

            slug = extractCountySlug(county.bucket, stateCode);
            if (!slug || slug === 'unknown') {
                return;
            }

            path = svgEl.querySelector('#wtc-county-' + slug);
            if (!path || typeof path.getBBox !== 'function') {
                return;
            }

            bbox = path.getBBox();
            maxCount = Math.max(maxCount, count);
            points.push({
                count: count,
                x: bbox.x + (bbox.width / 2),
                y: bbox.y + (bbox.height / 2),
                label: county.label || slug
            });
        });

        if (!points.length) {
            clearStateCountyGeometry(hostEl, emptyEl);
            hostEl.appendChild(svgEl);
            return;
        }

        bubbleGroup = document.createElementNS(SVG_NS, 'g');
        bubbleGroup.setAttribute('class', 'wtc-state-county-map-bubbles');
        svgEl.appendChild(bubbleGroup);

        points.sort(function (a, b) { return a.count - b.count; });

        points.forEach(function (point) {
            var ratio = maxCount > 0 ? Math.sqrt(point.count / maxCount) : 0;
            var radius = Math.round(5 + ratio * 20);
            var circle = document.createElementNS(SVG_NS, 'circle');

            circle.setAttribute('class', 'wtc-state-county-map-bubble');
            circle.setAttribute('cx', point.x);
            circle.setAttribute('cy', point.y);
            circle.setAttribute('r', radius);
            circle.setAttribute('data-county', point.label);
            circle.setAttribute('data-count', point.count);
            circle.setAttribute('tabindex', '0');
            circle.setAttribute('role', 'img');
            circle.setAttribute('aria-label', getSessionLabel(point.label, point.count));
            bubbleGroup.appendChild(circle);
        });

        if (emptyEl) {
            emptyEl.hidden = true;
        }

        if (!tooltipEl) {
            return;
        }

        bubbleGroup.addEventListener('mousemove', function (event) {
            var target = event.target;
            if (target.classList.contains('wtc-state-county-map-bubble')) {
                showTooltip(tooltipEl, hostEl, event.clientX, event.clientY, target.getAttribute('data-county'), parseInt(target.getAttribute('data-count'), 10));
            } else {
                hideTooltip(tooltipEl);
            }
        });

        bubbleGroup.addEventListener('mouseleave', function () {
            hideTooltip(tooltipEl);
        });

        bubbleGroup.addEventListener('focusin', function (event) {
            var target = event.target;
            var rect;
            if (!target.classList.contains('wtc-state-county-map-bubble')) {
                return;
            }

            rect = target.getBoundingClientRect();
            showTooltip(tooltipEl, hostEl, (rect.left + rect.right) / 2, rect.top, target.getAttribute('data-county'), parseInt(target.getAttribute('data-count'), 10));
        });

        bubbleGroup.addEventListener('focusout', function () {
            hideTooltip(tooltipEl);
        });
    }

    function renderStateCountyGeometry(stateCode, templateMap, hostEl, emptyEl, counties) {
        var normalizedCode = String(stateCode || '').toUpperCase();
        var templateId = templateMap && templateMap[normalizedCode] ? templateMap[normalizedCode] : '';

        if (templateId) {
            renderStateCountyGeometryFromTemplate(normalizedCode, templateId, hostEl, emptyEl, counties);
            return;
        }

        clearStateCountyGeometry(hostEl, emptyEl);
    }

    function initStateAnalyticsPanel() {
        if (typeof window.wtcStateAnalytics === 'undefined') {
            return;
        }

        var payload = window.wtcStateAnalytics;
        var states = payload.states || {};
        var geometryTemplates = payload.geometryTemplates || {};
        var selector = document.getElementById('wtc-state-analytics-select');
        var titleEl = document.getElementById('wtc-state-panel-title');
        var countyTitleEl = document.getElementById('wtc-state-county-title');
        var submittedEl = document.getElementById('wtc-state-submitted-sessions');
        var uniqueEl = document.getElementById('wtc-state-unique-sessions');
        var daysEl = document.getElementById('wtc-state-days-stored');
        var avgEl = document.getElementById('wtc-state-average-rate');
        var countyBubblesEl = document.getElementById('wtc-state-county-bubbles');
        var countyEmptyEl = document.getElementById('wtc-state-county-empty');
        var countyGeometryEl = document.getElementById('wtc-state-county-geometry');
        var countyGeometryEmptyEl = document.getElementById('wtc-state-county-geometry-empty');
        var countyTableEl = document.getElementById('wtc-state-county-table');
        var countyTableBodyEl = document.getElementById('wtc-state-county-table-body');
        var countyTableEmptyEl = document.getElementById('wtc-state-county-table-empty');
        var tileMapEl = document.getElementById('wtc-state-geo-map');
        var defaultState = payload.defaultState || 'MI';

        if (!countyTableEl && countyTableBodyEl && countyTableBodyEl.closest) {
            countyTableEl = countyTableBodyEl.closest('table');
        }

        if (!selector || !titleEl || !submittedEl || !uniqueEl || !daysEl || !avgEl || !countyBubblesEl || !countyEmptyEl || !countyGeometryEl || !countyGeometryEmptyEl || !countyTableEl || !countyTableBodyEl || !countyTableEmptyEl || !tileMapEl) {
            return;
        }

        function showStateTab() {
            var stateTabButton = document.querySelector('.wtc-analytics-section-toggle .wtc-analytics-toggle-btn[data-wtc-section-target="state"]');
            if (stateTabButton && !stateTabButton.classList.contains('is-active')) {
                stateTabButton.click();
            }
        }

        function updateStatePanel(stateCode) {
            var normalizedCode = String(stateCode || '').toUpperCase();
            var stateEntry = states[normalizedCode];
            var totals;
            var counties;

            if (!stateEntry) {
                return;
            }

            totals = stateEntry.totals || {};
            counties = Array.isArray(stateEntry.counties) ? stateEntry.counties : [];

            titleEl.textContent = stateEntry.label || normalizedCode;
            if (countyTitleEl) {
                countyTitleEl.textContent = stateEntry.label || normalizedCode;
            }

            submittedEl.textContent = formatNumber(totals.submittedSessions);
            uniqueEl.textContent = formatNumber(totals.uniqueSessions);
            daysEl.textContent = formatNumber(totals.daysStored);
            avgEl.textContent = formatAverageRate(totals.averageTaxRate);

            renderCountyBubbles(countyBubblesEl, counties);
            countyEmptyEl.hidden = counties.length > 0;

            renderStateCountyGeometry(normalizedCode, geometryTemplates, countyGeometryEl, countyGeometryEmptyEl, counties);

            renderCountyTable(countyTableBodyEl, countyTableEl, countyTableEmptyEl, counties);
            buildStateTileMap(tileMapEl, normalizedCode, states);
        }

        selector.addEventListener('change', function () {
            updateStatePanel(this.value);
            showStateTab();
        });

        tileMapEl.addEventListener('click', function (event) {
            var tile = event.target.closest ? event.target.closest('.wtc-state-tile[data-state-code]') : null;
            if (!tile) {
                return;
            }

            if (selector.querySelector('option[value="' + tile.getAttribute('data-state-code') + '"]:disabled')) {
                return;
            }

            selector.value = tile.getAttribute('data-state-code');
            updateStatePanel(selector.value);
            showStateTab();
        });

        if (!selector.value) {
            selector.value = defaultState;
        }

        updateStatePanel(selector.value || defaultState);
    }

    function normalizeSectionKey(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'section';
    }

    function loadCollapsedSectionState() {
        var raw;
        try {
            raw = window.localStorage.getItem(WTC_ANALYTICS_COLLAPSE_KEY);
        } catch (error) {
            return {};
        }

        if (!raw) {
            return {};
        }

        try {
            return JSON.parse(raw) || {};
        } catch (error) {
            return {};
        }
    }

    function saveCollapsedSectionState(state) {
        try {
            window.localStorage.setItem(WTC_ANALYTICS_COLLAPSE_KEY, JSON.stringify(state));
        } catch (error) {
            // Ignore storage failures (e.g. private mode restrictions).
        }
    }

    function initCollapsibleAnalyticsSections() {
        var cards = document.querySelectorAll('.wrap > .card:not(.wtc-no-collapse), .wrap > .wtc-analytics-section-panel > .card:not(.wtc-no-collapse)');
        var collapsedState = loadCollapsedSectionState();
        var keyCounts = {};

        if (!cards.length) {
            return;
        }

        for (var i = 0; i < cards.length; i++) {
            (function (card, index) {
                var heading = card.querySelector(':scope > h2');
                var body;
                var button;
                var icon;
                var sectionLabel;
                var baseKey;
                var collisionCount;
                var stateKey;
                var bodyId;
                var isCollapsed;

                if (!heading) {
                    return;
                }

                sectionLabel = heading.textContent ? heading.textContent.trim() : '';
                if (!sectionLabel) {
                    return;
                }

                baseKey = normalizeSectionKey(sectionLabel);
                collisionCount = keyCounts[baseKey] || 0;
                keyCounts[baseKey] = collisionCount + 1;
                stateKey = collisionCount > 0 ? baseKey + '-' + collisionCount : baseKey;
                bodyId = 'wtc-analytics-section-body-' + String(index + 1);

                card.classList.add('wtc-analytics-collapsible');
                heading.classList.add('wtc-analytics-section-heading');

                button = document.createElement('button');
                button.type = 'button';
                button.className = 'wtc-analytics-section-toggle-btn';
                button.setAttribute('aria-controls', bodyId);

                button.appendChild(document.createTextNode(sectionLabel));

                icon = document.createElement('span');
                icon.className = 'wtc-analytics-section-toggle-icon';
                icon.setAttribute('aria-hidden', 'true');
                button.appendChild(icon);

                heading.textContent = '';
                heading.appendChild(button);

                body = document.createElement('div');
                body.id = bodyId;
                body.className = 'wtc-analytics-section-body';

                while (heading.nextSibling) {
                    body.appendChild(heading.nextSibling);
                }

                card.appendChild(body);

                isCollapsed = collapsedState[stateKey] === true;

                function setCollapsed(nextCollapsed) {
                    body.hidden = nextCollapsed;
                    card.classList.toggle('is-collapsed', nextCollapsed);
                    button.setAttribute('aria-expanded', nextCollapsed ? 'false' : 'true');
                    collapsedState[stateKey] = nextCollapsed;
                    saveCollapsedSectionState(collapsedState);
                }

                setCollapsed(isCollapsed);

                button.addEventListener('click', function () {
                    setCollapsed(!card.classList.contains('is-collapsed'));
                });
            }(cards[i], i));
        }
    }

    var WTC_US_STATE_TILES = {
        'WA': {x:0, y:0, label:'Washington'},
        'OR': {x:0, y:1, label:'Oregon'},
        'CA': {x:0, y:2, label:'California'},
        'AK': {x:0, y:6, label:'Alaska'},
        'ID': {x:1, y:1, label:'Idaho'},
        'NV': {x:1, y:2, label:'Nevada'},
        'HI': {x:1, y:6, label:'Hawaii'},
        'MT': {x:2, y:0, label:'Montana'},
        'WY': {x:2, y:1, label:'Wyoming'},
        'UT': {x:2, y:2, label:'Utah'},
        'AZ': {x:2, y:3, label:'Arizona'},
        'CO': {x:3, y:2, label:'Colorado'},
        'NM': {x:3, y:3, label:'New Mexico'},
        'ND': {x:4, y:0, label:'North Dakota'},
        'SD': {x:4, y:1, label:'South Dakota'},
        'NE': {x:4, y:2, label:'Nebraska'},
        'KS': {x:4, y:3, label:'Kansas'},
        'OK': {x:4, y:4, label:'Oklahoma'},
        'TX': {x:4, y:5, label:'Texas'},
        'MN': {x:5, y:0, label:'Minnesota'},
        'IA': {x:5, y:1, label:'Iowa'},
        'MO': {x:5, y:2, label:'Missouri'},
        'AR': {x:5, y:3, label:'Arkansas'},
        'LA': {x:5, y:4, label:'Louisiana'},
        'WI': {x:6, y:0, label:'Wisconsin'},
        'IL': {x:6, y:1, label:'Illinois'},
        'KY': {x:6, y:2, label:'Kentucky'},
        'TN': {x:6, y:3, label:'Tennessee'},
        'MS': {x:6, y:4, label:'Mississippi'},
        'MI': {x:7, y:0, label:'Michigan'},
        'IN': {x:7, y:1, label:'Indiana'},
        'OH': {x:8, y:1, label:'Ohio'},
        'WV': {x:8, y:2, label:'West Virginia'},
        'AL': {x:7, y:4, label:'Alabama'},
        'GA': {x:8, y:4, label:'Georgia'},
        'FL': {x:9, y:5, label:'Florida'},
        'VA': {x:9, y:2, label:'Virginia'},
        'NC': {x:9, y:3, label:'North Carolina'},
        'SC': {x:9, y:4, label:'South Carolina'},
        'PA': {x:9, y:1, label:'Pennsylvania'},
        'NY': {x:10, y:0, label:'New York'},
        'NJ': {x:10, y:1, label:'New Jersey'},
        'DE': {x:10, y:2, label:'Delaware'},
        'MD': {x:10, y:3, label:'Maryland'},
        'VT': {x:11, y:0, label:'Vermont'},
        'NH': {x:11, y:1, label:'New Hampshire'},
        'MA': {x:11, y:2, label:'Massachusetts'},
        'CT': {x:11, y:3, label:'Connecticut'},
        'RI': {x:12, y:3, label:'Rhode Island'},
        'ME': {x:12, y:1, label:'Maine'}
    };

    var WTC_MI_CITIES = {
        'detroit': {x:463.6, y:491.1, label:'Detroit'},
        'grand-rapids': {x:305.1, y:440.2, label:'Grand Rapids'},
        'warren': {x:464.7, y:479.4, label:'Warren'},
        'sterling-heights': {x:464.5, y:471.1, label:'Sterling Heights'},
        'ann-arbor': {x:421.5, y:495.2, label:'Ann Arbor'},
        'lansing': {x:372.3, y:458.8, label:'Lansing'},
        'flint': {x:424.8, y:436.2, label:'Flint'},
        'dearborn': {x:455.7, y:491.9, label:'Dearborn'},
        'livonia': {x:445.0, y:488.1, label:'Livonia'},
        'troy': {x:457.6, y:469.0, label:'Troy'},
        'westland': {x:442.2, y:491.7, label:'Westland'},
        'kalamazoo': {x:310.0, y:494.3, label:'Kalamazoo'},
        'saginaw': {x:408.9, y:403.4, label:'Saginaw'},
        'muskegon': {x:270.1, y:418.3, label:'Muskegon'},
        'holland': {x:278.5, y:454.4, label:'Holland'},
        'battle-creek': {x:334.6, y:491.9, label:'Battle Creek'},
        'bay-city': {x:412.6, y:389.3, label:'Bay City'},
        'pontiac': {x:448.8, y:466.3, label:'Pontiac'},
        'midland': {x:391.0, y:387.6, label:'Midland'},
        'jackson': {x:381.7, y:498.1, label:'Jackson'},
        'portage': {x:310.5, y:501.6, label:'Portage'},
        'royal-oak': {x:457.6, y:478.3, label:'Royal Oak'},
        'southfield': {x:452.9, y:479.7, label:'Southfield'},
        'farmington-hills': {x:443.6, y:478.7, label:'Farmington Hills'},
        'st-clair-shores': {x:472.6, y:478.2, label:'St. Clair Shores'},
        'canton': {x:437.2, y:493.0, label:'Canton'},
        'clinton-township': {x:467.8, y:469.4, label:'Clinton Township'},
        'ypsilanti': {x:429.3, y:498.4, label:'Ypsilanti'},
        'dearborn-heights': {x:449.7, y:490.6, label:'Dearborn Heights'},
        'taylor': {x:450.0, y:498.4, label:'Taylor'},
        'roseville': {x:470.1, y:477.7, label:'Roseville'},
        'novi': {x:437.6, y:479.0, label:'Novi'},
        'east-lansing': {x:376.7, y:458.5, label:'East Lansing'},
        'mount-pleasant': {x:359.5, y:389.0, label:'Mount Pleasant'},
        'port-huron': {x:501.1, y:439.6, label:'Port Huron'},
        'traverse-city': {x:308.0, y:295.1, label:'Traverse City'},
        'alpena': {x:440.2, y:271.0, label:'Alpena'},
        'marquette': {x:200.8, y:151.5, label:'Marquette'},
        'escanaba': {x:220.7, y:215.9, label:'Escanaba'},
        'sault-ste-marie': {x:385.1, y:155.4, label:'Sault Ste. Marie'},
        'iron-mountain': {x:160.2, y:209.9, label:'Iron Mountain'},
        'houghton': {x:130.0, y:104.9, label:'Houghton'},
        'cadillac': {x:321.3, y:336.4, label:'Cadillac'},
        'petoskey': {x:348.2, y:245.8, label:'Petoskey'},
        'manistee': {x:265.5, y:336.9, label:'Manistee'},
        'big-rapids': {x:316.3, y:380.8, label:'Big Rapids'},
        'niles': {x:269.7, y:531.5, label:'Niles'},
        'benton-harbor': {x:257.6, y:508.5, label:'Benton Harbor'},
        'adrian': {x:403.7, y:526.1, label:'Adrian'},
        'monroe': {x:442.4, y:524.6, label:'Monroe'},
        'owosso': {x:395.4, y:437.4, label:'Owosso'},
        'mount-clemens': {x:473.7, y:469.7, label:'Mount Clemens'},
        'auburn-hills': {x:452.1, y:462.5, label:'Auburn Hills'},
        'wyoming': {x:302.8, y:444.7, label:'Wyoming'},
        'kentwood': {x:306.6, y:447.8, label:'Kentwood'},
        'romulus': {x:442.4, y:499.8, label:'Romulus'},
        'ferndale': {x:458.2, y:480.7, label:'Ferndale'},
        'lincoln-park': {x:455.5, y:498.2, label:'Lincoln Park'},
        'allen-park': {x:453.7, y:497.1, label:'Allen Park'},
        'southgate': {x:454.7, y:500.6, label:'Southgate'},
        'wyandotte': {x:457.3, y:500.6, label:'Wyandotte'},
        'trenton': {x:455.6, y:506.6, label:'Trenton'},
        'grosse-pointe': {x:471.8, y:486.8, label:'Grosse Pointe'},
        'hamtramck': {x:463.3, y:485.9, label:'Hamtramck'},
        'inkster': {x:447.4, y:494.1, label:'Inkster'},
        'garden-city': {x:445.8, y:491.6, label:'Garden City'},
        'walker': {x:299.0, y:437.2, label:'Walker'},
        'grandville': {x:299.5, y:444.5, label:'Grandville'},
        'hudsonville': {x:293.4, y:447.6, label:'Hudsonville'},
        'zeeland': {x:284.0, y:452.4, label:'Zeeland'},
        'comstock-park': {x:304.7, y:433.5, label:'Comstock Park'},
        'ionia': {x:341.8, y:438.2, label:'Ionia'},
        'greenville': {x:330.2, y:422.9, label:'Greenville'},
        'okemos': {x:380.1, y:461.5, label:'Okemos'},
        'rochester-hills': {x:457.3, y:464.8, label:'Rochester Hills'},
        'oak-park': {x:455.3, y:480.7, label:'Oak Park'},
        'waterford': {x:441.3, y:461.9, label:'Waterford'},
        'west-bloomfield': {x:443.8, y:472.1, label:'West Bloomfield'},
        'shelby-township': {x:464.2, y:463.3, label:'Shelby Township'},
        'macomb-township': {x:473.2, y:463.6, label:'Macomb Township'},
        'harper-woods': {x:470.9, y:482.4, label:'Harper Woods'},
        'grosse-pointe-woods': {x:472.2, y:482.4, label:'Grosse Pointe Woods'},
        'grosse-pointe-park': {x:471.7, y:487.5, label:'Grosse Pointe Park'},
        'riverview': {x:455.5, y:503.9, label:'Riverview'},
        'highland-park': {x:460.5, y:485.2, label:'Highland Park'},
        'alma': {x:366.0, y:406.6, label:'Alma'},
        'sturgis': {x:320.2, y:534.0, label:'Sturgis'},
        'st-joseph': {x:256.3, y:509.8, label:'St. Joseph'},
        'iron-river': {x:125.4, y:188.3, label:'Iron River'},
        'ironwood': {x:33.0, y:158.8, label:'Ironwood'},
        'menominee': {x:187.6, y:267.3, label:'Menominee'},
        'gaylord': {x:365.1, y:273.8, label:'Gaylord'},
        'rogers-city': {x:416.9, y:242.1, label:'Rogers City'},
        'cheboygan': {x:377.3, y:223.8, label:'Cheboygan'},
        'boyne-city': {x:344.5, y:258.5, label:'Boyne City'},
        'charlevoix': {x:330.0, y:250.3, label:'Charlevoix'},
        'ludington': {x:257.8, y:360.2, label:'Ludington'},
        'reed-city': {x:314.9, y:366.7, label:'Reed City'},
        'newaygo': {x:297.2, y:403.4, label:'Newaygo'},
        'allegan': {x:293.8, y:475.1, label:'Allegan'},
        'st-johns': {x:372.2, y:437.2, label:'St. Johns'},
        'hastings': {x:327.7, y:465.7, label:'Hastings'},
        'charlotte': {x:355.4, y:472.4, label:'Charlotte'},
        'mason': {x:379.1, y:471.1, label:'Mason'},
        'howell': {x:410.2, y:469.0, label:'Howell'},
        'brighton': {x:419.2, y:475.2, label:'Brighton'},
        'milford': {x:430.2, y:470.2, label:'Milford'},
        'fenton': {x:423.7, y:453.6, label:'Fenton'},
        'grand-blanc': {x:428.5, y:442.8, label:'Grand Blanc'},
        'burton': {x:429.1, y:437.3, label:'Burton'},
        'davison': {x:435.0, y:434.5, label:'Davison'},
        'swartz-creek': {x:416.4, y:440.5, label:'Swartz Creek'},
        'lapeer': {x:447.1, y:433.0, label:'Lapeer'},
        'imlay-city': {x:461.8, y:435.4, label:'Imlay City'},
        'sandusky': {x:476.7, y:403.3, label:'Sandusky'},
        'port-austin': {x:466.0, y:352.9, label:'Port Austin'},
        'bad-axe': {x:466.3, y:372.6, label:'Bad Axe'},
        'caro': {x:442.4, y:397.6, label:'Caro'},
        'cass-city': {x:455.8, y:388.8, label:'Cass City'},
        'tawas-city': {x:435.0, y:334.7, label:'Tawas City'},
        'oscoda': {x:446.2, y:322.6, label:'Oscoda'},
        'west-branch': {x:391.4, y:334.3, label:'West Branch'},
        'grayling': {x:362.7, y:303.3, label:'Grayling'},
        'roscommon': {x:370.1, y:316.3, label:'Roscommon'},
        'houghton-lake': {x:359.9, y:331.0, label:'Houghton Lake'},
        'clare': {x:359.4, y:371.1, label:'Clare'},
        'gladwin': {x:376.6, y:358.0, label:'Gladwin'},
        'harrison': {x:357.3, y:359.7, label:'Harrison'},
        'lake-city': {x:332.5, y:329.4, label:'Lake City'},
        'evart': {x:329.4, y:364.6, label:'Evart'},
        'howard-city': {x:317.2, y:405.2, label:'Howard City'},
        'muskegon-heights': {x:270.8, y:421.2, label:'Muskegon Heights'},
        'norton-shores': {x:269.1, y:423.7, label:'Norton Shores'},
        'spring-lake': {x:273.1, y:431.4, label:'Spring Lake'},
        'coopersville': {x:288.9, y:431.9, label:'Coopersville'},
        'lowell': {x:325.0, y:442.4, label:'Lowell'},
        'grand-haven': {x:271.3, y:432.1, label:'Grand Haven'},
        'wayland': {x:306.6, y:463.6, label:'Wayland'},
        'otsego': {x:303.9, y:480.9, label:'Otsego'},
        'paw-paw': {x:291.7, y:500.3, label:'Paw Paw'},
        'dowagiac': {x:278.6, y:518.9, label:'Dowagiac'},
        'south-haven': {x:268.5, y:485.4, label:'South Haven'},
        'stevensville': {x:253.2, y:516.8, label:'Stevensville'},
        'three-rivers': {x:307.2, y:522.3, label:'Three Rivers'},
        'coldwater': {x:345.5, y:522.6, label:'Coldwater'},
        'marshall': {x:347.7, y:495.9, label:'Marshall'},
        'albion': {x:360.5, y:498.2, label:'Albion'},
        'tecumseh': {x:409.2, y:517.9, label:'Tecumseh'},
        'milan': {x:425.4, y:510.9, label:'Milan'},
        'saline': {x:419.1, y:504.4, label:'Saline'},
        'chelsea': {x:404.7, y:492.0, label:'Chelsea'},
        'dexter': {x:412.9, y:491.1, label:'Dexter'},
        'south-lyon': {x:427.0, y:480.7, label:'South Lyon'},
        'wixom': {x:433.9, y:475.6, label:'Wixom'},
        'clio': {x:422.0, y:422.9, label:'Clio'},
        'mount-morris': {x:424.2, y:427.8, label:'Mount Morris'},
        'linden': {x:419.0, y:452.2, label:'Linden'},
        'holly': {x:428.3, y:453.8, label:'Holly'},
        'lake-orion': {x:452.0, y:454.8, label:'Lake Orion'},
        'clarkston': {x:441.1, y:458.6, label:'Clarkston'},
        'oxford': {x:450.5, y:451.3, label:'Oxford'},
        'romeo': {x:466.5, y:453.2, label:'Romeo'},
        'richmond': {x:481.2, y:452.6, label:'Richmond'},
        'new-baltimore': {x:482.4, y:463.0, label:'New Baltimore'},
        'chesterfield-township': {x:476.3, y:464.2, label:'Chesterfield Township'},
        'utica': {x:464.4, y:467.3, label:'Utica'},
        'eastpointe': {x:469.0, y:480.2, label:'Eastpointe'},
        'fraser': {x:469.4, y:474.4, label:'Fraser'},
        'center-line': {x:464.7, y:478.7, label:'Center Line'},
        'madison-heights': {x:460.0, y:478.6, label:'Madison Heights'},
        'hazel-park': {x:460.1, y:480.6, label:'Hazel Park'},
        'berkley': {x:455.2, y:477.3, label:'Berkley'},
        'clawson': {x:457.5, y:474.8, label:'Clawson'},
        'birmingham': {x:453.5, y:473.7, label:'Birmingham'},
        'bloomfield-hills': {x:451.5, y:470.8, label:'Bloomfield Hills'},
        'waterford-charter-township': {x:441.3, y:461.9, label:'Waterford Charter Township'},
        'white-lake-township': {x:436.5, y:464.9, label:'White Lake Township'},
        'highland-township': {x:432.2, y:463.0, label:'Highland Township'},
        'hartland-township': {x:432.9, y:456.5, label:'Hartland Township'},
        'commerce-township': {x:436.7, y:471.6, label:'Commerce Township'},
        'shelby-charter-township': {x:464.2, y:463.3, label:'Shelby Charter Township'},
        'harrison-township': {x:476.6, y:472.7, label:'Harrison Township'},
        'washington-township': {x:466.4, y:459.1, label:'Washington Township'},
    };

    var WTC_US_STATES = {
        AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
        CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
        HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
        KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
        MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
        MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
        NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
        OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
        SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
        VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
    };

    var BUBBLE_MIN = 4;
    var BUBBLE_MAX = 28;
    var SVG_NS = 'http://www.w3.org/2000/svg';

    function getSessionLabel(label, count) {
        return label + ': ' + count + ' session' + (count !== 1 ? 's' : '');
    }

    function positionTooltip(tooltip, wrapEl, clientX, clientY) {
        var rect = wrapEl.getBoundingClientRect();
        var pageX = clientX - rect.left;
        var pageY = clientY - rect.top;
        var tooltipWidth = tooltip.offsetWidth;
        var left = pageX + 12;

        if (left + tooltipWidth > rect.width) {
            left = pageX - tooltipWidth - 12;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = (pageY - 28) + 'px';
    }

    function showTooltip(tooltip, wrapEl, clientX, clientY, label, count) {
        tooltip.textContent = getSessionLabel(label, count);
        tooltip.style.display = 'block';
        positionTooltip(tooltip, wrapEl, clientX, clientY);
    }

    function hideTooltip(tooltip) {
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }

    function initMichiganMap() {
        if (typeof window.wtcMichiganMap === 'undefined') {
            return;
        }

        var mapConfig = window.wtcMichiganMap;
        var cities = mapConfig.cities || {};
        var svgEl = document.getElementById('wtc-michigan-map');
        if (!svgEl) {
            return;
        }

        var bubbleData = [];
        var maxCount = 0;
        Object.keys(cities).forEach(function (bucket) {
            var count = parseInt(cities[bucket], 10);
            if (!count || count <= 0) return;
            if (!Object.prototype.hasOwnProperty.call(WTC_MI_CITIES, bucket)) return;
            var city = WTC_MI_CITIES[bucket];
            if (count > maxCount) maxCount = count;
            bubbleData.push({slug: bucket, count: count, x: city.x, y: city.y, label: city.label});
        });

        if (bubbleData.length === 0) {
            return;
        }

        var group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('class', 'wtc-bubbles');
        group.setAttribute('aria-hidden', 'true');
        svgEl.appendChild(group);

        bubbleData.sort(function (a, b) { return a.count - b.count; });

        bubbleData.forEach(function (dataPoint) {
            var scale = maxCount > 1 ? Math.sqrt(dataPoint.count / maxCount) : 1;
            var radius = Math.round(BUBBLE_MIN + scale * (BUBBLE_MAX - BUBBLE_MIN));

            var circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('class', 'wtc-mi-bubble');
            circle.setAttribute('cx', dataPoint.x);
            circle.setAttribute('cy', dataPoint.y);
            circle.setAttribute('r', radius);
            circle.setAttribute('data-city', dataPoint.label);
            circle.setAttribute('data-count', dataPoint.count);
            circle.setAttribute('tabindex', '0');
            circle.setAttribute('role', 'img');
            circle.setAttribute('aria-label', getSessionLabel(dataPoint.label, dataPoint.count));
            group.appendChild(circle);
        });

        var tooltip = document.getElementById('wtc-mi-map-tooltip');
        var wrapEl = svgEl.closest('.wtc-mi-map-wrap');
        if (!tooltip || !wrapEl) return;

        group.addEventListener('mousemove', function (event) {
            var target = event.target;
            if (target.classList.contains('wtc-mi-bubble')) {
                showTooltip(tooltip, wrapEl, event.clientX, event.clientY, target.getAttribute('data-city'), parseInt(target.getAttribute('data-count'), 10));
            } else {
                hideTooltip(tooltip);
            }
        });

        group.addEventListener('mouseleave', function () {
            hideTooltip(tooltip);
        });

        group.addEventListener('focusin', function (event) {
            var target = event.target;
            if (target.classList.contains('wtc-mi-bubble')) {
                var rect = target.getBoundingClientRect();
                showTooltip(tooltip, wrapEl, (rect.left + rect.right) / 2, rect.top, target.getAttribute('data-city'), parseInt(target.getAttribute('data-count'), 10));
            }
        });

        group.addEventListener('focusout', function () {
            hideTooltip(tooltip);
        });
    }

    function initUnitedStatesMap() {
        if (typeof window.wtcUnitedStatesMap === 'undefined') {
            return;
        }

        var mapConfig = window.wtcUnitedStatesMap;
        var states = mapConfig.states || {};
        var svgEl = document.getElementById('wtc-us-map');
        var tooltip = document.getElementById('wtc-us-map-tooltip');
        var wrapEl = svgEl ? svgEl.closest('.wtc-us-map-wrap') : null;
        var maxCount = 0;

        if (!svgEl || !tooltip || !wrapEl) {
            return;
        }

        Object.keys(states).forEach(function (code) {
            var normalizedCode = String(code).toUpperCase();
            var count = parseInt(states[code], 10);
            var stateEl;
            var level;

            if (!count || count <= 0) return;
            if (!Object.prototype.hasOwnProperty.call(WTC_US_STATES, normalizedCode)) return;

            stateEl = svgEl.querySelector('#wtc-us-state-' + normalizedCode.toLowerCase());
            if (!stateEl) return;

            if (count > maxCount) {
                maxCount = count;
            }

            stateEl.setAttribute('data-state-name', WTC_US_STATES[normalizedCode]);
            stateEl.setAttribute('data-count', String(count));
            stateEl.setAttribute('tabindex', '0');
            stateEl.setAttribute('role', 'img');
            stateEl.setAttribute('aria-label', getSessionLabel(WTC_US_STATES[normalizedCode], count));
            stateEl.classList.add('has-data');
        });

        if (!maxCount) {
            return;
        }

        Object.keys(states).forEach(function (code) {
            var normalizedCode = String(code).toUpperCase();
            var count = parseInt(states[code], 10);
            var stateEl;
            var level;

            if (!count || count <= 0) return;

            stateEl = svgEl.querySelector('#wtc-us-state-' + normalizedCode.toLowerCase());
            if (!stateEl || !stateEl.classList.contains('has-data')) return;

            level = maxCount > 1 ? Math.ceil((count / maxCount) * 5) : 5;
            level = Math.max(1, Math.min(5, level));
            stateEl.classList.add('wtc-us-level-' + level);
        });

        svgEl.addEventListener('mousemove', function (event) {
            var target = event.target.closest ? event.target.closest('.wtc-us-state.has-data') : null;
            if (!target) {
                hideTooltip(tooltip);
                return;
            }

            showTooltip(tooltip, wrapEl, event.clientX, event.clientY, target.getAttribute('data-state-name'), parseInt(target.getAttribute('data-count'), 10));
        });

        svgEl.addEventListener('mouseleave', function () {
            hideTooltip(tooltip);
        });

        svgEl.addEventListener('focusin', function (event) {
            var target = event.target.closest ? event.target.closest('.wtc-us-state.has-data') : null;
            var rect;
            if (!target) {
                return;
            }

            rect = target.getBoundingClientRect();
            showTooltip(tooltip, wrapEl, (rect.left + rect.right) / 2, rect.top, target.getAttribute('data-state-name'), parseInt(target.getAttribute('data-count'), 10));
        });

        svgEl.addEventListener('focusout', function () {
            hideTooltip(tooltip);
        });
    }

    function init() {
        initAnalyticsCharts();
        initAnalyticsScopeTabs();
        initStateAnalyticsPanel();
        initCollapsibleAnalyticsSections();
        initUnitedStatesMap();
        initMichiganMap();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
