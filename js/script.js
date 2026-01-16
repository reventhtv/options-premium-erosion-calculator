// ==========================================================================
// Option Premium Erosion Calculator - Main JavaScript
// Version 2.0.0 - Indian Rupee (₹) + Non-Linear Theta
// ==========================================================================

// Global variables
let erosionChart = null;
let plChart = null;
let appStartTime = Date.now();
let calculationHistory = [];

// ==========================================================================
// DOM Content Loaded - Initialize Application
// ==========================================================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('Indian Options Premium Erosion Calculator loading...');
    
    // Initialize tooltips
    initTooltips();
    
    // Initialize charts
    initChart();
    initPLChart();
    
    // Load saved data from localStorage
    loadSavedInputs();
    
    // Load calculation history
    loadCalculationHistory();
    
    // Add event listeners
    setupEventListeners();
    
    // Update moneyness indicators based on initial values
    updateInitialMoneyness();
    
    // Update summary display
    updateSummaryDisplay();
    
    // Application loaded
    const loadTime = Date.now() - appStartTime;
    console.log(`Calculator loaded in ${loadTime}ms`);
    trackEvent('app_loaded', { load_time: loadTime, currency: 'INR' });
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
 * Initialize Chart.js chart for Premium Erosion
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
                                return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
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
                            text: 'Option Premium (₹)',
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
                                return formatCurrency(value, true);
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
        console.log('Erosion Chart initialized successfully');
    } catch (error) {
        console.error('Error initializing erosion chart:', error);
        displayError('Could not initialize erosion chart.');
    }
}

/**
 * Initialize Profit & Loss Chart
 */
function initPLChart() {
    const ctx = document.getElementById('plChart');
    if (!ctx) return;
    
    try {
        plChart = new Chart(ctx.getContext('2d'), {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Call Option P&L',
                        data: [],
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: '#28a745',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 3
                    },
                    {
                        label: 'Put Option P&L',
                        data: [],
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: '#dc3545',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 3
                    },
                    {
                        label: 'Call + Put P&L',
                        data: [],
                        borderColor: '#0d6efd',
                        backgroundColor: 'rgba(13, 110, 253, 0.1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: '#0d6efd',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4
                    },
                    {
                        label: 'Breakeven',
                        data: [],
                        borderColor: '#ffc107',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        fill: false,
                        pointRadius: 0,
                        tension: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Profit & Loss at Expiry',
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
                                return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
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
                            text: 'Underlying Price (₹)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Profit/Loss (₹)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.05)'
                        },
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value, true);
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
        console.log('P&L Chart initialized successfully');
    } catch (error) {
        console.error('Error initializing P&L chart:', error);
        displayError('Could not initialize P&L chart.');
    }
}

/**
 * Update initial moneyness indicators
 */
function updateInitialMoneyness() {
    const spotPrice = parseFloat(document.getElementById('spotPrice').value) || 17450;
    const callStrike = parseFloat(document.getElementById('callStrike').value) || 17500;
    const putStrike = parseFloat(document.getElementById('putStrike').value) || 17500;
    
    // Update call moneyness
    const callMoneyness = updateMoneynessIndicator(callStrike, spotPrice, true);
    document.getElementById('callMoneyness').textContent = callMoneyness.moneyness;
    document.getElementById('callMoneyness').className = `moneyness-badge ${callMoneyness.badgeClass}`;
    
    // Update put moneyness
    const putMoneyness = updateMoneynessIndicator(putStrike, spotPrice, false);
    document.getElementById('putMoneyness').textContent = putMoneyness.moneyness;
    document.getElementById('putMoneyness').className = `moneyness-badge ${putMoneyness.badgeClass}`;
}

/**
 * Calculate theta decay using non-linear model (square root of time)
 */
function calculateNonLinearTheta(currentTheta, daysPassed, totalDays, isATM = true) {
    // Square root of time model: decay ∝ 1/√(time to expiry)
    const timeToExpiry = totalDays - daysPassed;
    
    // Prevent division by zero
    if (timeToExpiry <= 0) return 0;
    
    // Base decay follows square root of time
    const timeFactor = 1 / Math.sqrt(timeToExpiry);
    
    // ATM options decay faster than ITM/OTM
    const moneynessFactor = isATM ? 1.2 : 0.8;
    
    // Theta increases as we approach expiry
    const thetaAcceleration = 1 + (daysPassed / totalDays) * 2;
    
    return currentTheta * timeFactor * moneynessFactor * thetaAcceleration;
}

/**
 * Calculate total erosion with non-linear theta
 */
function calculateTotalErosionNonLinear(initialPremium, dailyTheta, daysToExpiry, isATM = true) {
    let totalErosion = 0;
    let currentPremium = initialPremium;
    
    for (let day = 1; day <= daysToExpiry; day++) {
        // Calculate theta for this specific day
        const dailyDecay = calculateNonLinearTheta(dailyTheta, day-1, daysToExpiry, isATM);
        
        // Ensure premium doesn't go negative
        if (Math.abs(dailyDecay) > currentPremium) {
            totalErosion += currentPremium;
            break;
        }
        
        totalErosion += dailyDecay;
        currentPremium += dailyDecay; // dailyDecay is negative, so this decreases premium
    }
    
    return totalErosion;
}

/**
 * Calculate linear theta decay (legacy method)
 */
