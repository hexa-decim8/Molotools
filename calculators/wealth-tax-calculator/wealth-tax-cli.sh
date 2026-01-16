#!/bin/bash

# Billionaire Wealth Tax Calculator - CLI Version
# Calculate potential tax revenue from billionaires at different tax rates

# Base wealth amount (in billions for easier calculation)
BILLIONAIRE_WEALTH=15300  # $15.3 trillion in billions

# Color codes for better readability
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to format numbers with commas
format_number() {
    printf "%'d" "$1" 2>/dev/null || echo "$1"
}

# Function to get comparison based on revenue
get_comparison() {
    local revenue=$1
    
    if (( $(echo "$revenue < 200" | bc -l) )); then
        echo "This could fund the entire annual budget of the Department of Education"
        echo "[1] U.S. Department of Education FY 2024 Budget"
        echo "    https://www2.ed.gov/about/overview/budget/budget24/index.html"
    elif (( $(echo "$revenue < 400" | bc -l) )); then
        echo "This could fund the entire annual budget of the Department of Veterans Affairs"
        echo "[1] U.S. Department of Veterans Affairs FY 2024 Budget"
        echo "    https://www.va.gov/budget/products.asp"
    elif (( $(echo "$revenue < 700" | bc -l) )); then
        echo "This could cover nearly all federal spending on Medicare"
        echo "[1] CMS Medicare Spending FY 2024"
        echo "    https://www.cms.gov/data-research/statistics-trends-and-reports/national-health-expenditure-data"
    elif (( $(echo "$revenue < 1000" | bc -l) )); then
        echo "This could fund federal Medicaid and CHIP programs for an entire year"
        echo "[1] CMS Medicaid and CHIP FY 2024"
        echo "    https://www.medicaid.gov/medicaid/financial-management/index.html"
    else
        echo "This represents a substantial portion of the entire federal discretionary budget"
        echo "[1] Congressional Budget Office FY 2024 Discretionary Spending"
        echo "    https://www.cbo.gov/topics/budget"
    fi
}

# Main program
clear
echo -e "${BOLD}${BLUE}========================================${NC}"
echo -e "${BOLD}${BLUE}  Billionaire Wealth Tax Calculator${NC}"
echo -e "${BOLD}${BLUE}========================================${NC}"
echo ""
echo -e "Based on estimated billionaire wealth of ${BOLD}\$15.3 trillion${NC}"
echo ""

# Loop to allow multiple calculations
while true; do
    echo -e "${YELLOW}Enter a tax rate between 1% and 8% (or 'q' to quit):${NC} "
    read -r tax_rate
    
    # Check if user wants to quit
    if [[ "$tax_rate" == "q" ]] || [[ "$tax_rate" == "Q" ]]; then
        echo ""
        echo -e "${GREEN}Thank you for using the Billionaire Wealth Tax Calculator!${NC}"
        exit 0
    fi
    
    # Validate input is a number
    if ! [[ "$tax_rate" =~ ^[0-9]+\.?[0-9]*$ ]]; then
        echo -e "${BOLD}Error: Please enter a valid number${NC}"
        echo ""
        continue
    fi
    
    # Validate range
    if (( $(echo "$tax_rate < 1" | bc -l) )) || (( $(echo "$tax_rate > 8" | bc -l) )); then
        echo -e "${BOLD}Error: Tax rate must be between 1% and 8%${NC}"
        echo ""
        continue
    fi
    
    # Calculate revenue (in billions)
    revenue_billions=$(echo "scale=2; $BILLIONAIRE_WEALTH * $tax_rate / 100" | bc)
    
    # Format billions with commas for easier reading
    revenue_billions_int=$(echo "$revenue_billions / 1" | bc)
    formatted_billions=$(format_number "$revenue_billions_int")
    
    echo ""
    echo -e "${BOLD}${GREEN}========================================${NC}"
    echo -e "${BOLD}${GREEN}RESULTS${NC}"
    echo -e "${BOLD}${GREEN}========================================${NC}"
    echo -e "${BOLD}Tax Rate:${NC} ${tax_rate}% of \$15.3 trillion in billionaire wealth"
    echo ""
    echo -e "${BOLD}Annual Revenue:${NC} ${GREEN}\$${formatted_billions} billion${NC}"
    echo ""
    echo -e "${BOLD}Context:${NC}"
    get_comparison "$revenue_billions"
    echo ""
    echo -e "${BOLD}Sources:${NC}"
    echo "[2] Distribution of Income by Source, U.S. Department of the Treasury (2024)"
    echo "    https://home.treasury.gov/system/files/131/Distribution-of-Income-by-Source-2024.pdf"
    echo -e "${BOLD}${GREEN}========================================${NC}"
    echo ""
done
