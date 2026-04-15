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

    function initInfoToggles() {
        var toggles = document.querySelectorAll('.wtc-info-toggle');
        var i;

        if (!toggles.length) {
            return;
        }

        for (i = 0; i < toggles.length; i++) {
            (function (toggle) {
                var contentId = toggle.getAttribute('aria-controls');
                var contentEl;

                if (!contentId) {
                    return;
                }

                contentEl = document.getElementById(contentId);
                if (!contentEl) {
                    return;
                }

                toggle.addEventListener('click', function () {
                    var isExpanded = toggle.getAttribute('aria-expanded') === 'true';
                    var nextExpanded = !isExpanded;
                    toggle.setAttribute('aria-expanded', nextExpanded ? 'true' : 'false');
                    contentEl.hidden = !nextExpanded;
                });
            }(toggles[i]));
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

    function renderCountyBubbles(container, counties, stateCode, policyData, policyColors) {
        var maxCount = 0;
        var i;

        if (!container) {
            return;
        }

        container.innerHTML = '';

        if (!counties || !counties.length) {
            return;
        }

        stateCode = stateCode || '';
        policyData = policyData || {};
        policyColors = policyColors || {};

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
            bubble.setAttribute('data-county', county.bucket || county.label);
            bubble.title = county.label + ': ' + formatNumber(count);

            // Get top policy for this county if policy data is available
            var polygonId = (stateCode + '-' + (county.bucket || county.label)).toLowerCase();
            var topPolicy = null;
            var policyDistribution = [];

            if (policyData[county.bucket]) {
                var policies = policyData[county.bucket];
                var sortedPolicies = Object.keys(policies).sort(function(a, b) {
                    return (policies[b] || 0) - (policies[a] || 0);
                });

                for (var p = 0; p < Math.min(3, sortedPolicies.length); p++) {
                    topPolicy = sortedPolicies[p];
                    policyDistribution.push(topPolicy + ' (' + (policies[topPolicy] || 0) + ')');
                }

                // Color the bubble based on top policy
                if (topPolicy && policyColors[topPolicy]) {
                    bubble.style.backgroundColor = policyColors[topPolicy];
                }
            }

            countEl.className = 'wtc-state-county-bubble-count';
            countEl.textContent = formatNumber(count);

            labelEl.className = 'wtc-state-county-bubble-label';
            labelEl.textContent = county.label;

            // Add policy info to title if available
            if (policyDistribution.length > 0) {
                bubble.title = county.label + ': ' + formatNumber(count) + ' sessions | Policies: ' + policyDistribution.join(', ');
            }

            bubble.appendChild(countEl);
            bubble.appendChild(labelEl);
            container.appendChild(bubble);
        });
    }

    function renderCountyPolicyDistribution(container, countyPolicies, countyCounts, maxRows) {
        if (!container || !countyPolicies || Object.keys(countyPolicies).length === 0) {
            container.innerHTML = '<p>' + 'No policy distribution data available yet.' + '</p>';
            return;
        }

        maxRows = maxRows || 20;
        var html = '<table class="widefat striped"><thead><tr><th>County</th><th>Sessions</th><th>Top 3 Policies</th></tr></thead><tbody>';
        var rowCount = 0;

        Object.keys(countyPolicies).forEach(function(countyBucket) {
            if (rowCount >= maxRows) {
                return;
            }

            var policies = countyPolicies[countyBucket] || {};
            var sessionCount = countyCounts && countyCounts[countyBucket] ? parseInt(countyCounts[countyBucket], 10) : 0;
            var countyLabel = countyBucket.replace(/^[a-z]{2}_county_/, '').replace(/-/g, ' ').charAt(0).toUpperCase() + countyBucket.replace(/^[a-z]{2}_county_/, '').replace(/-/g, ' ').slice(1);

            var policyLines = [];
            var sortedPolicies = Object.keys(policies).sort(function(a, b) {
                return (policies[b] || 0) - (policies[a] || 0);
            });

            for (var i = 0; i < Math.min(3, sortedPolicies.length); i++) {
                var policyKey = sortedPolicies[i];
                var count = policies[policyKey] || 0;
                policyLines.push((i + 1) + '. ' + policyKey + ' (' + count + ')');
            }

            html += '<tr><td>' + countyLabel + '</td><td>' + formatNumber(sessionCount) + '</td><td>' + policyLines.join(' | ') + '</td></tr>';
            rowCount++;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderUrbanRuralTaxAnalysis(container, taxRateSummary, maxRows) {
        if (!container || !taxRateSummary || Object.keys(taxRateSummary).length === 0) {
            container.innerHTML = '<p>' + 'No tax rate data available yet.' + '</p>';
            return;
        }

        maxRows = maxRows || 30;
        var urbanRates = [];
        var suburbanRates = [];
        var ruralRates = [];

        // Aggregate rates by geography type
        Object.keys(taxRateSummary).forEach(function(countyBucket) {
            var countyData = taxRateSummary[countyBucket] || {};
            if (countyData.urban && !isNaN(parseFloat(countyData.urban))) {
                urbanRates.push(parseFloat(countyData.urban));
            }
            if (countyData.suburban && !isNaN(parseFloat(countyData.suburban))) {
                suburbanRates.push(parseFloat(countyData.suburban));
            }
            if (countyData.rural && !isNaN(parseFloat(countyData.rural))) {
                ruralRates.push(parseFloat(countyData.rural));
            }
        });

        var urbanAvg = urbanRates.length > 0 ? (urbanRates.reduce(function(a, b) { return a + b; }) / urbanRates.length).toFixed(1) : null;
        var suburbanAvg = suburbanRates.length > 0 ? (suburbanRates.reduce(function(a, b) { return a + b; }) / suburbanRates.length).toFixed(1) : null;
        var ruralAvg = ruralRates.length > 0 ? (ruralRates.reduce(function(a, b) { return a + b; }) / ruralRates.length).toFixed(1) : null;

        var html = '<table class="widefat striped"><thead><tr><th>Geography Type</th><th>Average Tax Rate (%)</th><th>County Count</th></tr></thead><tbody>';
        html += '<tr><td>Urban</td><td>' + (urbanAvg !== null ? parseFloat(urbanAvg).toFixed(1) + '%' : '—') + '</td><td>' + urbanRates.length + '</td></tr>';
        html += '<tr><td>Suburban</td><td>' + (suburbanAvg !== null ? parseFloat(suburbanAvg).toFixed(1) + '%' : '—') + '</td><td>' + suburbanRates.length + '</td></tr>';
        html += '<tr><td>Rural</td><td>' + (ruralAvg !== null ? parseFloat(ruralAvg).toFixed(1) + '%' : '—') + '</td><td>' + ruralRates.length + '</td></tr>';
        html += '</tbody></table>';

        // Detailed breakdown
        var detailedHtml = '<details style="margin-top: 20px;"><summary>Detailed County Breakdown</summary>';
        detailedHtml += '<table class="widefat striped" style="margin-top: 10px;"><thead><tr><th>County</th><th>Urban Avg</th><th>Suburban Avg</th><th>Rural Avg</th></tr></thead><tbody>';

        var rowCount = 0;
        Object.keys(taxRateSummary).forEach(function(countyBucket) {
            if (rowCount >= maxRows) {
                return;
            }

            var countyData = taxRateSummary[countyBucket] || {};
            var countyLabel = countyBucket.replace(/^[a-z]{2}_county_/, '').replace(/-/g, ' ').charAt(0).toUpperCase() + countyBucket.replace(/^[a-z]{2}_county_/, '').replace(/-/g, ' ').slice(1);
            var urban = countyData.urban && !isNaN(parseFloat(countyData.urban)) ? parseFloat(countyData.urban).toFixed(1) + '%' : '—';
            var suburban = countyData.suburban && !isNaN(parseFloat(countyData.suburban)) ? parseFloat(countyData.suburban).toFixed(1) + '%' : '—';
            var rural = countyData.rural && !isNaN(parseFloat(countyData.rural)) ? parseFloat(countyData.rural).toFixed(1) + '%' : '—';

            detailedHtml += '<tr><td>' + countyLabel + '</td><td>' + urban + '</td><td>' + suburban + '</td><td>' + rural + '</td></tr>';
            rowCount++;
        });

        detailedHtml += '</tbody></table></details>';
        container.innerHTML = html + detailedHtml;
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

        if (!titleEl || !submittedEl || !uniqueEl || !daysEl || !avgEl || !countyBubblesEl || !countyEmptyEl || !countyGeometryEl || !countyGeometryEmptyEl || !countyTableEl || !countyTableBodyEl || !countyTableEmptyEl || !tileMapEl) {
            return;
        }

        function getFirstStateWithData() {
            var keys = Object.keys(states);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var entry = states[key] || {};
                if (entry.hasData) {
                    return key;
                }
            }

            return keys.length ? keys[0] : '';
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

            // Pass policy data for all states (extract from state entry)
            var policyData = stateEntry.countyPolicies || {};
            var policyColors = stateEntry.policyColors || {};
            var taxRateSummary = stateEntry.countyTaxRates || {};

            renderCountyBubbles(countyBubblesEl, counties, normalizedCode, policyData, policyColors);
            countyEmptyEl.hidden = counties.length > 0;

            renderStateCountyGeometry(normalizedCode, geometryTemplates, countyGeometryEl, countyGeometryEmptyEl, counties);

            renderCountyTable(countyTableBodyEl, countyTableEl, countyTableEmptyEl, counties);
            
            // Render county policy distribution and tax rate analysis
            if (counties.length > 0) {
                // Build county counts map for render functions
                var countyCounts = {};
                counties.forEach(function(county) {
                    countyCounts[county.bucket] = county.count;
                });

                // Create or get policy distribution container
                var policyDistSection = document.getElementById('wtc-state-policy-dist-section');
                if (!policyDistSection) {
                    policyDistSection = document.createElement('div');
                    policyDistSection.id = 'wtc-state-policy-dist-section';
                    policyDistSection.className = 'card wtc-analytics-card';
                    policyDistSection.style.maxWidth = '920px';
                    policyDistSection.style.marginTop = '20px';
                    policyDistSection.innerHTML = '<h2>County-Level Policy Distribution</h2><p class="description">Shows the top 3 ranked policies for each county.</p><div id="wtc-state-policy-distribution-container"></div>';
                    if (countyTableEl && countyTableEl.parentElement) {
                        countyTableEl.parentElement.parentElement.insertAdjacentElement('afterend', policyDistSection);
                    }
                }
                var policyDistContainer = document.getElementById('wtc-state-policy-distribution-container');
                if (policyDistContainer) {
                    renderCountyPolicyDistribution(policyDistContainer, policyData, countyCounts, 20);
                }

                // Create or get tax rate analysis container
                var taxAnalysisSection = document.getElementById('wtc-state-tax-analysis-section');
                if (!taxAnalysisSection) {
                    taxAnalysisSection = document.createElement('div');
                    taxAnalysisSection.id = 'wtc-state-tax-analysis-section';
                    taxAnalysisSection.className = 'card wtc-analytics-card';
                    taxAnalysisSection.style.maxWidth = '920px';
                    taxAnalysisSection.style.marginTop = '20px';
                    taxAnalysisSection.innerHTML = '<h2>Tax Rate Analysis by Geography</h2><p class="description">Average wealth tax rate by urban/rural classification and county.</p><div id="wtc-state-tax-analysis-container"></div>';
                    if (policyDistSection && policyDistSection.parentElement) {
                        policyDistSection.insertAdjacentElement('afterend', taxAnalysisSection);
                    }
                }
                var taxAnalysisContainer = document.getElementById('wtc-state-tax-analysis-container');
                if (taxAnalysisContainer) {
                    renderUrbanRuralTaxAnalysis(taxAnalysisContainer, taxRateSummary, 30);
                }
            }
            
            buildStateTileMap(tileMapEl, normalizedCode, states);
        }

        tileMapEl.addEventListener('click', function (event) {
            var tile = event.target.closest ? event.target.closest('.wtc-state-tile[data-state-code]') : null;
            if (!tile) {
                return;
            }

            if (tile.classList.contains('is-empty')) {
                return;
            }

            updateStatePanel(tile.getAttribute('data-state-code'));
            showStateTab();
        });

        if (!states[defaultState]) {
            defaultState = getFirstStateWithData();
        }

        updateStatePanel(defaultState || getFirstStateWithData());
    }

    function moveMichiganOnlyChartsCard() {
        var chartsCard = document.getElementById('wtc-michigan-only-charts-card');
        var michiganPanel = document.querySelector('.wtc-analytics-section-panel[data-wtc-section-panel="michigan"]');
        var anchorCard;

        if (!chartsCard || !michiganPanel) {
            return;
        }

        anchorCard = michiganPanel.querySelector('.card');
        if (anchorCard && anchorCard.parentElement === michiganPanel) {
            anchorCard.insertAdjacentElement('afterend', chartsCard);
            return;
        }

        michiganPanel.insertBefore(chartsCard, michiganPanel.firstChild || null);
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

    function formatCitySlugLabel(slug) {
        return String(slug || '')
            .split('-')
            .filter(Boolean)
            .map(function (part) {
                return part.charAt(0).toUpperCase() + part.slice(1);
            })
            .join(' ');
    }

    function getCountyCentroidMap(svgEl) {
        var centroidMap = {};
        if (!svgEl) {
            return centroidMap;
        }

        svgEl.querySelectorAll('.wtc-county[id^="wtc-county-"]').forEach(function (pathEl) {
            if (typeof pathEl.getBBox !== 'function') {
                return;
            }

            var countySlug = String(pathEl.id || '').replace(/^wtc-county-/, '');
            if (!countySlug) {
                return;
            }

            var bbox = pathEl.getBBox();
            centroidMap[countySlug] = {
                x: bbox.x + (bbox.width / 2),
                y: bbox.y + (bbox.height / 2),
            };
        });

        return centroidMap;
    }

    function getDeterministicJitter(citySlug) {
        var value = String(citySlug || '');
        var hash = 0;
        var idx;

        for (idx = 0; idx < value.length; idx++) {
            hash = ((hash << 5) - hash) + value.charCodeAt(idx);
            hash |= 0;
        }

        return {
            x: ((hash % 9) + 9) % 9 - 4,
            y: (((Math.floor(hash / 9)) % 9) + 9) % 9 - 4,
        };
    }

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
        var cityToCounty = mapConfig.cityToCounty || {};
        var svgEl = document.getElementById('wtc-michigan-map');
        if (!svgEl) {
            return;
        }

        var countyCentroids = getCountyCentroidMap(svgEl);

        var bubbleData = [];
        var maxCount = 0;
        Object.keys(cities).forEach(function (bucket) {
            var count = parseInt(cities[bucket], 10);
            var countySlug = String(cityToCounty[bucket] || '').toLowerCase();
            var countyCenter = countyCentroids[countySlug];
            var jitter;

            if (!count || count <= 0) return;
            if (!countyCenter) return;

            jitter = getDeterministicJitter(bucket);

            if (count > maxCount) maxCount = count;
            bubbleData.push({
                slug: bucket,
                count: count,
                x: countyCenter.x + jitter.x,
                y: countyCenter.y + jitter.y,
                label: formatCitySlugLabel(bucket)
            });
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
        initInfoToggles();
        initStateAnalyticsPanel();
        moveMichiganOnlyChartsCard();
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