function calculateTotalErosionLinear(initialPremium, dailyTheta, daysToExpiry, thetaAcceleration = 1.2) {
    let totalErosion = 0;
    
    for (let day = 1; day <= daysToExpiry; day++) {
        const dailyAcceleration = 1 + (day / daysToExpiry) * (thetaAcceleration - 1);
        totalErosion += dailyTheta * dailyAcceleration;
    }
    
    return totalErosion;
}

/**
 * Calculate Call Option Premium Erosion
 */
function calculateCallPremiumErosion() {
    try {
        // Get input values - INDIAN MARKET DEFAULTS
        const strike = parseFloat(document.getElementById('callStrike').value) || 17500;
        const premium = parseFloat(document.getElementById('callPremium').value) || 450;
        const theta = parseFloat(document.getElementById('callTheta').value) || -4.50;
        const gamma = parseFloat(document.getElementById('callGamma').value) || 0.0002;
        const delta = parseFloat(document.getElementById('callDelta').value) || 0.55;
        const vega = parseFloat(document.getElementById('callVega').value) || 12.50;
        const daysToExpiry = parseInt(document.getElementById('callDaysToExpiry').value) || 30;
        const spotPrice = parseFloat(document.getElementById('spotPrice').value) || strike;
        
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
        
        // Get advanced settings
        const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
        const volatilityChange = parseFloat(document.getElementById('volatilityChange').value) || 0;
        const useNonLinear = document.getElementById('nonLinearTheta').checked;
        
        // Determine if option is ATM
        const isATM = Math.abs((spotPrice - strike) / strike) < 0.05; // Within 5% of spot
        
        // Calculate total erosion
        let totalErosion;
        if (useNonLinear) {
            totalErosion = calculateTotalErosionNonLinear(premium, theta, daysToExpiry, isATM);
        } else {
            totalErosion = calculateTotalErosionLinear(premium, theta, daysToExpiry, thetaAcceleration);
        }
        
        // Apply volatility impact through vega
        if (vega > 0 && volatilityChange !== 0) {
            const vegaImpact = vega * (volatilityChange / 100) * Math.sqrt(daysToExpiry / 365);
            totalErosion += vegaImpact;
        }
        
        // Ensure erosion doesn't exceed premium (options can't go negative)
        const safeTotalErosion = Math.min(Math.abs(totalErosion), premium) * Math.sign(totalErosion);
        const premiumAtExpiry = Math.max(0.01, premium + safeTotalErosion); // Min 1 paisa
        
        // Calculate premium in 7 days
        let premiumInWeek;
        if (useNonLinear) {
            const weeklyDecay = calculateNonLinearTheta(theta, 0, 7, isATM) * 7;
            premiumInWeek = Math.max(0.01, premium + weeklyDecay);
        } else {
            premiumInWeek = Math.max(0.01, premium + weeklyErosion);
        }
        
        // Update UI with ₹ formatting
        document.getElementById('callDailyErosion').textContent = formatCurrency(dailyErosion);
        document.getElementById('callWeeklyErosion').textContent = formatCurrency(weeklyErosion);
        document.getElementById('callPremiumWeek').textContent = formatCurrency(premiumInWeek);
        document.getElementById('callPremiumExpiry').textContent = formatCurrency(premiumAtExpiry);
        document.getElementById('callTotalErosion').textContent = formatCurrency(safeTotalErosion);
        
        // Show results section
        document.getElementById('callResults').style.display = 'block';
        
        // Add fade-in animation
        document.getElementById('callResults').classList.add('fade-in');
        
        // Update moneyness indicator
        const moneynessInfo = updateMoneynessIndicator(strike, spotPrice, true);
        document.getElementById('callMoneyness').textContent = moneynessInfo.moneyness;
        document.getElementById('callMoneyness').className = `moneyness-badge ${moneynessInfo.badgeClass}`;
        
        // Update theta acceleration bar
        const accelerationWidth = Math.min(100, (daysToExpiry <= 7 ? 100 : (30 / daysToExpiry * 100)));
        document.getElementById('callThetaAcceleration').style.width = `${accelerationWidth}%`;
        
        // Update summary
        updateSummaryDisplay();
        
        // Save to history
        saveToHistory('call', {
            strike, premium, theta, gamma, delta, vega, daysToExpiry, spotPrice,
            dailyErosion, weeklyErosion, totalErosion: safeTotalErosion,
            premiumAtExpiry, premiumInWeek, moneyness: moneynessInfo.moneyness,
            useNonLinear: useNonLinear
        });
        
        // Track calculation
        trackEvent('calculate_call', {
            strike, premium, theta, daysToExpiry,
            totalErosion: safeTotalErosion,
            useNonLinear: useNonLinear,
            currency: 'INR'
        });
        
        return {
            strike, premium, theta, gamma, delta, vega, daysToExpiry, spotPrice,
            dailyErosion, weeklyErosion, totalErosion: safeTotalErosion,
            premiumAtExpiry, premiumInWeek, isATM, moneyness: moneynessInfo.moneyness
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
        // Get input values - INDIAN MARKET DEFAULTS
        const strike = parseFloat(document.getElementById('putStrike').value) || 17500;
        const premium = parseFloat(document.getElementById('putPremium').value) || 380;
        const theta = parseFloat(document.getElementById('putTheta').value) || -3.80;
        const gamma = parseFloat(document.getElementById('putGamma').value) || 0.00018;
        const delta = parseFloat(document.getElementById('putDelta').value) || -0.45;
        const vega = parseFloat(document.getElementById('putVega').value) || 10.50;
        const daysToExpiry = parseInt(document.getElementById('putDaysToExpiry').value) || 30;
        const spotPrice = parseFloat(document.getElementById('spotPrice').value) || strike;
        
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
        
        // Get advanced settings
        const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
        const volatilityChange = parseFloat(document.getElementById('volatilityChange').value) || 0;
        const useNonLinear = document.getElementById('nonLinearTheta').checked;
        
        // Determine if option is ATM
        const isATM = Math.abs((spotPrice - strike) / strike) < 0.05; // Within 5% of spot
        
        // Calculate total erosion
        let totalErosion;
        if (useNonLinear) {
            totalErosion = calculateTotalErosionNonLinear(premium, theta, daysToExpiry, isATM);
        } else {
            totalErosion = calculateTotalErosionLinear(premium, theta, daysToExpiry, thetaAcceleration);
        }
        
        // Apply volatility impact through vega
        if (vega > 0 && volatilityChange !== 0) {
            const vegaImpact = vega * (volatilityChange / 100) * Math.sqrt(daysToExpiry / 365);
            totalErosion += vegaImpact;
        }
        
        // Ensure erosion doesn't exceed premium
        const safeTotalErosion = Math.min(Math.abs(totalErosion), premium) * Math.sign(totalErosion);
        const premiumAtExpiry = Math.max(0.01, premium + safeTotalErosion); // Min 1 paisa
        
        // Calculate premium in 7 days
        let premiumInWeek;
        if (useNonLinear) {
            const weeklyDecay = calculateNonLinearTheta(theta, 0, 7, isATM) * 7;
            premiumInWeek = Math.max(0.01, premium + weeklyDecay);
        } else {
            premiumInWeek = Math.max(0.01, premium + weeklyErosion);
        }
        
        // Update UI with ₹ formatting
        document.getElementById('putDailyErosion').textContent = formatCurrency(dailyErosion);
        document.getElementById('putWeeklyErosion').textContent = formatCurrency(weeklyErosion);
        document.getElementById('putPremiumWeek').textContent = formatCurrency(premiumInWeek);
        document.getElementById('putPremiumExpiry').textContent = formatCurrency(premiumAtExpiry);
        document.getElementById('putTotalErosion').textContent = formatCurrency(safeTotalErosion);
        
        // Show results section
        document.getElementById('putResults').style.display = 'block';
        
        // Add fade-in animation
        document.getElementById('putResults').classList.add('fade-in');
        
        // Update moneyness indicator
        const moneynessInfo = updateMoneynessIndicator(strike, spotPrice, false);
        document.getElementById('putMoneyness').textContent = moneynessInfo.moneyness;
        document.getElementById('putMoneyness').className = `moneyness-badge ${moneynessInfo.badgeClass}`;
        
        // Update theta acceleration bar
        const accelerationWidth = Math.min(100, (daysToExpiry <= 7 ? 100 : (30 / daysToExpiry * 100)));
        document.getElementById('putThetaAcceleration').style.width = `${accelerationWidth}%`;
        
        // Update summary
        updateSummaryDisplay();
        
        // Save to history
        saveToHistory('put', {
            strike, premium, theta, gamma, delta, vega, daysToExpiry, spotPrice,
            dailyErosion, weeklyErosion, totalErosion: safeTotalErosion,
            premiumAtExpiry, premiumInWeek, moneyness: moneynessInfo.moneyness,
            useNonLinear: useNonLinear
        });
        
        // Track calculation
        trackEvent('calculate_put', {
            strike, premium, theta, daysToExpiry,
            totalErosion: safeTotalErosion,
            useNonLinear: useNonLinear,
            currency: 'INR'
        });
        
        return {
            strike, premium, theta, gamma, delta, vega, daysToExpiry, spotPrice,
            dailyErosion, weeklyErosion, totalErosion: safeTotalErosion,
            premiumAtExpiry, premiumInWeek, isATM, moneyness: moneynessInfo.moneyness
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
            const callTheta = parseFloat(document.getElementById('callTheta').value) || -4.50;
            const putTheta = parseFloat(document.getElementById('putTheta').value) || -3.80;
            
            if (putTheta !== 0) {
                const ratio = Math.abs(callTheta / putTheta).toFixed(2);
                document.getElementById('erosionRatio').textContent = `Call:Put = ${ratio}:1`;
                document.getElementById('erosionRatio').classList.add('pulse');
                
                // Remove pulse animation after 3 seconds
                setTimeout(() => {
                    document.getElementById('erosionRatio').classList.remove('pulse');
                }, 3000);
            }
            
            // Update charts
            updateChart(callResult, putResult);
            
            // Trigger P&L calculation - FIXED: No delay needed
            calculatePL();
            
            // Track combined calculation
            trackEvent('calculate_both', {
                callErosion: callResult.totalErosion,
                putErosion: putResult.totalErosion,
                ratio: Math.abs(callResult.totalErosion / putResult.totalErosion).toFixed(2),
                currency: 'INR'
            });
            
            return { callResult, putResult };
        }
    } catch (error) {
        console.error('Error in combined calculation:', error);
        displayError('Error calculating both options');
        return null;
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
        const callPremium = parseFloat(document.getElementById('callPremium').value) || 450;
        const putPremium = parseFloat(document.getElementById('putPremium').value) || 380;
        const callTheta = parseFloat(document.getElementById('callTheta').value) || -4.50;
        const putTheta = parseFloat(document.getElementById('putTheta').value) || -3.80;
        const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
        const includeWeekends = document.getElementById('includeWeekends').checked;
        const useNonLinear = document.getElementById('nonLinearTheta').checked;
        const spotPrice = parseFloat(document.getElementById('spotPrice').value) || 17450;
        const callStrike = parseFloat(document.getElementById('callStrike').value) || 17500;
        const putStrike = parseFloat(document.getElementById('putStrike').value) || 17500;
        
        // Determine moneyness for both options
        const callIsATM = Math.abs((spotPrice - callStrike) / callStrike) < 0.05;
        const putIsATM = Math.abs((spotPrice - putStrike) / putStrike) < 0.05;
        
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
                
                if (useNonLinear) {
                    // Non-linear decay
                    const dailyDecay = calculateNonLinearTheta(callTheta, d, projectionDays, callIsATM);
                    callDecay += dailyDecay;
                } else {
                    // Linear decay with acceleration
                    const dailyAcceleration = 1 + (d / projectionDays) * (thetaAcceleration - 1);
                    callDecay += callTheta * dailyAcceleration;
                }
                daysCounted++;
            }
            
            const currentCallPremium = Math.max(0.01, callPremium + callDecay);
            callData.push(currentCallPremium);
            
            // Calculate put premium at this day
            let putDecay = 0;
            daysCounted = 0;
            for (let d = 0; d < day; d++) {
                // Apply weekend adjustment
                if (includeWeekends && d % 7 >= 5) {
                    continue;
                }
                
                if (useNonLinear) {
                    // Non-linear decay
                    const dailyDecay = calculateNonLinearTheta(putTheta, d, projectionDays, putIsATM);
                    putDecay += dailyDecay;
                } else {
                    // Linear decay with acceleration
                    const dailyAcceleration = 1 + (d / projectionDays) * (thetaAcceleration - 1);
                    putDecay += putTheta * dailyAcceleration;
                }
                daysCounted++;
            }
            
            const currentPutPremium = Math.max(0.01, putPremium + putDecay);
            putData.push(currentPutPremium);
        }
        
        // Update chart
        erosionChart.data.labels = labels;
        erosionChart.data.datasets[0].data = callData;
        erosionChart.data.datasets[1].data = putData;
        erosionChart.update();
        
        console.log('Erosion Chart updated successfully');
        
    } catch (error) {
        console.error('Error updating erosion chart:', error);
        displayError('Could not update erosion chart. Please check your inputs.');
    }
}

