// ==========================================================================
// Option Premium Erosion Calculator - Main JavaScript
// ==========================================================================

// Global variables
let erosionChart = null;
let appStartTime = Date.now();
let calculationHistory = [];

// ==========================================================================
// DOM Content Loaded - Initialize Application
// ==========================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Options Premium Erosion Calculator loading...');
    
    // Initialize tooltips
    initTooltips();
    
    // Initialize chart
    initChart();
    
    // Load saved data from localStorage
    loadSavedInputs();
    
    // Load calculation history
    loadCalculationHistory();
    
    // Add event listeners
    setupEventListeners();
    
    // Update summary display
    updateSummaryDisplay();
    
    // Application loaded
    const loadTime = Date.now() - appStartTime;
    console.log(`Calculator loaded in ${loadTime}ms`);
    trackEvent('app_loaded', { load_time: loadTime });
});

// ==========================================================================
// Core Functions
// ==========================================================================

/**
 * Initialize Bootstrap tooltips
 */
function initTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function(tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl, {
            trigger: 'hover focus'
        });
    });
}

/**
 * Initialize Chart.js chart
 */
function initChart() {
    const ctx = document.getElementById('erosionChart');
    if (!ctx) return;
    
    try {
        erosionChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Call Option Premium',
                        data: [],
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#28a745',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Put Option Premium',
                        data: [],
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#dc3545',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Premium Erosion Over Time',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        padding: {
                            top: 10,
                            bottom: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: $${context.raw.toFixed(2)}`;
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Days to Expiry',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        reverse: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Option Premium ($)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
        console.log('Chart initialized successfully');
    } catch (error) {
        console.error('Error initializing chart:', error);
        displayError('Could not initialize chart. Please refresh the page.');
    }
}

/**
 * Calculate Call Option Premium Erosion
 */
function calculateCallPremiumErosion() {
    try {
        // Get input values
        const strike = parseFloat(document.getElementById('callStrike').value) || 100;
        const premium = parseFloat(document.getElementById('callPremium').value) || 5.50;
        const theta = parseFloat(document.getElementById('callTheta').value) || -0.05;
        const gamma = parseFloat(document.getElementById('callGamma').value) || 0.02;
        const delta = parseFloat(document.getElementById('callDelta').value) || 0.55;
        const vega = parseFloat(document.getElementById('callVega').value) || 0.12;
        const daysToExpiry = parseInt(document.getElementById('callDaysToExpiry').value) || 30;
        
        // Validate inputs
        if (isNaN(premium) || premium < 0) {
            throw new Error('Invalid premium value');
        }
        if (isNaN(theta)) {
            throw new Error('Invalid theta value');
        }
        if (isNaN(daysToExpiry) || daysToExpiry < 1 || daysToExpiry > 365) {
            throw new Error('Days to expiry must be between 1 and 365');
        }
        
        // Calculate erosions
        const dailyErosion = theta;
        const weeklyErosion = theta * 7;
        
        // Apply theta acceleration for total erosion
        const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
        const volatilityChange = parseFloat(document.getElementById('volatilityChange').value) || 0;
        
        // Adjust theta based on gamma and volatility (simplified)
        let effectiveTheta = theta;
        if (gamma > 0 && volatilityChange !== 0) {
            effectiveTheta *= (1 + (volatilityChange / 100) * gamma * 10);
        }
        effectiveTheta *= thetaAcceleration;
        
        // Calculate total erosion with acceleration
        let totalErosion = 0;
        for (let day = 1; day <= daysToExpiry; day++) {
            const dailyAcceleration = 1 + (day / daysToExpiry) * (thetaAcceleration - 1);
            totalErosion += theta * dailyAcceleration;
        }
        
        // Apply volatility impact through vega
        if (vega > 0 && volatilityChange !== 0) {
            const vegaImpact = vega * (volatilityChange / 100) * Math.sqrt(daysToExpiry / 365);
            totalErosion += vegaImpact;
        }
        
        // Ensure erosion doesn't exceed premium (options can't go negative)
        const safeTotalErosion = Math.min(Math.abs(totalErosion), premium) * Math.sign(totalErosion);
        const premiumAtExpiry = Math.max(0, premium + safeTotalErosion);
        const premiumInWeek = Math.max(0, premium + weeklyErosion);
        
        // Update UI
        document.getElementById('callDailyErosion').textContent = formatCurrency(dailyErosion);
        document.getElementById('callWeeklyErosion').textContent = formatCurrency(weeklyErosion);
        document.getElementById('callPremiumWeek').textContent = formatCurrency(premiumInWeek);
        document.getElementById('callPremiumExpiry').textContent = formatCurrency(premiumAtExpiry);
        document.getElementById('callTotalErosion').textContent = formatCurrency(safeTotalErosion);
        
        // Show results section
        document.getElementById('callResults').style.display = 'block';
        
        // Add fade-in animation
        document.getElementById('callResults').classList.add('fade-in');
        
        // Update summary
        updateSummaryDisplay();
        
        // Save to history
        saveToHistory('call', {
            strike, premium, theta, gamma, delta, vega, daysToExpiry,
            dailyErosion, weeklyErosion, totalErosion: safeTotalErosion,
            premiumAtExpiry, premiumInWeek
        });
        
        // Track calculation
        trackEvent('calculate_call', {
            strike, premium, theta, daysToExpiry,
            totalErosion: safeTotalErosion
        });
        
        return {
            strike, premium, theta, gamma, delta, vega, daysToExpiry,
            dailyErosion, weeklyErosion, totalErosion: safeTotalErosion,
            premiumAtExpiry, premiumInWeek
        };
        
    } catch (error) {
        console.error('Error in call calculation:', error);
        displayError(`Call calculation error: ${error.message}`);
        return null;
    }
}

/**
 * Calculate Put Option Premium Erosion
 */
function calculatePutPremiumErosion() {
    try {
        // Get input values
        const strike = parseFloat(document.getElementById('putStrike').value) || 100;
        const premium = parseFloat(document.getElementById('putPremium').value) || 4.25;
        const theta = parseFloat(document.getElementById('putTheta').value) || -0.04;
        const gamma = parseFloat(document.getElementById('putGamma').value) || 0.018;
        const delta = parseFloat(document.getElementById('putDelta').value) || -0.45;
        const vega = parseFloat(document.getElementById('putVega').value) || 0.10;
        const daysToExpiry = parseInt(document.getElementById('putDaysToExpiry').value) || 30;
        
        // Validate inputs
        if (isNaN(premium) || premium < 0) {
            throw new Error('Invalid premium value');
        }
        if (isNaN(theta)) {
            throw new Error('Invalid theta value');
        }
        if (isNaN(daysToExpiry) || daysToExpiry < 1 || daysToExpiry > 365) {
            throw new Error('Days to expiry must be between 1 and 365');
        }
        
        // Calculate erosions
        const dailyErosion = theta;
        const weeklyErosion = theta * 7;
        
        // Apply theta acceleration for total erosion
        const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
        const volatilityChange = parseFloat(document.getElementById('volatilityChange').value) || 0;
        
        // Adjust theta based on gamma and volatility (simplified)
        let effectiveTheta = theta;
        if (gamma > 0 && volatilityChange !== 0) {
            effectiveTheta *= (1 + (volatilityChange / 100) * gamma * 10);
        }
        effectiveTheta *= thetaAcceleration;
        
        // Calculate total erosion with acceleration
        let totalErosion = 0;
        for (let day = 1; day <= daysToExpiry; day++) {
            const dailyAcceleration = 1 + (day / daysToExpiry) * (thetaAcceleration - 1);
            totalErosion += theta * dailyAcceleration;
        }
        
        // Apply volatility impact through vega
        if (vega > 0 && volatilityChange !== 0) {
            const vegaImpact = vega * (volatilityChange / 100) * Math.sqrt(daysToExpiry / 365);
            totalErosion += vegaImpact;
        }
        
        // Ensure erosion doesn't exceed premium
        const safeTotalErosion = Math.min(Math.abs(totalErosion), premium) * Math.sign(totalErosion);
        const premiumAtExpiry = Math.max(0, premium + safeTotalErosion);
        const premiumInWeek = Math.max(0, premium + weeklyErosion);
        
        // Update UI
        document.getElementById('putDailyErosion').textContent = formatCurrency(dailyErosion);
        document.getElementById('putWeeklyErosion').textContent = formatCurrency(weeklyErosion);
        document.getElementById('putPremiumWeek').textContent = formatCurrency(premiumInWeek);
        document.getElementById('putPremiumExpiry').textContent = formatCurrency(premiumAtExpiry);
        document.getElementById('putTotalErosion').textContent = formatCurrency(safeTotalErosion);
        
        // Show results section
        document.getElementById('putResults').style.display = 'block';
        
        // Add fade-in animation
        document.getElementById('putResults').classList.add('fade-in');
        
        // Update summary
        updateSummaryDisplay();
        
        // Save to history
        saveToHistory('put', {
            strike, premium, theta, gamma, delta, vega, daysToExpiry,
            dailyErosion, weeklyErosion, totalErosion: safeTotalErosion,
            premiumAtExpiry, premiumInWeek
        });
        
        // Track calculation
        trackEvent('calculate_put', {
            strike, premium, theta, daysToExpiry,
            totalErosion: safeTotalErosion
        });
        
        return {
            strike, premium, theta, gamma, delta, vega, daysToExpiry,
            dailyErosion, weeklyErosion, totalErosion: safeTotalErosion,
            premiumAtExpiry, premiumInWeek
        };
        
    } catch (error) {
        console.error('Error in put calculation:', error);
        displayError(`Put calculation error: ${error.message}`);
        return null;
    }
}

/**
 * Calculate Both Options and Update Chart
 */
function calculateBoth() {
    try {
        const callResult = calculateCallPremiumErosion();
        const putResult = calculatePutPremiumErosion();
        
        if (callResult && putResult) {
            // Calculate erosion ratio
            const callTheta = parseFloat(document.getElementById('callTheta').value) || -0.05;
            const putTheta = parseFloat(document.getElementById('putTheta').value) || -0.04;
            
            if (putTheta !== 0) {
                const ratio = Math.abs(callTheta / putTheta).toFixed(2);
                document.getElementById('erosionRatio').textContent = `Call:Put = ${ratio}:1`;
                document.getElementById('erosionRatio').classList.add('pulse');
                
                // Remove pulse animation after 3 seconds
                setTimeout(() => {
                    document.getElementById('erosionRatio').classList.remove('pulse');
                }, 3000);
            }
            
            // Update chart
            updateChart(callResult, putResult);
            
            // Track combined calculation
            trackEvent('calculate_both', {
                callErosion: callResult.totalErosion,
                putErosion: putResult.totalErosion,
                ratio: Math.abs(callResult.totalErosion / putResult.totalErosion).toFixed(2)
            });
        }
    } catch (error) {
        console.error('Error in combined calculation:', error);
        displayError('Error calculating both options');
    }
}

/**
 * Update the Erosion Chart
 */
function updateChart(callResult, putResult) {
    if (!erosionChart) {
        initChart();
        if (!erosionChart) return;
    }
    
    try {
        const projectionDays = parseInt(document.getElementById('projectionDays').value) || 30;
        const callPremium = parseFloat(document.getElementById('callPremium').value) || 5.50;
        const putPremium = parseFloat(document.getElementById('putPremium').value) || 4.25;
        const callTheta = parseFloat(document.getElementById('callTheta').value) || -0.05;
        const putTheta = parseFloat(document.getElementById('putTheta').value) || -0.04;
        const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
        const includeWeekends = document.getElementById('includeWeekends').checked;
        
        // Generate data points
        const labels = [];
        const callData = [];
        const putData = [];
        
        for (let day = 0; day <= projectionDays; day++) {
            labels.push(projectionDays - day);
            
            // Calculate call premium at this day
            let callDecay = 0;
            let daysCounted = 0;
            for (let d = 0; d < day; d++) {
                // Apply weekend adjustment
                if (includeWeekends && d % 7 >= 5) { // Saturday (5) and Sunday (6)
                    continue; // Skip weekend days for decay
                }
                
                // Apply acceleration (more decay as days pass)
                const acceleration = 1 + (d / projectionDays) * (thetaAcceleration - 1);
                callDecay += callTheta * acceleration;
                daysCounted++;
            }
            
            const currentCallPremium = Math.max(0, callPremium + callDecay);
            callData.push(currentCallPremium);
            
            // Calculate put premium at this day
            let putDecay = 0;
            daysCounted = 0;
            for (let d = 0; d < day; d++) {
                // Apply weekend adjustment
                if (includeWeekends && d % 7 >= 5) {
                    continue;
                }
                
                // Apply acceleration
                const acceleration = 1 + (d / projectionDays) * (thetaAcceleration - 1);
                putDecay += putTheta * acceleration;
                daysCounted++;
            }
            
            const currentPutPremium = Math.max(0, putPremium + putDecay);
            putData.push(currentPutPremium);
        }
        
        // Update chart
        erosionChart.data.labels = labels;
        erosionChart.data.datasets[0].data = callData;
        erosionChart.data.datasets[1].data = putData;
        erosionChart.update();
        
        console.log('Chart updated successfully');
        
    } catch (error) {
        console.error('Error updating chart:', error);
        displayError('Could not update chart. Please check your inputs.');
    }
}

/**
 * Update the Summary Display
 */
function updateSummaryDisplay() {
    try {
        const callTheta = parseFloat(document.getElementById('callTheta').value) || 0;
        const putTheta = parseFloat(document.getElementById('putTheta').value) || 0;
        const callWeekly = (callTheta * 7).toFixed(2);
        const putWeekly = (putTheta * 7).toFixed(2);
        
        // Get total erosions from results if available
        let callTotal = document.getElementById('callTotalErosion').textContent;
        let putTotal = document.getElementById('putTotalErosion').textContent;
        
        // If results aren't calculated yet, show placeholders
        if (!callTotal || callTotal === '-') {
            const callDays = parseInt(document.getElementById('callDaysToExpiry').value) || 30;
            const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
            callTotal = formatCurrency(callTheta * callDays * thetaAcceleration);
        }
        
        if (!putTotal || putTotal === '-') {
            const putDays = parseInt(document.getElementById('putDaysToExpiry').value) || 30;
            const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
            putTotal = formatCurrency(putTheta * putDays * thetaAcceleration);
        }
        
        // Update summary table
        document.getElementById('summaryCallTheta').textContent = formatCurrency(callTheta);
        document.getElementById('summaryPutTheta').textContent = formatCurrency(putTheta);
        document.getElementById('summaryCallWeekly').textContent = `$${callWeekly}`;
        document.getElementById('summaryPutWeekly').textContent = `$${putWeekly}`;
        document.getElementById('summaryCallTotal').textContent = callTotal;
        document.getElementById('summaryPutTotal').textContent = putTotal;
        
    } catch (error) {
        console.error('Error updating summary:', error);
    }
}

// ==========================================================================
// Utility Functions
// ==========================================================================

/**
 * Format currency value
 */
function formatCurrency(value) {
    if (isNaN(value)) return '$0.00';
    const formatted = Math.abs(value) < 0.01 ? value.toFixed(4) : value.toFixed(2);
    return `$${formatted}`;
}

/**
 * Display error message
 */
function displayError(message) {
    // Create error toast
    const toast = document.createElement('div');
    toast.className = 'alert alert-danger alert-dismissible fade show';
    toast.innerHTML = `
        <strong>Error:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Add to page
    const container = document.querySelector('.container-fluid');
    container.insertBefore(toast, container.firstChild);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 5000);
}

