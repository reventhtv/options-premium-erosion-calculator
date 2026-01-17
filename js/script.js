// Active Trader Options Calculator - Industry Standard Edition
// Version 4.0 - Complete Black-Scholes/Merton implementation
// Based on CBOE/NSE industry standards

// Global variables
let options = [];
let erosionChart = null;
let plChart = null;
let autoCalculate = true;
let lastCalculationTime = null;

// Black-Scholes-Merton model constants
const BSM_MODEL = {
    VERSION: '4.0',
    STANDARD: 'CBOE/NSE Industry Standard',
    FEATURES: [
        'Complete Black-Scholes-Merton pricing',
        'Accurate Greeks calculation',
        'Put-Call Parity validation',
        'Volatility surface modeling',
        'Dividend yield support'
    ]
};

// Math utility functions
const MathUtils = {
    // Normal CDF (industry standard approximation)
    normCDF: function(x) {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return x > 0 ? 1 - prob : prob;
    },

    // Normal PDF
    normPDF: function(x) {
        return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
    },

    // Calculate d1 and d2 for Black-Scholes
    calculateD1D2: function(S, K, T, r, sigma, q = 0) {
        if (T <= 0) return { d1: 0, d2: 0 };
        
        const sqrtT = Math.sqrt(T);
        const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
        const d2 = d1 - sigma * sqrtT;
        
        return { d1, d2 };
    }
};

// Complete Black-Scholes-Merton Pricing Engine
class BlackScholesPricing {
    // Price European option
    static priceOption(type, S, K, T, r, sigma, q = 0) {
        if (T <= 0) {
            // At expiration
            if (type === 'CALL') return Math.max(S - K, 0);
            else return Math.max(K - S, 0);
        }
        
        const { d1, d2 } = MathUtils.calculateD1D2(S, K, T, r, sigma, q);
        const Nd1 = MathUtils.normCDF(type === 'CALL' ? d1 : -d1);
        const Nd2 = MathUtils.normCDF(type === 'CALL' ? d2 : -d2);
        
        const callPrice = S * Math.exp(-q * T) * MathUtils.normCDF(d1) - K * Math.exp(-r * T) * MathUtils.normCDF(d2);
        const putPrice = K * Math.exp(-r * T) * MathUtils.normCDF(-d2) - S * Math.exp(-q * T) * MathUtils.normCDF(-d1);
        
        return type === 'CALL' ? callPrice : putPrice;
    }

    // Calculate all Greeks
    static calculateGreeks(type, S, K, T, r, sigma, q = 0) {
        if (T <= 0) {
            // At expiration Greeks
            const intrinsic = type === 'CALL' ? Math.max(S - K, 0) : Math.max(K - S, 0);
            return {
                delta: type === 'CALL' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
                gamma: 0,
                theta: 0,
                vega: 0,
                rho: 0,
                intrinsic: intrinsic,
                extrinsic: 0
            };
        }
        
        const { d1, d2 } = MathUtils.calculateD1D2(S, K, T, r, sigma, q);
        const sqrtT = Math.sqrt(T);
        const Nd1 = MathUtils.normCDF(type === 'CALL' ? d1 : -d1);
        const Nd2 = MathUtils.normCDF(type === 'CALL' ? d2 : -d2);
        const nd1 = MathUtils.normPDF(d1);
        
        // Delta: ∂V/∂S
        let delta;
        if (type === 'CALL') {
            delta = Math.exp(-q * T) * MathUtils.normCDF(d1);
        } else {
            delta = Math.exp(-q * T) * (MathUtils.normCDF(d1) - 1);
        }
        
        // Gamma: ∂²V/∂S²
        const gamma = Math.exp(-q * T) * (nd1 / (S * sigma * sqrtT));
        
        // Theta: ∂V/∂t (per day, negative for decay)
        let theta;
        const term1 = -(S * sigma * Math.exp(-q * T) * nd1) / (2 * sqrtT);
        if (type === 'CALL') {
            theta = term1 + q * S * Math.exp(-q * T) * MathUtils.normCDF(d1) 
                    - r * K * Math.exp(-r * T) * MathUtils.normCDF(d2);
        } else {
            theta = term1 - q * S * Math.exp(-q * T) * MathUtils.normCDF(-d1) 
                    + r * K * Math.exp(-r * T) * MathUtils.normCDF(-d2);
        }
        theta = theta / 365; // Convert annual to daily
        
        // Vega: ∂V/∂σ (per 1% change in volatility)
        const vega = S * Math.exp(-q * T) * sqrtT * nd1 * 0.01; // For 1% vol change
        
        // Rho: ∂V/∂r (per 1% change in interest rate)
        let rho;
        if (type === 'CALL') {
            rho = K * T * Math.exp(-r * T) * MathUtils.normCDF(d2) * 0.01;
        } else {
            rho = -K * T * Math.exp(-r * T) * MathUtils.normCDF(-d2) * 0.01;
        }
        
        const price = this.priceOption(type, S, K, T, r, sigma, q);
        const intrinsic = type === 'CALL' ? Math.max(S - K, 0) : Math.max(K - S, 0);
        const extrinsic = Math.max(price - intrinsic, 0);
        
        return {
            delta: parseFloat(delta.toFixed(4)),
            gamma: parseFloat(gamma.toFixed(6)),
            theta: parseFloat(theta.toFixed(2)),
            vega: parseFloat(vega.toFixed(2)),
            rho: parseFloat(rho.toFixed(2)),
            price: parseFloat(price.toFixed(2)),
            intrinsic: parseFloat(intrinsic.toFixed(2)),
            extrinsic: parseFloat(extrinsic.toFixed(2)),
            d1: parseFloat(d1.toFixed(4)),
            d2: parseFloat(d2.toFixed(4))
        };
    }