/**
 * Calculate Profit & Loss at Expiry
 */
function calculatePL() {
    try {
        // Get input values
        const spotPrice = parseFloat(document.getElementById('spotPrice').value) || 17450;
        const callStrike = parseFloat(document.getElementById('callStrike').value) || 17500;
        const callPremium = parseFloat(document.getElementById('callPremium').value) || 450;
        const putStrike = parseFloat(document.getElementById('putStrike').value) || 17500;
        const putPremium = parseFloat(document.getElementById('putPremium').value) || 380;
        
        // Get P&L settings
        const priceRangePercent = parseFloat(document.getElementById('plPriceRange').value) || 20;
        const priceSteps = parseInt(document.getElementById('plPriceSteps').value) || 50;
        const includePremium = document.getElementById('plIncludePremium').checked;
        
        console.log('P&L Calculation Started:', {
            spotPrice, callStrike, callPremium, putStrike, putPremium,
            priceRangePercent, priceSteps, includePremium
        });
        
        // Validate inputs
        if (isNaN(callPremium) || isNaN(putPremium) || callPremium < 0 || putPremium < 0) {
            throw new Error('Please enter valid option premiums');
        }
        
        // Calculate price range
        const minPrice = spotPrice * (1 - priceRangePercent / 100);
        const maxPrice = spotPrice * (1 + priceRangePercent / 100);
        const priceStep = (maxPrice - minPrice) / priceSteps;
        
        // Generate price points
        const pricePoints = [];
        for (let i = 0; i <= priceSteps; i++) {
            pricePoints.push(minPrice + i * priceStep);
        }
        
        // Calculate P&L for each price point
        const callPLData = [];
        const putPLData = [];
        const combinedPLData = [];
        
        let maxProfit = -Infinity;
        let maxLoss = Infinity;
        let breakevenUpper = null;
        let breakevenLower = null;
        
        pricePoints.forEach((price, index) => {
            // Call option P&L at expiry
            const callIntrinsic = Math.max(0, price - callStrike);
            const callPL = callIntrinsic - (includePremium ? callPremium : 0);
            callPLData.push(callPL);
            
            // Put option P&L at expiry
            const putIntrinsic = Math.max(0, putStrike - price);
            const putPL = putIntrinsic - (includePremium ? putPremium : 0);
            putPLData.push(putPL);
            
            // Combined P&L (both positions)
            const combinedPL = callPL + putPL;
            combinedPLData.push(combinedPL);
            
            // Track max profit/loss
            maxProfit = Math.max(maxProfit, combinedPL, callPL, putPL);
            maxLoss = Math.min(maxLoss, combinedPL, callPL, putPL);
            
            // Find breakeven points for calls
            if (index > 0 && callPLData[index - 1] <= 0 && callPL >= 0) {
                breakevenUpper = pricePoints[index - 1] + (priceStep / 2);
            }
            
            // Find breakeven points for puts
            if (index > 0 && putPLData[index - 1] <= 0 && putPL >= 0) {
                breakevenLower = pricePoints[index - 1] + (priceStep / 2);
            }
        });
        
        console.log('P&L Calculated:', {
            maxProfit, maxLoss, breakevenUpper, breakevenLower,
            dataPoints: pricePoints.length
        });
        
        // Update P&L chart
        updatePLChart(pricePoints, callPLData, putPLData, combinedPLData, spotPrice);
        
        // Update P&L statistics
        document.getElementById('plMaxProfit').textContent = formatCurrency(maxProfit);
        document.getElementById('plMaxLoss').textContent = formatCurrency(maxLoss);
        document.getElementById('plBreakevenUpper').textContent = breakevenUpper ? 
            formatCurrency(breakevenUpper, true) : 'N/A';
        document.getElementById('plBreakevenLower').textContent = breakevenLower ? 
            formatCurrency(breakevenLower, true) : 'N/A';
        
        // Update detailed P&L table
        updatePLTable(pricePoints, callPLData, putPLData, combinedPLData);
        
        // Track P&L calculation
        trackEvent('calculate_pl', {
            spotPrice,
            priceRangePercent,
            priceSteps,
            includePremium,
            maxProfit,
            maxLoss,
            currency: 'INR'
        });
        
        console.log('P&L calculation completed successfully');
        return true;
        
    } catch (error) {
        console.error('Error in P&L calculation:', error);
        displayError(`P&L calculation error: ${error.message}`);
        return false;
    }
}

