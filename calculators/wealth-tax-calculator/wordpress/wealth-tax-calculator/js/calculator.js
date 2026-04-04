// Billionaire Wealth Tax Calculator — WordPress plugin script
// Element IDs are prefixed with "wtc-" to avoid collisions with other page content.

(function () {
    'use strict';

    // ── Constants ──────────────────────────────────────────────────────────────
    // Data is injected from WordPress via wp_localize_script
    var BILLIONAIRE_WEALTH = (typeof wealthTaxConfig !== 'undefined' && wealthTaxConfig.billionaireWealth) 
        ? wealthTaxConfig.billionaireWealth 
        : 15.3e12; // Fallback to $15.3 trillion

    // ── State ──────────────────────────────────────────────────────────────────
    var comparisonsData = (typeof wealthTaxConfig !== 'undefined' && wealthTaxConfig.comparisons)
        ? wealthTaxConfig.comparisons
        : [];
    var selectedPolicies = [];
    var currentMode = 'basic'; // 'basic' or 'advanced'

    // Policy category labels
    var POLICY_LABELS = {
        healthcare: 'Healthcare',
        education: 'Education',
        business: 'Business',
        directRelief: 'Direct Relief',
        housing: 'Housing',
        childcare: 'Childcare & Families'
    };
    
    // Policy-specific funding examples
    var POLICY_EXAMPLES = {
        healthcare: [
            {
                minAmount: 25e9,
                maxAmount: 44e9,
                description: 'Expand Medicare to cover dental, vision, and hearing care for all seniors (~$29B/year)',
                sourceText: 'The Make Billionaires Pay Their Fair Share Act, Sen. Sanders (2026)',
                sourceUrl: 'https://www.sanders.senate.gov/wp-content/uploads/MakeBillionairesPayTheirFairShareAct.pdf'
            },
            {
                minAmount: 25e9,
                maxAmount: 44e9,
                description: 'Ensure all seniors and people with disabilities can receive Medicaid home health care (~$30B/year)',
                sourceText: 'The Make Billionaires Pay Their Fair Share Act, Sen. Sanders (2026)',
                sourceUrl: 'https://www.sanders.senate.gov/wp-content/uploads/MakeBillionairesPayTheirFairShareAct.pdf'
            },
            {
                minAmount: 45e9,
                maxAmount: 52e9,
                description: 'National Institutes of Health fully funded',
                sourceText: 'NIH Appropriations',
                sourceUrl: 'https://www.nih.gov/about-nih/nih-almanac/appropriations-section-1'
            },
            {
                minAmount: 100e9,
                maxAmount: 175e9,
                description: 'Reverse all Medicaid and ACA cuts from the One Big Beautiful Bill (~$110B/year)',
                sourceText: 'The Make Billionaires Pay Their Fair Share Act, Sen. Sanders (2026)',
                sourceUrl: 'https://www.sanders.senate.gov/wp-content/uploads/MakeBillionairesPayTheirFairShareAct.pdf'
            }
        ],
        education: [
            {
                minAmount: 13e9,
                maxAmount: 20e9,
                description: 'Guarantee a $60,000 minimum salary for all public school teachers nationwide (~$15B/year)',
                sourceText: 'The Make Billionaires Pay Their Fair Share Act, Sen. Sanders (2026)',
                sourceUrl: 'https://www.sanders.senate.gov/wp-content/uploads/MakeBillionairesPayTheirFairShareAct.pdf'
            }
        ],
        business: [],
        directRelief: [
            {
                minAmount: 900e9,
                maxAmount: 2000e9,
                description: 'Provide $3,000 direct payments to every person in households earning $150,000 or less',
                sourceText: 'The Make Billionaires Pay Their Fair Share Act, Sen. Sanders (2026)',
                sourceUrl: 'https://www.sanders.senate.gov/wp-content/uploads/MakeBillionairesPayTheirFairShareAct.pdf'
            }
        ],
        housing: [
            {
                minAmount: 80e9,
                maxAmount: 130e9,
                description: 'Build, rehabilitate, and preserve 700,000+ affordable homes per year to eliminate the housing gap (~$86B/year)',
                sourceText: 'The Make Billionaires Pay Their Fair Share Act, Sen. Sanders (2026)',
                sourceUrl: 'https://www.sanders.senate.gov/wp-content/uploads/MakeBillionairesPayTheirFairShareAct.pdf'
            }
        ],
        childcare: [
            {
                minAmount: 65e9,
                maxAmount: 110e9,
                description: 'Cap childcare costs at 7% of family income for all American families (~$70B/year)',
                sourceText: 'The Make Billionaires Pay Their Fair Share Act, Sen. Sanders (2026)',
                sourceUrl: 'https://www.sanders.senate.gov/wp-content/uploads/MakeBillionairesPayTheirFairShareAct.pdf'
            }
        ]
    };

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

    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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
            var prompt = document.createElement('p');
            prompt.className = 'allocation-prompt';
            prompt.textContent = 'Select categories above to see allocation';
            allocationResults.innerHTML = '';
            allocationResults.appendChild(prompt);
            return;
        }

        var amountPerCategory = revenue / selectedPolicies.length;
        allocationResults.innerHTML = ''; // Clear existing content

        for (var i = 0; i < selectedPolicies.length; i++) {
            var policy = selectedPolicies[i];
            
            // Create allocation item
            var item = document.createElement('div');
            item.className = 'allocation-item';
            
            var category = document.createElement('span');
            category.className = 'allocation-category';
            category.textContent = POLICY_LABELS[policy] || policy;
            
            var amount = document.createElement('span');
            amount.className = 'allocation-amount';
            amount.textContent = formatCurrency(amountPerCategory);
            
            item.appendChild(category);
            item.appendChild(amount);
            allocationResults.appendChild(item);
            
            // Check for policy-specific examples
            if (POLICY_EXAMPLES[policy]) {
                for (var j = 0; j < POLICY_EXAMPLES[policy].length; j++) {
                    var example = POLICY_EXAMPLES[policy][j];
                    if (amountPerCategory >= example.minAmount && amountPerCategory <= example.maxAmount) {
                        var exampleDiv = document.createElement('div');
                        exampleDiv.className = 'allocation-example';
                        
                        var icon = document.createElement('span');
                        icon.className = 'example-icon';
                        icon.textContent = '→';
                        
                        var text = document.createElement('span');
                        text.className = 'example-text';
                        text.textContent = example.description;
                        
                        var link = document.createElement('a');
                        link.href = sanitizeUrl(example.sourceUrl);
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        link.className = 'example-source';
                        link.textContent = '(source)';
                        
                        exampleDiv.appendChild(icon);
                        exampleDiv.appendChild(text);
                        exampleDiv.appendChild(link);
                        allocationResults.appendChild(exampleDiv);
                    }
                }
            }
        }
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
            taxRate.toFixed(1) + '% of $15.3 trillion in billionaire wealth =';
        el('wtc-revenueAmount').textContent = formatCurrency(revenue);

        var comparison = findComparison(revenue);
        el('wtc-comparisonText').textContent = comparison.description;

        var sourceEl = el('wtc-comparisonSource');
        var link = document.createElement('a');
        link.href = sanitizeUrl(comparison.sourceUrl);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = comparison.sourceText;
        sourceEl.innerHTML = '';
        sourceEl.appendChild(link);

        // Update policy allocation
        updatePolicyAllocation();
    }

    // ── Bootstrap ──────────────────────────────────────────────────────────────

    function init() {
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

}());