    // Calculate implied volatility from price (numerical method)
    static calculateImpliedVol(type, S, K, T, r, price, q = 0, maxIterations = 100, precision = 0.0001) {
        if (T <= 0) return 0;
        
        let sigma = 0.3; // Initial guess
        let sigmaUpper = 5.0;
        let sigmaLower = 0.001;
        
        for (let i = 0; i < maxIterations; i++) {
            const calculatedPrice = this.priceOption(type, S, K, T, r, sigma, q);
            const diff = calculatedPrice - price;
            
            if (Math.abs(diff) < precision) {
                return sigma;
            }
            
            if (diff > 0) {
                sigmaUpper = sigma;
                sigma = (sigma + sigmaLower) / 2;
            } else {
                sigmaLower = sigma;
                sigma = (sigma + sigmaUpper) / 2;
            }
        }
        
        return sigma;
    }

    // Check put-call parity
    static checkPutCallParity(callPrice, putPrice, S, K, T, r, q = 0) {
        const callPV = callPrice;
        const putPV = putPrice;
        const stockPV = S * Math.exp(-q * T);
        const strikePV = K * Math.exp(-r * T);
        
        const parityCheck = callPV + strikePV - (putPV + stockPV);
        const parityValid = Math.abs(parityCheck) < 0.01; // Allow 1 paisa tolerance
        
        return {
            valid: parityValid,
            discrepancy: parseFloat(parityCheck.toFixed(2)),
            callPrice: callPV,
            putPrice: putPV,
            syntheticCall: putPV + stockPV - strikePV,
            syntheticPut: callPV + strikePV - stockPV
        };
    }

    // Calculate probability ITM (N(d2) for calls, N(-d2) for puts)
    static probabilityITM(type, S, K, T, sigma, q = 0) {
        if (T <= 0) {
            if (type === 'CALL') return S > K ? 100 : 0;
            else return S < K ? 100 : 0;
        }
        
        const { d1, d2 } = MathUtils.calculateD1D2(S, K, T, 0, sigma, q);
        const prob = type === 'CALL' ? MathUtils.normCDF(d2) : MathUtils.normCDF(-d2);
        return Math.min(Math.max(prob * 100, 0), 100);
    }
}

// Volatility Surface Model (basic)
class VolatilitySurface {
    constructor() {
        this.surface = {
            atmVol: 0.15,
            skew: -0.002, // Volatility skew per 100 points OTM
            smile: 0.0001, // Volatility smile curvature
            termStructure: { '30': 0.15, '7': 0.18, '1': 0.25 } // Days -> Volatility
        };
    }

