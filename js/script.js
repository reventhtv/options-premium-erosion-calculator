// Active Trader Options Calculator - Industry Standard Edition
// Version 4.0 - Complete Black-Scholes/Merton implementation
// Based on CBOE/NSE industry standards

// ============================================================================
// GLOBAL VARIABLES AND CONSTANTS
// ============================================================================
let options = [];
let erosionChart = null;
let plChart = null;
let autoCalculate = true;
let lastCalculationTime = null;

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

// ============================================================================
// MATH UTILITIES AND BSM ENGINE
// ============================================================================
const MathUtils = {
    normCDF: function(x) {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return x > 0 ? 1 - prob : prob;
    },

    normPDF: function(x) {
        return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
    },

    calculateD1D2: function(S, K, T, r, sigma, q = 0) {
        if (T <= 0) return { d1: 0, d2: 0 };
        const sqrtT = Math.sqrt(T);
        const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
        const d2 = d1 - sigma * sqrtT;
        return { d1, d2 };
    }
};

class BlackScholesPricing {
    static priceOption(type, S, K, T, r, sigma, q = 0) {
        if (T <= 0) {
            return type === 'CALL' ? Math.max(S - K, 0) : Math.max(K - S, 0);
        }
        
        const { d1, d2 } = MathUtils.calculateD1D2(S, K, T, r, sigma, q);
        const callPrice = S * Math.exp(-q * T) * MathUtils.normCDF(d1) - K * Math.exp(-r * T) * MathUtils.normCDF(d2);
        const putPrice = K * Math.exp(-r * T) * MathUtils.normCDF(-d2) - S * Math.exp(-q * T) * MathUtils.normCDF(-d1);
        
        return type === 'CALL' ? callPrice : putPrice;
    }

