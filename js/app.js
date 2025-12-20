import { calculateErosion } from './core/erosionEngine.js';
import { getMoneyness } from './core/moneyness.js';
import { formatCurrency } from './utils/currency.js';
import { getConfidenceBand } from './core/confidenceEngine.js';

function read(type) {
    return {
        strike: +document.getElementById(`${type}Strike`).value,
        premium: +document.getElementById(`${type}Premium`).value,
        theta: +document.getElementById(`${type}Theta`).value,
        gamma: +document.getElementById(`${type}Gamma`).value,
        delta: +document.getElementById(`${type}Delta`).value,
        vega: +document.getElementById(`${type}Vega`).value,
        daysToExpiry: +document.getElementById(`${type}DaysToExpiry`).value,
        spot: +spotPrice.value,
        useNonLinear: true,
        thetaAcceleration: 1.2,
        volatilityChange: 0
    };
}

function render(type, result, m) {
    const input = read(type);

    document.getElementById(`${type}DailyErosion`).textContent =
        formatCurrency(input.theta);

    document.getElementById(`${type}WeeklyErosion`).textContent =
        formatCurrency(input.theta * 7);

    document.getElementById(`${type}PremiumExpiry`).textContent =
        formatCurrency(result.premiumAtExpiry);

    document.getElementById(`${type}TotalErosion`).textContent =
        formatCurrency(result.totalErosion);

    const badge = document.getElementById(`${type}Moneyness`);
    badge.textContent = m.moneyness;
    badge.className = `moneyness-badge badge-${m.moneyness.toLowerCase()}`;

    // 🔥 CONFIDENCE BAND
    const confidence = getConfidenceBand(input.premium, input.theta);
    const confidenceEl = document.getElementById(`${type}Confidence`);
    confidenceEl.textContent = confidence.label;
    confidenceEl.className = confidence.className;

    document.getElementById(`${type}Results`).classList.remove('d-none');
}

export function calculateCall() {
    const input = read('call');
    const m = getMoneyness(input.strike, input.spot, true);
    const result = calculateErosion({ ...input, isATM: m.moneyness === 'ATM' });
    render('call', result, m);
}

export function calculatePut() {
    const input = read('put');
    const m = getMoneyness(input.strike, input.spot, false);
    const result = calculateErosion({ ...input, isATM: m.moneyness === 'ATM' });
    render('put', result, m);
}

export function calculateBoth() {
    calculateCall();
    calculatePut();
}

export function resetAll() {
    location.reload();
}

export function exportCSV() {
    alert('CSV export will be enabled in next phase');
}