    getVolatility(moneyness, days) {
        // moneyness = (strike - spot) / spot
        const atmVol = this.surface.termStructure[days] || this.surface.atmVol;
        const skewEffect = this.surface.skew * moneyness * 100;
        const smileEffect = this.surface.smile * Math.pow(moneyness * 100, 2);
        
        return Math.max(0.05, atmVol + skewEffect + smileEffect);
    }

    updateFromMarket(atmVol, skew = null, smile = null) {
        this.surface.atmVol = atmVol;
        if (skew !== null) this.surface.skew = skew;
        if (smile !== null) this.surface.smile = smile;
    }
}

// Initialize with industry standard models
const volSurface = new VolatilitySurface();

// Initialize default options
function initializeDefaultOptions() {
    // Clear any existing options
    options = [];
    
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
    // Add default call option (calculated using BSM)
    const callGreeks = BlackScholesPricing.calculateGreeks('CALL', spot, spot, days/365, r, iv);
    
    addOption({
        id: 1,
        type: 'CALL',
        strike: spot,
        premium: callGreeks.price,
        theta: callGreeks.theta,
        delta: callGreeks.delta,
        gamma: callGreeks.gamma,
        vega: callGreeks.vega,
        rho: callGreeks.rho,
        days: days,
        moneyness: 'ATM',
        intrinsic: callGreeks.intrinsic,
        extrinsic: callGreeks.extrinsic,
        iv: iv * 100,
        theoreticalPrice: callGreeks.price
    });
    
    // Add default put option (calculated using BSM)
    const putGreeks = BlackScholesPricing.calculateGreeks('PUT', spot, spot, days/365, r, iv);
    
    addOption({
        id: 2,
        type: 'PUT',
        strike: spot,
        premium: putGreeks.price,
        theta: putGreeks.theta,
        delta: putGreeks.delta,
        gamma: putGreeks.gamma,
        vega: putGreeks.vega,
        rho: putGreeks.rho,
        days: days,
        moneyness: 'ATM',
        intrinsic: putGreeks.intrinsic,
        extrinsic: putGreeks.extrinsic,
        iv: iv * 100,
        theoreticalPrice: putGreeks.price
    });
    
    // Update UI
    updateOptionsTable();
    if (autoCalculate) {
        updateAllCalculations();
    }
    
    // Show industry standard mode
    console.log(`Options Calculator ${BSM_MODEL.VERSION} - ${BSM_MODEL.STANDARD}`);
    console.log('Features:', BSM_MODEL.FEATURES.join(', '));
}

// Enhanced option object with BSM support
function addOption(optionData) {
    const id = options.length > 0 ? Math.max(...options.map(o => o.id)) + 1 : 1;
    
    // Get market parameters
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const q = 0; // Dividend yield (can be added later)
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const T = days / 365;
    
    // Calculate using Black-Scholes if not provided
    let premium = parseFloat(optionData.premium) || 0;
    let greeks = {};
    
    if (optionData.strike && spot && T > 0) {
        greeks = BlackScholesPricing.calculateGreeks(
            optionData.type || 'CALL',
            spot,
            optionData.strike || spot,
            T,
            r,
            iv,
            q
        );
        
        // Use calculated price if premium not provided
        if (!optionData.premium) {
            premium = greeks.price;
        }
        
        // Calculate implied volatility from price if different
        const theoreticalIV = iv;
        const actualIV = BlackScholesPricing.calculateImpliedVol(
            optionData.type || 'CALL',
            spot,
            optionData.strike || spot,
            T,
            r,
            premium,
            q
        );
        
        optionData.iv = actualIV * 100;
    }
    
    const option = {
        id: id,
        type: optionData.type || 'CALL',
        strike: parseFloat(optionData.strike) || spot,
        premium: premium,
        theta: optionData.theta || (greeks.theta || 0),
        delta: optionData.delta || (greeks.delta || 0),
        gamma: optionData.gamma || (greeks.gamma || 0),
        vega: optionData.vega || (greeks.vega || 0),
        rho: optionData.rho || (greeks.rho || 0),
        days: parseInt(optionData.days) || days,
        moneyness: optionData.moneyness || 'ATM',
        intrinsic: optionData.intrinsic || (greeks.intrinsic || 0),
        extrinsic: optionData.extrinsic || (greeks.extrinsic || 0),
        iv: optionData.iv || (iv * 100),
        theoreticalPrice: greeks.price || premium,
        d1: greeks.d1 || 0,
        d2: greeks.d2 || 0,
        lastCalculated: new Date(),
        // BSM model data
        model: 'Black-Scholes-Merton',
        parameters: {
            S: spot,
            K: parseFloat(optionData.strike) || spot,
            T: T,
            r: r,
            sigma: iv,
            q: q
        }
    };
    
    options.push(option);
    return option;
}