/**
 * Update the Profit & Loss Chart
 */
function updatePLChart(pricePoints, callPLData, putPLData, combinedPLData, spotPrice) {
    if (!plChart) {
        initPLChart();
        if (!plChart) return;
    }
    
    try {
        // Update chart data
        plChart.data.labels = pricePoints.map(p => formatCurrency(p, true));
        plChart.data.datasets[0].data = callPLData;
        plChart.data.datasets[1].data = putPLData;
        plChart.data.datasets[2].data = combinedPLData;
        
        // Add breakeven line (horizontal at zero)
        const breakevenLine = pricePoints.map(() => 0);
        plChart.data.datasets[3].data = breakevenLine;
        
        // Add vertical line at current spot price
        const annotations = {
            annotations: {
                line1: {
                    type: 'line',
                    yMin: Math.min(...combinedPLData),
                    yMax: Math.max(...combinedPLData),
                    xMin: spotPrice,
                    xMax: spotPrice,
                    borderColor: '#ffc107',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    label: {
                        display: true,
                        content: `Spot: ${formatCurrency(spotPrice, true)}`,
                        position: 'end',
                        backgroundColor: '#ffc107',
                        color: '#000',
                        font: {
                            size: 12,
                            weight: 'bold'
                        }
                    }
                }
            }
        };
        
        // Update chart options with annotations
        plChart.options.plugins.annotation = annotations;
        
        // Update chart
        plChart.update();
        
        console.log('P&L Chart updated successfully');
        
    } catch (error) {
        console.error('Error updating P&L chart:', error);
    }
}