    static calculateGreeks(type, S, K, T, r, sigma, q = 0) {
        if (T <= 0) {
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
        const nd1 = MathUtils.normPDF(d1);
        
        let delta, theta, rho;
        if (type === 'CALL') {
            delta = Math.exp(-q * T) * MathUtils.normCDF(d1);
            theta = (-(S * sigma * Math.exp(-q * T) * nd1) / (2 * sqrtT) + 
                     q * S * Math.exp(-q * T) * MathUtils.normCDF(d1) - 
                     r * K * Math.exp(-r * T) * MathUtils.normCDF(d2)) / 365;
            rho = K * T * Math.exp(-r * T) * MathUtils.normCDF(d2) * 0.01;
        } else {
            delta = Math.exp(-q * T) * (MathUtils.normCDF(d1) - 1);
            theta = (-(S * sigma * Math.exp(-q * T) * nd1) / (2 * sqrtT) - 
                     q * S * Math.exp(-q * T) * MathUtils.normCDF(-d1) + 
                     r * K * Math.exp(-r * T) * MathUtils.normCDF(-d2)) / 365;
            rho = -K * T * Math.exp(-r * T) * MathUtils.normCDF(-d2) * 0.01;
        }
        
        const gamma = Math.exp(-q * T) * (nd1 / (S * sigma * sqrtT));
        const vega = S * Math.exp(-q * T) * sqrtT * nd1 * 0.01;
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

    static calculateImpliedVol(type, S, K, T, r, price, q = 0, maxIterations = 100, precision = 0.0001) {
        if (T <= 0) return 0;
        let sigma = 0.3;
        let sigmaUpper = 5.0;
        let sigmaLower = 0.001;
        
        for (let i = 0; i < maxIterations; i++) {
            const calculatedPrice = this.priceOption(type, S, K, T, r, sigma, q);
            const diff = calculatedPrice - price;
            if (Math.abs(diff) < precision) return sigma;
            
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

    static checkPutCallParity(callPrice, putPrice, S, K, T, r, q = 0) {
        const callPV = callPrice;
        const putPV = putPrice;
        const stockPV = S * Math.exp(-q * T);
        const strikePV = K * Math.exp(-r * T);
        const parityCheck = callPV + strikePV - (putPV + stockPV);
        const parityValid = Math.abs(parityCheck) < 0.01;
        
        return {
            valid: parityValid,
            discrepancy: parseFloat(parityCheck.toFixed(2)),
            callPrice: callPV,
            putPrice: putPV,
            syntheticCall: putPV + stockPV - strikePV,
            syntheticPut: callPV + strikePV - stockPV
        };
    }

    static probabilityITM(type, S, K, T, sigma, q = 0) {
        if (T <= 0) {
            return type === 'CALL' ? (S > K ? 100 : 0) : (S < K ? 100 : 0);
        }
        const { d2 } = MathUtils.calculateD1D2(S, K, T, 0, sigma, q);
        const prob = type === 'CALL' ? MathUtils.normCDF(d2) : MathUtils.normCDF(-d2);
        return Math.min(Math.max(prob * 100, 0), 100);
    }
}

class VolatilitySurface {
    constructor() {
        this.surface = {
            atmVol: 0.15,
            skew: -0.002,
            smile: 0.0001,
            termStructure: { '30': 0.15, '7': 0.18, '1': 0.25 }
        };
    }

    getVolatility(moneyness, days) {
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

const volSurface = new VolatilitySurface();

// ============================================================================
// CORE OPTION MANAGEMENT
// ============================================================================
function initializeDefaultOptions() {
    options = [];
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
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
    
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

function addOption(optionData) {
    const id = options.length > 0 ? Math.max(...options.map(o => o.id)) + 1 : 1;
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const q = 0;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const T = days / 365;
    
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
        
        if (!optionData.premium) premium = greeks.price;
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

// ============================================================================
// UPDATED FUNCTIONS - MAKING ALL FIELDS EDITABLE
// ============================================================================

function updateOptionsTable() {
    const tbody = document.getElementById('optionsTableBody');
    if (!tbody) return;
    
    // Get the currently focused element BEFORE we rebuild the table
    const focusedElement = document.activeElement;
    let focusedId = null;
    let focusedField = null;
    let focusedValue = null;
    
    if (focusedElement && focusedElement.classList.contains('option-input')) {
        focusedId = focusedElement.dataset.id;
        focusedField = focusedElement.dataset.field;
        focusedValue = focusedElement.value;
    }
    
    // Clear and rebuild table
    tbody.innerHTML = '';
    
    options.forEach((option, index) => {
        const priceDiff = option.premium - option.theoreticalPrice;
        const priceDiffClass = Math.abs(priceDiff) > 0.5 ? 
            (priceDiff > 0 ? 'text-danger' : 'text-success') : 'text-muted';
        const priceDiffIcon = priceDiff > 0 ? 'bi-arrow-up' : 
                            priceDiff < 0 ? 'bi-arrow-down' : 'bi-dash';
        
        const row = document.createElement('tr');
        row.className = option.type === 'CALL' ? 'call-row' : 'put-row';
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
                    <input type="number" class="form-control option-input strike-input" 
                           data-id="${option.id}" data-field="strike" 
                           value="${option.strike}" step="1">
                </div>
            </td>
            <td>
                <div class="input-group input-group-sm">
                    <span class="input-group-text">₹</span>
                    <input type="number" class="form-control option-input premium-input" 
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
                    <input type="number" class="form-control option-input theta-input" 
                           data-id="${option.id}" data-field="theta" 
                           value="${option.theta.toFixed(2)}" step="0.01">
                    <span class="input-group-text">₹</span>
                </div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input delta-input" 
                       data-id="${option.id}" data-field="delta" 
                       value="${option.delta.toFixed(4)}" step="0.0001">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input gamma-input" 
                       data-id="${option.id}" data-field="gamma" 
                       value="${option.gamma.toFixed(6)}" step="0.000001">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input vega-input" 
                       data-id="${option.id}" data-field="vega" 
                       value="${option.vega.toFixed(2)}" step="0.01">
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input rho-input" 
                       data-id="${option.id}" data-field="rho" 
                       value="${option.rho.toFixed(2)}" step="0.01">
            </td>
            <td>
                <div class="input-group input-group-sm">
                    <input type="number" class="form-control option-input iv-input" 
                           data-id="${option.id}" data-field="iv" 
                           value="${option.iv.toFixed(2)}" step="0.01">
                    <span class="input-group-text">%</span>
                </div>
            </td>
            <td>
                <input type="number" class="form-control form-control-sm option-input days-input" 
                       data-id="${option.id}" data-field="days" 
                       value="${option.days}" min="1" max="365">
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="recalculateBSM(${option.id})" title="Recalc BSM">
                        <i class="bi bi-calculator-fill"></i>
                    </button>
                    <button class="btn btn-outline-success" onclick="updateSingleOption(${option.id})" title="Update">
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
    
    // Setup event listeners for the new inputs
    setupOptionInputListeners();
    
    // Restore focus and value if there was a focused element
    if (focusedId && focusedField) {
        setTimeout(() => {
            const elementToFocus = document.querySelector(`.${focusedField}-input[data-id="${focusedId}"]`);
            if (elementToFocus) {
                elementToFocus.focus();
                elementToFocus.value = focusedValue;
                // Move cursor to end of input
                const length = elementToFocus.value.length;
                elementToFocus.setSelectionRange(length, length);
            }
        }, 10);
    }
}

function setupOptionInputListeners() {
    // Use event delegation for better performance
    const optionsTable = document.getElementById('optionsTable');
    if (!optionsTable) return;
    
    // Remove existing listeners to avoid duplicates
    optionsTable.removeEventListener('input', handleOptionInput);
    optionsTable.removeEventListener('blur', handleOptionInputBlur);
    optionsTable.removeEventListener('change', handleOptionInputChange);
    
    // Add new event listeners
    optionsTable.addEventListener('input', handleOptionInput);
    optionsTable.addEventListener('blur', handleOptionInputBlur, true); // Use capture phase
    optionsTable.addEventListener('change', handleOptionInputChange);
}

function handleOptionInput(e) {
    const input = e.target;
    if (!input.classList.contains('option-input')) return;
    
    // Just allow typing, don't update the model yet
    // We'll update on blur or change
}

function handleOptionInputBlur(e) {
    const input = e.target;
    if (!input.classList.contains('option-input')) return;
    
    const id = parseInt(input.dataset.id);
    const field = input.dataset.field;
    const value = input.value;
    
    if (value === '' || value === null || value === undefined) {
        // Restore original value
        const option = options.find(o => o.id === id);
        if (option) {
            input.value = getFormattedOptionValue(option, field);
        }
        return;
    }
    
    // Update the option field
    updateOptionField(id, field, value);
    
    // Special handling for certain fields
    if (field === 'premium') {
        // When premium changes, recalculate IV
        const spot = parseFloat(document.getElementById('spotPrice').value);
        const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
        const option = options.find(o => o.id === id);
        
        if (option && option.days > 0) {
            const T = option.days / 365;
            const iv = BlackScholesPricing.calculateImpliedVol(
                option.type,
                spot,
                option.strike,
                T,
                r,
                parseFloat(value)
            );
            option.iv = iv * 100;
            
            // Update IV display
            const ivInput = document.querySelector(`.iv-input[data-id="${id}"]`);
            if (ivInput) {
                ivInput.value = option.iv.toFixed(2);
            }
        }
    } else if (field === 'iv') {
        // When IV changes, recalculate Greeks and theoretical price
        const spot = parseFloat(document.getElementById('spotPrice').value);
        const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
        const option = options.find(o => o.id === id);
        
        if (option && option.days > 0) {
            const T = option.days / 365;
            const iv = parseFloat(value) / 100;
            
            // Recalculate Greeks with new IV
            const greeks = BlackScholesPricing.calculateGreeks(
                option.type,
                spot,
                option.strike,
                T,
                r,
                iv
            );
            
            // Update option with recalculated Greeks
            option.theta = greeks.theta;
            option.delta = greeks.delta;
            option.gamma = greeks.gamma;
            option.vega = greeks.vega;
            option.rho = greeks.rho;
            option.theoreticalPrice = greeks.price;
            
            // Update all input fields with new values
            updateOptionInputs(id);
        }
    } else if (field === 'theta' || field === 'gamma' || field === 'vega' || field === 'rho') {
        // For other Greeks, just update the field and recalculate price difference
        updatePriceDifference(id);
    }
    
    // Update price difference display
    updatePriceDifference(id);
    
    // If auto-calculate is on and this is a key field, trigger BSM recalculation
    if (autoCalculate && (field === 'strike' || field === 'premium' || field === 'days' || field === 'iv')) {
        setTimeout(() => {
            recalculateBSM(id);
            updateAllCalculations();
        }, 100);
    }
}

function handleOptionInputChange(e) {
    const input = e.target;
    if (!input.classList.contains('option-input')) return;
    
    // Trigger blur handler (same logic)
    handleOptionInputBlur(e);
}

function getFormattedOptionValue(option, field) {
    switch(field) {
        case 'strike': return option.strike;
        case 'premium': return option.premium.toFixed(2);
        case 'theta': return option.theta.toFixed(2);
        case 'delta': return option.delta.toFixed(4);
        case 'gamma': return option.gamma.toFixed(6);
        case 'vega': return option.vega.toFixed(2);
        case 'rho': return option.rho.toFixed(2);
        case 'iv': return option.iv.toFixed(2);
        case 'days': return option.days;
        default: return '';
    }
}

function updatePriceDifference(id) {
    const option = options.find(o => o.id === id);
    if (!option) return;
    
    const priceDiff = option.premium - option.theoreticalPrice;
    const priceDiffClass = Math.abs(priceDiff) > 0.5 ? 
        (priceDiff > 0 ? 'text-danger' : 'text-success') : 'text-muted';
    const priceDiffIcon = priceDiff > 0 ? 'bi-arrow-up' : 
                        priceDiff < 0 ? 'bi-arrow-down' : 'bi-dash';
    
    const premiumInput = document.querySelector(`.premium-input[data-id="${id}"]`);
    if (premiumInput) {
        const smallElement = premiumInput.parentElement.nextElementSibling;
        if (smallElement) {
            smallElement.className = priceDiffClass;
            smallElement.innerHTML = `<i class="bi ${priceDiffIcon}"></i> ${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)}`;
        }
    }
}

function recalculateBSM(id) {
    const option = options.find(o => o.id === id);
    if (!option) return;
    
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = (option.iv || parseFloat(document.getElementById('impliedVol').value)) / 100;
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
    
    // Update the specific inputs without refreshing entire table
    updateOptionInputs(id);
}

function updateOptionInputs(id) {
    const option = options.find(o => o.id === id);
    if (!option) return;
    
    // Update all inputs for this option
    const inputs = {
        'strike': option.strike,
        'premium': option.premium.toFixed(2),
        'theta': option.theta.toFixed(2),
        'delta': option.delta.toFixed(4),
        'gamma': option.gamma.toFixed(6),
        'vega': option.vega.toFixed(2),
        'rho': option.rho.toFixed(2),
        'iv': option.iv.toFixed(2),
        'days': option.days
    };
    
    // Update each input field
    Object.keys(inputs).forEach(field => {
        const input = document.querySelector(`.${field}-input[data-id="${id}"]`);
        if (input && input.value !== inputs[field]) {
            input.value = inputs[field];
        }
    });
    
    // Update moneyness display
    const row = document.querySelector(`.strike-input[data-id="${id}"]`)?.closest('tr');
    if (row) {
        const moneynessElement = row.querySelector('small.text-muted');
        if (moneynessElement) {
            moneynessElement.textContent = option.moneyness;
        }
    }
    
    // Update price difference
    updatePriceDifference(id);
}

function updateSingleOption(id) {
    const option = options.find(o => o.id === id);
    if (!option) return;
    
    // Get current values from all input fields
    const fields = ['strike', 'premium', 'theta', 'delta', 'gamma', 'vega', 'rho', 'iv', 'days'];
    
    fields.forEach(field => {
        const input = document.querySelector(`.${field}-input[data-id="${id}"]`);
        if (input && !isNaN(parseFloat(input.value))) {
            if (field === 'days') {
                option[field] = parseInt(input.value);
            } else if (field === 'iv') {
                option[field] = parseFloat(input.value);
            } else {
                option[field] = parseFloat(input.value);
            }
        }
    });
    
    // Recalculate BSM with updated values
    recalculateBSM(id);
    updateAllCalculations();
    showNotification(`Option ${id} updated`);
}

function updateOptionField(id, field, value) {
    const option = options.find(o => o.id === id);
    if (!option) return;
    
    // Update the specific field
    if (field === 'days') {
        option[field] = parseInt(value) || option[field];
    } else if (field === 'iv') {
        option[field] = parseFloat(value) || option[field];
    } else if (['strike', 'premium', 'theta', 'delta', 'gamma', 'vega', 'rho'].includes(field)) {
        option[field] = parseFloat(value) || option[field];
    }
}

// ============================================================================
// REST OF THE FUNCTIONS (UNCHANGED EXCEPT FOR MINOR UPDATES)
// ============================================================================

function loadPreset(presetName) {
    console.log(`Loading preset: ${presetName}`);
    switch(presetName) {
        case 'nifty_atm':
            document.getElementById('spotPrice').value = 17450;
            document.getElementById('impliedVol').value = 15;
            document.getElementById('daysToExpiry').value = 30;
            document.getElementById('riskFreeRate').value = 6.5;
            document.getElementById('dividendYield').value = 0;
            options = [];
            addCallOption();
            addPutOption();
            showNotification('NIFTY ATM preset loaded!');
            break;
        case 'banknifty_weekly':
            document.getElementById('underlyingSelect').value = 'BANKNIFTY';
            document.getElementById('spotPrice').value = 42000;
            document.getElementById('impliedVol').value = 18;
            document.getElementById('daysToExpiry').value = 7;
            document.getElementById('riskFreeRate').value = 6.5;
            options = [];
            addCallOption();
            addPutOption();
            showNotification('BANKNIFTY Weekly preset loaded!');
            break;
        case 'straddle':
            options = [];
            addCallOption();
            addPutOption();
            showNotification('ATM Straddle preset loaded!');
            break;
    }
    updateAllCalculations();
}

function setATM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    if (options.length === 0) {
        addCallOption();
        addPutOption();
    } else {
        options.forEach(option => {
            option.strike = spot;
            option.moneyness = 'ATM';
        });
    }
    updateOptionsTable();
    updateAllCalculations();
    showNotification('All strikes set to At The Money');
}

function setITM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    options.forEach(option => {
        if (option.type === 'CALL') {
            option.strike = spot * 0.98;
            option.moneyness = 'ITM';
        } else {
            option.strike = spot * 1.02;
            option.moneyness = 'ITM';
        }
    });
    updateOptionsTable();
    updateAllCalculations();
    showNotification('All strikes set to In The Money');
}

function setOTM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    options.forEach(option => {
        if (option.type === 'CALL') {
            option.strike = spot * 1.02;
            option.moneyness = 'OTM';
        } else {
            option.strike = spot * 0.98;
            option.moneyness = 'OTM';
        }
    });
    updateOptionsTable();
    updateAllCalculations();
    showNotification('All strikes set to Out of The Money');
}

function resetAll() {
    if (!confirm('Reset all options and settings?')) return;
    document.getElementById('spotPrice').value = 17450;
    document.getElementById('impliedVol').value = 15;
    document.getElementById('daysToExpiry').value = 30;
    document.getElementById('riskFreeRate').value = 6.5;
    document.getElementById('dividendYield').value = 0;
    document.getElementById('volatilitySkew').value = -0.002;
    document.getElementById('volatilitySmile').value = 0.0001;
    document.getElementById('termStructure').value = 'normal';
    options = [];
    updateOptionsTable();
    updateAllCalculations();
    if (erosionChart) erosionChart.destroy();
    if (plChart) plChart.destroy();
    showNotification('All options and settings reset');
}

function calculatePL() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const rangePercent = parseFloat(document.getElementById('plPriceRange').value) / 100;
    const steps = parseInt(document.getElementById('plPriceSteps').value);
    const includePremium = document.getElementById('plIncludePremium').checked;
    const useBSMpricing = document.getElementById('plBSMpricing').checked;
    
    const minPrice = spot * (1 - rangePercent);
    const maxPrice = spot * (1 + rangePercent);
    const priceStep = (maxPrice - minPrice) / steps;
    
    const priceLevels = [];
    for (let i = 0; i <= steps; i++) {
        priceLevels.push(minPrice + i * priceStep);
    }
    
    const plData = priceLevels.map(price => {
        let callPL = 0, putPL = 0, netPL = 0, extrinsicValue = 0;
        
        options.forEach(option => {
            const T = option.days / 365;
            const iv = option.iv / 100;
            const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
            let optionPL = 0;
            
            if (useBSMpricing && T > 0) {
                const greeks = BlackScholesPricing.calculateGreeks(
                    option.type,
                    price,
                    option.strike,
                    T,
                    r,
                    iv
                );
                optionPL = greeks.price;
                extrinsicValue += greeks.extrinsic;
            } else {
                optionPL = option.type === 'CALL' ? 
                    Math.max(price - option.strike, 0) : 
                    Math.max(option.strike - price, 0);
            }
            
            if (includePremium) {
                optionPL = optionPL - option.premium;
            }
            
            if (option.type === 'CALL') callPL += optionPL;
            else putPL += optionPL;
            netPL += optionPL;
        });
        
        return { price, callPL, putPL, netPL, extrinsic: extrinsicValue };
    });
    
    updatePLChart(priceLevels, plData);
    updatePLTable(plData);
    calculatePLStatistics(plData);
    showNotification('P&L calculation completed');
}

function updatePLChart(priceLevels = null, plData = null) {
    const ctx = document.getElementById('plChart').getContext('2d');
    
    if (!priceLevels || !plData) {
        priceLevels = Array.from({length: 20}, (_, i) => 17000 + i * 50);
        plData = priceLevels.map(price => ({
            price: price,
            callPL: Math.sin(price / 1000) * 100,
            putPL: Math.cos(price / 1000) * 100,
            netPL: Math.sin(price / 1000) * 100 + Math.cos(price / 1000) * 100,
            extrinsic: 50
        }));
    }
    
    if (plChart) plChart.destroy();
    
    plChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: priceLevels.map(p => `₹${p.toFixed(0)}`),
            datasets: [
                {
                    label: 'Net P&L',
                    data: plData.map(d => d.netPL),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    label: 'Call P&L',
                    data: plData.map(d => d.callPL),
                    borderColor: '#28a745',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: 'Put P&L',
                    data: plData.map(d => d.putPL),
                    borderColor: '#dc3545',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    yAxisID: 'y'
                },
                {
                    label: 'Breakeven',
                    data: priceLevels.map(() => 0),
                    borderColor: '#6c757d',
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderDash: [3, 3],
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label || ''}: ₹${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Underlying Price (₹)' },
                    grid: { drawBorder: false }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'P&L (₹)' },
                    grid: { drawBorder: false }
                }
            }
        }
    });
}

function updatePLTable(plData) {
    const tbody = document.querySelector('#plDetailedTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const includePremium = document.getElementById('plIncludePremium').checked;
    const keyPercentages = [0, -0.05, -0.10, -0.15, -0.20, 0.05, 0.10, 0.15, 0.20];
    
    keyPercentages.forEach(percent => {
        const price = spot * (1 + percent);
        let closestData = plData.reduce((prev, curr) => {
            return Math.abs(curr.price - price) < Math.abs(prev.price - price) ? curr : prev;
        });
        
        let status = '', statusClass = '';
        const tolerance = 0.01; // Small tolerance for rounding
        
        // Always check P&L, even at current price
        if (Math.abs(closestData.netPL) <= tolerance) {
            status = '<span class="badge bg-warning">B/E</span>';
            statusClass = 'table-warning';
        } else if (closestData.netPL > 0) {
            if (percent === 0) {
                status = '<span class="badge bg-success">Current Profit</span>';
            } else {
                status = '<span class="badge bg-success">Profit</span>';
            }
            statusClass = 'table-success';
        } else if (closestData.netPL < 0) {
            if (percent === 0) {
                status = '<span class="badge bg-danger">Current Loss</span>';
            } else {
                status = '<span class="badge bg-danger">Loss</span>';
            }
            statusClass = 'table-danger';
        }
        
        // Add indicator for current spot price row
        if (percent === 0) {
            statusClass += ' current-spot-row';
        }
        
        const row = document.createElement('tr');
        row.className = statusClass;
        row.innerHTML = `
            <td>₹${closestData.price.toFixed(2)} ${percent === 0 ? '<i class="bi bi-geo-alt"></i>' : ''}</td>
            <td>₹${closestData.callPL.toFixed(2)}</td>
            <td>₹${closestData.putPL.toFixed(2)}</td>
            <td>₹${closestData.netPL.toFixed(2)}</td>
            <td>₹${closestData.extrinsic.toFixed(2)}</td>
            <td>${status}</td>
        `;
        tbody.appendChild(row);
    });
}

function calculatePLStatistics(plData) {
    if (!plData || plData.length === 0) return;
    let maxProfit = -Infinity, maxLoss = Infinity;
    let breakevenUpper = null, breakevenLower = null;
    const spot = parseFloat(document.getElementById('spotPrice').value);
    
    const currentData = plData.reduce((prev, curr) => {
        return Math.abs(curr.price - spot) < Math.abs(prev.price - spot) ? curr : prev;
    });
    
    plData.forEach(data => {
        if (data.netPL > maxProfit) maxProfit = data.netPL;
        if (data.netPL < maxLoss) maxLoss = data.netPL;
        if (data.netPL >= 0 && data.netPL <= 0.01) {
            if (data.price > spot && !breakevenUpper) breakevenUpper = data.price;
            else if (data.price < spot && !breakevenLower) breakevenLower = data.price;
        }
    });
    
    if (document.getElementById('plMaxProfit')) 
        document.getElementById('plMaxProfit').textContent = `₹${maxProfit.toFixed(2)}`;
    if (document.getElementById('plMaxLoss')) 
        document.getElementById('plMaxLoss').textContent = `₹${maxLoss.toFixed(2)}`;
    if (document.getElementById('plBreakevenUpper')) 
        document.getElementById('plBreakevenUpper').textContent = breakevenUpper ? `₹${breakevenUpper.toFixed(2)}` : 'N/A';
    if (document.getElementById('plBreakevenLower')) 
        document.getElementById('plBreakevenLower').textContent = breakevenLower ? `₹${breakevenLower.toFixed(2)}` : 'N/A';
}

function clearAllOptions() {
    if (options.length === 0) {
        showNotification('No options to clear');
        return;
    }
    if (confirm(`Clear all ${options.length} options?`)) {
        options = [];
        updateOptionsTable();
        updateAllCalculations();
        showNotification('All options cleared');
    }
}

function addPair() {
    addCallOption();
    addPutOption();
    showNotification('ATM Straddle pair added');
}

function setDaysToExpiry(days) {
    document.getElementById('daysToExpiry').value = days;
    options.forEach(option => option.days = days);
    updateAllCalculations();
    showNotification(`Days to expiry set to ${days}`);
}

function adjustSpot(amount) {
    const spotInput = document.getElementById('spotPrice');
    spotInput.value = parseFloat(spotInput.value) + amount;
    spotInput.dispatchEvent(new Event('change'));
}

function adjustDays(amount) {
    const daysInput = document.getElementById('daysToExpiry');
    daysInput.value = Math.max(1, parseInt(daysInput.value) + amount);
    daysInput.dispatchEvent(new Event('change'));
}

function updateUnderlying() {
    const underlying = document.getElementById('underlyingSelect').value;
    let spotPrice = 17450;
    switch(underlying) {
        case 'NIFTY': spotPrice = 17450; break;
        case 'BANKNIFTY': spotPrice = 42000; break;
        case 'FINNIFTY': spotPrice = 19500; break;
        case 'SENSEX': spotPrice = 72000; break;
        case 'RELIANCE': spotPrice = 2500; break;
        case 'TCS': spotPrice = 3800; break;
        case 'INFY': spotPrice = 1500; break;
        case 'HDFCBANK': spotPrice = 1650; break;
    }
    document.getElementById('spotPrice').value = spotPrice;
    updateAllCalculations();
    showNotification(`Underlying updated to ${underlying}`);
}

function toggleView(viewType) {
    const simpleBtn = document.querySelector('[onclick="toggleView(\'simple\')"]');
    const advancedBtn = document.querySelector('[onclick="toggleView(\'advanced\')"]');
    const proBtn = document.querySelector('[onclick="toggleView(\'pro\')"]');
    
    [simpleBtn, advancedBtn, proBtn].forEach(btn => {
        if (btn) {
            btn.classList.remove('active');
            btn.classList.add('btn-outline-secondary');
        }
    });
    
    const activeBtn = document.querySelector(`[onclick="toggleView('${viewType}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.classList.remove('btn-outline-secondary');
    }
    
    const advancedSettings = document.getElementById('advancedSettings');
    const bsmInfo = document.querySelector('.card-header.bg-dark.text-white');
    
    switch(viewType) {
        case 'simple':
            if (advancedSettings) advancedSettings.style.display = 'none';
            if (bsmInfo) bsmInfo.style.display = 'none';
            break;
        case 'advanced':
            if (advancedSettings) advancedSettings.style.display = 'block';
            if (bsmInfo) bsmInfo.style.display = 'block';
            break;
        case 'pro':
            if (advancedSettings) advancedSettings.style.display = 'block';
            if (bsmInfo) bsmInfo.style.display = 'block';
            break;
    }
    
    showNotification(`${viewType.charAt(0).toUpperCase() + viewType.slice(1)} view activated`);
}

function calculateAll() {
    options.forEach(option => recalculateBSM(option.id));
    updateAllCalculations();
    calculatePL();
    showNotification('All calculations completed');
}

function cloneOption(id) {
    const originalOption = options.find(o => o.id === id);
    if (!originalOption) return;
    const clone = {
        ...originalOption,
        id: Math.max(...options.map(o => o.id)) + 1,
        strike: originalOption.strike + (originalOption.type === 'CALL' ? 100 : -100)
    };
    options.push(clone);
    updateOptionsTable();
    updateAllCalculations();
    showNotification(`Option ${id} cloned`);
}

function deleteOption(id) {
    const optionIndex = options.findIndex(o => o.id === id);
    if (optionIndex === -1) return;
    if (confirm(`Delete ${options[optionIndex].type} option?`)) {
        options.splice(optionIndex, 1);
        updateOptionsTable();
        updateAllCalculations();
        showNotification(`Option ${id} deleted`);
    }
}

function toggleAutoCalculate() {
    autoCalculate = !autoCalculate;
    const autoCalcCheckbox = document.getElementById('autoCalculate');
    const label = autoCalcCheckbox.nextElementSibling;
    if (autoCalculate) {
        label.innerHTML = '<i class="bi bi-lightning-charge"></i> Auto-calc <span class="badge bg-success">ON</span>';
        showNotification('Auto-calculate: ON');
    } else {
        label.innerHTML = '<i class="bi bi-lightning-charge"></i> Auto-calc <span class="badge bg-secondary">OFF</span>';
        showNotification('Auto-calculate: OFF');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.body.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) notification.parentNode.removeChild(notification);
    }, 3000);
}

// ============================================================================
// CHART FUNCTIONS
// ============================================================================
function updateErosionChart() {
    const ctx = document.getElementById('erosionChart').getContext('2d');
    const projectionDays = 30;
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
    if (erosionChart) erosionChart.destroy();
    
    const labels = [];
    const callData = [];
    const putData = [];
    const callExtrinsic = [];
    const putExtrinsic = [];
    
    for (let day = 0; day <= projectionDays; day++) {
        labels.push(`Day ${day}`);
        let callPremium = 0, putPremium = 0;
        let callExtrinsicVal = 0, putExtrinsicVal = 0;
        
        options.forEach(option => {
            if (day <= option.days) {
                const remainingDays = option.days - day;
                const T = remainingDays / 365;
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
                    if (option.type === 'CALL') callPremium += Math.max(spot - option.strike, 0);
                    else putPremium += Math.max(option.strike - spot, 0);
                }
            }
        });
        
        callData.push(callPremium);
        putData.push(putPremium);
        callExtrinsic.push(callExtrinsicVal);
        putExtrinsic.push(putExtrinsicVal);
    }
    
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
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' },
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
                x: { title: { display: true, text: 'Days to Expiry' } },
                y: { title: { display: true, text: 'Premium (₹)' }, beginAtZero: true }
            }
        }
    });
}

// ============================================================================
// BSM SPECIALIZED FUNCTIONS
// ============================================================================
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
        }
    });
    
    updateOptionsTable();
    alert('Implied volatility calculated for all options');
}

function validatePutCallParity() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
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
    
    let message = 'PUT-CALL PARITY ANALYSIS:\n\n';
    pairs.forEach(pair => {
        message += `Strike: ₹${pair.strike}\n`;
        message += `Call: ₹${pair.callPrice.toFixed(2)} | Put: ₹${pair.putPrice.toFixed(2)}\n`;
        message += `Status: ${pair.parity.valid ? '✓ VALID' : '✗ INVALID'}\n`;
        message += `Discrepancy: ₹${pair.parity.discrepancy.toFixed(2)}\n`;
        message += `Synthetic Call: ₹${pair.parity.syntheticCall.toFixed(2)}\n`;
        message += `Synthetic Put: ₹${pair.parity.syntheticPut.toFixed(2)}\n\n`;
    });
    
    if (pairs.length === 0) message += 'No matching call/put pairs found.';
    alert(message);
}

function updateVolatilitySurface() {
    const atmVol = parseFloat(document.getElementById('impliedVol').value) / 100;
    const skew = parseFloat(document.getElementById('volatilitySkew').value) || -0.002;
    const smile = parseFloat(document.getElementById('volatilitySmile').value) || 0.0001;
    
    volSurface.updateFromMarket(atmVol, skew, smile);
    
    options.forEach(option => {
        const moneyness = (option.strike - parseFloat(document.getElementById('spotPrice').value)) / 
                         parseFloat(document.getElementById('spotPrice').value);
        const vol = volSurface.getVolatility(moneyness, option.days);
        option.iv = vol * 100;
    });
    
    updateAllCalculations();
    alert(`Volatility surface updated:\nATM: ${(atmVol*100).toFixed(2)}%\nSkew: ${skew}\nSmile: ${smile}`);
}

// ============================================================================
// OPTION CREATION FUNCTIONS
// ============================================================================
function addCallOption() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
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

function addPutOption() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
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

// ============================================================================
// CALCULATION ENGINE
// ============================================================================
function updateAllCalculations() {
    if (options.length === 0) return;
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv = parseFloat(document.getElementById('impliedVol').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const r = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    
    let totalTheta = 0, totalWeeklyErosion = 0, totalTimeValue = 0;
    let totalVegaImpact = 0, totalDelta = 0, totalGamma = 0;
    let totalRho = 0, totalExtrinsic = 0, totalIntrinsic = 0;
    let atmCall = null, atmPut = null;
    
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
        
        if (option.moneyness === 'ATM' || option.moneyness === 'ATM') {
            if (option.type === 'CALL') atmCall = option;
            if (option.type === 'PUT') atmPut = option;
        }
    });
    
    if (document.getElementById('totalTheta')) 
        document.getElementById('totalTheta').textContent = `-₹${Math.abs(totalTheta).toFixed(2)}`;
    if (document.getElementById('totalWeeklyErosion')) 
        document.getElementById('totalWeeklyErosion').textContent = `-₹${Math.abs(totalWeeklyErosion).toFixed(2)}`;
    if (document.getElementById('totalExtrinsic')) 
        document.getElementById('totalExtrinsic').textContent = `₹${totalExtrinsic.toFixed(2)}`;
    if (document.getElementById('totalIntrinsic')) 
        document.getElementById('totalIntrinsic').textContent = `₹${totalIntrinsic.toFixed(2)}`;
    if (document.getElementById('totalDelta')) 
        document.getElementById('totalDelta').textContent = totalDelta.toFixed(4);
    
    if (atmCall && atmPut) {
        const parity = BlackScholesPricing.checkPutCallParity(
            atmCall.premium,
            atmPut.premium,
            spot,
            atmCall.strike,
            days/365,
            r
        );
        const parityElem = document.getElementById('putCallParity');
        if (parityElem) {
            parityElem.innerHTML = parity.valid ? 
                `<span class="badge bg-success">Parity ✓</span>` :
                `<span class="badge bg-warning">Parity ₹${parity.discrepancy}</span>`;
        }
    }
    
    lastCalculationTime = new Date();
    if (document.getElementById('lastUpdate')) {
        document.getElementById('lastUpdate').textContent = 
            `Last: ${lastCalculationTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
    }
    
    updateErosionChart();
}

// ============================================================================
// EXPORT FUNCTION
// ============================================================================
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
    alert('CSV exported with BSM model data!');
}

// ============================================================================
// BSM UI ENHANCEMENTS
// ============================================================================
function addBSMFeaturesToUI() {
    const header = document.querySelector('header h1');
    if (header && !document.getElementById('bsmBadge')) {
        const badge = document.createElement('span');
        badge.id = 'bsmBadge';
        badge.className = 'badge bg-info ms-2';
        badge.textContent = 'BSM v4.0';
        badge.title = 'Black-Scholes-Merton Industry Standard';
        header.appendChild(badge);
    }
}

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
Up/Down Arrow: Adjust spot price
Left/Right Arrow: Adjust days to expiry

MODEL: Black-Scholes-Merton (Industry Standard)
FEATURES: Complete Greeks, Parity Check, Vol Surface

AUTO-CALCULATE: ${autoCalculate ? 'ON' : 'OFF'}`);
}

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================
document.addEventListener('keydown', function(e) {
    if (e.altKey) {
        e.preventDefault();
        switch(e.key.toLowerCase()) {
            case 'c': calculateAll(); break;
            case 'r': resetAll(); break;
            case 'e': exportToCSV(); break;
            case 'p': calculatePL(); break;
            case 'i': calculateImpliedVolatility(); break;
            case 'v': validatePutCallParity(); break;
            case '1': if (options.length > 0) recalculateBSM(options[0].id); break;
            case '2': if (options.length > 1) recalculateBSM(options[1].id); break;
        }
    }
    
    switch(e.key) {
        case 'F1': e.preventDefault(); loadPreset('nifty_atm'); break;
        case 'F2': e.preventDefault(); loadPreset('banknifty_weekly'); break;
        case 'F3': e.preventDefault(); toggleView('advanced'); break;
        case 'F4': e.preventDefault(); toggleView('pro'); break;
        case 'F5': e.preventDefault(); options.forEach(o => recalculateBSM(o.id)); updateAllCalculations(); break;
    }
    
    if (!e.altKey && !e.ctrlKey && !e.shiftKey) {
        switch(e.key) {
            case 'ArrowUp': e.preventDefault(); adjustSpot(10); break;
            case 'ArrowDown': e.preventDefault(); adjustSpot(-10); break;
            case 'ArrowRight': e.preventDefault(); adjustDays(1); break;
            case 'ArrowLeft': e.preventDefault(); adjustDays(-1); break;
        }
    }
    
    if (e.target.tagName === 'INPUT' && (e.key === '+' || e.key === '-')) {
        e.preventDefault();
        const input = e.target;
        const current = parseFloat(input.value) || 0;
        const step = parseFloat(input.step) || 1;
        input.value = e.key === '+' ? current + step : current - step;
        input.dispatchEvent(new Event('change'));
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================
function initializeCharts() {
    updateErosionChart();
    updatePLChart();
}

document.addEventListener('DOMContentLoaded', function() {
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    setTimeout(() => {
        addBSMFeaturesToUI();
        initializeDefaultOptions();
        initializeCharts();
    }, 100);
    
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        dateElement.textContent = new Date().toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
    
    setTimeout(() => {
        console.log('%c⚡ BSM Options Calculator v4.0 Loaded', 
            'color: #28a745; font-weight: bold; font-size: 16px;');
        console.log('%cBlack-Scholes-Merton Model Active', 'color: #6c757d;');
    }, 500);
});