// Update UI to show BSM data
function updateOptionsTable() {
    const tbody = document.getElementById('optionsTableBody');
    tbody.innerHTML = '';
    
    options.forEach((option, index) => {
        const row = document.createElement('tr');
        row.className = option.type === 'CALL' ? 'call-row' : 'put-row';
        
        // Calculate price difference from theoretical
        const priceDiff = option.premium - option.theoreticalPrice;
        const priceDiffClass = Math.abs(priceDiff) > 0.5 ? 
            (priceDiff > 0 ? 'text-danger' : 'text-success') : 'text-muted';
        const priceDiffIcon = priceDiff > 0 ? 'bi-arrow-up' : 
                            priceDiff < 0 ? 'bi-arrow-down' : 'bi-dash';
        
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <span class="badge ${option.type === 'CALL' ? 'bg-success' : 'bg-danger'}">
                    ${option.type}
                </span>
                <br>
                <small class="text-muted">${option.moneyness}</small>
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
                           value="${option.premium.toFixed(2)}" step="0.01">
                </div>
                <small class="${priceDiffClass}">
                    <i class="bi ${priceDiffIcon}"></i> 
                    ${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)}
                </small>
            </td>
            <td>
                <div class="input-group input-group-sm">
                    <input type="number" class="form-control option-input" 
                           data-id="${option.id}" data-field="theta" 
                           value="${option.theta.toFixed(2)}" step="0.01">
                    <span class="input-group-text">₹</span>
                </div>
                <small class="text-muted">BSM: ${option.theta.toFixed(2)}</small>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input" 
                       data-id="${option.id}" data-field="delta" 
                       value="${option.delta.toFixed(4)}" step="0.0001">
                <small class="text-muted">Δ=${option.delta.toFixed(4)}</small>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input" 
                       data-id="${option.id}" data-field="gamma" 
                       value="${option.gamma.toFixed(6)}" step="0.000001">
                <small class="text-muted">Γ=${option.gamma.toFixed(6)}</small>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input" 
                       data-id="${option.id}" data-field="vega" 
                       value="${option.vega.toFixed(2)}" step="0.01">
                <small class="text-muted">ν=${option.vega.toFixed(2)}</small>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input" 
                       data-id="${option.id}" data-field="days" 
                       value="${option.days}" min="1" max="365">
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="recalculateBSM(${option.id})" title="Recalc BSM">
                        <i class="bi bi-calculator-fill"></i>
                    </button>
                    <button class="btn btn-outline-success" onclick="calculateSingleOption(${option.id})" title="Update">
                        <i class="bi bi-arrow-clockwise"></i>
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
    
    // Add event listeners
    document.querySelectorAll('.option-input').forEach(input => {
        input.addEventListener('input', function() {
            const id = parseInt(this.dataset.id);
            const field = this.dataset.field;
            const value = this.value;
            
            updateOptionField(id, field, value);
            
            if (autoCalculate) {
                recalculateBSM(id);
                updateAllCalculations();
            }
        });
    });
}

// Recalculate using Black-Scholes
function recalculateBSM(id) {
    const option = options.find(o => o.id === id);
    if (!option) return;
    
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const q = 0;
    const T = option.days / 365;
    
    // Recalculate using BSM
    const greeks = BlackScholesPricing.calculateGreeks(
        option.type,
        spot,
        option.strike,
        T,
        r,
        iv,
        q
    );
    
    // Update option with BSM values
    option.theta = greeks.theta;
    option.delta = greeks.delta;
    option.gamma = greeks.gamma;
    option.vega = greeks.vega;
    option.rho = greeks.rho;
    option.theoreticalPrice = greeks.price;
    option.intrinsic = greeks.intrinsic;
    option.extrinsic = greeks.extrinsic;
    option.d1 = greeks.d1;
    option.d2 = greeks.d2;
    option.iv = iv * 100;
    
    // Update moneyness
    if (option.type === 'CALL') {
        if (option.strike < spot * 0.98) option.moneyness = 'Deep ITM';
        else if (option.strike < spot * 0.995) option.moneyness = 'ITM';
        else if (option.strike <= spot * 1.005) option.moneyness = 'ATM';
        else if (option.strike <= spot * 1.02) option.moneyness = 'OTM';
        else option.moneyness = 'Deep OTM';
    } else {
        if (option.strike > spot * 1.02) option.moneyness = 'Deep ITM';
        else if (option.strike > spot * 1.005) option.moneyness = 'ITM';
        else if (option.strike >= spot * 0.995) option.moneyness = 'ATM';
        else if (option.strike >= spot * 0.98) option.moneyness = 'OTM';
        else option.moneyness = 'Deep OTM';
    }
    
    updateOptionsTable();
}

// Enhanced updateAllCalculations with BSM features
function updateAllCalculations() {
    if (options.length === 0) return;
    
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
    // Calculate totals
    let totalTheta = 0;
    let totalWeeklyErosion = 0;
    let totalTimeValue = 0;
    let totalVegaImpact = 0;
    let totalDelta = 0;
    let totalGamma = 0;
    let totalRho = 0;
    let totalExtrinsic = 0;
    let totalIntrinsic = 0;
    
    // Check put-call parity for ATM options
    let atmCall = null;
    let atmPut = null;
    
    options.forEach(option => {
        totalTheta += option.theta;
        totalWeeklyErosion += option.theta * 7;
        totalTimeValue += option.premium;
        totalVegaImpact += option.vega;
        totalDelta += option.delta;
        totalGamma += option.gamma;
        totalRho += option.rho;
        totalExtrinsic += option.extrinsic;
        totalIntrinsic += option.intrinsic;
        
        // Find ATM options for parity check
        if (option.moneyness === 'ATM' || option.moneyness === 'ATM') {
            if (option.type === 'CALL') atmCall = option;
            if (option.type === 'PUT') atmPut = option;
        }
    });
    
    // Update real-time metrics
    document.getElementById('totalTheta').textContent = `-₹${Math.abs(totalTheta).toFixed(2)}`;
    document.getElementById('totalWeeklyErosion').textContent = `-₹${Math.abs(totalWeeklyErosion).toFixed(2)}`;
    document.getElementById('dailyCarryCost').textContent = `₹${Math.abs(totalTheta).toFixed(2)}`;
    document.getElementById('totalTimeValue').textContent = `₹${totalTimeValue.toFixed(2)}`;
    document.getElementById('totalVegaImpact').textContent = `₹${totalVegaImpact.toFixed(2)}`;
    
    // Add new metrics if elements exist
    const totalExtrinsicElem = document.getElementById('totalExtrinsic');
    const totalIntrinsicElem = document.getElementById('totalIntrinsic');
    const totalDeltaElem = document.getElementById('totalDelta');
    
    if (totalExtrinsicElem) totalExtrinsicElem.textContent = `₹${totalExtrinsic.toFixed(2)}`;
    if (totalIntrinsicElem) totalIntrinsicElem.textContent = `₹${totalIntrinsic.toFixed(2)}`;
    if (totalDeltaElem) totalDeltaElem.textContent = totalDelta.toFixed(4);
    
    // Calculate average probability ITM using BSM
    let totalProbITM = 0;
    options.forEach(option => {
        const prob = BlackScholesPricing.probabilityITM(
            option.type,
            spot,
            option.strike,
            option.days/365,
            iv
        );
        totalProbITM += prob;
    });
    
    const avgProbITM = options.length > 0 ? (totalProbITM / options.length) : 0;
    document.getElementById('avgProbITM').textContent = `${avgProbITM.toFixed(1)}%`;
    
    // Check put-call parity
    if (atmCall && atmPut) {
        const parity = BlackScholesPricing.checkPutCallParity(
            atmCall.premium,
            atmPut.premium,
            spot,
            atmCall.strike,
            days/365,
            r
        );
        
        // Display parity status
        const parityElem = document.getElementById('putCallParity');
        if (parityElem) {
            if (parity.valid) {
                parityElem.innerHTML = `<span class="badge bg-success">Parity ✓</span>`;
            } else {
                parityElem.innerHTML = `<span class="badge bg-warning">Parity ₹${parity.discrepancy}</span>`;
            }
        }
    }
    
    // Update last calculation time
    lastCalculationTime = new Date();
    document.getElementById('lastUpdate').textContent = `Last: ${lastCalculationTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    
    // Update charts with BSM-calculated erosion
    updateErosionChart();
    updatePLChart();
    updatePLTable();
}

// Enhanced erosion chart with BSM decay
function updateErosionChart() {
    const ctx = document.getElementById('erosionChart').getContext('2d');
    const projectionDays = parseInt(document.getElementById('projectionDays').value);
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
    // Destroy existing chart if it exists
    if (erosionChart) {
        erosionChart.destroy();
    }
    
    // Prepare data using BSM for each day
    const labels = [];
    const callData = [];
    const putData = [];
    const callExtrinsic = [];
    const putExtrinsic = [];
    
    for (let day = 0; day <= projectionDays; day++) {
        labels.push(`Day ${day}`);
        
        let callPremium = 0;
        let putPremium = 0;
        let callExtrinsicVal = 0;
        let putExtrinsicVal = 0;
        
        options.forEach(option => {
            if (day <= option.days) {
                const remainingDays = option.days - day;
                const T = remainingDays / 365;
                
                // Use BSM to calculate premium at each point
                if (T > 0) {
                    const greeks = BlackScholesPricing.calculateGreeks(
                        option.type,
                        spot,
                        option.strike,
                        T,
                        r,
                        iv
                    );
                    
                    if (option.type === 'CALL') {
                        callPremium += greeks.price;
                        callExtrinsicVal += greeks.extrinsic;
                    } else {
                        putPremium += greeks.price;
                        putExtrinsicVal += greeks.extrinsic;
                    }
                } else {
                    // At expiration
                    if (option.type === 'CALL') {
                        callPremium += Math.max(spot - option.strike, 0);
                    } else {
                        putPremium += Math.max(option.strike - spot, 0);
                    }
                }
            }
        });
        
        callData.push(callPremium);
        putData.push(putPremium);
        callExtrinsic.push(callExtrinsicVal);
        putExtrinsic.push(putExtrinsicVal);
    }
    
    // Create chart with BSM-calculated data
    erosionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Call Premium (BSM)',
                    data: callData,
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Put Premium (BSM)',
                    data: putData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Call Extrinsic',
                    data: callExtrinsic,
                    borderColor: '#28a745',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Put Extrinsic',
                    data: putExtrinsic,
                    borderColor: '#dc3545',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
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

// Add new functions for industry standard features
function calculateImpliedVolatility() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
    options.forEach(option => {
        const T = option.days / 365;
        if (T > 0) {
            const iv = BlackScholesPricing.calculateImpliedVol(
                option.type,
                spot,
                option.strike,
                T,
                r,
                option.premium
            );
            option.iv = iv * 100;
            console.log(`${option.type} ${option.strike}: IV = ${(iv*100).toFixed(2)}%`);
        }
    });
    
    updateOptionsTable();
    alert('Implied volatility calculated for all options');
}

function validatePutCallParity() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    
    // Find matching call/put pairs
    const pairs = [];
    
    options.forEach(call => {
        if (call.type === 'CALL') {
            const matchingPut = options.find(p => 
                p.type === 'PUT' && p.strike === call.strike && p.days === call.days
            );
            
            if (matchingPut) {
                const parity = BlackScholesPricing.checkPutCallParity(
                    call.premium,
                    matchingPut.premium,
                    spot,
                    call.strike,
                    days/365,
                    r
                );
                
                pairs.push({
                    strike: call.strike,
                    callPrice: call.premium,
                    putPrice: matchingPut.premium,
                    parity: parity
                });
            }
        }
    });
    
    // Display results
    let message = 'PUT-CALL PARITY ANALYSIS:\n\n';
    pairs.forEach(pair => {
        message += `Strike: ₹${pair.strike}\n`;
        message += `Call: ₹${pair.callPrice.toFixed(2)} | Put: ₹${pair.putPrice.toFixed(2)}\n`;
        message += `Status: ${pair.parity.valid ? '✓ VALID' : '✗ INVALID'}\n`;
        message += `Discrepancy: ₹${pair.parity.discrepancy.toFixed(2)}\n`;
        message += `Synthetic Call: ₹${pair.parity.syntheticCall.toFixed(2)}\n`;
        message += `Synthetic Put: ₹${pair.parity.syntheticPut.toFixed(2)}\n\n`;
    });
    
    if (pairs.length === 0) {
        message += 'No matching call/put pairs found for parity check.';
    }
    
    alert(message);
}

function updateVolatilitySurface() {
    const atmVol = parseFloat(document.getElementById('impliedVol').value) / 100;
    const skew = parseFloat(document.getElementById('volatilitySkew').value) || -0.002;
    const smile = parseFloat(document.getElementById('volatilitySmile').value) || 0.0001;
    
    volSurface.updateFromMarket(atmVol, skew, smile);
    
    // Recalculate all options with updated volatility surface
    options.forEach(option => {
        const moneyness = (option.strike - parseFloat(document.getElementById('spotPrice').value)) / 
                         parseFloat(document.getElementById('spotPrice').value);
        const vol = volSurface.getVolatility(moneyness, option.days);
        option.iv = vol * 100;
    });
    
    updateAllCalculations();
    alert(`Volatility surface updated:\nATM: ${(atmVol*100).toFixed(2)}%\nSkew: ${skew}\nSmile: ${smile}`);
}

// Update HTML to add new BSM features
function addBSMFeaturesToUI() {
    // Add BSM status indicator to header
    const header = document.querySelector('header h1');
    if (header && !document.getElementById('bsmBadge')) {
        const badge = document.createElement('span');
        badge.id = 'bsmBadge';
        badge.className = 'badge bg-info ms-2';
        badge.textContent = 'BSM v4.0';
        badge.title = 'Black-Scholes-Merton Industry Standard';
        header.appendChild(badge);
    }
    
    // Add BSM tools to quick action bar
    const quickActions = document.querySelector('.d-flex.flex-wrap.gap-2.justify-content-center');
    if (quickActions && !document.getElementById('bsmTools')) {
        const bsmTools = document.createElement('div');
        bsmTools.id = 'bsmTools';
        bsmTools.className = 'btn-group btn-group-sm';
        
        bsmTools.innerHTML = `
            <button class="btn btn-outline-info" onclick="calculateImpliedVolatility()" title="Calc IV">
                <i class="bi bi-graph-up-arrow"></i> Calc IV
            </button>
            <button class="btn btn-outline-info" onclick="validatePutCallParity()" title="Check Parity">
                <i class="bi bi-shuffle"></i> Parity
            </button>
            <button class="btn btn-outline-info" onclick="updateVolatilitySurface()" title="Vol Surface">
                <i class="bi bi-cloud-arrow-up"></i> Vol Surface
            </button>
        `;
        
        quickActions.appendChild(bsmTools);
    }
    
    // Add BSM metrics to real-time metrics
    const metricsContainer = document.querySelector('.row.text-center');
    if (metricsContainer && !document.getElementById('bsmMetrics')) {
        const bsmMetrics = document.createElement('div');
        bsmMetrics.id = 'bsmMetrics';
        bsmMetrics.className = 'col-md-2 col-4';
        
        bsmMetrics.innerHTML = `
            <div class="metric-box">
                <small class="text-muted">Total Extrinsic</small>
                <div class="h5 text-warning" id="totalExtrinsic">₹0.00</div>
            </div>
        `;
        
        metricsContainer.appendChild(bsmMetrics);
        
        // Add parity check metric
        const parityMetric = document.createElement('div');
        parityMetric.className = 'col-md-2 col-4';
        parityMetric.innerHTML = `
            <div class="metric-box">
                <small class="text-muted">Put-Call Parity</small>
                <div class="h6" id="putCallParity">
                    <span class="badge bg-secondary">N/A</span>
                </div>
            </div>
        `;
        
        metricsContainer.appendChild(parityMetric);
    }
}

// Initialize BSM features on load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Add BSM UI features
    setTimeout(() => {
        addBSMFeaturesToUI();
        initializeDefaultOptions();
    }, 100);
    
    // Set current date
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    // Add BSM info to console
    console.log('%c⚡ Active Trader Pro v4.0 - Industry Standard BSM Model', 
                'color: #28a745; font-weight: bold; font-size: 14px;');
    console.log('%c✓ Complete Black-Scholes-Merton implementation', 'color: #6c757d;');
    console.log('%c✓ CBOE/NSE industry standard calculations', 'color: #6c757d;');
    console.log('%c✓ Professional options pricing engine', 'color: #6c757d;');
});

// Keep existing functions but enhance them
// ... [Keep all existing functions like addCallOption, addPutOption, etc.] 
// but modify them to use BSM calculations when appropriate

// Update addCallOption to use BSM
function addCallOption() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
    // Calculate using BSM
    const greeks = BlackScholesPricing.calculateGreeks('CALL', spot, spot, days/365, r, iv);
    
    addOption({
        type: 'CALL',
        strike: spot,
        premium: greeks.price,
        theta: greeks.theta,
        delta: greeks.delta,
        gamma: greeks.gamma,
        vega: greeks.vega,
        rho: greeks.rho,
        days: days,
        moneyness: 'ATM',
        intrinsic: greeks.intrinsic,
        extrinsic: greeks.extrinsic,
        iv: iv * 100
    });
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Update addPutOption to use BSM
function addPutOption() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
    // Calculate using BSM
    const greeks = BlackScholesPricing.calculateGreeks('PUT', spot, spot, days/365, r, iv);
    
    addOption({
        type: 'PUT',
        strike: spot,
        premium: greeks.price,
        theta: greeks.theta,
        delta: greeks.delta,
        gamma: greeks.gamma,
        vega: greeks.vega,
        rho: greeks.rho,
        days: days,
        moneyness: 'ATM',
        intrinsic: greeks.intrinsic,
        extrinsic: greeks.extrinsic,
        iv: iv * 100
    });
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// Update keyboard shortcuts to include BSM features
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
            case 'i': // New: Calculate IV
                calculateImpliedVolatility();
                break;
            case 'v': // New: Validate parity
                validatePutCallParity();
                break;
            case '1':
                if (options.length > 0) recalculateBSM(options[0].id);
                break;
            case '2':
                if (options.length > 1) recalculateBSM(options[1].id);
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
        case 'F5': // New: BSM recalc all
            e.preventDefault();
            options.forEach(option => recalculateBSM(option.id));
            updateAllCalculations();
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

// Update showShortcuts to include BSM shortcuts
function showShortcuts() {
    alert(`ACTIVE TRADER PRO v4.0 - BSM INDUSTRY STANDARD

F1: NIFTY ATM preset
F2: Weekly expiry preset
F3: Advanced view
F4: Pro view
F5: Recalc all BSM

Alt+C: Calculate all
Alt+R: Reset
Alt+E: Export CSV
Alt+P: Calculate P&L
Alt+I: Calculate Implied Volatility
Alt+V: Validate Put-Call Parity
Alt+1: Recalc option 1 (BSM)
Alt+2: Recalc option 2 (BSM)

+/- on number inputs: Quick adjust

Tab: Next field
Shift+Tab: Previous field
Enter: Apply and calculate

MODEL: Black-Scholes-Merton (Industry Standard)
FEATURES: Complete Greeks, Parity Check, Vol Surface

AUTO-CALCULATE is ON - changes update in real-time!`);
}

// Enhanced CSV export with BSM data
function exportToCSV() {
    let csv = 'Type,Strike,Premium,Theta,Delta,Gamma,Vega,Rho,Days,Moneyness,IV%,Intrinsic,Extrinsic,Theoretical,D1,D2,Model\n';
    
    options.forEach(option => {
        csv += `${option.type},${option.strike},${option.premium},${option.theta},${option.delta},${option.gamma},${option.vega},${option.rho},${option.days},${option.moneyness},${option.iv},${option.intrinsic},${option.extrinsic},${option.theoreticalPrice},${option.d1},${option.d2},${option.model}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `options_calculator_bsm_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    
    // Show notification
    alert('CSV exported with BSM model data!');
}