/**
 * Update Detailed P&L Table
 */
function updatePLTable(pricePoints, callPLData, putPLData, combinedPLData) {
    try {
        const tableBody = document.getElementById('plDetailedTable').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = '';
        
        // Show key price points (every 10th point for readability)
        for (let i = 0; i < pricePoints.length; i += Math.ceil(pricePoints.length / 10)) {
            const price = pricePoints[i];
            const callPL = callPLData[i];
            const putPL = putPLData[i];
            const combinedPL = combinedPLData[i];
            
            // Determine status
            let status = '';
            if (combinedPL > 0) {
                status = '<span class="badge bg-success">Profit</span>';
            } else if (combinedPL < 0) {
                status = '<span class="badge bg-danger">Loss</span>';
            } else {
                status = '<span class="badge bg-warning">Breakeven</span>';
            }
            
            const row = tableBody.insertRow();
            row.innerHTML = `
                <td>${formatCurrency(price)}</td>
                <td class="${callPL >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(callPL)}</td>
                <td class="${putPL >= 0 ? 'text-success' : 'text-danger'}">${formatCurrency(putPL)}</td>
                <td class="${combinedPL >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}">${formatCurrency(combinedPL)}</td>
                <td>${status}</td>
            `;
        }
        
    } catch (error) {
        console.error('Error updating P&L table:', error);
    }
}

/**
 * Export P&L Data to CSV
 */
