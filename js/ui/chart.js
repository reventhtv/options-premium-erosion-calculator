// ui/chart.js
import { formatCurrency } from '../utils/currency.js';

let chart = null;

export function initChart(ctx) {
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                { label: 'Call', data: [], borderColor: '#28a745' },
                { label: 'Put', data: [], borderColor: '#dc3545' }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    ticks: {
                        callback: v => formatCurrency(v, true)
                    }
                }
            }
        }
    });
}

export function updateChart(labels, callData, putData) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = callData;
    chart.data.datasets[1].data = putData;
    chart.update();
}