/**
 * Save inputs to localStorage
 */
function saveInputs() {
    try {
        const inputs = {
            callStrike: document.getElementById('callStrike').value,
            callPremium: document.getElementById('callPremium').value,
            callTheta: document.getElementById('callTheta').value,
            callGamma: document.getElementById('callGamma').value,
            callDelta: document.getElementById('callDelta').value,
            callVega: document.getElementById('callVega').value,
            callDaysToExpiry: document.getElementById('callDaysToExpiry').value,
            putStrike: document.getElementById('putStrike').value,
            putPremium: document.getElementById('putPremium').value,
            putTheta: document.getElementById('putTheta').value,
            putGamma: document.getElementById('putGamma').value,
            putDelta: document.getElementById('putDelta').value,
            putVega: document.getElementById('putVega').value,
            putDaysToExpiry: document.getElementById('putDaysToExpiry').value,
            thetaAcceleration: document.getElementById('thetaAcceleration').value,
            volatilityChange: document.getElementById('volatilityChange').value,
            projectionDays: document.getElementById('projectionDays').value,
            includeWeekends: document.getElementById('includeWeekends').checked
        };
        
        localStorage.setItem('optionCalculatorInputs', JSON.stringify(inputs));
        console.log('Inputs saved to localStorage');
        
    } catch (error) {
        console.error('Error saving inputs:', error);
    }
}

