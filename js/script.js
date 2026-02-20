// Active Trader Options Calculator - Industry Standard Edition
// Version 4.0 - Complete Black-Scholes/Merton implementation
// Based on CBOE/NSE industry standards
// MODIFIED: Gamma (Γ) and Vega (ν) wired to metrics strip | Tooltip syntax fixed

// ============================================================================
// GLOBAL VARIABLES AND CONSTANTS
// ============================================================================
let _options = [];

Object.defineProperty(window, 'options', {
    get: function() { return _options; },
    set: function(value) {
        _options = value;
        options = _options;
        console.log('🔁 Window.options updated:', _options.length, 'options');
    }
});

const options = window.options;

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

function syncOptionsToWindow() {
    window.options = _options;
    console.log('🔁 Options synced to window:', _options.length, 'options');
    if (window.RiskSpotlight && window.RiskSpotlight.updateRiskSpotlight) {
        setTimeout(() => { window.RiskSpotlight.updateRiskSpotlight(); }, 100);
    }
}

// ============================================================================
// UNIFIED THEME MANAGEMENT
// ============================================================================

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    let theme = 'light';
    if (savedTheme) {
        theme = savedTheme;
    } else if (prefersDark) {
        theme = 'dark';
    }
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme === 'dark');
    setTimeout(updateChartColorsForCurrentTheme, 100);
}

function toggleVolSurfaceIcon() {
    const chevron = document.getElementById('volSurfaceChevron');
    const icon = document.getElementById('volSurfaceIcon');
    if (chevron && icon) {
        const isCollapsed = chevron.classList.contains('bi-chevron-down');
        chevron.className = isCollapsed ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
        icon.className = isCollapsed ? 'bi bi-cloud-arrow-down' : 'bi bi-cloud-arrow-up';
    }
}

function toggleBSMInfoIcon() {
    const chevron = document.getElementById('bsmInfoChevron');
    const icon = document.getElementById('bsmInfoIcon');
    if (chevron && icon) {
        const isCollapsed = chevron.classList.contains('bi-chevron-down');
        chevron.className = isCollapsed ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
        icon.className = isCollapsed ? 'bi bi-info-circle-fill' : 'bi bi-info-circle';
    }
}

function updateThemeIcon(isDark) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    const sunIcon = themeToggle.querySelector('.bi-sun-fill');
    const moonIcon = themeToggle.querySelector('.bi-moon-fill');
    if (isDark) {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
    } else {
        if (sunIcon) sunIcon.style.display = 'block';
        if (moonIcon) moonIcon.style.display = 'none';
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme === 'dark');
    console.log(`%c⚡ Theme changed to: ${newTheme} mode`,
        `color: ${newTheme === 'dark' ? '#f0a500' : '#c4861a'}; font-weight: bold;`);
    updateChartColorsForCurrentTheme();
    showNotification(`Theme switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} mode`);
}

function updateChartColorsForCurrentTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (erosionChart) { updateChartColorsForTheme(erosionChart, isDark); erosionChart.update(); }
    if (plChart)      { updateChartColorsForTheme(plChart, isDark);      plChart.update(); }
}

function updateChartColorsForTheme(chart, isDark) {
    if (!chart || !chart.options) return;
    const gridColor = isDark ? 'rgba(52, 58, 64, 0.3)' : 'rgba(233, 236, 239, 0.8)';
    const textColor = isDark ? '#9aa3b0' : '#495057';
    if (chart.options.scales) {
        Object.keys(chart.options.scales).forEach(scaleKey => {
            const scale = chart.options.scales[scaleKey];
            if (scale.grid)   scale.grid.color   = gridColor;
            if (scale.ticks)  scale.ticks.color  = textColor;
            if (scale.title)  scale.title.color  = textColor;
        });
    }
    if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = textColor;
    }
    if (chart.options.plugins?.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = isDark ? 'rgba(26,29,32,0.9)' : 'rgba(255,255,255,0.9)';
        chart.options.plugins.tooltip.titleColor = textColor;
        chart.options.plugins.tooltip.bodyColor  = textColor;
    }
}

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
        const putPrice  = K * Math.exp(-r * T) * MathUtils.normCDF(-d2) - S * Math.exp(-q * T) * MathUtils.normCDF(-d1);
        return type === 'CALL' ? callPrice : putPrice;
    }

    static calculateGreeks(type, S, K, T, r, sigma, q = 0) {
        if (T <= 0) {
            const intrinsic = type === 'CALL' ? Math.max(S - K, 0) : Math.max(K - S, 0);
            return {
                delta: type === 'CALL' ? (S > K ? 1 : 0) : (S < K ? -1 : 0),
                gamma: 0, theta: 0, vega: 0, rho: 0,
                intrinsic, extrinsic: 0
            };
        }
        const { d1, d2 } = MathUtils.calculateD1D2(S, K, T, r, sigma, q);
        const sqrtT = Math.sqrt(T);
        const nd1   = MathUtils.normPDF(d1);

        let delta, theta, rho;
        if (type === 'CALL') {
            delta = Math.exp(-q * T) * MathUtils.normCDF(d1);
            theta = (-(S * sigma * Math.exp(-q * T) * nd1) / (2 * sqrtT) +
                      q * S * Math.exp(-q * T) * MathUtils.normCDF(d1) -
                      r * K * Math.exp(-r * T) * MathUtils.normCDF(d2)) / 365;
            rho   = K * T * Math.exp(-r * T) * MathUtils.normCDF(d2) * 0.01;
        } else {
            delta = Math.exp(-q * T) * (MathUtils.normCDF(d1) - 1);
            theta = (-(S * sigma * Math.exp(-q * T) * nd1) / (2 * sqrtT) -
                      q * S * Math.exp(-q * T) * MathUtils.normCDF(-d1) +
                      r * K * Math.exp(-r * T) * MathUtils.normCDF(-d2)) / 365;
            rho   = -K * T * Math.exp(-r * T) * MathUtils.normCDF(-d2) * 0.01;
        }

        const gamma    = Math.exp(-q * T) * (nd1 / (S * sigma * sqrtT));
        const vega     = S * Math.exp(-q * T) * sqrtT * nd1 * 0.01;
        const price    = this.priceOption(type, S, K, T, r, sigma, q);
        const intrinsic = type === 'CALL' ? Math.max(S - K, 0) : Math.max(K - S, 0);
        const extrinsic = Math.max(price - intrinsic, 0);

        return {
            delta:     parseFloat(delta.toFixed(4)),
            gamma:     parseFloat(gamma.toFixed(6)),
            theta:     parseFloat(theta.toFixed(2)),
            vega:      parseFloat(vega.toFixed(2)),
            rho:       parseFloat(rho.toFixed(2)),
            price:     parseFloat(price.toFixed(2)),
            intrinsic: parseFloat(intrinsic.toFixed(2)),
            extrinsic: parseFloat(extrinsic.toFixed(2)),
            d1:        parseFloat(d1.toFixed(4)),
            d2:        parseFloat(d2.toFixed(4))
        };
    }

    static calculateImpliedVol(type, S, K, T, r, price, q = 0, maxIterations = 100, precision = 0.0001) {
        if (T <= 0) return 0;
        let sigma = 0.3, sigmaUpper = 5.0, sigmaLower = 0.001;
        for (let i = 0; i < maxIterations; i++) {
            const calculatedPrice = this.priceOption(type, S, K, T, r, sigma, q);
            const diff = calculatedPrice - price;
            if (Math.abs(diff) < precision) return sigma;
            if (diff > 0) { sigmaUpper = sigma; sigma = (sigma + sigmaLower) / 2; }
            else          { sigmaLower = sigma; sigma = (sigma + sigmaUpper) / 2; }
        }
        return sigma;
    }

    static checkPutCallParity(callPrice, putPrice, S, K, T, r, q = 0) {
        const stockPV   = S * Math.exp(-q * T);
        const strikePV  = K * Math.exp(-r * T);
        const parityCheck = callPrice + strikePV - (putPrice + stockPV);
        return {
            valid:        Math.abs(parityCheck) < 0.01,
            discrepancy:  parseFloat(parityCheck.toFixed(2)),
            callPrice,
            putPrice,
            syntheticCall: putPrice + stockPV - strikePV,
            syntheticPut:  callPrice + strikePV - stockPV
        };
    }

    static probabilityITM(type, S, K, T, sigma, q = 0) {
        if (T <= 0) return type === 'CALL' ? (S > K ? 100 : 0) : (S < K ? 100 : 0);
        const { d2 } = MathUtils.calculateD1D2(S, K, T, 0, sigma, q);
        const prob = type === 'CALL' ? MathUtils.normCDF(d2) : MathUtils.normCDF(-d2);
        return Math.min(Math.max(prob * 100, 0), 100);
    }
}

