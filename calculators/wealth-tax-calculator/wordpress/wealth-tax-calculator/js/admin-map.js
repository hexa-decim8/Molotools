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

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatCountyBucketLabel(countyBucket) {
        var label = String(countyBucket || '').replace(/^[a-z]{2}_county_/, '').replace(/-/g, ' ');
        if (!label) {
            return 'Unknown county';
        }

        return label.charAt(0).toUpperCase() + label.slice(1);
    }

    function abbreviatePolicyKey(policyKey) {
        var key = String(policyKey || '');
        var keyParts = key.split(':');
        var groupKey = keyParts[0] || '';
        var optionKey = keyParts.length > 1 ? keyParts[1] : '';
        var map = {
            healthcare: 'HC',
            education: 'ED',
            business: 'TR',
            directrelief: 'DR',
            housing: 'HS',
            childcare: 'CF'
        };
        var abbreviatedGroup = map[groupKey] || groupKey.slice(0, 3).toUpperCase();

        return optionKey === '' ? abbreviatedGroup : (abbreviatedGroup + ':' + optionKey);
    }

    function formatCompactCurrency(value) {
        var amount = parseFloat(value);

        if (!amount || amount <= 0) {
            return '$0';
        }

        if (amount >= 1e12) {
            return '$' + (amount / 1e12).toFixed(2) + 'T';
        }

        if (amount >= 1e9) {
            return '$' + (amount / 1e9).toFixed(1) + 'B';
        }

        return '$' + Math.round(amount).toLocaleString();
    }

    var WTC_DONUT_SWATCHES = ['#D1495B', '#2B59C3', '#2A9D8F', '#F4A261', '#7B2CBF', '#3A86FF', '#EF476F', '#118AB2', '#06D6A0', '#FFD166', '#8338EC', '#8E9AAF'];

    function buildDonutRows(rows) {
        var total = 0;
        var i;
        for (i = 0; i < rows.length; i++) {
            total += parseInt(rows[i].count, 10) || 0;
        }
        if (!total) {
            return null;
        }

        var current = 0;
        var parts = [];
        var legend = [];

        for (i = 0; i < rows.length; i++) {
            var count = parseInt(rows[i].count, 10) || 0;
            if (!count) {
                continue;
            }
            var ratio = count / total;
            var next = current + ratio * 360;
            var color = WTC_DONUT_SWATCHES[i % WTC_DONUT_SWATCHES.length];
            parts.push(color + ' ' + current.toFixed(2) + 'deg ' + next.toFixed(2) + 'deg');
            legend.push({ label: rows[i].label, count: count, percent: (ratio * 100).toFixed(1), color: color });
            current = next;
        }

        return { gradient: parts.join(', '), legend: legend };
    }

    function renderDonutChart(container, rows, emptyText) {
        if (!container) {
            return;
        }

        if (!rows || !rows.length) {
            container.innerHTML = '<p class="wtc-analytics-empty">' + emptyText + '</p>';
            return;
        }

        var data = buildDonutRows(rows);
        if (!data) {
            container.innerHTML = '<p class="wtc-analytics-empty">' + emptyText + '</p>';
            return;
        }

        var html = '<div class="wtc-analytics-donut" role="img" aria-label="' + emptyText + '" style="background: conic-gradient(' + data.gradient + ');"></div>';
        html += '<div class="wtc-analytics-legend wtc-analytics-legend-scroll">';
        for (var i = 0; i < data.legend.length; i++) {
            var row = data.legend[i];
            html += '<div class="wtc-analytics-legend-item">';
            html += '<span class="wtc-analytics-legend-swatch" style="background:' + row.color + '"></span>';
            html += '<span class="wtc-analytics-legend-label">' + row.label + '</span>';
            html += '<span class="wtc-analytics-legend-value">' + row.count.toLocaleString() + ' (' + row.percent + '%)</span>';
            html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    function renderPolicyGroupChart(container, rows, emptyText) {
        if (!container) {
            return;
        }

        if (!rows || !rows.length) {
            container.innerHTML = '<p class="wtc-analytics-empty">' + emptyText + '</p>';
            return;
        }

        var total = 0;
        var normalizedRows = [];

        rows.forEach(function (row) {
            var selectedAmount = parseInt(row.selectedAmount, 10) || 0;
            if (selectedAmount <= 0) {
                return;
            }

            total += selectedAmount;
            normalizedRows.push({
                label: row.label || '',
                selectedAmount: selectedAmount,
                color: row.color || '#406BBF'
            });
        });

        if (!total || !normalizedRows.length) {
            container.innerHTML = '<p class="wtc-analytics-empty">' + emptyText + '</p>';
            return;
        }

        var html = '<div class="wtc-analytics-stacked-bar" role="img" aria-label="Category allocation mix">';
        normalizedRows.forEach(function (row) {
            var segmentWidth = Math.max(2, ((row.selectedAmount / total) * 100));
            html += '<span class="wtc-analytics-stacked-segment" style="width:' + segmentWidth.toFixed(2) + '%;background:' + row.color + ';" title="' + row.label + ': ' + formatCompactCurrency(row.selectedAmount) + ' selected over 10 years"></span>';
        });
        html += '</div><div class="wtc-analytics-legend">';
        normalizedRows.forEach(function (row) {
            html += '<div class="wtc-analytics-legend-item">';
            html += '<span class="wtc-analytics-legend-swatch" style="background:' + row.color + '"></span>';
            html += '<span class="wtc-analytics-legend-label">' + row.label + '</span>';
            html += '<span class="wtc-analytics-legend-value">' + formatCompactCurrency(row.selectedAmount) + '</span>';
            html += '</div>';
        });
        html += '</div>';

        container.innerHTML = html;
    }

    function renderLineChart(container, rows, emptyText) {
        if (!container) {
            return;
        }

        if (!rows || !rows.length) {
            container.innerHTML = '<p class="wtc-analytics-empty">' + emptyText + '</p>';
            return;
        }

        var normalizedRows = rows
            .map(function (row) {
                return {
                    label: row.label || '',
                    count: parseInt(row.count, 10) || 0,
                    rate: parseFloat(String(row.label || '').replace('%', '')) || 0
                };
            })
            .filter(function (row) {
                return row.count > 0;
            })
            .sort(function (a, b) {
                return a.rate - b.rate;
            });

        if (!normalizedRows.length) {
            container.innerHTML = '<p class="wtc-analytics-empty">' + emptyText + '</p>';
            return;
        }

        var width = 360;
        var height = 220;
        var paddingLeft = 24;
        var paddingTop = 18;
        var paddingRight = 18;
        var paddingBottom = 44;
        var plotWidth = width - paddingLeft - paddingRight;
        var plotHeight = height - paddingTop - paddingBottom;
        var minRate = normalizedRows[0].rate;
        var maxRate = normalizedRows[normalizedRows.length - 1].rate;
        var rateRange = maxRate > minRate ? (maxRate - minRate) : 1;
        var maxCount = normalizedRows.reduce(function (currentMax, row) {
            return Math.max(currentMax, row.count);
        }, 0) || 1;
        var points = [];
        var labelsHtml = '';
        var circlesHtml = '';
        var gridHtml = '';

        for (var i = 0; i < 4; i++) {
            var gridY = paddingTop + ((plotHeight / 3) * i);
            gridHtml += '<line class="wtc-analytics-line-grid" x1="' + paddingLeft + '" y1="' + gridY.toFixed(2) + '" x2="' + (width - paddingRight) + '" y2="' + gridY.toFixed(2) + '"></line>';
        }

        normalizedRows.forEach(function (row, index) {
            var x = paddingLeft + (((row.rate - minRate) / rateRange) * plotWidth);
            var y = paddingTop + plotHeight - ((row.count / maxCount) * plotHeight);

            if (normalizedRows.length === 1) {
                x = paddingLeft + (plotWidth / 2);
            }

            points.push(x.toFixed(2) + ',' + y.toFixed(2));
            circlesHtml += '<circle class="wtc-analytics-line-point" cx="' + x.toFixed(2) + '" cy="' + y.toFixed(2) + '" r="5"></circle>';
            circlesHtml += '<text class="wtc-analytics-line-value-label" x="' + x.toFixed(2) + '" y="' + (y - 10).toFixed(2) + '" text-anchor="middle">' + formatNumber(row.count) + '</text>';
            labelsHtml += '<text class="wtc-analytics-line-axis-label" x="' + x.toFixed(2) + '" y="' + (height - 14) + '" text-anchor="middle">' + row.label + '</text>';
        });

        var html = '<div class="wtc-analytics-line-chart">';
        html += '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Tax rate selection line chart">';
        html += gridHtml;
        html += '<polyline class="wtc-analytics-line-path" points="' + points.join(' ') + '"></polyline>';
        html += circlesHtml;
        html += labelsHtml;
        html += '</svg>';
        html += '<div class="wtc-analytics-legend wtc-analytics-legend-scroll">';
        normalizedRows.forEach(function (row) {
            html += '<div class="wtc-analytics-legend-item">';
            html += '<span class="wtc-analytics-legend-swatch wtc-analytics-legend-swatch-line"></span>';
            html += '<span class="wtc-analytics-legend-label">' + row.label + '</span>';
            html += '<span class="wtc-analytics-legend-value">' + formatNumber(row.count) + '</span>';
            html += '</div>';
        });
        html += '</div></div>';

        container.innerHTML = html;
    }

    function buildStateTileMap(container, selectedStateCode, stateAnalytics, isInteractive) {
        var tileKeys;
        var maxCount = 0;
        var code;
        var i;

        if (typeof isInteractive === 'undefined') {
            isInteractive = true;
        }

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
                tile.className = 'wtc-state-tile wtc-us-level-' + level + (isSelected ? ' is-selected' : '') + (count > 0 ? ' has-data' : ' is-empty') + (isInteractive ? '' : ' is-static');
                tile.style.gridColumn = String(tileMeta.x + 1);
                tile.style.gridRow = String(tileMeta.y + 1);
                tile.setAttribute('data-state-code', stateCode);
                tile.setAttribute('title', getSessionLabel(stateLabel, count));
                tile.setAttribute('aria-label', getSessionLabel(stateLabel, count));
                tile.textContent = stateCode;
                tile.disabled = !isInteractive;
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
        var html = '<table class="widefat striped wtc-policy-distribution-table"><thead><tr><th>County</th><th>Sessions</th><th>Policies</th></tr></thead><tbody>';
        var countyRows = Object.keys(countyPolicies).map(function (countyBucket) {
            return {
                countyBucket: countyBucket,
                sessionCount: countyCounts && countyCounts[countyBucket] ? parseInt(countyCounts[countyBucket], 10) : 0
            };
        }).sort(function (a, b) {
            return b.sessionCount - a.sessionCount;
        });

        countyRows.slice(0, maxRows).forEach(function (countyRow) {
            var countyBucket = countyRow.countyBucket;
            var policies = countyPolicies[countyBucket] || {};
            var countyLabel = formatCountyBucketLabel(countyBucket);
            var sortedPolicies = Object.keys(policies).sort(function (a, b) {
                return (policies[b] || 0) - (policies[a] || 0);
            });
            var detailsRows = [];
            var topPolicySummary = '';

            for (var i = 0; i < Math.min(3, sortedPolicies.length); i++) {
                var policyKey = sortedPolicies[i];
                var count = policies[policyKey] || 0;
                var compactPolicy = abbreviatePolicyKey(policyKey);

                if (i === 0) {
                    topPolicySummary = compactPolicy + ' (' + formatNumber(count) + ')';
                }

                detailsRows.push(
                    '<li><span class="wtc-policy-abbrev">' +
                    escapeHtml(compactPolicy) +
                    '</span><span class="wtc-policy-full-key">' +
                    escapeHtml(policyKey) +
                    '</span><span class="wtc-policy-count">' +
                    escapeHtml(formatNumber(count)) +
                    '</span></li>'
                );
            }

            if (!detailsRows.length) {
                detailsRows.push('<li>No policy details stored.</li>');
                topPolicySummary = 'No policy details';
            }

            html += '<tr>';
            html += '<td>' + escapeHtml(countyLabel) + '</td>';
            html += '<td>' + formatNumber(countyRow.sessionCount) + '</td>';
            html += '<td>';
            html += '<details class="wtc-policy-details">';
            html += '<summary><span class="wtc-policy-summary">' + escapeHtml(topPolicySummary) + '</span><span class="wtc-policy-summary-meta">View top 3</span></summary>';
            html += '<ol class="wtc-policy-details-list">' + detailsRows.join('') + '</ol>';
            html += '</details>';
            html += '</td>';
            html += '</tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function renderCountyTaxRateAnalysis(container, taxRateSummary, maxRows) {
        if (!container || !taxRateSummary || Object.keys(taxRateSummary).length === 0) {
            container.innerHTML = '<p>' + 'No tax rate data available yet.' + '</p>';
            return;
        }

        maxRows = maxRows || 30;
        var rows = Object.keys(taxRateSummary).map(function (countyBucket) {
            return {
                bucket: countyBucket,
                label: countyBucket.replace(/^[a-z]{2}_county_/, '').replace(/-/g, ' ').replace(/\b\w/g, function (letter) { return letter.toUpperCase(); }),
                rate: parseFloat(taxRateSummary[countyBucket]) || 0
            };
        }).filter(function (row) {
            return row.rate > 0;
        }).sort(function (a, b) {
            return b.rate - a.rate;
        });

        if (!rows.length) {
            container.innerHTML = '<p>' + 'No tax rate data available yet.' + '</p>';
            return;
        }

        var html = '<table class="widefat striped"><thead><tr><th>County</th><th>Average Tax Rate (%)</th></tr></thead><tbody>';
        rows.slice(0, maxRows).forEach(function (row) {
            html += '<tr><td>' + row.label + '</td><td>' + row.rate.toFixed(1) + '%</td></tr>';
        });
        html += '</tbody></table>';

        container.innerHTML = html;
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
        var genericMatch;

        if (value.indexOf(prefix) === 0) {
            return value.substring(prefix.length);
        }

        // Accept legacy/raw county bucket formats so older analytics rows still map.
        genericMatch = value.match(/^[a-z]{2}_county_(.+)$/);
        if (genericMatch && genericMatch[1]) {
            return genericMatch[1];
        }

        if (value.indexOf('wtc-county-') === 0) {
            return value.substring('wtc-county-'.length);
        }

        return value;
    }

    function normalizeCountyLookupToken(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '');
    }

    function buildCountyPathLookup(svgEl) {
        var map = {};

        if (!svgEl) {
            return map;
        }

        svgEl.querySelectorAll('.wtc-county[id^="wtc-county-"]').forEach(function (pathEl) {
            var countyId = String(pathEl.id || '').replace(/^wtc-county-/, '');
            var lookupToken;

            if (!countyId) {
                return;
            }

            lookupToken = normalizeCountyLookupToken(countyId);
            if (!lookupToken || Object.prototype.hasOwnProperty.call(map, lookupToken)) {
                return;
            }

            map[lookupToken] = pathEl;
        });

        return map;
    }

    function resolveCountyPath(svgEl, countyPathLookup, countySlug) {
        var path = null;
        var lookupToken;

        if (!svgEl || !countySlug) {
            return null;
        }

        path = svgEl.querySelector('#wtc-county-' + countySlug);
        if (path) {
            return path;
        }

        lookupToken = normalizeCountyLookupToken(countySlug);
        if (!lookupToken) {
            return null;
        }

        return countyPathLookup[lookupToken] || null;
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
        var countyPathLookup;
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
        countyPathLookup = buildCountyPathLookup(svgEl);

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

            path = resolveCountyPath(svgEl, countyPathLookup, slug);
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

    /**
     * Rule: STATE-EXCLUSIVE / MICHIGAN-ONLY
     * Each panel instance (Michigan tab and By State tab) renders charts, statistics,
     * county tables, and tax-rate analyses using data scoped exclusively to the
     * selected state. No data from other states may appear in any visualisation
     * rendered by this function or its inner updateStatePanel().
     */
    function initStateAnalyticsPanel() {
        if (typeof window.wtcStateAnalytics === 'undefined') {
            return;
        }

        var payload = window.wtcStateAnalytics;
        var states = payload.states || {};
        var geometryTemplates = payload.geometryTemplates || {};
        function getFirstStateWithData(preferredState) {
            var keys = Object.keys(states);
            var preferred = String(preferredState || '').toUpperCase();

            if (preferred && states[preferred] && states[preferred].hasData) {
                return preferred;
            }

            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var entry = states[key] || {};
                if (entry.hasData) {
                    return key;
                }
            }

            return keys.length ? keys[0] : '';
        }

        function initSingleStatePanel(config) {
            var prefix = config.prefix;
            var titleEl = document.getElementById(prefix + '-panel-title');
            var countyTitleEl = document.getElementById(prefix + '-county-title');
            var submittedEl = document.getElementById(prefix + '-submitted-sessions');
            var uniqueEl = document.getElementById(prefix + '-unique-sessions');
            var daysEl = document.getElementById(prefix + '-days-stored');
            var avgEl = document.getElementById(prefix + '-average-rate');
            var policyGroupEl = document.getElementById(prefix + '-policy-group-chart');
            var policyEnabledEl = document.getElementById(prefix + '-policy-chart-enabled');
            var policyTopRankEl = document.getElementById(prefix + '-policy-chart-top-rank');
            var taxChartEl = document.getElementById(prefix + '-tax-chart');
            var countyBubblesEl = document.getElementById(prefix + '-county-bubbles');
            var countyEmptyEl = document.getElementById(prefix + '-county-empty');
            var countyGeometryEl = document.getElementById(prefix + '-county-geometry');
            var countyGeometryEmptyEl = document.getElementById(prefix + '-county-geometry-empty');
            var countyTableEl = document.getElementById(prefix + '-county-table');
            var countyTableBodyEl = document.getElementById(prefix + '-county-table-body');
            var countyTableEmptyEl = document.getElementById(prefix + '-county-table-empty');
            var tileMapEl = document.getElementById(prefix + '-geo-map');
            var policyDistContainer = document.getElementById(prefix + '-policy-distribution-container');
            var taxAnalysisContainer = document.getElementById(prefix + '-tax-analysis-container');
            var selectorEl = config.selectorId ? document.getElementById(config.selectorId) : null;
            var currentState = '';

            if (!countyTableEl && countyTableBodyEl && countyTableBodyEl.closest) {
                countyTableEl = countyTableBodyEl.closest('table');
            }

            if (!titleEl || !submittedEl || !uniqueEl || !daysEl || !avgEl || !policyGroupEl || !policyEnabledEl || !policyTopRankEl || !taxChartEl || !countyBubblesEl || !countyEmptyEl || !countyGeometryEl || !countyGeometryEmptyEl || !countyTableEl || !countyTableBodyEl || !countyTableEmptyEl || !policyDistContainer || !taxAnalysisContainer) {
                return;
            }

            // Rule: STATE-EXCLUSIVE — all data rendered below (stats, charts, tables)
            // reflects exclusively the selected state's submissions.
            function updateStatePanel(stateCode) {
                var normalizedCode = String(stateCode || '').toUpperCase();
                var stateEntry = states[normalizedCode] || states[getFirstStateWithData(config.defaultState)];
                var totals;
                var counties;
                var stateLabel;
                var policyData;
                var policyColors;
                var taxRateSummary;
                var countyCounts = {};

                if (!stateEntry) {
                    return;
                }

                currentState = normalizedCode;
                totals = stateEntry.totals || {};
                counties = Array.isArray(stateEntry.counties) ? stateEntry.counties : [];
                stateLabel = stateEntry.label || normalizedCode;
                policyData = stateEntry.countyPolicies || {};
                policyColors = stateEntry.policyColors || {};
                taxRateSummary = stateEntry.countyTaxRates || {};

                titleEl.textContent = stateLabel;
                if (countyTitleEl) {
                    countyTitleEl.textContent = stateLabel;
                }

                submittedEl.textContent = formatNumber(totals.submittedSessions);
                uniqueEl.textContent = formatNumber(totals.uniqueSessions);
                daysEl.textContent = formatNumber(totals.daysStored);
                avgEl.textContent = formatAverageRate(totals.averageTaxRate);

                renderPolicyGroupChart(
                    policyGroupEl,
                    Array.isArray(stateEntry.policyGroupRows) ? stateEntry.policyGroupRows : [],
                    'Category mix appears after submissions are recorded for ' + stateLabel + '.'
                );
                renderDonutChart(
                    policyEnabledEl,
                    Array.isArray(stateEntry.enabledRows) ? stateEntry.enabledRows : [],
                    'Policy data appears after submissions are recorded for ' + stateLabel + '.'
                );
                renderDonutChart(
                    policyTopRankEl,
                    Array.isArray(stateEntry.topRankRows) ? stateEntry.topRankRows : [],
                    'Top-rank data appears after submissions are recorded for ' + stateLabel + '.'
                );
                renderLineChart(
                    taxChartEl,
                    Array.isArray(stateEntry.taxRateRows) ? stateEntry.taxRateRows : [],
                    'Tax rate data appears after submissions are recorded for ' + stateLabel + '.'
                );

                renderCountyBubbles(countyBubblesEl, counties, normalizedCode, policyData, policyColors);
                countyEmptyEl.hidden = counties.length > 0;

                renderStateCountyGeometry(normalizedCode, geometryTemplates, countyGeometryEl, countyGeometryEmptyEl, counties);
                renderCountyTable(countyTableBodyEl, countyTableEl, countyTableEmptyEl, counties);

                counties.forEach(function (county) {
                    countyCounts[county.bucket] = county.count;
                });

                renderCountyPolicyDistribution(policyDistContainer, policyData, countyCounts, 20);
                renderCountyTaxRateAnalysis(taxAnalysisContainer, taxRateSummary, 20);
                if (tileMapEl) {
                    buildStateTileMap(tileMapEl, normalizedCode, states, config.interactive);
                }

                if (selectorEl) {
                    selectorEl.value = normalizedCode;
                }
            }

            if (config.interactive && tileMapEl) {
                tileMapEl.addEventListener('click', function (event) {
                    var tile = event.target.closest ? event.target.closest('.wtc-state-tile[data-state-code]') : null;
                    if (!tile || tile.classList.contains('is-empty')) {
                        return;
                    }

                    updateStatePanel(tile.getAttribute('data-state-code'));
                });

                if (selectorEl) {
                    selectorEl.addEventListener('change', function () {
                        var nextState = String(this.value || '').toUpperCase();
                        if (!nextState || !states[nextState]) {
                            return;
                        }

                        updateStatePanel(nextState);
                    });
                }
            }

            updateStatePanel(getFirstStateWithData(config.defaultState));
        }

        initSingleStatePanel({
            prefix: 'wtc-michigan',
            defaultState: 'MI',
            interactive: false
        });

        initSingleStatePanel({
            prefix: 'wtc-state',
            defaultState: payload.defaultState || 'MI',
            interactive: true,
            selectorId: 'wtc-state-analytics-select'
        });
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

    /**
     * Rule: NATIONWIDE
     * Renders the US state heat map using cumulative data from all 50 US states,
     * including Michigan. Every state's count in wtcUnitedStatesMap.states reflects
     * all US-originated submissions for that state — no state is excluded.
     */
    function initUnitedStatesMap() {
        var mapEl = document.getElementById('wtc-us-state-map');
        if (!mapEl) {
            return;
        }

        var stateAnalyticsPayload = typeof window.wtcStateAnalytics !== 'undefined' ? window.wtcStateAnalytics : null;
        if (!stateAnalyticsPayload || !stateAnalyticsPayload.states) {
            return;
        }

        buildStateTileMap(mapEl, '', stateAnalyticsPayload.states, false);
    }

    function initStateSearchCombobox() {
        var wrap      = document.querySelector('.wtc-state-combobox-wrap');
        var input     = document.getElementById('wtc-state-search-input');
        var list      = document.getElementById('wtc-state-search-list');
        var hidden    = document.getElementById('wtc-state-analytics-select');
        var stateBtn  = document.querySelector('[data-wtc-section-target="state"]');

        if (!wrap || !input || !list || !hidden) {
            return;
        }

        var allOptions = Array.prototype.slice.call(list.querySelectorAll('.wtc-state-search-option'));
        var focusedIndex = -1;

        function openList() {
            list.hidden = false;
            wrap.setAttribute('aria-expanded', 'true');
            wrap.classList.add('is-open');
        }

        function closeList() {
            list.hidden = true;
            wrap.setAttribute('aria-expanded', 'false');
            wrap.classList.remove('is-open');
            focusedIndex = -1;
            clearFocus();
        }

        function clearFocus() {
            allOptions.forEach(function (opt) {
                opt.classList.remove('is-focused');
            });
        }

        function getVisibleOptions() {
            return allOptions.filter(function (opt) { return !opt.hidden; });
        }

        function filterOptions(query) {
            var q = query.trim().toLowerCase();
            var hasMatch = false;

            allOptions.forEach(function (opt) {
                var label = (opt.getAttribute('data-state-label') || '').toLowerCase();
                var code  = (opt.getAttribute('data-state-code') || '').toLowerCase();
                var match = !q || label.indexOf(q) !== -1 || code.indexOf(q) !== -1;
                opt.hidden = !match;
                if (match) { hasMatch = true; }
            });

            // Remove stale no-results message if present
            var noResults = list.querySelector('.wtc-state-search-no-results');
            if (!hasMatch) {
                if (!noResults) {
                    noResults = document.createElement('li');
                    noResults.className = 'wtc-state-search-no-results';
                    noResults.textContent = 'No states found';
                    list.appendChild(noResults);
                }
            } else if (noResults) {
                noResults.parentNode.removeChild(noResults);
            }
        }

        function selectState(stateCode, stateLabel) {
            hidden.value = stateCode;
            input.value  = stateLabel + ' (' + stateCode + ')';

            // Mark selected in list
            allOptions.forEach(function (opt) {
                opt.setAttribute('aria-selected', opt.getAttribute('data-state-code') === stateCode ? 'true' : 'false');
            });

            // Update PDF form's hidden state input (same bridge as before)
            var changeEvent = document.createEvent('Event');
            changeEvent.initEvent('change', true, true);
            hidden.dispatchEvent(changeEvent);

            // Activate the "By State" panel via the hidden tab button
            wrap.classList.add('is-active');
            wrap.classList.remove('is-open');
            input.blur();

            if (stateBtn) {
                stateBtn.click();
            }

            closeList();
        }

        // Deactivate combobox styling when other tabs are clicked
        var otherTabBtns = document.querySelectorAll('[data-wtc-section-target="all"], [data-wtc-section-target="michigan"]');
        otherTabBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                wrap.classList.remove('is-active');
            });
        });

        // Open on focus / input
        input.addEventListener('focus', function () {
            filterOptions(input.value);
            openList();
        });

        input.addEventListener('input', function () {
            filterOptions(input.value);
            openList();
            focusedIndex = -1;
            clearFocus();
        });

        // Keyboard navigation
        input.addEventListener('keydown', function (e) {
            var visible = getVisibleOptions();

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (list.hidden) { openList(); }
                focusedIndex = Math.min(focusedIndex + 1, visible.length - 1);
                clearFocus();
                if (visible[focusedIndex]) {
                    visible[focusedIndex].classList.add('is-focused');
                    visible[focusedIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                focusedIndex = Math.max(focusedIndex - 1, 0);
                clearFocus();
                if (visible[focusedIndex]) {
                    visible[focusedIndex].classList.add('is-focused');
                    visible[focusedIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (focusedIndex >= 0 && visible[focusedIndex]) {
                    var opt = visible[focusedIndex];
                    selectState(opt.getAttribute('data-state-code'), opt.getAttribute('data-state-label'));
                }
            } else if (e.key === 'Escape') {
                closeList();
                input.blur();
            }
        });

        // Click on option
        list.addEventListener('click', function (e) {
            var opt = e.target;
            while (opt && opt !== list) {
                if (opt.classList.contains('wtc-state-search-option')) {
                    selectState(opt.getAttribute('data-state-code'), opt.getAttribute('data-state-label'));
                    return;
                }
                opt = opt.parentNode;
            }
        });

        // Close when clicking outside
        document.addEventListener('mousedown', function (e) {
            if (!wrap.contains(e.target)) {
                closeList();
            }
        });
    }

    function init() {
        initAnalyticsCharts();
        initAnalyticsScopeTabs();
        initInfoToggles();
        initStateAnalyticsPanel();
        initCollapsibleAnalyticsSections();
        initUnitedStatesMap();
        initMichiganMap();
        initStateSearchCombobox();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