/**
 * Load saved inputs from localStorage
 */
function loadSavedInputs() {
    try {
        const saved = localStorage.getItem('optionCalculatorInputs');
        if (saved) {
            const inputs = JSON.parse(saved);
            
            // Load all inputs
            Object.keys(inputs).forEach(key => {
                const element = document.getElementById(key);
                if (element) {
                    if (element.type === 'checkbox') {
                        element.checked = inputs[key];
                    } else {
                        element.value = inputs[key];
                    }
                }
            });
            
            console.log('Inputs loaded from localStorage');
            trackEvent('load_saved_inputs');
        }
    } catch (error) {
        console.error('Error loading saved inputs:', error);
    }
}

/**
 * Save calculation to history
 */
function saveToHistory(type, data) {
    try {
        const calculation = {
            id: Date.now(),
            type: type,
            timestamp: new Date().toISOString(),
            data: data
        };
        
        calculationHistory.unshift(calculation); // Add to beginning
        
        // Keep only last 50 calculations
        if (calculationHistory.length > 50) {
            calculationHistory = calculationHistory.slice(0, 50);
        }
        
        // Save to localStorage
        localStorage.setItem('calculationHistory', JSON.stringify(calculationHistory));
        
        console.log(`Calculation saved to history: ${type}`);
        
    } catch (error) {
        console.error('Error saving to history:', error);
    }
}

