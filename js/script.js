// Active Trader Options Calculator
// Version 3.0 - Optimized for speed and efficiency

// Global variables
let options = [];
let erosionChart = null;
let plChart = null;
let autoCalculate = true;
let lastCalculationTime = null;

// Initialize default options
function initializeDefaultOptions() {
    // Clear any existing options
    options = [];
    
    // Add default call option
    addOption({
        id: 1,
        type: 'CALL',
        strike: 17500,
        premium: 450,
        theta: -4.50,
        delta: 0.55,
        gamma: 0.0002,
        vega: 12.50,
        days: 30,
        moneyness: 'ATM'
    });
    
    // Add default put option
    addOption({
        id: 2,
        type: 'PUT',
        strike: 17500,
        premium: 380,
        theta: -3.80,
        delta: -0.45,
        gamma: 0.00018,
        vega: 10.50,
        days: 30,
        moneyness: 'ATM'
    });
    
    // Update UI
    updateOptionsTable();
    if (autoCalculate) {
        updateAllCalculations();
    }
}

// Add an option to the table
function addOption(optionData) {
    const id = options.length > 0 ? Math.max(...options.map(o => o.id)) + 1 : 1;
    const option = {
        id: id,
        type: optionData.type || 'CALL',
        strike: parseFloat(optionData.strike) || 0,
        premium: parseFloat(optionData.premium) || 0,
        theta: parseFloat(optionData.theta) || 0,
        delta: parseFloat(optionData.delta) || 0,
        gamma: parseFloat(optionData.gamma) || 0,
        vega: parseFloat(optionData.vega) || 0,
        days: parseInt(optionData.days) || 30,
        moneyness: optionData.moneyness || 'ATM'
    };
    
    options.push(option);
    return option;
}

