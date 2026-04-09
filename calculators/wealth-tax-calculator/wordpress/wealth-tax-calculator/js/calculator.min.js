// Billionaire Wealth Tax Calculator — WordPress plugin script
// Element IDs are prefixed with "wtc-" to avoid collisions with other page content.

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────────────────────────────────
    // Data is injected from WordPress via wp_localize_script
    var BILLIONAIRE_WEALTH = (typeof wealthTaxConfig !== 'undefined' && wealthTaxConfig.billionaireWealth)
        ? wealthTaxConfig.billionaireWealth
        : 8.2e12; // Fallback to $8.2 trillion (Forbes 2026 estimate)
    var FIVE_PERCENT_BASELINE_REVENUE = 4.4e12;

    // ── State ──────────────────────────────────────────────────────────────────
    var comparisonsData = (typeof wealthTaxConfig !== 'undefined' && wealthTaxConfig.comparisons)
        ? wealthTaxConfig.comparisons
        : [];
    var POLICY_GROUP_KEYS = ['healthcare', 'education', 'business', 'directRelief', 'housing', 'childcare'];
    var selectedPolicies = POLICY_GROUP_KEYS.slice();
    var selectedPolicyOptions = {};
    var collapsedPolicyGroups = [];
    var currentMode = 'advanced'; // 'basic' or 'advanced'
    var TAX_RATE_MIN = 1;
    var TAX_RATE_MAX = 10;
    var sliderController = {
        instance: null,
        suppressCallback: false,
        resizeTicking: false
    };
    var moneyPileController = {
        shell: null,
        field: null,
        columns: [],
        initialized: false
    };
    var supportsRequestAnimationFrame = typeof window.requestAnimationFrame === 'function';
    var requestFrame = supportsRequestAnimationFrame
        ? function (callback) {
            return window.requestAnimationFrame(callback);
        }
        : function (callback) {
            return window.setTimeout(callback, 16);
        };
    var supportsCssVariables = !!(window.CSS && window.CSS.supports && window.CSS.supports('--wtc-test', '0'));
    var MONEY_PILE_PROFILES = [0.26, 0.4, 0.58, 0.82, 1, 0.92, 0.72, 0.5, 0.34];
    var MONEY_PILE_MAX_BUNDLES = 14;

    // Policy category labels
    var POLICY_LABELS = {
        healthcare: 'Healthcare',
        education: 'Education',
        business: 'Tax Relief',
        directRelief: 'Direct Relief',
        housing: 'Housing',
        childcare: 'Childcare & Families'
    };

    var POLICY_FILL_COLORS = {
        healthcare:   '#e05a5a',
        education:    '#4a90d9',
        business:     '#9b59b6',
        directRelief: '#27ae60',
        housing:      '#e67e22',
        childcare:    '#1abc9c'
    };

    var SANDERS_POLICY_SOURCES = [
        {
            text: 'The Make Billionaires Pay Their Fair Share Act',
            url: 'https://www.sanders.senate.gov/wp-content/uploads/MakeBillionairesPayTheirFairShareAct.pdf'
        },
        {
            text: 'Saez-Zucman wealth tax revenue memo',
            url: 'https://www.sanders.senate.gov/wp-content/uploads/saez-zucman-sanders2026wealthtax.pdf'
        }
    ];
    
    // Policy-specific funding examples
    var POLICY_EXAMPLES = {
        healthcare: [
            {
                minAmount: 290e9,
                maxAmount: 290e9,
                costLabel: '$290 billion over 10 years',
                description: 'Expand Medicare to cover dental, vision, and hearing care for all seniors.',
                sources: SANDERS_POLICY_SOURCES
            },
            {
                minAmount: 300e9,
                maxAmount: 300e9,
                costLabel: '$300 billion over 10 years',
                description: 'Ensure that seniors and people with disabilities are able to receive the home health care they need through Medicaid.',
                sources: SANDERS_POLICY_SOURCES
            },
            {
                minAmount: 1.1e12,
                maxAmount: 1.1e12,
                costLabel: '$1.1 trillion over 10 years',
                description: 'Reverse Medicaid and ACA cuts in the One Big Beautiful Bill.',
                sources: SANDERS_POLICY_SOURCES
            }
        ],
        education: [
            {
                minAmount: 152e9,
                maxAmount: 152e9,
                costLabel: '$152 billion over 10 years',
                description: 'Guarantee a $60,000 minimum public-school teacher salary nationwide.',
                sources: SANDERS_POLICY_SOURCES
            }
        ],
        business: [
            {
                minAmount: 2e12,
                maxAmount: 2.5e12,
                costLabel: '$2.0-$2.5 trillion over 10 years',
                description: 'Eliminate federal income taxes entirely for individuals earning up to $46,000 per year and married couples earning up to $92,000 per year.',
                sources: [
                    {
                        text: 'The Budget and Economic Outlook: 2024 to 2034',
                        url: 'https://www.cbo.gov/publication/59710'
                    },
                    {
                        text: 'SOI Tax Stats - Historical data tables | Internal Revenue Service',
                        url: 'https://www.irs.gov/statistics/soi-tax-stats-individual-income-tax-returns-publication-1304-complete-report'
                    }
                ]
            },
            {
                minAmount: 50e9,
                maxAmount: 90e9,
                costLabel: '$50-$90 billion over 10 years',
                description: 'Freeze property tax rates for seniors owning just one home.',
                sources: [
                    {
                        text: 'Homeownership by Selected Demographic and Housing Characteristics'
                    },
                    {
                        text: 'Property tax burdens vary widely as states debate senior relief'
                    }
                ]
            },
            {
                minAmount: 2.125e12,
                maxAmount: 2.125e12,
                costLabel: '$2.125 trillion over 10 years',
                description: 'Reduce employer-side payroll tax on wages to 25%.',
                sources: [
                    {
                        text: 'Monthly Budget Review: August 2024',
                        url: 'https://www.cbo.gov/publication/60553'
                    },
                    {
                        text: 'Trustees Report Summary',
                        url: 'https://www.ssa.gov/OACT/TRSUM/'
                    },
                    {
                        text: 'What Kinds of Revenue Does the Government Collect? | Bipartisan Policy Center',
                        url: 'https://bipartisanpolicy.org/explainer/what-kinds-of-revenue-does-the-government-collect/'
                    },
                    {
                        text: 'Overview of the Federal Tax System | EveryCRSReport.com',
                        url: 'https://www.everycrsreport.com/reports/R45145.html'
                    }
                ]
            }
        ],
        directRelief: [
            {
                minAmount: 959e9,
                maxAmount: 959e9,
                costLabel: '$959 billion over 10 years',
                description: 'Provide $3,000 direct payments to every man, woman, and child living in a household making $150,000 or less. Approximately 85% of the U.S. population would be eligible, totaling around 285.3 million people.',
                sources: SANDERS_POLICY_SOURCES
            }
        ],
        housing: [
            {
                minAmount: 856e9,
                maxAmount: 856e9,
                costLabel: '$856 billion over 10 years',
                description: 'Eliminate the affordable housing gap and abolish homelessness in America by building, rehabilitating, and preserving over 7 million affordable homes and apartments.',
                sources: SANDERS_POLICY_SOURCES
            }
        ],
        childcare: [
            {
                minAmount: 700e9,
                maxAmount: 700e9,
                costLabel: '$700 billion over 10 years',
                description: 'End the child care crisis in America by making sure that no family in America pays over 7 percent of their income on child care.',
                sources: SANDERS_POLICY_SOURCES
            }
        ]
    };

    function getPolicyOptionKey(policy, index) {
        return policy + ':' + index;
    }

    function isOptionEnabled(policy, index) {
        return Object.prototype.hasOwnProperty.call(selectedPolicyOptions, getPolicyOptionKey(policy, index));
    }

    function enableOption(policy, index, item) {
        var key = getPolicyOptionKey(policy, index);
        var maxAmount = (typeof item.maxAmount === 'number') ? item.maxAmount : getFundingAmount(item);
        selectedPolicyOptions[key] = {
            amount: maxAmount
        };
    }

    function disableOption(policy, index) {
        delete selectedPolicyOptions[getPolicyOptionKey(policy, index)];
    }

    function getOptionAmount(key) {
        return Object.prototype.hasOwnProperty.call(selectedPolicyOptions, key)
            ? selectedPolicyOptions[key].amount
            : 0;
    }

    function removePolicyOptionsForGroup(policyGroup) {
        var prefix = policyGroup + ':';
        var keys = Object.keys(selectedPolicyOptions);
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].indexOf(prefix) === 0) {
                delete selectedPolicyOptions[keys[i]];
            }
        }
    }

    function removeCollapsedStateForGroup(policyGroup) {
        var index = collapsedPolicyGroups.indexOf(policyGroup);
        if (index > -1) {
            collapsedPolicyGroups.splice(index, 1);
        }
    }

    function toggleGroupCollapse(policyGroup) {
        var index = collapsedPolicyGroups.indexOf(policyGroup);
        if (index > -1) {
            // Currently collapsed, expand it
            collapsedPolicyGroups.splice(index, 1);
        } else {
            // Currently expanded, collapse it
            collapsedPolicyGroups.push(policyGroup);
        }
        
        // Update the UI to reflect the new state
        var allocationResults = document.getElementById('wtc-allocation-results');
        if (allocationResults && allocationResults.previousElementSibling) {
            allocationResults.previousElementSibling.classList.remove('is-collapsed');
        }
        renderPolicyAllocationResults();
    }

    function handleGroupToggleClick(event) {
        event.preventDefault();
        var toggle = event.currentTarget;
        var policyGroup = toggle.getAttribute('data-policy-group');
        if (policyGroup) {
            toggleGroupCollapse(policyGroup);
        }
    }

    function enableAvailablePolicyOptionsForGroup(policyGroup) {
        var policyExamples = POLICY_EXAMPLES[policyGroup] || [];
        for (var i = 0; i < policyExamples.length; i++) {
            if (!isOptionEnabled(policyGroup, i)) {
                enableOption(policyGroup, i, policyExamples[i]);
            }
        }
    }

    function selectAllPolicyOptionsForSelectedGroups() {
        for (var i = 0; i < selectedPolicies.length; i++) {
            enableAvailablePolicyOptionsForGroup(selectedPolicies[i]);
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Sanitize URL to prevent XSS attacks
     * Only allows http, https, and relative URLs
     */
    function sanitizeUrl(url) {
        if (!url) return '#';
        var urlStr = String(url).trim();
        // Allow http, https, and relative URLs only
        if (urlStr.match(/^(https?:\/\/|\/|#)/i)) {
            return urlStr;
        }
        return '#';
    }

    function formatWholeNumber(amount) {
        var rounded = Math.round(amount);
        return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    function formatCurrency(amount) {
        if (amount >= 1e12) {
            return '$' + (amount / 1e12).toFixed(2) + ' Trillion';
        }
        if (amount >= 1e9) {
            return '$' + (amount / 1e9).toFixed(1) + ' Billion';
        }
        return '$' + formatWholeNumber(amount);
    }

    function getFundingAmount(item) {
        if (!item) {
            return 0;
        }

        if (typeof item.maxAmount === 'number') {
            return item.maxAmount;
        }
        if (typeof item.minAmount === 'number') {
            return item.minAmount;
        }
        if (typeof item.maxCost === 'number') {
            return item.maxCost;
        }
        if (typeof item.minCost === 'number') {
            return item.minCost;
        }
        if (typeof item.amount === 'number') {
            return item.amount;
        }

        return 0;
    }

    function formatCostLabel(item) {
        if (item && item.costLabel) {
            return item.costLabel;
        }

        if (item && typeof item.minAmount === 'number' && typeof item.maxAmount === 'number' && item.maxAmount > item.minAmount) {
            return formatCurrency(item.minAmount) + ' - ' + formatCurrency(item.maxAmount);
        }

        if (item && typeof item.minCost === 'number' && typeof item.maxCost === 'number' && item.maxCost > item.minCost) {
            return formatCurrency(item.minCost) + ' - ' + formatCurrency(item.maxCost);
        }

        return formatCurrency(getFundingAmount(item));
    }

    function getItemSources(item) {
        if (item && item.sources && item.sources.length) {
            return item.sources;
        }

        if (item && item.sourceText && item.sourceUrl) {
            return [
                {
                    text: item.sourceText,
                    url: item.sourceUrl
                }
            ];
        }

        return [];
    }

    function appendSourceSet(container, sources, linkClass) {
        for (var i = 0; i < sources.length; i++) {
            if (i > 0) {
                container.appendChild(document.createTextNode(', '));
            }

            var source = sources[i];
            var node;

            if (source.url) {
                node = document.createElement('a');
                node.href = sanitizeUrl(source.url);
                node.target = '_blank';
                node.rel = 'noopener noreferrer';
            } else {
                node = document.createElement('span');
            }

            if (linkClass) {
                node.className = linkClass;
            }

            node.textContent = source.text;
            container.appendChild(node);
        }
    }

    function getPolicySourceAnchorId(policy, index) {
        return 'wtc-source-' + policy + '-' + index;
    }

    function renderAdvancedModeSources(sourcesList) {
        var hasSourceEntries = false;
        sourcesList.innerHTML = '';

        for (var i = 0; i < selectedPolicies.length; i++) {
            var policy = selectedPolicies[i];
            var policyExamples = POLICY_EXAMPLES[policy] || [];

            for (var j = 0; j < policyExamples.length; j++) {
                var example = policyExamples[j];
                var exampleSources = getItemSources(example);

                if (!exampleSources.length) {
                    continue;
                }

                hasSourceEntries = true;

                var sourceItem = document.createElement('li');
                sourceItem.id = getPolicySourceAnchorId(policy, j);

                var title = document.createElement('strong');
                title.textContent = (POLICY_LABELS[policy] || policy) + ': ';
                sourceItem.appendChild(title);

                var descriptionText = document.createElement('span');
                descriptionText.textContent = example.description + ' (' + formatCostLabel(example) + ') — ';
                sourceItem.appendChild(descriptionText);

                appendSourceSet(sourceItem, exampleSources);
                sourcesList.appendChild(sourceItem);
            }
        }

        if (!hasSourceEntries) {
            var emptyItem = document.createElement('li');
            emptyItem.textContent = 'Select policy categories to view sources.';
            sourcesList.appendChild(emptyItem);
        }
    }

    function buildMoneyBundleTransform(bundleScale, bundleTilt, isActive) {
        var translateY = isActive ? 0 : 9;
        var scale = isActive ? bundleScale : (0.92 * bundleScale);

        return 'translateX(-50%) translateY(' + translateY + 'px) scale(' + scale.toFixed(3) + ') rotate(' + bundleTilt.toFixed(2) + 'deg)';
    }

    function applyCompatibilityClasses() {
        var calculatorContainer = document.querySelector('.calculator-container');
        if (!calculatorContainer) {
            return;
        }

        if (!supportsCssVariables) {
            calculatorContainer.classList.add('no-cssvars');
        }
    }

    function calculateRevenue(taxRate) {
        return FIVE_PERCENT_BASELINE_REVENUE * (taxRate / 5);
    }

    function getTaxRateInput() {
        return el('wtc-taxRate');
    }

    function clampTaxRate(value) {
        return Math.max(TAX_RATE_MIN, Math.min(TAX_RATE_MAX, value));
    }

    function quantizeTaxRate(value) {
        if (currentMode === 'basic') {
            return Math.round(value);
        }

        return Math.round(value * 10) / 10;
    }

    function rateToRatio(taxRate) {
        return (taxRate - TAX_RATE_MIN) / (TAX_RATE_MAX - TAX_RATE_MIN);
    }

    function clampRatio(value) {
        return Math.max(0, Math.min(1, value));
    }

    function ratioToRate(ratio) {
        return TAX_RATE_MIN + (clampRatio(ratio) * (TAX_RATE_MAX - TAX_RATE_MIN));
    }

    function getCurrentTaxRate() {
        var input = getTaxRateInput();
        if (!input) {
            return TAX_RATE_MIN;
        }

        var parsed = parseFloat(input.value);
        if (isNaN(parsed)) {
            return TAX_RATE_MIN;
        }

        return clampTaxRate(parsed);
    }

    function clampNumber(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function keepSliderInfoboxVisible() {
        var sliderWrapper = el('wtc-pr-slider');
        var sliderInfoBox = el('wtc-sliderInfobox');

        if (!sliderWrapper || !sliderInfoBox) {
            return;
        }

        var handleWrapper = sliderInfoBox.parentElement;
        if (!handleWrapper) {
            return;
        }

        if (supportsCssVariables) {
            sliderInfoBox.style.setProperty('--wtc-infobox-offset', '0px');
            sliderInfoBox.style.setProperty('--wtc-infobox-pointer-offset', '0px');
        } else {
            sliderInfoBox.style.marginLeft = '0px';
        }

        var sliderRect = sliderWrapper.getBoundingClientRect();
        var handleRect = handleWrapper.getBoundingClientRect();
        var infoBoxWidth = sliderInfoBox.offsetWidth;

        if (!infoBoxWidth || sliderRect.width <= 0) {
            return;
        }

        var gutter = 8;
        var handleCenter = handleRect.left + (handleRect.width / 2);
        var desiredLeft = handleCenter - (infoBoxWidth / 2);
        var minLeft = sliderRect.left + gutter;
        var maxLeft = sliderRect.right - gutter - infoBoxWidth;
        var boundedLeft = clampNumber(desiredLeft, minLeft, maxLeft);
        var offset = boundedLeft - desiredLeft;

        var pointerLimit = (infoBoxWidth / 2) - 20;
        var pointerOffset = clampNumber(-offset, -pointerLimit, pointerLimit);

        if (supportsCssVariables) {
            sliderInfoBox.style.setProperty('--wtc-infobox-offset', offset.toFixed(2) + 'px');
            sliderInfoBox.style.setProperty('--wtc-infobox-pointer-offset', pointerOffset.toFixed(2) + 'px');
        } else {
            sliderInfoBox.style.left = '50%';
            sliderInfoBox.style.marginLeft = offset.toFixed(2) + 'px';
        }
    }

    function ensureMoneyPile() {
        if (moneyPileController.initialized) {
            return true;
        }

        var shell = document.querySelector('.wtc-slider-shell');
        var field = el('wtc-moneyField');

        if (!shell || !field) {
            return false;
        }

        moneyPileController.shell = shell;
        moneyPileController.field = field;
        moneyPileController.columns = [];
        field.innerHTML = '';

        for (var columnIndex = 0; columnIndex < MONEY_PILE_PROFILES.length; columnIndex++) {
            var column = document.createElement('div');
            column.className = 'wtc-stack-column';

            var shadow = document.createElement('div');
            shadow.className = 'wtc-stack-shadow';
            column.appendChild(shadow);

            var bundles = [];

            for (var bundleIndex = 0; bundleIndex < MONEY_PILE_MAX_BUNDLES; bundleIndex++) {
                var bundle = document.createElement('span');
                var offsetPattern = ((bundleIndex + (columnIndex * 2)) % 5) - 2;
                var tiltPattern = ((columnIndex * 3) + bundleIndex) % 7;
                var bundleTilt = (tiltPattern - 3) * 0.45;
                var widthTrim = (bundleIndex + columnIndex) % 3;
                var verticalRatio = (MONEY_PILE_MAX_BUNDLES <= 1)
                    ? 0
                    : (bundleIndex / (MONEY_PILE_MAX_BUNDLES - 1));
                var edgeBoost = Math.abs((verticalRatio * 2) - 1);
                var bundleScale = 0.94 + (edgeBoost * 0.2);

                bundle.className = 'wtc-money-bundle';
                bundle.style.marginLeft = (offsetPattern * 2.2).toFixed(1) + 'px';

                if (supportsCssVariables) {
                    bundle.style.setProperty('--wtc-bundle-index', String(bundleIndex));
                    bundle.style.setProperty('--wtc-bundle-delay', (bundleIndex * 16) + 'ms');
                    bundle.style.setProperty('--wtc-bundle-tilt', bundleTilt.toFixed(2) + 'deg');
                    bundle.style.setProperty('--wtc-bundle-width-trim', widthTrim + 'px');
                    bundle.style.setProperty('--wtc-bundle-scale', bundleScale.toFixed(3));
                } else {
                    bundle.setAttribute('data-bundle-scale', bundleScale.toFixed(3));
                    bundle.setAttribute('data-bundle-tilt', bundleTilt.toFixed(2));
                    bundle.style.bottom = (bundleIndex * 9) + 'px';
                    bundle.style.width = 'calc(100% - ' + widthTrim + 'px)';
                    bundle.style.transitionDelay = (bundleIndex * 16) + 'ms';
                    bundle.style.transform = buildMoneyBundleTransform(bundleScale, bundleTilt, false);
                }

                column.appendChild(bundle);
                bundles.push(bundle);
            }

            field.appendChild(column);
            moneyPileController.columns.push({
                profile: MONEY_PILE_PROFILES[columnIndex],
                bundles: bundles
            });
        }

        moneyPileController.initialized = true;
        return true;
    }

    function syncMoneyPile(taxRate) {
        if (!ensureMoneyPile()) {
            return;
        }

        var progress = rateToRatio(taxRate);
        var visibleRatio = 0.08 + (Math.pow(progress, 0.72) * 0.92);

        if (supportsCssVariables) {
            moneyPileController.shell.style.setProperty('--wtc-money-progress', visibleRatio.toFixed(3));
        }

        for (var columnIndex = 0; columnIndex < moneyPileController.columns.length; columnIndex++) {
            var column = moneyPileController.columns[columnIndex];
            var bundleTarget = Math.round(column.profile * visibleRatio * MONEY_PILE_MAX_BUNDLES);

            if (visibleRatio > 0.02) {
                bundleTarget = Math.max(1, bundleTarget);
            }

            for (var bundleIndex = 0; bundleIndex < column.bundles.length; bundleIndex++) {
                if (bundleIndex < bundleTarget) {
                    column.bundles[bundleIndex].classList.add('is-active');
                    if (!supportsCssVariables) {
                        column.bundles[bundleIndex].style.opacity = '1';
                        column.bundles[bundleIndex].style.transform = buildMoneyBundleTransform(
                            parseFloat(column.bundles[bundleIndex].getAttribute('data-bundle-scale')),
                            parseFloat(column.bundles[bundleIndex].getAttribute('data-bundle-tilt')),
                            true
                        );
                        column.bundles[bundleIndex].style.filter = 'saturate(1)';
                    }
                } else {
                    column.bundles[bundleIndex].classList.remove('is-active');
                    if (!supportsCssVariables) {
                        column.bundles[bundleIndex].style.opacity = '0';
                        column.bundles[bundleIndex].style.transform = buildMoneyBundleTransform(
                            parseFloat(column.bundles[bundleIndex].getAttribute('data-bundle-scale')),
                            parseFloat(column.bundles[bundleIndex].getAttribute('data-bundle-tilt')),
                            false
                        );
                        column.bundles[bundleIndex].style.filter = 'saturate(0.86)';
                    }
                }
            }
        }
    }

    function syncSliderDecor(taxRate, revenue) {
        var sliderValue = el('wtc-sliderValue');
        var annualPrice = el('wtc-annualPrice');
        var planHolder = el('wtc-plan-holder');
        var deviceHolder = el('wtc-device-holder');
        var highlightFill = el('wtc-highlight-fill');
        var handle = el('wtc-sliderHandle');

        var rateText = taxRate.toFixed(1) + '%';
        var progress = rateToRatio(taxRate) * 100;

        if (sliderValue) {
            sliderValue.textContent = rateText;
        }

        if (planHolder) {
            planHolder.textContent = 'Tax Rate:';
        }

        if (deviceHolder) {
            deviceHolder.textContent = rateText;
        }

        if (annualPrice) {
            annualPrice.textContent = formatCurrency(revenue);
        }

        if (highlightFill) {
            highlightFill.style.width = progress.toFixed(2) + '%';
        }

        if (handle) {
            handle.setAttribute('aria-valuenow', taxRate.toFixed(1));
            handle.setAttribute('aria-valuetext', rateText);
        }

        syncMoneyPile(taxRate);
        keepSliderInfoboxVisible();
    }

    function syncDragdealerPosition(taxRate) {
        if (!sliderController.instance) {
            return;
        }

        sliderController.suppressCallback = true;
        sliderController.instance.setValue(rateToRatio(taxRate), 0, true);
        sliderController.suppressCallback = false;
    }

    function setTaxRate(taxRate, syncHandlePosition) {
        var input = getTaxRateInput();
        if (!input) {
            return;
        }

        var nextRate = quantizeTaxRate(clampTaxRate(taxRate));
        input.value = currentMode === 'basic' ? String(Math.round(nextRate)) : nextRate.toFixed(1);

        if (syncHandlePosition) {
            syncDragdealerPosition(nextRate);
        }

        updateDisplay();
    }

    function handleSliderKeydown(event) {
        var key = event.key;
        var step = currentMode === 'basic' ? 1 : 0.1;
        var currentValue = getCurrentTaxRate();
        var nextValue = currentValue;

        if (key === 'ArrowLeft' || key === 'ArrowDown') {
            nextValue = currentValue - step;
        } else if (key === 'ArrowRight' || key === 'ArrowUp') {
            nextValue = currentValue + step;
        } else if (key === 'PageDown') {
            nextValue = currentValue - 1;
        } else if (key === 'PageUp') {
            nextValue = currentValue + 1;
        } else if (key === 'Home') {
            nextValue = TAX_RATE_MIN;
        } else if (key === 'End') {
            nextValue = TAX_RATE_MAX;
        } else {
            return;
        }

        event.preventDefault();
        setTaxRate(nextValue, true);
    }

    function initTaxRateSlider() {
        var sliderWrapper = el('wtc-pr-slider');
        var sliderHandle = el('wtc-sliderHandle');
        var taxRateInput = getTaxRateInput();

        if (!sliderWrapper || !sliderHandle || !taxRateInput || typeof Dragdealer === 'undefined') {
            return;
        }

        sliderController.instance = new Dragdealer('wtc-pr-slider', {
            x: rateToRatio(getCurrentTaxRate()),
            speed: 0.15,
            animationCallback: function (x) {
                if (sliderController.suppressCallback) {
                    return;
                }

                var nextRate = quantizeTaxRate(ratioToRate(x));
                var nextValue = currentMode === 'basic' ? String(Math.round(nextRate)) : nextRate.toFixed(1);

                if (taxRateInput.value !== nextValue) {
                    taxRateInput.value = nextValue;
                    updateDisplay();
                } else {
                    syncSliderDecor(nextRate, calculateRevenue(nextRate));
                }
            }
        });

        sliderHandle.addEventListener('keydown', handleSliderKeydown);
        syncDragdealerPosition(getCurrentTaxRate());

        function handleViewportChange() {
            if (sliderController.resizeTicking) {
                return;
            }

            sliderController.resizeTicking = true;
            requestFrame(function () {
                sliderController.resizeTicking = false;
                keepSliderInfoboxVisible();
            });
        }

        window.addEventListener('resize', handleViewportChange);
        window.addEventListener('orientationchange', handleViewportChange);
    }

    function getComparisonMatchCost(item) {
        if (!item) {
            return 0;
        }

        if (typeof item.minCost === 'number') {
            return item.minCost;
        }

        return getFundingAmount(item);
    }

    function getBestFitFundedComparisons(revenue) {
        if (!comparisonsData || comparisonsData.length === 0) {
            return {
                comparisons: [],
                totalCost: 0,
                remaining: Math.max(0, Math.round(revenue))
            };
        }

        var normalizedRevenue = Math.max(0, Math.round(revenue));
        var eligible = [];
        var i;

        for (i = 0; i < comparisonsData.length; i++) {
            var item = comparisonsData[i];
            var cost = getComparisonMatchCost(item);

            if (typeof cost === 'number' && cost > 0 && cost <= normalizedRevenue) {
                eligible.push({
                    item: item,
                    cost: cost,
                    index: i
                });
            }
        }

        if (eligible.length === 0) {
            return {
                comparisons: [],
                totalCost: 0,
                remaining: normalizedRevenue
            };
        }

        var bestTotal = 0;
        var bestIndexes = [];

        function isLexicographicallyEarlier(a, b) {
            var minLength = Math.min(a.length, b.length);
            for (var k = 0; k < minLength; k++) {
                if (a[k] !== b[k]) {
                    return a[k] < b[k];
                }
            }
            return a.length < b.length;
        }

        function isBetterSelection(total, indexes) {
            if (total > bestTotal) {
                return true;
            }

            if (total < bestTotal) {
                return false;
            }

            if (bestIndexes.length === 0) {
                return indexes.length > 0;
            }

            if (indexes.length < bestIndexes.length) {
                return true;
            }

            if (indexes.length > bestIndexes.length) {
                return false;
            }

            return isLexicographicallyEarlier(indexes, bestIndexes);
        }

        function search(position, total, indexes) {
            if (total > normalizedRevenue) {
                return;
            }

            if (position >= eligible.length) {
                if (isBetterSelection(total, indexes)) {
                    bestTotal = total;
                    bestIndexes = indexes.slice();
                }
                return;
            }

            search(position + 1, total, indexes);

            indexes.push(position);
            search(position + 1, total + eligible[position].cost, indexes);
            indexes.pop();
        }

        search(0, 0, []);

        var selected = [];
        for (i = 0; i < bestIndexes.length; i++) {
            selected.push(eligible[bestIndexes[i]].item);
        }

        return {
            comparisons: selected,
            totalCost: bestTotal,
            remaining: Math.max(0, normalizedRevenue - bestTotal)
        };
    }

    function createOverBudgetPinata(isAtMaxRate) {
        var pinataDrop = document.createElement('div');
        pinataDrop.className = 'allocation-pinata-drop';

        var pinataButton = document.createElement('button');
        pinataButton.type = 'button';
        pinataButton.className = 'allocation-pinata-button button-78';
        pinataButton.textContent = '+1% tax rate';
        pinataButton.setAttribute('aria-label', 'Increase tax rate by 1 percent');

        if (isAtMaxRate) {
            pinataButton.disabled = true;
            pinataButton.setAttribute('aria-label', 'Maximum tax rate reached');
            pinataButton.classList.add('is-maxed');
        }
        pinataDrop.appendChild(pinataButton);

        return pinataDrop;
    }

    function handleOverBudgetPinataClick(event) {
        event.preventDefault();

        var pinataButton = event.currentTarget;
        var currentRate = getCurrentTaxRate();
        if (currentRate >= TAX_RATE_MAX) {
            return;
        }

        pinataButton.blur();
        setTaxRate(currentRate + 1, true);
    }

    function syncPolicyAllocationRows(allocationResults) {
        var exampleRows = allocationResults.querySelectorAll('.allocation-example-row');
        for (var r = 0; r < exampleRows.length; r++) {
            var row = exampleRows[r];
            var policy = row.getAttribute('data-policy');
            var index = row.getAttribute('data-index');
            var isEnabled = isOptionEnabled(policy, index);

            if (isEnabled) {
                row.classList.add('is-enabled');
            } else {
                row.classList.remove('is-enabled');
            }

            var rowFill = row.querySelector('.allocation-row-fill');
            if (rowFill) {
                rowFill.style.width = isEnabled ? '100%' : '0%';
            }

            var optionInput = row.querySelector('.policy-option-input');
            if (optionInput) {
                optionInput.checked = isEnabled;
            }
        }
    }

    function updatePolicyAllocation() {
        var allocationResults = el('wtc-allocationResults');
        if (!allocationResults) return;
        ensureAllocationTotalsAtTop();

        if (selectedPolicies.length === 0) {
            selectedPolicyOptions = {};
            var prompt = document.createElement('p');
            prompt.className = 'allocation-prompt';
            prompt.textContent = 'No policy categories are currently available.';
            allocationResults.innerHTML = '';
            allocationResults.appendChild(prompt);
            allocationResults.setAttribute('data-rendered', 'false');
            return;
        }

        var shouldRender = allocationResults.getAttribute('data-rendered') !== 'true';

        if (shouldRender) {
            allocationResults.innerHTML = '';

            for (var i = 0; i < selectedPolicies.length; i++) {
                var policy = selectedPolicies[i];
                var policyExamples = POLICY_EXAMPLES[policy] || [];
                var availableExamples = [];

                for (var j = 0; j < policyExamples.length; j++) {
                    availableExamples.push({
                        example: policyExamples[j],
                        index: j
                    });
                }

                var group = document.createElement('div');
                group.className = 'allocation-group' + (collapsedPolicyGroups.indexOf(policy) > -1 ? ' is-collapsed' : '');

                // Create the toggle button
                var groupToggle = document.createElement('button');
                groupToggle.type = 'button';
                groupToggle.className = 'allocation-group-toggle';
                groupToggle.setAttribute('data-policy-group', policy);
                groupToggle.setAttribute('aria-expanded', collapsedPolicyGroups.indexOf(policy) === -1 ? 'true' : 'false');

                var groupMain = document.createElement('div');
                groupMain.className = 'allocation-group-main';

                var categoryLabel = document.createElement('span');
                categoryLabel.className = 'allocation-category';
                categoryLabel.textContent = POLICY_LABELS[policy];

                var chevron = document.createElement('span');
                chevron.className = 'allocation-group-chevron';
                chevron.setAttribute('aria-hidden', 'true');

                groupMain.appendChild(categoryLabel);
                groupMain.appendChild(chevron);
                groupToggle.appendChild(groupMain);

                var groupContent = document.createElement('div');
                groupContent.className = 'allocation-group-content' + (collapsedPolicyGroups.indexOf(policy) > -1 ? ' collapsed' : '');


                if (availableExamples.length > 0) {
                    var examplesContainer = document.createElement('div');
                    examplesContainer.className = 'allocation-example-list';

                    for (var k = 0; k < availableExamples.length; k++) {
                        var available = availableExamples[k];
                        var exampleData = available.example;
                        var isEnabled = isOptionEnabled(policy, available.index);
                        var fillColor = POLICY_FILL_COLORS[policy] || '#888';

                        var exampleRow = document.createElement('div');
                        exampleRow.className = 'allocation-example-row' + (isEnabled ? ' is-enabled' : '');
                        exampleRow.setAttribute('data-policy', policy);
                        exampleRow.setAttribute('data-index', String(available.index));
                        exampleRow.style.setProperty('--fill-color', fillColor);

                        var rowFill = document.createElement('div');
                        rowFill.className = 'allocation-row-fill';
                        rowFill.style.width = isEnabled ? '100%' : '0%';

                        var rowContent = document.createElement('div');
                        rowContent.className = 'allocation-row-content';

                        var optionWrapper = document.createElement('div');
                        optionWrapper.className = 'policy-option-checkbox';

                        var checkboxWrapper = document.createElement('div');
                        checkboxWrapper.className = 'checkbox-wrapper-50';

                        var optionInput = document.createElement('input');
                        optionInput.type = 'checkbox';
                        optionInput.className = 'plus-minus policy-option-input';
                        optionInput.checked = isEnabled;
                        optionInput.setAttribute('aria-label', 'Toggle policy option');

                        checkboxWrapper.appendChild(optionInput);

                        var optionText = document.createElement('span');
                        optionText.className = 'policy-option-text';
                        optionText.textContent = exampleData.description;

                        optionWrapper.appendChild(checkboxWrapper);
                        optionWrapper.appendChild(optionText);

                        var optionMeta = document.createElement('div');
                        optionMeta.className = 'policy-option-meta';

                        var optionCost = document.createElement('span');
                        optionCost.className = 'policy-option-cost';
                        optionCost.textContent = formatCostLabel(exampleData);

                        var optionSource = document.createElement('a');
                        optionSource.className = 'example-source';
                        optionSource.href = '#' + getPolicySourceAnchorId(policy, available.index);
                        optionSource.textContent = 'source';

                        optionMeta.appendChild(optionCost);
                        optionMeta.appendChild(optionSource);

                        rowContent.appendChild(optionWrapper);
                        rowContent.appendChild(optionMeta);

                        exampleRow.appendChild(rowFill);
                        exampleRow.appendChild(rowContent);
                        examplesContainer.appendChild(exampleRow);
                    }

                    groupContent.appendChild(examplesContainer);
                } else {
                    var emptyMessage = document.createElement('p');
                    emptyMessage.className = 'allocation-empty';
                    emptyMessage.textContent = 'No policy options currently available for this category.';
                    groupContent.appendChild(emptyMessage);
                }

                group.appendChild(groupToggle);
                group.appendChild(groupContent);
                allocationResults.appendChild(group);
            }

            // Add event listeners for group toggles
            var groupToggles = allocationResults.querySelectorAll('.allocation-group-toggle');
            for (var t = 0; t < groupToggles.length; t++) {
                groupToggles[t].addEventListener('click', handleGroupToggleClick);
            }

            for (var r = 0; r < exampleRows.length; r++) {
                exampleRows[r].addEventListener('click', handlePolicyRowClick);
            }

            var optionInputs = allocationResults.querySelectorAll('.policy-option-input');
            for (var s = 0; s < optionInputs.length; s++) {
                optionInputs[s].addEventListener('change', handlePolicyToggleInput);
                optionInputs[s].addEventListener('click', function (e) { e.stopPropagation(); });
            }

            allocationResults.setAttribute('data-rendered', 'true');
        }

        syncPolicyAllocationRows(allocationResults);
        updateAllocationSummary();
    }

    function calculateSelectedPolicyFunding() {
        var total = 0;
        var keys = Object.keys(selectedPolicyOptions);
        for (var i = 0; i < keys.length; i++) {
            total += selectedPolicyOptions[keys[i]].amount;
        }
        return total;
    }

    function ensureAllocationTotalsAtTop() {
        var policySection = document.querySelector('.policy-allocation-section');
        var totalsBox = el('wtc-allocationTotalsBox');
        var allocationResults = el('wtc-allocationResults');

        if (!policySection || !totalsBox || !allocationResults) {
            return;
        }

        if (totalsBox.parentNode !== policySection || totalsBox.nextElementSibling !== allocationResults) {
            policySection.insertBefore(totalsBox, allocationResults);
        }
    }

    function updateAllocationSummary() {
        ensureAllocationTotalsAtTop();

        var totalsBox = el('wtc-allocationTotalsBox');
        if (!totalsBox) return;

        var taxRate = parseFloat(el('wtc-taxRate').value);
        var revenue = calculateRevenue(taxRate);
        var selectedPolicyFunding = calculateSelectedPolicyFunding();

        var overrunAmount = Math.max(selectedPolicyFunding - revenue, 0);
        var remainingRevenue = Math.max(revenue - selectedPolicyFunding, 0);
        var isOverBudget = overrunAmount > 0;

        var existingSummary = totalsBox.querySelector('.allocation-summary');
        var summary = existingSummary;
        if (!summary) {
            summary = document.createElement('div');
            summary.className = 'allocation-summary';
            totalsBox.appendChild(summary);
        }

        if (isOverBudget) {
            summary.classList.add('is-over-budget');
        } else {
            summary.classList.remove('is-over-budget');
        }

        var availableLine = summary.querySelector('.allocation-available-line');
        if (!availableLine) {
            availableLine = document.createElement('span');
            availableLine.className = 'allocation-available-line';
            summary.appendChild(availableLine);
        }
        availableLine.textContent = '10-year tax revenue available: ' + formatCurrency(revenue);

        var selectedLine = summary.querySelector('.allocation-selected-line');
        if (!selectedLine) {
            selectedLine = document.createElement('span');
            selectedLine.className = 'allocation-selected-line';
            summary.appendChild(selectedLine);
        }
        selectedLine.textContent = 'Selected policy funding: ' + formatCurrency(selectedPolicyFunding);

        var budgetLine = summary.querySelector('.allocation-budget-line');
        if (!budgetLine) {
            budgetLine = document.createElement('span');
            budgetLine.className = 'allocation-budget-line';
            summary.appendChild(budgetLine);
        }

        budgetLine.classList.remove('allocation-budget-warning');
        if (isOverBudget) {
            budgetLine.classList.add('allocation-budget-warning');
            budgetLine.textContent = 'Over budget by: ' + formatCurrency(overrunAmount);
        } else {
            budgetLine.textContent = 'Remaining revenue: ' + formatCurrency(remainingRevenue);
        }

        var budgetHint = summary.querySelector('.allocation-budget-hint');
        if (!budgetHint) {
            budgetHint = document.createElement('span');
            budgetHint.className = 'allocation-budget-hint';
            summary.appendChild(budgetHint);
        }

        budgetHint.classList.remove('allocation-overrun-message');
        if (isOverBudget) {
            budgetHint.classList.add('allocation-overrun-message');
            budgetHint.textContent = 'You need to tax billionaires more! Use the button to raise the rate by 1%.';
        } else {
            budgetHint.textContent = 'Selected policy costs are within available revenue.';
        }

        var existingPinataEl = summary.querySelector('.allocation-pinata-drop');

        if (isOverBudget) {
            if (!existingPinataEl) {
                var pinataEl = createOverBudgetPinata(getCurrentTaxRate() >= TAX_RATE_MAX);
                var pinataBtn = pinataEl.querySelector('.allocation-pinata-button');
                if (pinataBtn) {
                    pinataBtn.addEventListener('click', handleOverBudgetPinataClick);
                }
                summary.insertBefore(pinataEl, budgetHint);
            } else {
                var existingPinataButton = existingPinataEl.querySelector('.allocation-pinata-button');
                if (existingPinataButton) {
                    var isAtMaxRate = getCurrentTaxRate() >= TAX_RATE_MAX;
                    existingPinataButton.disabled = isAtMaxRate;
                    if (isAtMaxRate) {
                        existingPinataButton.setAttribute('aria-label', 'Maximum tax rate reached');
                        existingPinataButton.classList.add('is-maxed');
                    } else {
                        existingPinataButton.setAttribute('aria-label', 'Increase tax rate by 1 percent');
                        existingPinataButton.classList.remove('is-maxed');
                    }
                }
            }
        } else if (existingPinataEl) {
            existingPinataEl.parentNode.removeChild(existingPinataEl);
        }
    }

    function handlePolicyRowClick(event) {
        var target = event.target;
        if (target.tagName === 'INPUT' && target.type === 'checkbox') {
            return;
        }
        var node = target;
        while (node && node !== event.currentTarget) {
            if (node.tagName === 'A') {
                return;
            }
            node = node.parentElement;
        }

        var row = event.currentTarget;
        var policy = row.getAttribute('data-policy');
        var index = row.getAttribute('data-index');
        var policyOptionKey = getPolicyOptionKey(policy, index);
        var policyExamples = POLICY_EXAMPLES[policy] || [];
        var item = policyExamples[parseInt(index, 10)];
        if (!item) return;

        var rowFill = row.querySelector('.allocation-row-fill');
        var optionInputEl = row.querySelector('.policy-option-input');

        if (isOptionEnabled(policy, index)) {
            disableOption(policy, index);
            row.classList.remove('is-enabled');
            if (rowFill) rowFill.style.width = '0%';
            if (optionInputEl) optionInputEl.checked = false;
        } else {
            enableOption(policy, index, item);
            row.classList.add('is-enabled');
            if (rowFill) rowFill.style.width = '100%';
            if (optionInputEl) optionInputEl.checked = true;
        }

        updateAllocationSummary();
    }

    function handlePolicyToggleInput(event) {
        event.stopPropagation();
        var inputEl = event.currentTarget;
        var row = inputEl;
        while (row && !row.classList.contains('allocation-example-row')) {
            row = row.parentElement;
        }
        if (!row) return;

        var policy = row.getAttribute('data-policy');
        var index = row.getAttribute('data-index');
        var policyExamples = POLICY_EXAMPLES[policy] || [];
        var item = policyExamples[parseInt(index, 10)];
        if (!item) return;

        if (inputEl.checked) {
            enableOption(policy, index, item);
            row.classList.add('is-enabled');
        } else {
            disableOption(policy, index);
            row.classList.remove('is-enabled');
        }

        var rowFill = row.querySelector('.allocation-row-fill');
        if (rowFill) rowFill.style.width = inputEl.checked ? '100%' : '0%';

        updateAllocationSummary();
    }

    function handleModeToggle(event) {
        var button = event.target;
        var mode = button.getAttribute('data-mode');

        if (mode === currentMode) return;

        currentMode = mode;

        var modeButtons = document.querySelectorAll('.mode-button');
        for (var i = 0; i < modeButtons.length; i++) {
            if (modeButtons[i].getAttribute('data-mode') === mode) {
                modeButtons[i].classList.add('active');
            } else {
                modeButtons[i].classList.remove('active');
            }
        }

        var policySection = document.querySelector('.policy-allocation-section');
        if (policySection) {
            if (mode === 'basic') {
                policySection.classList.add('hidden');
            } else {
                policySection.classList.remove('hidden');
            }
        }

        // Toggle advanced-mode class so only advanced-only hidden UI is scoped in CSS.
        var calculatorContainer = document.querySelector('.calculator-container');
        if (calculatorContainer) {
            if (mode === 'basic') {
                calculatorContainer.classList.remove('mode-advanced');
            } else {
                calculatorContainer.classList.add('mode-advanced');
            }
        }
        
        var currentValue = getCurrentTaxRate();

        if (mode === 'basic') {
            currentValue = Math.round(currentValue);
        } else {
            selectAllPolicyOptionsForSelectedGroups();
        }

        setTaxRate(currentValue, true);
    }

    // ── DOM ────────────────────────────────────────────────────────────────────

    function el(id) {
        return document.getElementById(id);
    }

    function updateDisplay() {
        var slider = getTaxRateInput();
        if (!slider) return;

        var taxRate = parseFloat(slider.value);
        if (isNaN(taxRate)) {
            taxRate = TAX_RATE_MIN;
        }

        var revenue = calculateRevenue(taxRate);

        el('wtc-rateDisplay') && (el('wtc-rateDisplay').textContent = taxRate.toFixed(1) + '%');
        syncSliderDecor(taxRate, revenue);

        var comparisonSelection = getBestFitFundedComparisons(revenue);
        var fundableComparisons = comparisonSelection.comparisons;
        var comparisonEl = el('wtc-comparisonText');
        var sourcesList = el('wtc-sourcesList');

        if (comparisonEl) {
            comparisonEl.innerHTML = '';

            if (fundableComparisons.length === 0) {
                comparisonEl.textContent = 'No listed policies are fully funded at this revenue level yet.';
            } else {
                var intro = document.createElement('p');
                intro.textContent = 'At this rate, the revenue could fund:';

                var comparisonList = document.createElement('ul');

                // In basic mode, add items to the top; in advanced mode, add to the bottom
                for (var i = 0; i < fundableComparisons.length; i++) {
                    var item = fundableComparisons[i];
                    var listItem = document.createElement('li');
                    listItem.textContent = item.description + ' (' + formatCostLabel(item) + ')';
                    
                    if (currentMode === 'basic') {
                        // In basic mode, prepend to the list (add to top)
                        if (comparisonList.firstChild) {
                            comparisonList.insertBefore(listItem, comparisonList.firstChild);
                        } else {
                            comparisonList.appendChild(listItem);
                        }
                    } else {
                        // In advanced mode, append to the list (add to bottom)
                        comparisonList.appendChild(listItem);
                    }
                }

                comparisonEl.appendChild(intro);
                comparisonEl.appendChild(comparisonList);

                if (comparisonSelection.remaining > 0) {
                    var remainderNote = document.createElement('p');
                    remainderNote.textContent = 'Unallocated remainder: ' + formatCurrency(comparisonSelection.remaining) + '.';
                    comparisonEl.appendChild(remainderNote);
                }
            }
        }

        if (sourcesList) {
            if (currentMode === 'advanced') {
                renderAdvancedModeSources(sourcesList);
            } else {
                sourcesList.innerHTML = '';

                for (var j = 0; j < fundableComparisons.length; j++) {
                    var comparison = fundableComparisons[j];
                    var sourceItem = document.createElement('li');
                    var title = document.createElement('strong');
                    title.textContent = comparison.policy + ': ';
                    sourceItem.appendChild(title);
                    appendSourceSet(sourceItem, getItemSources(comparison));
                    sourcesList.appendChild(sourceItem);
                }

                var wealthItem = document.createElement('li');
                var wealthLink = document.createElement('a');
                wealthLink.href = 'https://www.forbes.com/billionaires/';
                wealthLink.target = '_blank';
                wealthLink.rel = 'noopener noreferrer';
                wealthLink.textContent = 'Forbes World\'s Billionaires List (2026)';
                wealthItem.appendChild(wealthLink);
                wealthItem.appendChild(document.createTextNode(' — Billionaire wealth estimate of $8.2 trillion'));
                sourcesList.appendChild(wealthItem);
            }
        }

        // Update policy allocation
        updatePolicyAllocation();
    }

    function setShareStatus(statusEl, message) {
        if (!statusEl) return;
        statusEl.textContent = message;
    }

    function getShareHref(action, pageUrl, shareText) {
        var encodedUrl = encodeURIComponent(pageUrl);
        var encodedText = encodeURIComponent(shareText);
        var encodedTextWithUrl = encodeURIComponent(shareText + ' ' + pageUrl);

        if (action === 'email') {
            return 'mailto:?subject=' + encodeURIComponent('Billionaire Wealth Tax Calculator') + '&body=' + encodedTextWithUrl;
        }

        if (action === 'linkedin') {
            return 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodedUrl;
        }

        if (action === 'twitter' || action === 'x') {
            return 'https://twitter.com/intent/tweet?url=' + encodedUrl + '&text=' + encodedText;
        }

        if (action === 'pinterest') {
            return 'https://pinterest.com/pin/create/button/?url=' + encodedUrl + '&description=' + encodedText;
        }

        if (action === 'facebook') {
            return 'https://www.facebook.com/sharer/sharer.php?u=' + encodedUrl;
        }

        if (action === 'whatsapp') {
            return 'https://api.whatsapp.com/send?text=' + encodedTextWithUrl;
        }

        if (action === 'bluesky') {
            return 'https://bsky.app/intent/compose?text=' + encodedTextWithUrl;
        }

        return '#';
    }

    function copyTextToClipboard(text) {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function' && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
        }

        return new Promise(function (resolve, reject) {
            var fallbackInput = document.createElement('textarea');
            fallbackInput.value = text;
            fallbackInput.setAttribute('readonly', 'readonly');
            fallbackInput.style.position = 'fixed';
            fallbackInput.style.opacity = '0';
            fallbackInput.style.pointerEvents = 'none';
            document.body.appendChild(fallbackInput);
            fallbackInput.focus();
            fallbackInput.select();

            try {
                var successful = document.execCommand('copy');
                document.body.removeChild(fallbackInput);
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('copy-failed'));
                }
            } catch (error) {
                document.body.removeChild(fallbackInput);
                reject(error);
            }
        });
    }

    function initShareActions() {
        var shareBlocks = document.querySelectorAll('.wtc-share-block');
        if (!shareBlocks.length) return;

        var pageUrl = window.location.href;
        var shareText = 'Try the Billionaire Wealth Tax Calculator:';

        for (var b = 0; b < shareBlocks.length; b++) {
            var shareBlock = shareBlocks[b];
            var shareButtons = shareBlock.querySelectorAll('[data-share-action]');
            var likeLinks = shareBlock.querySelectorAll('.like-btn a');
            var statusEl = shareBlock.querySelector('.wtc-share-status');

            for (var i = 0; i < shareButtons.length; i++) {
                var button = shareButtons[i];
                var action = button.getAttribute('data-share-action');

                if (action !== 'copy') {
                    button.setAttribute('href', getShareHref(action, pageUrl, shareText));
                }

                button.addEventListener('click', (function (localStatusEl) {
                    return function (event) {
                        var clickedAction = event.currentTarget.getAttribute('data-share-action');
                        if (clickedAction !== 'copy') {
                            setShareStatus(localStatusEl, '');
                            return;
                        }

                        event.preventDefault();
                        copyTextToClipboard(pageUrl).then(function () {
                            setShareStatus(localStatusEl, 'Link copied.');
                        }).catch(function () {
                            setShareStatus(localStatusEl, 'Could not copy automatically. Copy this URL: ' + pageUrl);
                        });
                    };
                }(statusEl)));
            }

            for (var l = 0; l < likeLinks.length; l++) {
                likeLinks[l].addEventListener('click', function (event) {
                    event.preventDefault();
                });
            }
        }
    }

    // ── Bootstrap ──────────────────────────────────────────────────────────────

    function init() {
        var slider = getTaxRateInput();
        if (!slider) return; // Shortcode not present on this page.

        applyCompatibilityClasses();
        ensureMoneyPile();
        initTaxRateSlider();

        selectAllPolicyOptionsForSelectedGroups();

        // Apply advanced-mode class to container since we default to advanced
        var calculatorContainer = document.querySelector('.calculator-container');
        if (calculatorContainer) {
            calculatorContainer.classList.add('mode-advanced');
        }

        // Set up event listeners for mode toggle buttons
        var modeButtons = document.querySelectorAll('.mode-button');
        for (var i = 0; i < modeButtons.length; i++) {
            modeButtons[i].addEventListener('click', handleModeToggle);
        }

        initShareActions();
        updateDisplay();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());
