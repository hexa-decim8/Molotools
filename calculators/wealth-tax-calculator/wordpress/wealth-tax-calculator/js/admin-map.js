// Billionaire Wealth Tax Calculator — Michigan visitor map (admin dashboard)
// Reads wtcMichiganMap injected via wp_localize_script.
// Renders proportional city bubbles onto the inline SVG county map.
(function () {
    'use strict';

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

    var BUBBLE_MIN = 4;
    var BUBBLE_MAX = 28;
    var SVG_NS = 'http://www.w3.org/2000/svg';

    function init() {
        initAnalyticsCharts();

        if (typeof window.wtcMichiganMap === 'undefined') {
            return;
        }

        var mapConfig = window.wtcMichiganMap;
        var cities = mapConfig.cities || {};
        var svgEl = document.getElementById('wtc-michigan-map');
        if (!svgEl) {
            return;
        }

        // Build list of known cities that have data
        var bubbleData = [];
        var maxCount = 0;
        Object.keys(cities).forEach(function (bucket) {
            // bucket is already the mi_* slug suffix, e.g. "detroit"
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

        // Create a group for bubbles on top of county paths
        var group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('class', 'wtc-bubbles');
        group.setAttribute('aria-hidden', 'true');
        svgEl.appendChild(group);

        // Draw bubbles (smallest first so largest renders on top)
        bubbleData.sort(function (a, b) { return a.count - b.count; });

        bubbleData.forEach(function (d) {
            var t = maxCount > 1 ? Math.sqrt(d.count / maxCount) : 1;
            var r = Math.round(BUBBLE_MIN + t * (BUBBLE_MAX - BUBBLE_MIN));

            var circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('class', 'wtc-mi-bubble');
            circle.setAttribute('cx', d.x);
            circle.setAttribute('cy', d.y);
            circle.setAttribute('r', r);
            circle.setAttribute('data-city', d.label);
            circle.setAttribute('data-count', d.count);
            circle.setAttribute('tabindex', '0');
            circle.setAttribute('role', 'img');
            circle.setAttribute('aria-label', d.label + ': ' + d.count + ' session' + (d.count !== 1 ? 's' : ''));
            group.appendChild(circle);
        });

        // Tooltip
        var tooltip = document.getElementById('wtc-mi-map-tooltip');
        if (!tooltip) return;

        function showTooltip(e, label, count) {
            tooltip.textContent = label + ': ' + count + ' session' + (count !== 1 ? 's' : '');
            tooltip.style.display = 'block';
            positionTooltip(e);
        }

        function positionTooltip(e) {
            var rect = svgEl.closest('.wtc-mi-map-wrap').getBoundingClientRect();
            var pageX = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
            var pageY = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
            var tw = tooltip.offsetWidth;
            var left = pageX + 12;
            if (left + tw > rect.width) {
                left = pageX - tw - 12;
            }
            tooltip.style.left = left + 'px';
            tooltip.style.top = (pageY - 28) + 'px';
        }

        function hideTooltip() {
            tooltip.style.display = 'none';
        }

        group.addEventListener('mousemove', function (e) {
            var t = e.target;
            if (t.classList.contains('wtc-mi-bubble')) {
                showTooltip(e, t.getAttribute('data-city'), parseInt(t.getAttribute('data-count'), 10));
            } else {
                hideTooltip();
            }
        });

        group.addEventListener('mouseleave', hideTooltip);

        group.addEventListener('focusin', function (e) {
            var t = e.target;
            if (t.classList.contains('wtc-mi-bubble')) {
                var rect = t.getBoundingClientRect();
                var wrapRect = svgEl.closest('.wtc-mi-map-wrap').getBoundingClientRect();
                var fakeEvent = {
                    clientX: (rect.left + rect.right) / 2,
                    clientY: rect.top
                };
                showTooltip(fakeEvent, t.getAttribute('data-city'), parseInt(t.getAttribute('data-count'), 10));
            }
        });

        group.addEventListener('focusout', hideTooltip);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
