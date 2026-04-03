// Billionaire Wealth Tax Calculator — WordPress plugin script
// Element IDs are prefixed with "wtc-" to avoid collisions with other page content.

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────────────────────────────────
    var BILLIONAIRE_WEALTH = 8.1e12; // $8.1 trillion

    // Resolve data directory: WordPress passes the plugin URL via wp_localize_script;
    // fall back to a relative path for standalone / development use.
    var DATA_URL =
        (typeof wealthTaxConfig !== 'undefined' && wealthTaxConfig.dataUrl)
            ? wealthTaxConfig.dataUrl
            : 'data/';

    // ── State ──────────────────────────────────────────────────────────────────
    var comparisonsData = null;
    var selectedPolicies = [];
    var currentMode = 'basic'; // 'basic' or 'advanced'

    // Policy category labels
    var POLICY_LABELS = {
        healthcare: 'Healthcare',
        education: 'Education',
        business: 'Business'
    };
    
    // Policy-specific funding examples
    var POLICY_EXAMPLES = {
        healthcare: [
            {
                minAmount: 45e9,
                maxAmount: 52e9,
                description: 'National Institutes of Health fully funded',
                sourceText: 'NIH Appropriations',
                sourceUrl: 'https://www.nih.gov/about-nih/nih-almanac/appropriations-section-1'
            }
        ],
        education: [],
        business: []
    };

    // ── Helpers ────────────────────────────────────────────────────────────────

    function formatCurrency(amount) {
        if (amount >= 1e12) {
            return '$' + (amount / 1e12).toFixed(2) + ' Trillion';
        }
        if (amount >= 1e9) {
            return '$' + (amount / 1e9).toFixed(1) + ' Billion';
        }
        return '$' + amount.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
    }

    function calculateRevenue(taxRate) {
        return BILLIONAIRE_WEALTH * (taxRate / 100);
    }

    function findComparison(revenue) {
        if (!comparisonsData || comparisonsData.length === 0) {
            return {
                description: 'Comparison data loading…',
                sourceText: 'Loading…',
                sourceUrl: '#'
            };
        }

        for (var i = 0; i < comparisonsData.length; i++) {
            var c = comparisonsData[i];
            if (revenue >= c.minRevenue && revenue <= c.maxRevenue) {
                return c;
            }
        }

        // Revenue exceeds every defined range — use the last entry.
        return comparisonsData[comparisonsData.length - 1];
    }

    function updatePolicyAllocation() {
        var allocationResults = el('wtc-allocationResults');
        if (!allocationResults) return;

        var slider = el('wtc-taxRate');
        if (!slider) return;

        var revenue = calculateRevenue(parseFloat(slider.value));

        if (selectedPolicies.length === 0) {
            allocationResults.innerHTML = '<p class="allocation-prompt">Select categories above to see allocation</p>';
            return;
        }

        var amountPerCategory = revenue / selectedPolicies.length;
        var html = '';

        for (var i = 0; i < selectedPolicies.length; i++) {
            var policy = selectedPolicies[i];
            html += '<div class="allocation-item">' +
                '<span class="allocation-category">' + POLICY_LABELS[policy] + '</span>' +
                '<span class="allocation-amount">' + formatCurrency(amountPerCategory) + '</span>' +
                '</div>';
            
            // Check for policy-specific examples
            if (POLICY_EXAMPLES[policy]) {
                for (var j = 0; j < POLICY_EXAMPLES[policy].length; j++) {
                    var example = POLICY_EXAMPLES[policy][j];
                    if (amountPerCategory >= example.minAmount && amountPerCategory <= example.maxAmount) {
                        html += '<div class="allocation-example">' +
                            '<span class="example-icon">→</span>' +
                            '<span class="example-text">' + example.description + '</span>' +
                            '<a href="' + example.sourceUrl + '" target="_blank" rel="noopener noreferrer" class="example-source">(source)</a>' +
                            '</div>';
                    }
                }
            }
        }

        allocationResults.innerHTML = html;
    }

    function handlePolicyChange(event) {
        var checkbox = event.target;
        var policyValue = checkbox.value;
        var index = selectedPolicies.indexOf(policyValue);

        if (checkbox.checked && index === -1) {
            selectedPolicies.push(policyValue);
        } else if (!checkbox.checked && index > -1) {
            selectedPolicies.splice(index, 1);
        }

        updatePolicyAllocation();
    }

    function handleModeToggle(event) {
        var button = event.target;
        var mode = button.getAttribute('data-mode');
        
        if (mode === currentMode) return;
        
        currentMode = mode;
        
        // Update button states
        var modeButtons = document.querySelectorAll('.mode-button');
        for (var i = 0; i < modeButtons.length; i++) {
            var btn = modeButtons[i];
            if (btn.getAttribute('data-mode') === mode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        }
        
        // Toggle policy allocation section visibility
        var policySection = document.querySelector('.policy-allocation-section');
        if (policySection) {
            if (mode === 'basic') {
                policySection.classList.add('hidden');
            } else {
                policySection.classList.remove('hidden');
            }
        }
        
        // Update slider step and tick marks based on mode
        var slider = el('wtc-taxRate');
        if (!slider) return;
        
        if (mode === 'basic') {
            // Basic mode: lock to round percentages with tick marks
            slider.step = '1';
            slider.setAttribute('list', 'wtc-tickmarks');
            // Round current value to nearest integer
            var currentValue = parseFloat(slider.value);
            slider.value = Math.round(currentValue);
        } else {
            // Advanced mode: allow fine-grained control without tick marks
            slider.step = '0.1';
            slider.removeAttribute('list');
        }
        
        // Update display with new value
        updateDisplay();
    }

    // ── DOM ────────────────────────────────────────────────────────────────────

    function el(id) {
        return document.getElementById(id);
    }

    function updateDisplay() {
        var slider      = el('wtc-taxRate');
        if (!slider) return;

        var taxRate = parseFloat(slider.value);
        var revenue = calculateRevenue(taxRate);

        el('wtc-rateDisplay').textContent = taxRate.toFixed(1) + '%';
        el('wtc-taxExplanation').textContent =
            taxRate.toFixed(1) + '% of $8.1 trillion in billionaire wealth =';
        el('wtc-revenueAmount').textContent = formatCurrency(revenue);

        var comparison = findComparison(revenue);
        el('wtc-comparisonText').textContent = comparison.description;

        var sourceEl = el('wtc-comparisonSource');
        var link = document.createElement('a');
        link.href = comparison.sourceUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = comparison.sourceText;
        sourceEl.innerHTML = '';
        sourceEl.appendChild(link);

        // Update policy allocation
        updatePolicyAllocation();
    }

    // ── Bootstrap ──────────────────────────────────────────────────────────────

    function loadComparisons(callback) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', DATA_URL + 'comparisons.json', true);
        xhr.responseType = 'json';
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                var data = xhr.response || JSON.parse(xhr.responseText);
                comparisonsData = data.comparisons || [];
            } else {
                console.error('Wealth Tax Calculator: failed to load comparisons.json (status ' + xhr.status + ')');
                comparisonsData = [];
            }
            callback();
        };
        xhr.onerror = function () {
            console.error('Wealth Tax Calculator: network error loading comparisons.json');
            comparisonsData = [];
            callback();
        };
        xhr.send();
    }

    function init() {
        loadComparisons(function () {
            var slider = el('wtc-taxRate');
            if (!slider) return; // Shortcode not present on this page.
            slider.addEventListener('input', updateDisplay);

            // Set up event listeners for policy checkboxes
            var policyCheckboxes = document.querySelectorAll('input[name="wtc-policy"]');
            for (var i = 0; i < policyCheckboxes.length; i++) {
                policyCheckboxes[i].addEventListener('change', handlePolicyChange);
            }

            // Set up event listeners for mode toggle buttons
            var modeButtons = document.querySelectorAll('.mode-button');
            for (var j = 0; j < modeButtons.length; j++) {
                modeButtons[j].addEventListener('click', handleModeToggle);
            }

            updateDisplay();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());