class VolatilitySurface {
    constructor() {
        this.surface = {
            atmVol: 0.15, skew: -0.002, smile: 0.0001,
            termStructure: { '30': 0.15, '7': 0.18, '1': 0.25 }
        };
    }
    getVolatility(moneyness, days) {
        const atmVol    = this.surface.termStructure[days] || this.surface.atmVol;
        const skewEffect  = this.surface.skew  * moneyness * 100;
        const smileEffect = this.surface.smile * Math.pow(moneyness * 100, 2);
        return Math.max(0.05, atmVol + skewEffect + smileEffect);
    }
    updateFromMarket(atmVol, skew = null, smile = null) {
        this.surface.atmVol = atmVol;
        if (skew  !== null) this.surface.skew  = skew;
        if (smile !== null) this.surface.smile = smile;
    }
}

const volSurface = new VolatilitySurface();

// ============================================================================
// CORE OPTION MANAGEMENT
// ============================================================================
function initializeDefaultOptions() {
    _options.length = 0;
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv   = parseFloat(document.getElementById('impliedVol').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;

    const callGreeks = BlackScholesPricing.calculateGreeks('CALL', spot, spot, days/365, r, iv);
    addOption({ id: 1, type: 'CALL', strike: spot, premium: callGreeks.price,
        theta: callGreeks.theta, delta: callGreeks.delta, gamma: callGreeks.gamma,
        vega: callGreeks.vega, rho: callGreeks.rho, days, moneyness: 'ATM',
        intrinsic: callGreeks.intrinsic, extrinsic: callGreeks.extrinsic,
        iv: iv * 100, theoreticalPrice: callGreeks.price });

    const putGreeks = BlackScholesPricing.calculateGreeks('PUT', spot, spot, days/365, r, iv);
    addOption({ id: 2, type: 'PUT', strike: spot, premium: putGreeks.price,
        theta: putGreeks.theta, delta: putGreeks.delta, gamma: putGreeks.gamma,
        vega: putGreeks.vega, rho: putGreeks.rho, days, moneyness: 'ATM',
        intrinsic: putGreeks.intrinsic, extrinsic: putGreeks.extrinsic,
        iv: iv * 100, theoreticalPrice: putGreeks.price });

    updateOptionsTable();
    syncOptionsToWindow();
    if (autoCalculate) updateAllCalculations();
}

function addOption(optionData) {
    const id   = _options.length > 0 ? Math.max(..._options.map(o => o.id)) + 1 : 1;
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv   = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const q    = 0;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const T    = days / 365;

    let premium = parseFloat(optionData.premium) || 0;
    let greeks  = {};

    if (optionData.strike && spot && T > 0) {
        greeks = BlackScholesPricing.calculateGreeks(
            optionData.type || 'CALL', spot, optionData.strike || spot, T, r, iv, q);
        if (!optionData.premium) premium = greeks.price;
        const actualIV = BlackScholesPricing.calculateImpliedVol(
            optionData.type || 'CALL', spot, optionData.strike || spot, T, r, premium, q);
        optionData.iv = actualIV * 100;
    }

    const option = {
        id, type: optionData.type || 'CALL',
        strike:   parseFloat(optionData.strike) || spot,
        premium,
        theta:    optionData.theta   || (greeks.theta   || 0),
        delta:    optionData.delta   || (greeks.delta   || 0),
        gamma:    optionData.gamma   || (greeks.gamma   || 0),
        vega:     optionData.vega    || (greeks.vega    || 0),
        rho:      optionData.rho     || (greeks.rho     || 0),
        days:     parseInt(optionData.days) || days,
        moneyness: optionData.moneyness || 'ATM',
        intrinsic: optionData.intrinsic || (greeks.intrinsic || 0),
        extrinsic: optionData.extrinsic || (greeks.extrinsic || 0),
        iv:        optionData.iv || (iv * 100),
        theoreticalPrice: greeks.price || premium,
        d1: greeks.d1 || 0, d2: greeks.d2 || 0,
        lastCalculated: new Date(),
        model: 'Black-Scholes-Merton',
        parameters: { S: spot, K: parseFloat(optionData.strike) || spot, T, r, sigma: iv, q }
    };

    _options.push(option);
    syncOptionsToWindow();
    console.log(`➕ Added ${option.type} option, total: ${_options.length}`);
    return option;
}

// ============================================================================
// OPTIONS TABLE
// ============================================================================
function updateOptionsTable() {
    const tbody = document.getElementById('optionsTableBody');
    if (!tbody) return;

    const focusedElement = document.activeElement;
    let focusedId = null, focusedField = null, focusedValue = null;
    if (focusedElement && focusedElement.classList.contains('option-input')) {
        focusedId    = focusedElement.dataset.id;
        focusedField = focusedElement.dataset.field;
        focusedValue = focusedElement.value;
    }

    tbody.innerHTML = '';

    _options.forEach((option, index) => {
        const priceDiff = option.premium - option.theoreticalPrice;
        const priceDiffClass = Math.abs(priceDiff) > 0.5
            ? (priceDiff > 0 ? 'text-danger' : 'text-success') : 'text-muted';
        const priceDiffIcon  = priceDiff > 0 ? 'bi-arrow-up' : priceDiff < 0 ? 'bi-arrow-down' : 'bi-dash';

        const row = document.createElement('tr');
        row.className = option.type === 'CALL' ? 'call-row' : 'put-row';
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>
                <span class="badge ${option.type === 'CALL' ? 'bg-success' : 'bg-danger'}">
                    ${option.type}
                </span><br>
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
                    <button class="btn btn-outline-info" onclick="recalculateBSM(${option.id})" title="Recalc BSM">
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

    setupOptionInputListeners();

    if (focusedId && focusedField) {
        setTimeout(() => {
            const el = document.querySelector(`.${focusedField}-input[data-id="${focusedId}"]`);
            if (el) {
                el.focus();
                el.value = focusedValue;
                const len = el.value.length;
                el.setSelectionRange(len, len);
            }
        }, 10);
    }
}

function setupOptionInputListeners() {
    const optionsTable = document.getElementById('optionsTable');
    if (!optionsTable) return;
    optionsTable.removeEventListener('input',  handleOptionInput);
    optionsTable.removeEventListener('blur',   handleOptionInputBlur);
    optionsTable.removeEventListener('change', handleOptionInputChange);
    optionsTable.addEventListener('input',  handleOptionInput);
    optionsTable.addEventListener('blur',   handleOptionInputBlur, true);
    optionsTable.addEventListener('change', handleOptionInputChange);
}

function handleOptionInput(e) {
    // Allow typing without immediately updating model
}

function handleOptionInputBlur(e) {
    const input = e.target;
    if (!input.classList.contains('option-input')) return;
    const id    = parseInt(input.dataset.id);
    const field = input.dataset.field;
    const value = input.value;

    if (value === '' || value === null || value === undefined) {
        const option = _options.find(o => o.id === id);
        if (option) input.value = getFormattedOptionValue(option, field);
        return;
    }

    updateOptionField(id, field, value);

    if (field === 'premium') {
        const spot = parseFloat(document.getElementById('spotPrice').value);
        const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;
        const option = _options.find(o => o.id === id);
        if (option && option.days > 0) {
            const T  = option.days / 365;
            const iv = BlackScholesPricing.calculateImpliedVol(
                option.type, spot, option.strike, T, r, parseFloat(value));
            option.iv = iv * 100;
            const ivInput = document.querySelector(`.iv-input[data-id="${id}"]`);
            if (ivInput) ivInput.value = option.iv.toFixed(2);
        }
    } else if (field === 'iv') {
        const spot = parseFloat(document.getElementById('spotPrice').value);
        const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;
        const option = _options.find(o => o.id === id);
        if (option && option.days > 0) {
            const T      = option.days / 365;
            const iv     = parseFloat(value) / 100;
            const greeks = BlackScholesPricing.calculateGreeks(option.type, spot, option.strike, T, r, iv);
            option.theta = greeks.theta; option.delta = greeks.delta;
            option.gamma = greeks.gamma; option.vega  = greeks.vega;
            option.rho   = greeks.rho;   option.theoreticalPrice = greeks.price;
            updateOptionInputs(id);
        }
    } else if (['theta','gamma','vega','rho'].includes(field)) {
        updatePriceDifference(id);
    }

    updatePriceDifference(id);

    if (autoCalculate && ['strike','premium','days','iv'].includes(field)) {
        setTimeout(() => { recalculateBSM(id); updateAllCalculations(); }, 100);
    }

    syncOptionsToWindow();
}

function handleOptionInputChange(e) {
    const input = e.target;
    if (!input.classList.contains('option-input')) return;
    handleOptionInputBlur(e);
}

function getFormattedOptionValue(option, field) {
    switch(field) {
        case 'strike':  return option.strike;
        case 'premium': return option.premium.toFixed(2);
        case 'theta':   return option.theta.toFixed(2);
        case 'delta':   return option.delta.toFixed(4);
        case 'gamma':   return option.gamma.toFixed(6);
        case 'vega':    return option.vega.toFixed(2);
        case 'rho':     return option.rho.toFixed(2);
        case 'iv':      return option.iv.toFixed(2);
        case 'days':    return option.days;
        default:        return '';
    }
}

function updatePriceDifference(id) {
    const option = _options.find(o => o.id === id);
    if (!option) return;
    const priceDiff = option.premium - option.theoreticalPrice;
    const priceDiffClass = Math.abs(priceDiff) > 0.5
        ? (priceDiff > 0 ? 'text-danger' : 'text-success') : 'text-muted';
    const priceDiffIcon  = priceDiff > 0 ? 'bi-arrow-up' : priceDiff < 0 ? 'bi-arrow-down' : 'bi-dash';
    const premiumInput   = document.querySelector(`.premium-input[data-id="${id}"]`);
    if (premiumInput) {
        const smallEl = premiumInput.parentElement.nextElementSibling;
        if (smallEl) {
            smallEl.className = priceDiffClass;
            smallEl.innerHTML = `<i class="bi ${priceDiffIcon}"></i> ${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)}`;
        }
    }
}

function recalculateBSM(id) {
    const option = _options.find(o => o.id === id);
    if (!option) return;
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv   = (option.iv || parseFloat(document.getElementById('impliedVol').value)) / 100;
    const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const T    = option.days / 365;

    const greeks = BlackScholesPricing.calculateGreeks(option.type, spot, option.strike, T, r, iv, 0);
    option.theta = greeks.theta;  option.delta = greeks.delta;
    option.gamma = greeks.gamma;  option.vega  = greeks.vega;
    option.rho   = greeks.rho;    option.theoreticalPrice = greeks.price;
    option.intrinsic = greeks.intrinsic; option.extrinsic = greeks.extrinsic;
    option.d1 = greeks.d1; option.d2 = greeks.d2; option.iv = iv * 100;

    if (option.type === 'CALL') {
        if      (option.strike < spot * 0.98)  option.moneyness = 'Deep ITM';
        else if (option.strike < spot * 0.995) option.moneyness = 'ITM';
        else if (option.strike <= spot * 1.005)option.moneyness = 'ATM';
        else if (option.strike <= spot * 1.02) option.moneyness = 'OTM';
        else                                   option.moneyness = 'Deep OTM';
    } else {
        if      (option.strike > spot * 1.02)  option.moneyness = 'Deep ITM';
        else if (option.strike > spot * 1.005) option.moneyness = 'ITM';
        else if (option.strike >= spot * 0.995)option.moneyness = 'ATM';
        else if (option.strike >= spot * 0.98) option.moneyness = 'OTM';
        else                                   option.moneyness = 'Deep OTM';
    }

    updateOptionInputs(id);
    syncOptionsToWindow();
}

function updateOptionInputs(id) {
    const option = _options.find(o => o.id === id);
    if (!option) return;
    const inputs = {
        strike: option.strike, premium: option.premium.toFixed(2),
        theta:  option.theta.toFixed(2),  delta: option.delta.toFixed(4),
        gamma:  option.gamma.toFixed(6),  vega:  option.vega.toFixed(2),
        rho:    option.rho.toFixed(2),    iv:    option.iv.toFixed(2),
        days:   option.days
    };
    Object.keys(inputs).forEach(field => {
        const input = document.querySelector(`.${field}-input[data-id="${id}"]`);
        if (input && input.value !== String(inputs[field])) input.value = inputs[field];
    });
    const row = document.querySelector(`.strike-input[data-id="${id}"]`)?.closest('tr');
    if (row) {
        const moneynessEl = row.querySelector('small.text-muted');
        if (moneynessEl) moneynessEl.textContent = option.moneyness;
    }
    updatePriceDifference(id);
}

function updateSingleOption(id) {
    const option = _options.find(o => o.id === id);
    if (!option) return;
    ['strike','premium','theta','delta','gamma','vega','rho','iv','days'].forEach(field => {
        const input = document.querySelector(`.${field}-input[data-id="${id}"]`);
        if (input && !isNaN(parseFloat(input.value))) {
            option[field] = field === 'days' ? parseInt(input.value) : parseFloat(input.value);
        }
    });
    recalculateBSM(id);
    updateAllCalculations();
    syncOptionsToWindow();
    showNotification(`Option ${id} updated`);
}

function updateOptionField(id, field, value) {
    const option = _options.find(o => o.id === id);
    if (!option) return;
    if (field === 'days') {
        option[field] = parseInt(value)   || option[field];
    } else if (['strike','premium','theta','delta','gamma','vega','rho','iv'].includes(field)) {
        option[field] = parseFloat(value) || option[field];
    }
}

// ============================================================================
// COLLAPSIBLE SECTIONS
// ============================================================================
function initializeCollapsibleSections() {
    const volSurfaceBtn = document.querySelector('[data-bs-target="#volSurfaceCollapse"]');
    const bsmInfoBtn    = document.querySelector('[data-bs-target="#bsmInfoCollapse"]');

    [volSurfaceBtn, bsmInfoBtn].forEach(btn => {
        if (!btn) return;
        btn.addEventListener('click', function () {
            setTimeout(() => {
                const targetId = this.getAttribute('data-bs-target').slice(1);
                const section  = document.getElementById(targetId);
                const chevron  = this.querySelector('.bi-chevron-down, .bi-chevron-up');
                if (section && chevron) {
                    if (section.classList.contains('show')) {
                        chevron.classList.replace('bi-chevron-down', 'bi-chevron-up');
                    } else {
                        chevron.classList.replace('bi-chevron-up', 'bi-chevron-down');
                    }
                }
            }, 10);
        });
    });
}

// ============================================================================
// PRESETS & QUICK ACTIONS
// ============================================================================
function loadPreset(presetName) {
    switch(presetName) {
        case 'nifty_atm':
            document.getElementById('spotPrice').value   = 17450;
            document.getElementById('impliedVol').value  = 15;
            document.getElementById('daysToExpiry').value= 30;
            document.getElementById('riskFreeRate').value= 6.5;
            document.getElementById('dividendYield').value=0;
            _options.length = 0;
            addCallOption(); addPutOption();
            showNotification('NIFTY ATM preset loaded!'); break;
        case 'banknifty_weekly':
            document.getElementById('underlyingSelect').value = 'BANKNIFTY';
            document.getElementById('spotPrice').value   = 42000;
            document.getElementById('impliedVol').value  = 18;
            document.getElementById('daysToExpiry').value= 7;
            document.getElementById('riskFreeRate').value= 6.5;
            _options.length = 0;
            addCallOption(); addPutOption();
            showNotification('BANKNIFTY Weekly preset loaded!'); break;
        case 'straddle':
            _options.length = 0;
            addCallOption(); addPutOption();
            showNotification('ATM Straddle preset loaded!'); break;
    }
    syncOptionsToWindow();
    updateAllCalculations();
}

function setATM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    if (_options.length === 0) { addCallOption(); addPutOption(); }
    else { _options.forEach(o => { o.strike = spot; o.moneyness = 'ATM'; }); }
    updateOptionsTable(); updateAllCalculations(); syncOptionsToWindow();
    showNotification('All strikes set to At The Money');
}

function setITM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    _options.forEach(o => {
        o.strike    = o.type === 'CALL' ? spot * 0.98 : spot * 1.02;
        o.moneyness = 'ITM';
    });
    updateOptionsTable(); updateAllCalculations(); syncOptionsToWindow();
    showNotification('All strikes set to In The Money');
}

function setOTM() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    _options.forEach(o => {
        o.strike    = o.type === 'CALL' ? spot * 1.02 : spot * 0.98;
        o.moneyness = 'OTM';
    });
    updateOptionsTable(); updateAllCalculations(); syncOptionsToWindow();
    showNotification('All strikes set to Out of The Money');
}