// Add a call option
function addCallOption() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const days = parseInt(document.getElementById('daysToExpiry').value);
    
    addOption({
        type: 'CALL',
        strike: spot,
        premium: 100,
        theta: -1.00,
        delta: 0.50,
        gamma: 0.0001,
        vega: 5.00,
        days: days,
        moneyness: 'ATM'
    });
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Add a put option
function addPutOption() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const days = parseInt(document.getElementById('daysToExpiry').value);
    
    addOption({
        type: 'PUT',
        strike: spot,
        premium: 80,
        theta: -0.80,
        delta: -0.45,
        gamma: 0.00009,
        vega: 4.50,
        days: days,
        moneyness: 'ATM'
    });
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Add a call+put pair (straddle)
function addPair() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const days = parseInt(document.getElementById('daysToExpiry').value);
    
    // Add call
    addOption({
        type: 'CALL',
        strike: spot,
        premium: 100,
        theta: -1.00,
        delta: 0.50,
        gamma: 0.0001,
        vega: 5.00,
        days: days,
        moneyness: 'ATM'
    });
    
    // Add put
    addOption({
        type: 'PUT',
        strike: spot,
        premium: 80,
        theta: -0.80,
        delta: -0.45,
        gamma: 0.00009,
        vega: 4.50,
        days: days,
        moneyness: 'ATM'
    });
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Update options table UI
function updateOptionsTable() {
    const tbody = document.getElementById('optionsTableBody');
    tbody.innerHTML = '';
    
    options.forEach((option, index) => {
        const row = document.createElement('tr');
        row.className = option.type === 'CALL' ? 'call-row' : 'put-row';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <span class="badge ${option.type === 'CALL' ? 'bg-success' : 'bg-danger'}">
                    ${option.type}
                </span>
            </td>
            <td>
                <div class="input-group input-group-sm">
                    <span class="input-group-text">₹</span>
                    <input type="number" class="form-control option-input" 
                           data-id="${option.id}" data-field="strike" 
                           value="${option.strike}" step="1">
                </div>
            </td>
            <td>
                <div class="input-group input-group-sm">
                    <span class="input-group-text">₹</span>
                    <input type="number" class="form-control option-input" 
                           data-id="${option.id}" data-field="premium" 
                           value="${option.premium}" step="0.01">
                </div>
            </td>
            <td>
                <div class="input-group input-group-sm">
                    <input type="number" class="form-control option-input" 
                           data-id="${option.id}" data-field="theta" 
                           value="${option.theta}" step="0.01">
                    <span class="input-group-text">₹</span>
                </div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input" 
                       data-id="${option.id}" data-field="delta" 
                       value="${option.delta}" step="0.01">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input" 
                       data-id="${option.id}" data-field="gamma" 
                       value="${option.gamma}" step="0.0001">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input" 
                       data-id="${option.id}" data-field="vega" 
                       value="${option.vega}" step="0.01">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input" 
                       data-id="${option.id}" data-field="days" 
                       value="${option.days}" min="1" max="365">
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-success" onclick="calculateSingleOption(${option.id})" title="Calculate">
                        <i class="bi bi-calculator"></i>
                    </button>
                    <button class="btn btn-outline-warning" onclick="cloneOption(${option.id})" title="Duplicate">
                        <i class="bi bi-copy"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteOption(${option.id})" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Add event listeners to inputs
    document.querySelectorAll('.option-input').forEach(input => {
        input.addEventListener('input', function() {
            const id = parseInt(this.dataset.id);
            const field = this.dataset.field;
            const value = this.value;
            
            updateOptionField(id, field, value);
            
            if (autoCalculate) {
                calculateSingleOption(id);
                updateAllCalculations();
            }
        });
    });
}

// Update a specific field of an option
function updateOptionField(id, field, value) {
    const option = options.find(o => o.id === id);
    if (!option) return;
    
    if (field === 'strike' || field === 'premium' || field === 'theta' || 
        field === 'delta' || field === 'gamma' || field === 'vega') {
        option[field] = parseFloat(value);
    } else if (field === 'days') {
        option[field] = parseInt(value);
    }
}

// Calculate a single option
function calculateSingleOption(id) {
    const option = options.find(o => o.id === id);
    if (!option) return;
    
    const spot = parseFloat(document.getElementById('spotPrice').value);
    
    // Update moneyness
    if (option.type === 'CALL') {
        if (option.strike < spot) option.moneyness = 'ITM';
        else if (option.strike > spot) option.moneyness = 'OTM';
        else option.moneyness = 'ATM';
    } else {
        if (option.strike > spot) option.moneyness = 'ITM';
        else if (option.strike < spot) option.moneyness = 'OTM';
        else option.moneyness = 'ATM';
    }
    
    // Update theta based on moneyness and days
    const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value);
    const nonLinear = document.getElementById('nonLinearTheta').checked;
    
    if (nonLinear) {
        // Non-linear theta: theta ∝ 1/√days
        const baseTheta = option.premium * 0.01; // 1% per day as base
        const timeFactor = Math.sqrt(30 / option.days) * thetaAcceleration;
        option.theta = -(baseTheta * timeFactor);
    }
    
    // Round to 2 decimal places
    option.theta = Math.round(option.theta * 100) / 100;
    
    updateOptionsTable();
}

// Delete an option
function deleteOption(id) {
    options = options.filter(o => o.id !== id);
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Clone an option
function cloneOption(id) {
    const original = options.find(o => o.id === id);
    if (!original) return;
    
    const clone = { ...original, id: Math.max(...options.map(o => o.id)) + 1 };
    options.push(clone);
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Clear all options
function clearAllOptions() {
    if (confirm('Are you sure you want to clear all options?')) {
        options = [];
        updateOptionsTable();
        updateAllCalculations();
    }
}

// Update all calculations
function updateAllCalculations() {
    if (options.length === 0) return;
    
    // Calculate totals
    let totalTheta = 0;
    let totalWeeklyErosion = 0;
    let totalTimeValue = 0;
    let totalVegaImpact = 0;
    let totalDelta = 0;
    
    options.forEach(option => {
        totalTheta += option.theta;
        totalWeeklyErosion += option.theta * 7;
        totalTimeValue += option.premium;
        totalVegaImpact += option.vega;
        totalDelta += option.delta;
    });
    
    // Update real-time metrics
    document.getElementById('totalTheta').textContent = `-₹${Math.abs(totalTheta).toFixed(2)}`;
    document.getElementById('totalWeeklyErosion').textContent = `-₹${Math.abs(totalWeeklyErosion).toFixed(2)}`;
    document.getElementById('dailyCarryCost').textContent = `₹${Math.abs(totalTheta).toFixed(2)}`;
    document.getElementById('totalTimeValue').textContent = `₹${totalTimeValue.toFixed(2)}`;
    document.getElementById('totalVegaImpact').textContent = `₹${totalVegaImpact.toFixed(2)}`;
    
    // Calculate average probability ITM
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    
    let totalProbITM = 0;
    options.forEach(option => {
        const prob = calculateProbabilityITM(spot, option.strike, iv, days);
        totalProbITM += prob;
    });
    
    const avgProbITM = options.length > 0 ? (totalProbITM / options.length) : 0;
    document.getElementById('avgProbITM').textContent = `${avgProbITM.toFixed(1)}%`;
    
    // Update last calculation time
    lastCalculationTime = new Date();
    document.getElementById('lastUpdate').textContent = `Last: ${lastCalculationTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    
    // Update charts
    updateErosionChart();
    updatePLChart();
    updatePLTable();
}

// Calculate probability ITM using Black-Scholes
function calculateProbabilityITM(spot, strike, iv, days) {
    const t = days / 365;
    if (t <= 0) return 50;
    
    const d1 = (Math.log(spot / strike) + (0.5 * iv * iv) * t) / (iv * Math.sqrt(t));
    const probability = normalCDF(d1) * 100;
    
    return Math.min(Math.max(probability, 0), 100);
}

// Normal cumulative distribution function
function normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    
    if (x > 0) prob = 1 - prob;
    return prob;
}

// Update erosion chart
function updateErosionChart() {
    const ctx = document.getElementById('erosionChart').getContext('2d');
    const projectionDays = parseInt(document.getElementById('projectionDays').value);
    
    // Destroy existing chart if it exists
    if (erosionChart) {
        erosionChart.destroy();
    }
    
    // Prepare data
    const labels = [];
    const callData = [];
    const putData = [];
    
    for (let day = 0; day <= projectionDays; day++) {
        labels.push(`Day ${day}`);
        
        let callPremium = 0;
        let putPremium = 0;
        
        options.forEach(option => {
            if (day <= option.days) {
                const remainingDays = option.days - day;
                const nonLinear = document.getElementById('nonLinearTheta').checked;
                
                let premium;
                if (nonLinear) {
                    // Non-linear decay: premium ∝ √time
                    premium = option.premium * Math.sqrt(remainingDays / option.days);
                } else {
                    // Linear decay
                    premium = option.premium + (option.theta * day);
                }
                
                if (option.type === 'CALL') {
                    callPremium += Math.max(premium, 0);
                } else {
                    putPremium += Math.max(premium, 0);
                }
            }
        });
        
        callData.push(callPremium);
        putData.push(putPremium);
    }
    
    // Create chart
    erosionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Call Premium',
                    data: callData,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                },
                {
                    label: 'Put Premium',
                    data: putData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 2,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ₹${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Days to Expiry'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Premium (₹)'
                    },
                    beginAtZero: true
                }
            }
        }
    });
}

// Update P&L chart
function updatePLChart() {
    const ctx = document.getElementById('plChart').getContext('2d');
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const rangePercent = parseFloat(document.getElementById('plPriceRange').value) / 100;
    const steps = parseInt(document.getElementById('plPriceSteps').value);
    const includePremium = document.getElementById('plIncludePremium').checked;
    
    // Destroy existing chart if it exists
    if (plChart) {
        plChart.destroy();
    }
    
    // Prepare data
    const labels = [];
    const callData = [];
    const putData = [];
    const netData = [];
    
    const minPrice = spot * (1 - rangePercent);
    const maxPrice = spot * (1 + rangePercent);
    const step = (maxPrice - minPrice) / steps;
    
    let maxProfit = -Infinity;
    let maxLoss = Infinity;
    let upperBreakeven = null;
    let lowerBreakeven = null;
    
    for (let price = minPrice; price <= maxPrice; price += step) {
        const priceFormatted = Math.round(price);
        labels.push(`₹${priceFormatted}`);
        
        let callPL = 0;
        let putPL = 0;
        
        options.forEach(option => {
            let pl = 0;
            
            if (option.type === 'CALL') {
                pl = Math.max(price - option.strike, 0);
            } else {
                pl = Math.max(option.strike - price, 0);
            }
            
            if (includePremium) {
                pl -= option.premium;
            }
            
            if (option.type === 'CALL') {
                callPL += pl;
            } else {
                putPL += pl;
            }
        });
        
        const netPL = callPL + putPL;
        
        callData.push(callPL);
        putData.push(putPL);
        netData.push(netPL);
        
        // Track max profit/loss
        maxProfit = Math.max(maxProfit, netPL);
        maxLoss = Math.min(maxLoss, netPL);
        
        // Track breakeven points
        if (upperBreakeven === null && price > spot && netPL >= 0) {
            upperBreakeven = price;
        }
        if (lowerBreakeven === null && price < spot && netPL >= 0) {
            lowerBreakeven = price;
        }
    }
    
    // Update statistics
    document.getElementById('plMaxProfit').textContent = `₹${maxProfit.toFixed(2)}`;
    document.getElementById('plMaxLoss').textContent = `₹${maxLoss.toFixed(2)}`;
    document.getElementById('plBreakevenUpper').textContent = upperBreakeven ? `₹${upperBreakeven.toFixed(2)}` : 'N/A';
    document.getElementById('plBreakevenLower').textContent = lowerBreakeven ? `₹${lowerBreakeven.toFixed(2)}` : 'N/A';
    
    // Create chart
    plChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Call P&L',
                    data: callData,
                    borderColor: '#28a745',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    tension: 0.1,
                    pointRadius: 0
                },
                {
                    label: 'Put P&L',
                    data: putData,
                    borderColor: '#dc3545',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    tension: 0.1,
                    pointRadius: 0
                },
                {
                    label: 'Net P&L',
                    data: netData,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ₹${context.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Underlying Price at Expiry (₹)'
                    },
                    ticks: {
                        maxTicksLimit: 10
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Profit & Loss (₹)'
                    }
                }
            }
        }
    });
}

// Update P&L table
function updatePLTable() {
    const tbody = document.querySelector('#plDetailedTable tbody');
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const includePremium = document.getElementById('plIncludePremium').checked;
    
    // Key price points
    const keyPrices = [
        spot * 0.8,    // -20%
        spot * 0.9,    // -10%
        spot * 0.95,   // -5%
        spot,          // Current
        spot * 1.05,   // +5%
        spot * 1.1,    // +10%
        spot * 1.2     // +20%
    ];
    
    let html = '';
    
    keyPrices.forEach(price => {
        let callPL = 0;
        let putPL = 0;
        
        options.forEach(option => {
            let pl = 0;
            
            if (option.type === 'CALL') {
                pl = Math.max(price - option.strike, 0);
            } else {
                pl = Math.max(option.strike - price, 0);
            }
            
            if (includePremium) {
                pl -= option.premium;
            }
            
            if (option.type === 'CALL') {
                callPL += pl;
            } else {
                putPL += pl;
            }
        });
        
        const netPL = callPL + putPL;
        const status = netPL > 0 ? 'profit' : netPL < 0 ? 'loss' : 'breakeven';
        const statusClass = netPL > 0 ? 'text-success' : netPL < 0 ? 'text-danger' : 'text-warning';
        const statusIcon = netPL > 0 ? 'bi-arrow-up' : netPL < 0 ? 'bi-arrow-down' : 'bi-dash';
        
        html += `
            <tr>
                <td class="fw-bold">₹${Math.round(price)}</td>
                <td class="${callPL >= 0 ? 'text-success' : 'text-danger'}">
                    ₹${callPL.toFixed(2)}
                </td>
                <td class="${putPL >= 0 ? 'text-success' : 'text-danger'}">
                    ₹${putPL.toFixed(2)}
                </td>
                <td class="${statusClass} fw-bold">
                    <i class="bi ${statusIcon}"></i> ₹${netPL.toFixed(2)}
                </td>
                <td>
                    <span class="badge bg-${status === 'profit' ? 'success' : status === 'loss' ? 'danger' : 'warning'}">
                        ${status.toUpperCase()}
                    </span>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

// Calculate P&L
function calculatePL() {
    updatePLChart();
    updatePLTable();
}

// Calculate all
function calculateAll() {
    options.forEach(option => calculateSingleOption(option.id));
    updateAllCalculations();
}

// Update underlying
function updateUnderlying() {
    const underlying = document.getElementById('underlyingSelect').value;
    // You could add logic to fetch current spot price here
    updateAllCalculations();
}

// Adjust spot price
function adjustSpot(amount) {
    const spotInput = document.getElementById('spotPrice');
    const current = parseFloat(spotInput.value);
    spotInput.value = current + amount;
    updateAllCalculations();
}

// Adjust days to expiry
function adjustDays(amount) {
    const daysInput = document.getElementById('daysToExpiry');
    const current = parseInt(daysInput.value);
    const newValue = Math.max(1, current + amount);
    daysInput.value = newValue;
    
    // Update all options' days
    options.forEach(option => {
        option.days = newValue;
    });
    
    updateOptionsTable();
    updateAllCalculations();
}

// Set ATM
function setATM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    
    options.forEach(option => {
        option.strike = spot;
        option.moneyness = 'ATM';
    });
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Set ITM
function setITM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    
    options.forEach(option => {
        if (option.type === 'CALL') {
            option.strike = spot * 0.98; // 2% ITM for calls
            option.moneyness = 'ITM';
        } else {
            option.strike = spot * 1.02; // 2% ITM for puts
            option.moneyness = 'ITM';
        }
    });
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Set OTM
function setOTM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    
    options.forEach(option => {
        if (option.type === 'CALL') {
            option.strike = spot * 1.02; // 2% OTM for calls
            option.moneyness = 'OTM';
        } else {
            option.strike = spot * 0.98; // 2% OTM for puts
            option.moneyness = 'OTM';
        }
    });
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Set days to expiry
function setDaysToExpiry(days) {
    document.getElementById('daysToExpiry').value = days;
    adjustDays(0); // This will update all options
}

// Load preset
function loadPreset(preset) {
    switch(preset) {
        case 'nifty_atm':
            document.getElementById('underlyingSelect').value = 'NIFTY';
            document.getElementById('spotPrice').value = 17450;
            document.getElementById('impliedVol').value = 15;
            setDaysToExpiry(30);
            
            options = [];
            addCallOption();
            addPutOption();
            break;
            
        case 'banknifty_weekly':
            document.getElementById('underlyingSelect').value = 'BANKNIFTY';
            document.getElementById('spotPrice').value = 42000;
            document.getElementById('impliedVol').value = 18;
            setDaysToExpiry(7);
            
            options = [];
            addCallOption();
            addPutOption();
            break;
            
        case 'straddle':
            document.getElementById('spotPrice').value = 17450;
            setDaysToExpiry(30);
            
            options = [];
            addPair(); // Adds both call and put at same strike
            break;
    }
    
    updateOptionsTable();
    updateAllCalculations();
}

// Toggle auto calculate
function toggleAutoCalculate() {
    autoCalculate = document.getElementById('autoCalculate').checked;
    const badge = document.querySelector('#autoCalculate + label .badge');
    badge.textContent = autoCalculate ? 'ON' : 'OFF';
    badge.className = autoCalculate ? 'badge bg-success' : 'badge bg-secondary';
}

// Toggle view
function toggleView(view) {
    // Remove active from all buttons
    document.querySelectorAll('[onclick*="toggleView"]').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Add active to clicked button
    event.target.classList.add('active');
    
    // Implement view-specific changes
    switch(view) {
        case 'simple':
            document.querySelectorAll('.advanced-only').forEach(el => {
                el.style.display = 'none';
            });
            break;
        case 'advanced':
            document.querySelectorAll('.advanced-only').forEach(el => {
                el.style.display = '';
            });
            break;
        case 'pro':
            document.querySelectorAll('.advanced-only').forEach(el => {
                el.style.display = '';
            });
            // Add pro features
            break;
    }
}

// Export to CSV
function exportToCSV() {
    let csv = 'Type,Strike,Premium,Theta,Delta,Gamma,Vega,Days,Moneyness\n';
    
    options.forEach(option => {
        csv += `${option.type},${option.strike},${option.premium},${option.theta},${option.delta},${option.gamma},${option.vega},${option.days},${option.moneyness}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `options_calculator_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    
    // Show notification
    alert('CSV exported successfully!');
}

// Export P&L data
function exportPLToCSV() {
    // Similar implementation for P&L data
    alert('P&L export coming soon!');
}

// Reset all
function resetAll() {
    if (confirm('Reset all inputs to defaults?')) {
        document.getElementById('spotPrice').value = 17450;
        document.getElementById('impliedVol').value = 15;
        document.getElementById('daysToExpiry').value = 30;
        document.getElementById('riskFreeRate').value = 6.5;
        document.getElementById('thetaAcceleration').value = 1.2;
        document.getElementById('volatilityChange').value = 0;
        document.getElementById('projectionDays').value = 30;
        
        initializeDefaultOptions();
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Alt + Key shortcuts
    if (e.altKey) {
        e.preventDefault();
        switch(e.key.toLowerCase()) {
            case 'c':
                calculateAll();
                break;
            case 'r':
                resetAll();
                break;
            case 'e':
                exportToCSV();
                break;
            case 'p':
                calculatePL();
                break;
            case '1':
                if (options.length > 0) calculateSingleOption(options[0].id);
                break;
            case '2':
                if (options.length > 1) calculateSingleOption(options[1].id);
                break;
        }
    }
    
    // Function keys
    switch(e.key) {
        case 'F1':
            e.preventDefault();
            loadPreset('nifty_atm');
            break;
        case 'F2':
            e.preventDefault();
            loadPreset('banknifty_weekly');
            break;
        case 'F3':
            e.preventDefault();
            toggleView('advanced');
            break;
        case 'F4':
            e.preventDefault();
            toggleView('pro');
            break;
    }
    
    // Number pad +/- for quick adjustments
    if (e.target.tagName === 'INPUT' && (e.key === '+' || e.key === '-')) {
        e.preventDefault();
        const input = e.target;
        const current = parseFloat(input.value) || 0;
        const step = parseFloat(input.step) || 1;
        
        if (e.key === '+') {
            input.value = current + step;
        } else {
            input.value = current - step;
        }
        
        // Trigger change event
        input.dispatchEvent(new Event('change'));
    }
});

// Show keyboard shortcuts
function showShortcuts() {
    alert(`ACTIVE TRADER KEYBOARD SHORTCUTS:

F1: NIFTY ATM preset
F2: Weekly expiry preset
F3: Advanced view
F4: Pro view

Alt+C: Calculate all
Alt+R: Reset
Alt+E: Export CSV
Alt+P: Calculate P&L
Alt+1: Calculate option 1
Alt+2: Calculate option 2

+/- on number inputs: Quick adjust

Tab: Next field
Shift+Tab: Previous field
Enter: Apply and calculate

AUTO-CALCULATE is ON - changes update in real-time!`);
}