/**
 * Load calculation history
 */
function loadCalculationHistory() {
    try {
        const saved = localStorage.getItem('calculationHistory');
        if (saved) {
            calculationHistory = JSON.parse(saved);
            console.log(`Loaded ${calculationHistory.length} calculations from history`);
        }
    } catch (error) {
        console.error('Error loading calculation history:', error);
    }
}

/**
 * Export results to CSV
 */
function exportToCSV() {
    try {
        const callResultsVisible = document.getElementById('callResults').style.display !== 'none';
        const putResultsVisible = document.getElementById('putResults').style.display !== 'none';
        
        if (!callResultsVisible && !putResultsVisible) {
            displayError('No results to export. Please calculate first.');
            return;
        }
        
        let csv = 'Option Premium Erosion Calculator Results\n';
        csv += 'Generated: ' + new Date().toLocaleString() + '\n\n';
        
        // Add parameters section
        csv += 'INPUT PARAMETERS\n';
        csv += 'Parameter,Call Option,Put Option\n';
        
        const params = [
            ['Strike Price', 'callStrike', 'putStrike'],
            ['Current Premium', 'callPremium', 'putPremium'],
            ['Theta (θ)', 'callTheta', 'putTheta'],
            ['Gamma (Γ)', 'callGamma', 'putGamma'],
            ['Delta (Δ)', 'callDelta', 'putDelta'],
            ['Vega (ν)', 'callVega', 'putVega'],
            ['Days to Expiry', 'callDaysToExpiry', 'putDaysToExpiry']
        ];
        
        params.forEach(([label, callId, putId]) => {
            const callValue = document.getElementById(callId).value;
            const putValue = document.getElementById(putId).value;
            csv += `${label},${callValue},${putValue}\n`;
        });
        
        csv += '\nRESULTS\n';
        csv += 'Metric,Call Option,Put Option\n';
        
        if (callResultsVisible) {
            const metrics = [
                ['Daily Erosion (Theta)', 'callDailyErosion', 'putDailyErosion'],
                ['Weekly Erosion', 'callWeeklyErosion', 'putWeeklyErosion'],
                ['Remaining Premium in 7 Days', 'callPremiumWeek', 'putPremiumWeek'],
                ['Remaining Premium at Expiry', 'callPremiumExpiry', 'putPremiumExpiry'],
                ['Total Erosion to Expiry', 'callTotalErosion', 'putTotalErosion']
            ];
            
            metrics.forEach(([label, callId, putId]) => {
                const callValue = document.getElementById(callId).textContent.replace('$', '');
                const putValue = document.getElementById(putId).textContent.replace('$', '');
                csv += `${label},${callValue},${putValue}\n`;
            });
        }
        
        // Create download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `option-erosion-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('CSV exported successfully');
        trackEvent('export_csv');
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        displayError('Could not export CSV file');
    }
}