function resetAll() {
    if (!confirm('Reset all options and settings?')) return;
    document.getElementById('spotPrice').value    = 17450;
    document.getElementById('impliedVol').value   = 15;
    document.getElementById('daysToExpiry').value = 30;
    document.getElementById('riskFreeRate').value = 6.5;
    document.getElementById('dividendYield').value= 0;
    document.getElementById('volatilitySkew').value  = -0.002;
    document.getElementById('volatilitySmile').value = 0.0001;
    document.getElementById('termStructure').value   = 'normal';
    _options.length = 0;
    updateOptionsTable(); updateAllCalculations(); syncOptionsToWindow();
    if (erosionChart) erosionChart.destroy();
    if (plChart)      plChart.destroy();
    showNotification('All options and settings reset');
}

function addPair() { addCallOption(); addPutOption(); showNotification('ATM Straddle pair added'); }

function setDaysToExpiry(days) {
    document.getElementById('daysToExpiry').value = days;
    _options.forEach(o => o.days = days);
    updateAllCalculations(); syncOptionsToWindow();
    showNotification(`Days to expiry set to ${days}`);
}

function adjustSpot(amount) {
    const el = document.getElementById('spotPrice');
    el.value = parseFloat(el.value) + amount;
    el.dispatchEvent(new Event('change'));
}