function exportPLToCSV() {
    try {
        // Get P&L chart data
        const chart = plChart;
        if (!chart || !chart.data.labels || chart.data.labels.length === 0) {
            displayError('No P&L data to export. Please calculate P&L first.');
            return;
        }
        
        const underlyingName = document.getElementById('underlyingName').value || 'NIFTY';
        const spotPrice = document.getElementById('spotPrice').value || '17450';
        const callStrike = document.getElementById('callStrike').value || '17500';
        const putStrike = document.getElementById('putStrike').value || '17500';
        const callPremium = document.getElementById('callPremium').value || '450';
        const putPremium = document.getElementById('putPremium').value || '380';
        
        let csv = 'Indian Options P&L Simulator Results\n';
        csv += `Underlying: ${underlyingName}, Spot Price: ₹${spotPrice}\n`;
        csv += `Call Strike: ₹${callStrike}, Put Strike: ₹${putStrike}\n`;
        csv += `Call Premium: ₹${callPremium}, Put Premium: ₹${putPremium}\n`;
        csv += 'Generated: ' + new Date().toLocaleString('en-IN') + '\n\n';
        
        // Add P&L data
        csv += 'Underlying Price,Call P&L,Put P&L,Combined P&L,Status\n';
        
        const labels = chart.data.labels;
        const callData = chart.data.datasets[0].data;
        const putData = chart.data.datasets[1].data;
        const combinedData = chart.data.datasets[2].data;
        
        for (let i = 0; i < labels.length; i++) {
            const price = labels[i];
            const callPL = callData[i] || 0;
            const putPL = putData[i] || 0;
            const combinedPL = combinedData[i] || 0;
            const status = combinedPL > 0 ? 'Profit' : combinedPL < 0 ? 'Loss' : 'Breakeven';
            
            csv += `${price.replace('₹', '')},${callPL.toFixed(2)},${putPL.toFixed(2)},${combinedPL.toFixed(2)},${status}\n`;
        }
        
        // Add summary statistics
        csv += '\nSUMMARY STATISTICS\n';
        csv += 'Metric,Value\n';
        csv += `Max Profit,${document.getElementById('plMaxProfit').textContent.replace('₹', '')}\n`;
        csv += `Max Loss,${document.getElementById('plMaxLoss').textContent.replace('₹', '')}\n`;
        csv += `Breakeven (Upper),${document.getElementById('plBreakevenUpper').textContent.replace('₹', '')}\n`;
        csv += `Breakeven (Lower),${document.getElementById('plBreakevenLower').textContent.replace('₹', '')}\n`;
        
        // Create download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `option-pl-${underlyingName}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('P&L CSV exported successfully');
        trackEvent('export_pl_csv', { currency: 'INR' });
        
    } catch (error) {
        console.error('Error exporting P&L CSV:', error);
        displayError('Could not export P&L data');
    }
}

/**
 * Update the Summary Display
 */
function updateSummaryDisplay() {
    try {
        const callTheta = parseFloat(document.getElementById('callTheta').value) || -4.50;
        const putTheta = parseFloat(document.getElementById('putTheta').value) || -3.80;
        
        // Get total erosions from results if available
        let callTotal = document.getElementById('callTotalErosion').textContent;
        let putTotal = document.getElementById('putTotalErosion').textContent;
        
        // If results aren't calculated yet, show estimates
        if (!callTotal || callTotal === '-₹0.00' || callTotal === '₹0.00') {
            const callDays = parseInt(document.getElementById('callDaysToExpiry').value) || 30;
            const useNonLinear = document.getElementById('nonLinearTheta').checked;
            const spotPrice = parseFloat(document.getElementById('spotPrice').value) || 17450;
            const callStrike = parseFloat(document.getElementById('callStrike').value) || 17500;
            const callIsATM = Math.abs((spotPrice - callStrike) / callStrike) < 0.05;
            
            if (useNonLinear) {
                const totalErosion = calculateTotalErosionNonLinear(
                    parseFloat(document.getElementById('callPremium').value) || 450,
                    callTheta,
                    callDays,
                    callIsATM
                );
                callTotal = formatCurrency(totalErosion);
            } else {
                const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
                callTotal = formatCurrency(callTheta * callDays * thetaAcceleration);
            }
        }
        
        if (!putTotal || putTotal === '-₹0.00' || putTotal === '₹0.00') {
            const putDays = parseInt(document.getElementById('putDaysToExpiry').value) || 30;
            const useNonLinear = document.getElementById('nonLinearTheta').checked;
            const spotPrice = parseFloat(document.getElementById('spotPrice').value) || 17450;
            const putStrike = parseFloat(document.getElementById('putStrike').value) || 17500;
            const putIsATM = Math.abs((spotPrice - putStrike) / putStrike) < 0.05;
            
            if (useNonLinear) {
                const totalErosion = calculateTotalErosionNonLinear(
                    parseFloat(document.getElementById('putPremium').value) || 380,
                    putTheta,
                    putDays,
                    putIsATM
                );
                putTotal = formatCurrency(totalErosion);
            } else {
                const thetaAcceleration = parseFloat(document.getElementById('thetaAcceleration').value) || 1.2;
                putTotal = formatCurrency(putTheta * putDays * thetaAcceleration);
            }
        }
        
        // Update summary table with ₹ formatting
        document.getElementById('summaryCallTheta').textContent = formatCurrency(callTheta);
        document.getElementById('summaryPutTheta').textContent = formatCurrency(putTheta);
        document.getElementById('summaryCallWeekly').textContent = formatCurrency(callTheta * 7);
        document.getElementById('summaryPutWeekly').textContent = formatCurrency(putTheta * 7);
        document.getElementById('summaryCallTotal').textContent = callTotal;
        document.getElementById('summaryPutTotal').textContent = putTotal;
        
    } catch (error) {
        console.error('Error updating summary:', error);
    }
}

// ==========================================================================
// Utility Functions - RUPEES FORMATTING
// ==========================================================================