/**
 * Reset all inputs to defaults
 */
function resetAll() {
    if (!confirm('Are you sure you want to reset all inputs to default values?')) {
        return;
    }
    
    try {
        // Reset call inputs
        document.getElementById('callStrike').value = '100';
        document.getElementById('callPremium').value = '5.50';
        document.getElementById('callTheta').value = '-0.05';
        document.getElementById('callGamma').value = '0.02';
        document.getElementById('callDelta').value = '0.55';
        document.getElementById('callVega').value = '0.12';
        document.getElementById('callDaysToExpiry').value = '30';
        
        // Reset put inputs
        document.getElementById('putStrike').value = '100';
        document.getElementById('putPremium').value = '4.25';
        document.getElementById('putTheta').value = '-0.04';
        document.getElementById('putGamma').value = '0.018';
        document.getElementById('putDelta').value = '-0.45';
        document.getElementById('putVega').value = '0.10';
        document.getElementById('putDaysToExpiry').value = '30';
        
        // Reset advanced settings
        document.getElementById('thetaAcceleration').value = '1.2';
        document.getElementById('volatilityChange').value = '0';
        document.getElementById('projectionDays').value = '30';
        document.getElementById('includeWeekends').checked = false;
        
        // Hide results
        document.getElementById('callResults').style.display = 'none';
        document.getElementById('putResults').style.display = 'none';
        
        // Clear chart
        if (erosionChart) {
            erosionChart.data.labels = [];
            erosionChart.data.datasets[0].data = [];
            erosionChart.data.datasets[1].data = [];
            erosionChart.update();
        }
        
        // Clear summary
        updateSummaryDisplay();
        
        // Save reset state
        saveInputs();
        
        console.log('All inputs reset to defaults');
        trackEvent('reset_all');
        
    } catch (error) {
        console.error('Error resetting inputs:', error);
        displayError('Could not reset inputs');
    }
}

