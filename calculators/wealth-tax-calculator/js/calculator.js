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
    business: 'Business'
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
    
    // Future: Show/hide advanced features based on mode
    // For now, both modes display the same content
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