/**
 * Format currency value in Indian Rupees with Lakhs/Crores formatting
 */
function formatCurrency(value, forChart = false) {
    if (isNaN(value)) return forChart ? '₹0' : '₹0.00';
    
    const absValue = Math.abs(value);
    let formatted;
    
    if (forChart) {
        // Simplified format for chart axis
        if (absValue >= 10000000) { // 1 Crore = 10,000,000
            return '₹' + (value / 10000000).toFixed(1) + 'Cr';
        } else if (absValue >= 100000) { // 1 Lakh = 100,000
            return '₹' + (value / 100000).toFixed(1) + 'L';
        } else if (absValue >= 1000) { // Thousands
            return '₹' + (value / 1000).toFixed(1) + 'K';
        } else {
            return '₹' + value.toFixed(0);
        }
    } else {
        // Detailed format for display
        if (absValue >= 10000000) { // Crores
            formatted = (value / 10000000).toFixed(2) + ' Cr';
        } else if (absValue >= 100000) { // Lakhs
            formatted = (value / 100000).toFixed(2) + ' Lakh';
        } else if (absValue >= 1000) { // Thousands
            formatted = (value / 1000).toFixed(2) + ' K';
        } else if (absValue < 0.01 && absValue > 0) { // Very small values
            formatted = value.toFixed(4);
        } else {
            formatted = value.toFixed(2);
        }
        
        // Add ₹ symbol and handle negative values
        if (value < 0) {
            return '-₹' + formatted.replace('-', '');
        }
        return '₹' + formatted;
    }
}

/**
 * Test rupee formatting function
 */
function testRupeeFormatting() {
    console.log('Testing Rupee Formatting:');
    console.log('₹450.00 ->', formatCurrency(450));
    console.log('₹4,500.00 ->', formatCurrency(4500));
    console.log('₹45,000.00 ->', formatCurrency(45000));
    console.log('₹4,50,000.00 (4.5 Lakh) ->', formatCurrency(450000));
    console.log('₹45,00,000.00 (45 Lakh) ->', formatCurrency(4500000));
    console.log('₹1,00,00,000.00 (1 Crore) ->', formatCurrency(10000000));
    console.log('-₹450.00 ->', formatCurrency(-450));
    console.log('-₹4,50,000.00 (-4.5 Lakh) ->', formatCurrency(-450000));
}

/**
 * Calculate and display moneyness (ATM/ITM/OTM)
 */
function updateMoneynessIndicator(strike, spot, isCall = true) {
    const percentDiff = ((spot - strike) / strike) * 100;
    let moneyness = '';
    let badgeClass = '';
    
    if (Math.abs(percentDiff) < 2) { // Within 2% = ATM
        moneyness = 'ATM';
        badgeClass = 'badge-atm';
    } else if ((isCall && percentDiff > 0) || (!isCall && percentDiff < 0)) {
        moneyness = 'ITM';
        badgeClass = 'badge-itm';
    } else {
        moneyness = 'OTM';
        badgeClass = 'badge-otm';
    }
    
    return { moneyness, badgeClass, percentDiff };
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
            underlyingName: document.getElementById('underlyingName').value,
            spotPrice: document.getElementById('spotPrice').value,
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
            includeWeekends: document.getElementById('includeWeekends').checked,
            nonLinearTheta: document.getElementById('nonLinearTheta').checked,
            plPriceRange: document.getElementById('plPriceRange').value,
            plPriceSteps: document.getElementById('plPriceSteps').value,
            plIncludePremium: document.getElementById('plIncludePremium').checked
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
            trackEvent('load_saved_inputs', { currency: 'INR' });
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
            data: data,
            currency: 'INR'
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
        
        const underlyingName = document.getElementById('underlyingName').value || 'NIFTY';
        const spotPrice = document.getElementById('spotPrice').value || '17450';
        
        let csv = 'Indian Options Premium Erosion Calculator Results\n';
        csv += `Underlying: ${underlyingName}, Spot Price: ₹${spotPrice}\n`;
        csv += 'Generated: ' + new Date().toLocaleString('en-IN') + '\n\n';
        
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
            csv += `${label},₹${callValue},₹${putValue}\n`;
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
                const callValue = document.getElementById(callId).textContent.replace('₹', '');
                const putValue = document.getElementById(putId).textContent.replace('₹', '');
                csv += `${label},${callValue},${putValue}\n`;
            });
        }
        
        // Add advanced settings
        csv += '\nADVANCED SETTINGS\n';
        csv += 'Setting,Value\n';
        csv += `Theta Acceleration,${document.getElementById('thetaAcceleration').value}\n`;
        csv += `Volatility Change,${document.getElementById('volatilityChange').value}%\n`;
        csv += `Non-Linear Model,${document.getElementById('nonLinearTheta').checked ? 'Yes' : 'No'}\n`;
        csv += `Include Weekends,${document.getElementById('includeWeekends').checked ? 'Yes' : 'No'}\n`;
        
        // Create download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `option-erosion-${underlyingName}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        console.log('CSV exported successfully');
        trackEvent('export_csv', { currency: 'INR' });
        
    } catch (error) {
        console.error('Error exporting CSV:', error);
        displayError('Could not export CSV file');
    }
}

/**
 * Reset all inputs to Indian market defaults
 */
