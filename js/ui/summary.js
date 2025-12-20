// ui/summary.js
import { formatCurrency } from '../utils/currency.js';

export function updateSummary(callTheta, putTheta, callTotal, putTotal) {
    document.getElementById('summaryCallTheta').textContent = formatCurrency(callTheta);
    document.getElementById('summaryPutTheta').textContent = formatCurrency(putTheta);
    document.getElementById('summaryCallTotal').textContent = formatCurrency(callTotal);
    document.getElementById('summaryPutTotal').textContent = formatCurrency(putTotal);
}