function adjustDays(amount) {
    const el = document.getElementById('daysToExpiry');
    el.value = Math.max(1, parseInt(el.value) + amount);
    el.dispatchEvent(new Event('change'));
}

function updateUnderlying() {
    const underlying = document.getElementById('underlyingSelect').value;
    const priceMap   = { NIFTY:17450,BANKNIFTY:42000,FINNIFTY:19500,SENSEX:72000,RELIANCE:2500,TCS:3800,INFY:1500,HDFCBANK:1650 };
    document.getElementById('spotPrice').value = priceMap[underlying] || 17450;
    updateAllCalculations(); syncOptionsToWindow();
    showNotification(`Underlying updated to ${underlying}`);
}

function toggleView(viewType) {
    document.querySelectorAll('[onclick^="toggleView"]').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[onclick="toggleView('${viewType}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    const advancedSettings = document.getElementById('advancedSettings');
    if (advancedSettings) {
        advancedSettings.style.display = viewType === 'simple' ? 'none' : 'block';
    }
    showNotification(`${viewType.charAt(0).toUpperCase() + viewType.slice(1)} view activated`);
}

function calculateAll() {
    _options.forEach(o => recalculateBSM(o.id));
    updateAllCalculations(); calculatePL(); syncOptionsToWindow();
    showNotification('All calculations completed');
}

function cloneOption(id) {
    const orig = _options.find(o => o.id === id);
    if (!orig) return;
    _options.push({
        ...orig,
        id: Math.max(..._options.map(o => o.id)) + 1,
        strike: orig.strike + (orig.type === 'CALL' ? 100 : -100)
    });
    updateOptionsTable(); updateAllCalculations(); syncOptionsToWindow();
    showNotification(`Option ${id} cloned`);
}

function deleteOption(id) {
    const idx = _options.findIndex(o => o.id === id);
    if (idx === -1) return;
    if (confirm(`Delete ${_options[idx].type} option?`)) {
        _options.splice(idx, 1);
        updateOptionsTable(); updateAllCalculations(); syncOptionsToWindow();
        showNotification(`Option ${id} deleted`);
    }
}

function clearAllOptions() {
    if (_options.length === 0) { showNotification('No options to clear'); return; }
    if (confirm(`Clear all ${_options.length} options?`)) {
        _options.length = 0;
        updateOptionsTable(); updateAllCalculations(); syncOptionsToWindow();
        showNotification('All options cleared');
    }
}

function toggleAutoCalculate() {
    autoCalculate = !autoCalculate;
    const checkbox = document.getElementById('autoCalculate');
    const label    = checkbox.nextElementSibling;
    if (autoCalculate) {
        label.innerHTML = '<i class="bi bi-lightning-charge"></i> Auto-calc <span class="badge bg-success">ON</span>';
        showNotification('Auto-calculate: ON');
    } else {
        label.innerHTML = '<i class="bi bi-lightning-charge"></i> Auto-calc <span class="badge bg-secondary">OFF</span>';
        showNotification('Auto-calculate: OFF');
    }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = `
        position:fixed;top:20px;right:80px;z-index:9999;
        min-width:260px;max-width:380px;
        font-family:'Space Mono',monospace;font-size:0.72rem;
        box-shadow:0 4px 16px rgba(0,0,0,0.25);
        border-radius:2px;
    `;
    notification.innerHTML = `${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
    document.body.appendChild(notification);
    setTimeout(() => { if (notification.parentNode) notification.parentNode.removeChild(notification); }, 3000);
}

// ============================================================================
// OPTION CREATION
// ============================================================================
function addCallOption() {
    const spot  = parseFloat(document.getElementById('spotPrice').value);
    const days  = parseInt(document.getElementById('daysToExpiry').value);
    const iv    = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r     = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const greeks = BlackScholesPricing.calculateGreeks('CALL', spot, spot, days/365, r, iv);
    addOption({ type:'CALL', strike:spot, premium:greeks.price,
        theta:greeks.theta, delta:greeks.delta, gamma:greeks.gamma, vega:greeks.vega,
        rho:greeks.rho, days, moneyness:'ATM', intrinsic:greeks.intrinsic,
        extrinsic:greeks.extrinsic, iv: iv * 100 });
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

function addPutOption() {
    const spot  = parseFloat(document.getElementById('spotPrice').value);
    const days  = parseInt(document.getElementById('daysToExpiry').value);
    const iv    = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r     = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const greeks = BlackScholesPricing.calculateGreeks('PUT', spot, spot, days/365, r, iv);
    addOption({ type:'PUT', strike:spot, premium:greeks.price,
        theta:greeks.theta, delta:greeks.delta, gamma:greeks.gamma, vega:greeks.vega,
        rho:greeks.rho, days, moneyness:'ATM', intrinsic:greeks.intrinsic,
        extrinsic:greeks.extrinsic, iv: iv * 100 });
    updateOptionsTable();
    if (autoCalculate) updateAllCalculations();
}

// ============================================================================
// CALCULATION ENGINE
// ─── CHANGED: totalGamma + totalVega now rendered in the metrics strip ───────
// ============================================================================
function updateAllCalculations() {
    if (_options.length === 0) return;
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv   = parseFloat(document.getElementById('impliedVol').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;

    let totalTheta = 0, totalWeeklyErosion = 0;
    let totalVegaImpact = 0, totalDelta = 0, totalGamma = 0, totalRho = 0;
    let totalExtrinsic = 0, totalIntrinsic = 0;
    let atmCall = null, atmPut = null;

    _options.forEach(option => {
        totalTheta         += option.theta;
        totalWeeklyErosion += option.theta * 7;
        totalVegaImpact    += option.vega;
        totalDelta         += option.delta;
        totalGamma         += option.gamma;
        totalRho           += option.rho;
        totalExtrinsic     += option.extrinsic;
        totalIntrinsic     += option.intrinsic;

        if (option.moneyness === 'ATM') {
            if (option.type === 'CALL') atmCall = option;
            if (option.type === 'PUT')  atmPut  = option;
        }
    });

    // ── Theta
    if (document.getElementById('totalTheta'))
        document.getElementById('totalTheta').textContent = `-₹${Math.abs(totalTheta).toFixed(2)}`;

    // ── Weekly Erosion
    if (document.getElementById('totalWeeklyErosion'))
        document.getElementById('totalWeeklyErosion').textContent = `-₹${Math.abs(totalWeeklyErosion).toFixed(2)}`;

    // ── Gamma (Γ) — NEW DISPLAY
    if (document.getElementById('totalGamma'))
        document.getElementById('totalGamma').textContent = totalGamma.toFixed(6);

    // ── Vega (ν) — NEW DISPLAY
    if (document.getElementById('totalVega'))
        document.getElementById('totalVega').textContent = `₹${totalVegaImpact.toFixed(2)}`;

    // ── Extrinsic
    if (document.getElementById('totalExtrinsic'))
        document.getElementById('totalExtrinsic').textContent = `₹${totalExtrinsic.toFixed(2)}`;

    // ── Intrinsic
    if (document.getElementById('totalIntrinsic'))
        document.getElementById('totalIntrinsic').textContent = `₹${totalIntrinsic.toFixed(2)}`;

    // ── Net Delta
    if (document.getElementById('totalDelta'))
        document.getElementById('totalDelta').textContent = totalDelta.toFixed(4);

    // ── Put-Call Parity
    if (atmCall && atmPut) {
        const parity = BlackScholesPricing.checkPutCallParity(
            atmCall.premium, atmPut.premium, spot, atmCall.strike, days/365, r);
        const parityElem = document.getElementById('putCallParity');
        if (parityElem) {
            parityElem.innerHTML = parity.valid
                ? `<span class="badge bg-success">Parity ✓</span>`
                : `<span class="badge bg-warning">₹${parity.discrepancy} off</span>`;
        }
    }

    lastCalculationTime = new Date();
    if (document.getElementById('lastUpdate')) {
        document.getElementById('lastUpdate').textContent =
            `Last: ${lastCalculationTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    }

    updateErosionChart();
    syncOptionsToWindow();
}

// ============================================================================
// P&L ENGINE
// ============================================================================
function calculatePL() {
    const spot          = parseFloat(document.getElementById('spotPrice').value);
    const rangePercent  = parseFloat(document.getElementById('plPriceRange').value) / 100;
    const steps         = parseInt(document.getElementById('plPriceSteps').value);
    const includePremium= document.getElementById('plIncludePremium').checked;
    const useBSMpricing = document.getElementById('plBSMpricing').checked;

    const minPrice  = spot * (1 - rangePercent);
    const maxPrice  = spot * (1 + rangePercent);
    const priceStep = (maxPrice - minPrice) / steps;

    const priceLevels = Array.from({length: steps + 1}, (_, i) => minPrice + i * priceStep);

    const plData = priceLevels.map(price => {
        let callPL = 0, putPL = 0, netPL = 0, extrinsicValue = 0;
        _options.forEach(option => {
            const T  = option.days / 365;
            const iv = option.iv / 100;
            const r  = parseFloat(document.getElementById('riskFreeRate').value) / 100;
            let optionPL = 0;
            if (useBSMpricing && T > 0) {
                const greeks = BlackScholesPricing.calculateGreeks(option.type, price, option.strike, T, r, iv);
                optionPL = greeks.price;
                extrinsicValue += greeks.extrinsic;
            } else {
                optionPL = option.type === 'CALL'
                    ? Math.max(price - option.strike, 0) : Math.max(option.strike - price, 0);
            }
            if (includePremium) optionPL -= option.premium;
            if (option.type === 'CALL') callPL += optionPL; else putPL += optionPL;
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
    const ctx    = document.getElementById('plChart').getContext('2d');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(52,58,64,0.3)' : 'rgba(233,236,239,0.8)';
    const textColor = isDark ? '#9aa3b0' : '#495057';

    if (!priceLevels || !plData) {
        priceLevels = Array.from({length: 20}, (_, i) => 17000 + i * 50);
        plData = priceLevels.map(price => ({
            price, callPL: Math.sin(price/1000)*100,
            putPL: Math.cos(price/1000)*100,
            netPL: Math.sin(price/1000)*100 + Math.cos(price/1000)*100,
            extrinsic: 50
        }));
    }

    if (plChart) plChart.destroy();

    plChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: priceLevels.map(p => `₹${p.toFixed(0)}`),
            datasets: [
                { label: 'Net P&L',  data: plData.map(d => d.netPL),
                  borderColor: '#f0a500', backgroundColor: 'rgba(240,165,0,0.08)',
                  borderWidth: 2.5, tension: 0.3, fill: true, yAxisID: 'y' },
                { label: 'Call P&L', data: plData.map(d => d.callPL),
                  borderColor: '#3b9eff', backgroundColor: 'transparent',
                  borderWidth: 1.5, borderDash: [5,5], tension: 0.3, fill: false, yAxisID: 'y' },
                { label: 'Put P&L',  data: plData.map(d => d.putPL),
                  borderColor: '#ff5c5c', backgroundColor: 'transparent',
                  borderWidth: 1.5, borderDash: [5,5], tension: 0.3, fill: false, yAxisID: 'y' },
                { label: 'Breakeven',data: priceLevels.map(() => 0),
                  borderColor: '#4f5a6a', backgroundColor: 'transparent',
                  borderWidth: 1, borderDash: [3,3], pointRadius: 0, fill: false, yAxisID: 'y' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { color: textColor, font: { family: 'Space Mono', size: 10 }, boxWidth: 12 } },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(24,28,34,0.95)' : 'rgba(255,255,255,0.95)',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: isDark ? '#252932' : '#dee2e6',
                    borderWidth: 1,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label || ''}: ₹${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Underlying Price (₹)', color: textColor },
                    grid:  { color: gridColor }, ticks: { color: textColor, font: { family: 'Space Mono', size: 9 } }
                },
                y: {
                    type: 'linear', display: true, position: 'left',
                    title: { display: true, text: 'P&L (₹)', color: textColor },
                    grid:  { color: gridColor }, ticks: { color: textColor, font: { family: 'Space Mono', size: 9 },
                        callback: v => `₹${v.toFixed(0)}` }
                }
            }
        }
    });
    window.plChart = plChart;
}

function updatePLTable(plData) {
    const tbody = document.querySelector('#plDetailedTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const keyPercentages = [0, -0.05, -0.10, -0.15, -0.20, 0.05, 0.10, 0.15, 0.20];

    keyPercentages.forEach(percent => {
        const price = spot * (1 + percent);
        const closest = plData.reduce((prev, curr) =>
            Math.abs(curr.price - price) < Math.abs(prev.price - price) ? curr : prev);

        let status = '', statusClass = '';
        const tolerance = 0.01;
        if (Math.abs(closest.netPL) <= tolerance) {
            status = '<span class="badge bg-warning">B/E</span>'; statusClass = 'table-warning';
        } else if (closest.netPL > 0) {
            status = `<span class="badge bg-success">${percent===0?'Current Profit':'Profit'}</span>`;
            statusClass = 'table-success';
        } else {
            status = `<span class="badge bg-danger">${percent===0?'Current Loss':'Loss'}</span>`;
            statusClass = 'table-danger';
        }
        if (percent === 0) statusClass += ' current-spot-row';

        const row = document.createElement('tr');
        row.className = statusClass;
        row.innerHTML = `
            <td>₹${closest.price.toFixed(2)} ${percent===0?'<i class="bi bi-geo-alt"></i>':''}</td>
            <td>₹${closest.callPL.toFixed(2)}</td>
            <td>₹${closest.putPL.toFixed(2)}</td>
            <td>₹${closest.netPL.toFixed(2)}</td>
            <td>₹${closest.extrinsic.toFixed(2)}</td>
            <td>${status}</td>
        `;
        tbody.appendChild(row);
    });
}

function calculatePLStatistics(plData) {
    if (!plData || !plData.length) return;
    let maxProfit = -Infinity, maxLoss = Infinity;
    let breakevenUpper = null, breakevenLower = null;
    const spot = parseFloat(document.getElementById('spotPrice').value);

    plData.forEach(data => {
        if (data.netPL > maxProfit) maxProfit = data.netPL;
        if (data.netPL < maxLoss)   maxLoss   = data.netPL;
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

// ============================================================================
// EROSION CHART
// ============================================================================
function updateErosionChart() {
    const ctx    = document.getElementById('erosionChart').getContext('2d');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(52,58,64,0.3)' : 'rgba(233,236,239,0.8)';
    const textColor = isDark ? '#9aa3b0' : '#495057';

    const spot = parseFloat(document.getElementById('spotPrice').value);
    const iv   = parseFloat(document.getElementById('impliedVol').value) / 100;
    const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const projectionDays = Math.min(
        Math.max(..._options.map(o => o.days), 30), 90);

    if (erosionChart) erosionChart.destroy();

    const labels = [], callData = [], putData = [];

    for (let day = 0; day <= projectionDays; day++) {
        labels.push(`D${day}`);
        let callPremium = 0, putPremium = 0;
        _options.forEach(option => {
            if (day <= option.days) {
                const remainingDays = option.days - day;
                const T = remainingDays / 365;
                if (T > 0) {
                    const g = BlackScholesPricing.calculateGreeks(option.type, spot, option.strike, T, r, iv);
                    if (option.type === 'CALL') callPremium += g.price;
                    else                        putPremium  += g.price;
                } else {
                    if (option.type === 'CALL') callPremium += Math.max(spot - option.strike, 0);
                    else                        putPremium  += Math.max(option.strike - spot, 0);
                }
            }
        });
        callData.push(callPremium);
        putData.push(putPremium);
    }

    erosionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: 'Call Premium (BSM)', data: callData,
                  borderColor: '#3b9eff', backgroundColor: 'rgba(59,158,255,0.08)',
                  borderWidth: 2, tension: 0.4, fill: true },
                { label: 'Put Premium (BSM)',  data: putData,
                  borderColor: '#ff5c5c', backgroundColor: 'rgba(255,92,92,0.08)',
                  borderWidth: 2, tension: 0.4, fill: true }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: textColor, font: { family: 'Space Mono', size: 10 }, boxWidth: 12 } },
                tooltip: {
                    mode: 'index', intersect: false,
                    backgroundColor: isDark ? 'rgba(24,28,34,0.95)' : 'rgba(255,255,255,0.95)',
                    titleColor: textColor, bodyColor: textColor,
                    borderColor: isDark ? '#252932' : '#dee2e6', borderWidth: 1,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ₹${ctx.raw.toFixed(2)}` }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Days Elapsed', color: textColor },
                     grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Space Mono', size: 9 }, maxTicksLimit: 15 } },
                y: { title: { display: true, text: 'Premium (₹)', color: textColor }, beginAtZero: true,
                     grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Space Mono', size: 9 },
                         callback: v => `₹${v.toFixed(0)}` } }
            }
        }
    });
    window.erosionChart = erosionChart;
}

// ============================================================================
// BSM SPECIALIZED FUNCTIONS
// ============================================================================
function calculateImpliedVolatility() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    _options.forEach(option => {
        const T = option.days / 365;
        if (T > 0) {
            const iv = BlackScholesPricing.calculateImpliedVol(option.type, spot, option.strike, T, r, option.premium);
            option.iv = iv * 100;
        }
    });
    updateOptionsTable(); syncOptionsToWindow();
    showNotification('Implied volatility calculated for all options');
}

function validatePutCallParity() {
    const spot = parseFloat(document.getElementById('spotPrice').value);
    const r    = parseFloat(document.getElementById('riskFreeRate').value) / 100;
    const days = parseInt(document.getElementById('daysToExpiry').value);
    const pairs = [];

    _options.forEach(call => {
        if (call.type !== 'CALL') return;
        const matchingPut = _options.find(p => p.type === 'PUT' && p.strike === call.strike && p.days === call.days);
        if (matchingPut) {
            const parity = BlackScholesPricing.checkPutCallParity(
                call.premium, matchingPut.premium, spot, call.strike, days/365, r);
            pairs.push({ strike: call.strike, callPrice: call.premium, putPrice: matchingPut.premium, parity });
        }
    });

    let message = 'PUT-CALL PARITY ANALYSIS\n\n';
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
    const skew   = parseFloat(document.getElementById('volatilitySkew').value)  || -0.002;
    const smile  = parseFloat(document.getElementById('volatilitySmile').value) || 0.0001;
    const spot   = parseFloat(document.getElementById('spotPrice').value);

    volSurface.updateFromMarket(atmVol, skew, smile);
    _options.forEach(option => {
        const moneyness = (option.strike - spot) / spot;
        option.iv = volSurface.getVolatility(moneyness, option.days) * 100;
    });
    updateAllCalculations(); syncOptionsToWindow();
    alert(`Volatility surface updated:\nATM: ${(atmVol*100).toFixed(2)}%\nSkew: ${skew}\nSmile: ${smile}`);
}

// ============================================================================
// EXPORT
// ============================================================================
function exportToCSV() {
    let csv = 'Type,Strike,Premium,Theta,Delta,Gamma,Vega,Rho,Days,Moneyness,IV%,Intrinsic,Extrinsic,Theoretical,D1,D2,Model\n';
    _options.forEach(o => {
        csv += `${o.type},${o.strike},${o.premium},${o.theta},${o.delta},${o.gamma},${o.vega},${o.rho},${o.days},${o.moneyness},${o.iv},${o.intrinsic},${o.extrinsic},${o.theoreticalPrice},${o.d1},${o.d2},${o.model}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = window.URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `options_bsm_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    showNotification('CSV exported with BSM data!');
}

// ============================================================================
// BSM UI HELPERS
// ============================================================================
function addBSMFeaturesToUI() {
    const header = document.querySelector('header h1');
    if (header && !document.getElementById('headerBsmBadge')) {
        const badge = document.createElement('span');
        badge.id = 'headerBsmBadge';
        badge.className = 'badge bg-info ms-2';
        badge.style.fontSize = '0.6rem';
        badge.textContent = 'BSM v4.0';
        header.appendChild(badge);
    }
}

function showShortcuts() {
    alert(`ACTIVE TRADER PRO v4.0 — BSM EDITION

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
Alt+T: Toggle Dark/Light Theme

↑↓: Adjust spot price (±10)
←→: Adjust days to expiry (±1)
+/-: Quick adjust focused input

GREEKS DISPLAYED:
  θ Theta  — daily premium decay
  Δ Delta  — directional exposure
  Γ Gamma  — delta rate of change  ← NEW in metrics strip
  ν Vega   — IV sensitivity        ← NEW in metrics strip
  ρ Rho    — rate sensitivity

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
            case 't': toggleTheme(); break;
            case '1': if (_options.length > 0) recalculateBSM(_options[0].id); break;
            case '2': if (_options.length > 1) recalculateBSM(_options[1].id); break;
        }
    }
    switch(e.key) {
        case 'F1': e.preventDefault(); loadPreset('nifty_atm'); break;
        case 'F2': e.preventDefault(); loadPreset('banknifty_weekly'); break;
        case 'F3': e.preventDefault(); toggleView('advanced'); break;
        case 'F4': e.preventDefault(); toggleView('pro'); break;
        case 'F5': e.preventDefault(); _options.forEach(o => recalculateBSM(o.id)); updateAllCalculations(); break;
    }
    if (!e.altKey && !e.ctrlKey && !e.shiftKey && e.target.tagName !== 'INPUT') {
        switch(e.key) {
            case 'ArrowUp':    e.preventDefault(); adjustSpot(10); break;
            case 'ArrowDown':  e.preventDefault(); adjustSpot(-10); break;
            case 'ArrowRight': e.preventDefault(); adjustDays(1); break;
            case 'ArrowLeft':  e.preventDefault(); adjustDays(-1); break;
        }
    }
    if (e.target.tagName === 'INPUT' && (e.key === '+' || e.key === '-')) {
        e.preventDefault();
        const current = parseFloat(e.target.value) || 0;
        const step    = parseFloat(e.target.step) || 1;
        e.target.value = e.key === '+' ? current + step : current - step;
        e.target.dispatchEvent(new Event('change'));
    }
});

// ============================================================================
// INITIALIZATION
// ============================================================================
function initializeCharts() { updateErosionChart(); updatePLChart(); }

document.addEventListener('DOMContentLoaded', function() {
    var tooltipEls = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipEls.map(el => new bootstrap.Tooltip(el));

    initializeTheme();

    const themeToggleBtn = document.getElementById('themeToggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
        new bootstrap.Tooltip(themeToggleBtn, { placement: 'left', title: 'Toggle theme (Alt+T)' });
    }

    initializeCollapsibleSections();

    setTimeout(() => {
        addBSMFeaturesToUI();
        initializeDefaultOptions();
        initializeCharts();
    }, 100);

    setTimeout(() => {
        console.log('%c⚡ BSM Options Calculator v4.0 Loaded', 'color:#f0a500;font-weight:bold;font-size:16px;');
        console.log('%cΓ Gamma + ν Vega now displayed in metrics strip', 'color:#a78bfa;');
        console.log('%cBlack-Scholes-Merton | Tooltip syntax fixed', 'color:#2ecc71;');
    }, 500);
});