function resetAll() {
    if (!confirm('Are you sure you want to reset all inputs to default values?')) {
        return;
    }
    
    try {
        // Reset underlying info - NIFTY typical values
        document.getElementById('underlyingName').value = 'NIFTY';
        document.getElementById('spotPrice').value = '17450';
        
        // Reset call inputs - ATM NIFTY option typical values
        document.getElementById('callStrike').value = '17500';
        document.getElementById('callPremium').value = '450';  // ~₹450 premium
        document.getElementById('callTheta').value = '-4.50';  // ~₹4.50 daily decay
        document.getElementById('callGamma').value = '0.0002';
        document.getElementById('callDelta').value = '0.55';
        document.getElementById('callVega').value = '12.50';   // ~₹12.50 vega
        document.getElementById('callDaysToExpiry').value = '30'; // Monthly expiry
        
        // Reset put inputs - ATM NIFTY option typical values
        document.getElementById('putStrike').value = '17500';
        document.getElementById('putPremium').value = '380';   // ~₹380 premium
        document.getElementById('putTheta').value = '-3.80';   // ~₹3.80 daily decay
        document.getElementById('putGamma').value = '0.00018';
        document.getElementById('putDelta').value = '-0.45';
        document.getElementById('putVega').value = '10.50';    // ~₹10.50 vega
        document.getElementById('putDaysToExpiry').value = '30'; // Monthly expiry
        
        // Reset advanced settings
        document.getElementById('thetaAcceleration').value = '1.2';
        document.getElementById('volatilityChange').value = '0';
        document.getElementById('projectionDays').value = '30';
        document.getElementById('includeWeekends').checked = false;
        document.getElementById('nonLinearTheta').checked = true;
        
        // Reset P&L settings
        document.getElementById('plPriceRange').value = '20';
        document.getElementById('plPriceSteps').value = '50';
        document.getElementById('plIncludePremium').checked = true;
        
        // Hide results
        document.getElementById('callResults').style.display = 'none';
        document.getElementById('putResults').style.display = 'none';
        
        // Clear P&L stats
        document.getElementById('plMaxProfit').textContent = '₹0.00';
        document.getElementById('plMaxLoss').textContent = '₹0.00';
        document.getElementById('plBreakevenUpper').textContent = '₹0.00';
        document.getElementById('plBreakevenLower').textContent = '₹0.00';
        
        // Clear P&L table
        const tableBody = document.getElementById('plDetailedTable').getElementsByTagName('tbody')[0];
        tableBody.innerHTML = '';
        
        // Update moneyness indicators
        updateInitialMoneyness();
        
        // Clear charts
        if (erosionChart) {
            erosionChart.data.labels = [];
            erosionChart.data.datasets[0].data = [];
            erosionChart.data.datasets[1].data = [];
            erosionChart.update();
        }
        
        if (plChart) {
            plChart.data.labels = [];
            plChart.data.datasets[0].data = [];
            plChart.data.datasets[1].data = [];
            plChart.data.datasets[2].data = [];
            plChart.data.datasets[3].data = [];
            plChart.update();
        }
        
        // Clear summary
        updateSummaryDisplay();
        
        // Save reset state
        saveInputs();
        
        console.log('All inputs reset to Indian market defaults');
        trackEvent('reset_all', { currency: 'INR' });
        
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
            
            // Update moneyness when spot or strike changes
            if (this.id.includes('Strike') || this.id === 'spotPrice') {
                updateInitialMoneyness();
            }
            
            // Update summary for certain inputs
            if (this.id.includes('Theta') || this.id.includes('DaysToExpiry') || 
                this.id === 'thetaAcceleration' || this.id === 'nonLinearTheta') {
                updateSummaryDisplay();
            }
            
            // Auto-calculate P&L when relevant inputs change
            if (this.id.includes('Premium') || this.id.includes('Strike') || 
                this.id.includes('plPriceRange') || this.id.includes('plPriceSteps') ||
                this.id === 'plIncludePremium' || this.id === 'spotPrice') {
                // Debounce P&L calculation
                clearTimeout(window.plTimeout);
                window.plTimeout = setTimeout(() => {
                    const callResultsVisible = document.getElementById('callResults').style.display !== 'none';
                    const putResultsVisible = document.getElementById('putResults').style.display !== 'none';
                    if (callResultsVisible && putResultsVisible) {
                        calculatePL();
                    }
                }, 1000);
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
    
    // Add P&L calculate button event listener
    const plCalculateBtn = document.querySelector('[onclick="calculatePL()"]');
    if (plCalculateBtn) {
        plCalculateBtn.addEventListener('click', calculatePL);
    }
    
    // Add P&L export button event listener
    const plExportBtn = document.querySelector('[onclick="exportPLToCSV()"]');
    if (plExportBtn) {
        plExportBtn.addEventListener('click', exportPLToCSV);
    }
    
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
        
        // Ctrl+P to calculate P&L
        if (event.ctrlKey && event.key === 'p') {
            event.preventDefault();
            calculatePL();
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
    calculatePL: calculatePL,
    resetAll: resetAll,
    exportToCSV: exportToCSV,
    exportPLToCSV: exportPLToCSV,
    getHistory: () => calculationHistory,
    testRupeeFormatting: testRupeeFormatting,
    version: '2.1.0',
    currency: 'INR'
};

console.log('Indian Options Premium Erosion Calculator with P&L initialized successfully');