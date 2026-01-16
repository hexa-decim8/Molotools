// Billionaire Wealth Tax Calculator - JavaScript

// Constants
const BILLIONAIRE_WEALTH = 15.3e12; // $15.3 trillion in dollars

// State
let comparisonsData = null;

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

// Format number with commas and dollar sign
function formatCurrency(amount) {
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

// Update the display
function updateDisplay() {
    const taxRate = parseFloat(document.getElementById('taxRate').value);
    const revenue = calculateRevenue(taxRate);
    
    // Update rate display
    document.getElementById('rateDisplay').textContent = taxRate.toFixed(1) + '%';
    
    // Update tax explanation
    document.getElementById('taxExplanation').textContent = 
        `${taxRate.toFixed(1)}% of $15.3 trillion in billionaire wealth =`;
    
    // Update revenue amount
    document.getElementById('revenueAmount').textContent = formatCurrency(revenue);
    
    // Find and display appropriate comparison
    const comparison = findComparison(revenue);
    document.getElementById('comparisonText').textContent = comparison.description;
    
    // Update comparison source
    const comparisonSourceElement = document.getElementById('comparisonSource');
    comparisonSourceElement.innerHTML = `<a href="${comparison.sourceUrl}" target="_blank" rel="noopener noreferrer">${comparison.sourceText}</a>`;
}

// Initialize the calculator
async function init() {
    await loadComparisons();
    
    // Set up event listener for slider
    const slider = document.getElementById('taxRate');
    slider.addEventListener('input', updateDisplay);
    
    // Initial display update
    updateDisplay();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
