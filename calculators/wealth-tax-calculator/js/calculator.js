// Billionaire Wealth Tax Calculator - JavaScript

// Constants
const BILLIONAIRE_WEALTH = 8.1e12; // $8.1 trillion in dollars

// State
let comparisonsData = null;
let selectedPolicies = new Set();
let currentMode = 'basic'; // 'basic' or 'advanced'

// Policy category labels
const POLICY_LABELS = {
    healthcare: 'Healthcare',
    education: 'Education',
    business: 'Business',
    directRelief: 'Direct Relief',
    housing: 'Housing',
    childcare: 'Childcare & Families'
};

// Policy-specific funding examples
const POLICY_EXAMPLES = {
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

// Load comparison data
async function loadComparisons() {
    try {
        const response = await fetch('data/comparisons.json');
        const data = await response.json();
        comparisonsData = data.comparisons;
    } catch (error) {
        console.error('Error loading comparisons:', error);
        comparisonsData = [];
    }
}

// Format number as human-readable billions/trillions
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

// Calculate tax revenue
function calculateRevenue(taxRate) {
    return BILLIONAIRE_WEALTH * (taxRate / 100);
}

// Find appropriate comparison based on revenue amount
function findComparison(revenue) {
    if (!comparisonsData || comparisonsData.length === 0) {
        return {
            description: 'Comparison data loading...',
            sourceText: 'Loading...',
            sourceUrl: '#'
        };
    }
    
    for (let comparison of comparisonsData) {
        if (revenue >= comparison.minRevenue && revenue <= comparison.maxRevenue) {
            return comparison;
        }
    }
    
    // Default to last comparison if revenue exceeds all ranges
    return comparisonsData[comparisonsData.length - 1];
}

// Update policy allocation display
function updatePolicyAllocation() {
    const revenue = calculateRevenue(parseFloat(document.getElementById('taxRate').value));
    const allocationResults = document.getElementById('allocationResults');
    
    if (selectedPolicies.size === 0) {
        allocationResults.innerHTML = '<p class="allocation-prompt">Select categories above to see allocation</p>';
        return;
    }
    
    const amountPerCategory = revenue / selectedPolicies.size;
    let html = '';
    
    selectedPolicies.forEach(policy => {
        html += `
            <div class="allocation-item">
                <span class="allocation-category">${POLICY_LABELS[policy]}</span>
                <span class="allocation-amount">${formatCurrency(amountPerCategory)}</span>
            </div>
        `;
        
        // Check for policy-specific examples
        if (POLICY_EXAMPLES[policy]) {
            for (let example of POLICY_EXAMPLES[policy]) {
                if (amountPerCategory >= example.minAmount && amountPerCategory <= example.maxAmount) {
                    html += `
                        <div class="allocation-example">
                            <span class="example-icon">→</span>
                            <span class="example-text">${example.description}</span>
                            <a href="${example.sourceUrl}" target="_blank" rel="noopener noreferrer" class="example-source">(source)</a>
                        </div>
                    `;
                }
            }
        }
    });
    
    allocationResults.innerHTML = html;
}

// Handle policy checkbox change
function handlePolicyChange(event) {
    const checkbox = event.target;
    const policyValue = checkbox.value;
    
    if (checkbox.checked) {
        selectedPolicies.add(policyValue);
    } else {
        selectedPolicies.delete(policyValue);
    }
    
    updatePolicyAllocation();
}

// Handle mode toggle
function handleModeToggle(event) {
    const button = event.target;
    const mode = button.dataset.mode;
    
    if (mode === currentMode) return;
    
    currentMode = mode;
    
    // Update button states
    document.querySelectorAll('.mode-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Toggle policy allocation section visibility
    const policySection = document.querySelector('.policy-allocation-section');
    if (mode === 'basic') {
        policySection.classList.add('hidden');
    } else {
        policySection.classList.remove('hidden');
    }
    
    // Update slider step and tick marks based on mode
    const slider = document.getElementById('taxRate');
    if (mode === 'basic') {
        // Basic mode: lock to round percentages with tick marks
        slider.step = '1';
        slider.setAttribute('list', 'tickmarks');
        // Round current value to nearest integer
        const currentValue = parseFloat(slider.value);
        slider.value = Math.round(currentValue);
    } else {
        // Advanced mode: allow fine-grained control without tick marks
        slider.step = '0.1';
        slider.removeAttribute('list');
    }
    
    // Update display with new value
    updateDisplay();
}

// Update the display
function updateDisplay() {
    const taxRate = parseFloat(document.getElementById('taxRate').value);
    const revenue = calculateRevenue(taxRate);
    
    // Update rate display
    document.getElementById('rateDisplay').textContent = taxRate.toFixed(1) + '%';
    
    // Update tax explanation
    document.getElementById('taxExplanation').textContent = 
        `${taxRate.toFixed(1)}% of $8.1 trillion in billionaire wealth =`;
    
    // Update revenue amount
    document.getElementById('revenueAmount').textContent = formatCurrency(revenue);
    
    // Find and display appropriate comparison
    const comparison = findComparison(revenue);
    document.getElementById('comparisonText').textContent = comparison.description;
    
    // Update comparison source
    const comparisonSourceElement = document.getElementById('comparisonSource');
    comparisonSourceElement.innerHTML = `<a href="${comparison.sourceUrl}" target="_blank" rel="noopener noreferrer">${comparison.sourceText}</a>`;
    
    // Update policy allocation
    updatePolicyAllocation();
}

// Initialize the calculator
async function init() {
    await loadComparisons();
    
    // Set up event listener for slider
    const slider = document.getElementById('taxRate');
    slider.addEventListener('input', updateDisplay);
    
    // Set up event listeners for policy checkboxes
    const policyCheckboxes = document.querySelectorAll('input[name="policy"]');
    policyCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', handlePolicyChange);
    });
    
    // Set up event listeners for mode toggle buttons
    const modeButtons = document.querySelectorAll('.mode-button');
    modeButtons.forEach(button => {
        button.addEventListener('click', handleModeToggle);
    });
    
    // Initial display update
    updateDisplay();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