// ==========================================================================
// Analytics and Tracking
// ==========================================================================

/**
 * Track events (for analytics)
 */
function trackEvent(eventName, eventParams = {}) {
    // Console logging for debugging
    console.log(`Event: ${eventName}`, eventParams);
    
    // If you add Google Analytics later, uncomment this:
    /*
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, eventParams);
    }
    */
}

// ==========================================================================
// Event Listeners Setup
// ==========================================================================

function setupEventListeners() {
    // Auto-save on input change
    document.querySelectorAll('input, select').forEach(input => {
        input.addEventListener('change', function() {
            saveInputs();
            
            // Update summary for certain inputs
            if (this.id.includes('Theta') || this.id.includes('DaysToExpiry')) {
                updateSummaryDisplay();
            }
        });
        
        input.addEventListener('input', function() {
            // Real-time validation for numeric fields
            if (this.type === 'number') {
                const value = parseFloat(this.value);
                const min = this.min ? parseFloat(this.min) : -Infinity;
                const max = this.max ? parseFloat(this.max) : Infinity;
                
                if (!isNaN(value) && (value < min || value > max)) {
                    this.classList.add('is-invalid');
                } else {
                    this.classList.remove('is-invalid');
                }
            }
        });
    });
    
    // Add reset button event listener
    const resetBtn = document.querySelector('[onclick="resetAll()"]');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAll);
    }
    
    // Add export button event listener
    const exportBtn = document.querySelector('[onclick="exportToCSV()"]');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Ctrl+Enter to calculate both
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            calculateBoth();
        }
        
        // Escape to reset
        if (event.key === 'Escape') {
            resetAll();
        }
    });
    
    // Before page unload
    window.addEventListener('beforeunload', function() {
        saveInputs();
    });
    
    console.log('Event listeners setup complete');
}

// ==========================================================================
// Public API (for external use if needed)
// ==========================================================================

// Export functions to global scope
window.OptionCalculator = {
    calculateCall: calculateCallPremiumErosion,
    calculatePut: calculatePutPremiumErosion,
    calculateBoth: calculateBoth,
    resetAll: resetAll,
    exportToCSV: exportToCSV,
    getHistory: () => calculationHistory,
    version: '1.0.0'
};

console.log('Option Premium Erosion Calculator initialized successfully');