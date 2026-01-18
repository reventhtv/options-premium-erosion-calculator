// Risk Spotlight Banner System for Indian Options Traders
// Version 1.0 - Single Dominant Risk Detection

// ============================================================================
// CONFIGURATION - Indian Market Thresholds
// ============================================================================
const RiskConfig = {
    // Priority Order (DO NOT CHANGE)
    PRIORITIES: ['THETA', 'IV', 'GAMMA', 'DELTA', 'NEUTRAL'],
    
    // Theta Risk Thresholds
    THETA: {
        DAYS_TO_EXPIRY_MAX: 7,                    // ≤ 7 days (weekly expiry)
        DAILY_DECAY_PERCENT_MIN: 1.2,             // ≥ 1.2% of premium
    },
    
    // IV Opportunity/Risk Thresholds
    IV: {
        HIGH_PERCENTILE: 70,                       // ≥ 70% → Seller opportunity
        LOW_PERCENTILE: 30,                        // ≤ 30% → Seller warning
        LOOKBACK_DAYS: 30,                         // Rolling 30 trading days
    },
    
    // Gamma Risk Thresholds (Instrument specific)
    GAMMA: {
        DAYS_TO_EXPIRY_MAX: 10,                    // ≤ 10 days
        STRIKE_RANGE_PERCENT: 0.01,                // ±1% for ATM
        INSTRUMENT_THRESHOLDS: {
            'NIFTY': 0.0004,
            'BANKNIFTY': 0.0006,
            'FINNIFTY': 0.0005,
            'DEFAULT': 0.0004
        }
    },
    
    // Delta Exposure Thresholds
    DELTA: {
        NET_DELTA_THRESHOLD: 0.25,                 // |Net Delta| ≥ 0.25
    },
    
    // Update frequency (milliseconds)
    UPDATE_INTERVAL: 1000,                         // Update every second
    
    // Banner display duration before auto-refresh (ms)
    MIN_DISPLAY_TIME: 5000,
};

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
class RiskSpotlight {
    constructor() {
        this.currentRisk = null;
        this.lastUpdate = null;
        this.isInitialized = false;
        this.riskHistory = [];
        this.riskScores = {};
        this.lastDisplayChange = null;
        
        // Initialize DOM elements
        this.elements = {
            container: document.getElementById('riskSpotlightContainer'),
            icon: document.getElementById('riskIcon'),
            title: document.getElementById('riskTitle'),
            description: document.getElementById('riskDescription'),
            details: document.getElementById('riskDetails'),
            detailsToggle: document.getElementById('riskDetailsToggle'),
            currentStateBadge: document.getElementById('currentStateBadge'),
            nextRiskIndicator: document.getElementById('nextRiskIndicator'),
            priorityScore: document.getElementById('priorityScore'),
            riskLastUpdate: document.getElementById('riskLastUpdate')
        };
        
        // Risk state templates
        this.riskTemplates = {
            THETA: {
                icon: '⚠️',
                title: 'High Theta Risk',
                className: 'theta-risk',
                priority: 1
            },
            IV_HIGH: {
                icon: '✅',
                title: 'IV Favorable for Premium Selling',
                className: 'iv-high',
                priority: 2
            },
            IV_LOW: {
                icon: '⚠️',
                title: 'Low IV Environment',
                className: 'iv-low',
                priority: 2
            },
            GAMMA: {
                icon: '⚠️',
                title: 'High Gamma Sensitivity',
                className: 'gamma-risk',
                priority: 3
            },
            DELTA: {
                icon: 'ℹ️',
                title: 'Directional Exposure Detected',
                className: 'delta-exposure',
                priority: 4
            },
            NEUTRAL: {
                icon: '✅',
                title: 'Balanced Risk Profile',
                className: 'neutral-state',
                priority: 5
            }
        };
    }
    
    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    initialize() {
        if (this.isInitialized) return;
        
        console.log('%c🔦 Risk Spotlight Initialized', 'color: #0dcaf0; font-weight: bold;');
        console.log('%cIndian Market Thresholds Active:', 'color: #6c757d;');
        console.log('- Theta: ≤7 days OR ≥1.2% daily decay');
        console.log('- IV: ≥70% (High) OR ≤30% (Low) percentile');
        console.log('- Gamma: ≤10 days + ATM ±1% + instrument-specific thresholds');
        console.log('- Delta: |Net Delta| ≥ 0.25');
        
        // Show the container
        this.elements.container.style.display = 'block';
        this.elements.container.style.visibility = 'visible';
        this.elements.container.style.opacity = '1';
        
        // Set initial state
        this.updateRiskDisplay('NEUTRAL', 'Initializing risk analysis...');
        
        // Start periodic updates
        this.startAutoUpdate();
        
        this.isInitialized = true;
    }
    
    // ============================================================================
    // RISK DETECTION LOGIC (CORE)
    // ============================================================================
    
    /**
     * Calculate all risk scores and return the dominant risk
     */
    calculateDominantRisk() {
        if (!window.options || window.options.length === 0) {
            return {
                type: 'NEUTRAL',
                message: 'No options detected for risk analysis',
                score: 0,
                data: {}
            };
        }
        
        const spot = parseFloat(document.getElementById('spotPrice')?.value) || 0;
        const days = parseInt(document.getElementById('daysToExpiry')?.value) || 0;
        const iv = parseFloat(document.getElementById('impliedVol')?.value) || 15;
        const underlying = document.getElementById('underlyingSelect')?.value || 'NIFTY';
        
        // Calculate portfolio metrics
        const portfolioMetrics = this.calculatePortfolioMetrics();
        
        // Calculate individual risk scores
        const risks = [];
        
        // 1. Theta Risk (Highest Priority)
        const thetaRisk = this.evaluateThetaRisk(portfolioMetrics, days);
        if (thetaRisk.score > 0) {
            risks.push(thetaRisk);
        }
        
        // 2. IV Risk/Opportunity (Second Priority)
        const ivRisk = this.evaluateIVRisk(iv, underlying);
        if (ivRisk.score > 0) {
            risks.push(ivRisk);
        }
        
        // 3. Gamma Risk (Third Priority)
        const gammaRisk = this.evaluateGammaRisk(portfolioMetrics, days, spot, underlying);
        if (gammaRisk.score > 0) {
            risks.push(gammaRisk);
        }
        
        // 4. Delta Exposure (Fourth Priority)
        const deltaRisk = this.evaluateDeltaRisk(portfolioMetrics);
        if (deltaRisk.score > 0) {
            risks.push(deltaRisk);
        }
        
        // 5. If no risks detected, return NEUTRAL
        if (risks.length === 0) {
            return {
                type: 'NEUTRAL',
                message: 'No dominant risk driver detected',
                score: 10,
                data: {},
                description: 'Your position shows balanced risk characteristics'
            };
        }
        
        // Sort by priority (lower number = higher priority)
        risks.sort((a, b) => {
            // First by priority order
            const priorityOrder = { 'THETA': 1, 'IV': 2, 'GAMMA': 3, 'DELTA': 4 };
            const aPriority = priorityOrder[a.type.split('_')[0]] || 5;
            const bPriority = priorityOrder[b.type.split('_')[0]] || 5;
            
            if (aPriority !== bPriority) return aPriority - bPriority;
            
            // Then by score (higher score wins within same priority)
            return b.score - a.score;
        });
        
        // Return the highest priority risk
        return risks[0];
    }
    
    /**
     * Calculate portfolio-wide metrics
     */
    calculatePortfolioMetrics() {
        if (!window.options || window.options.length === 0) {
            return {
                totalTheta: 0,
                totalPremium: 0,
                netDelta: 0,
                totalGamma: 0,
                avgGamma: 0,
                atmOptions: [],
                totalDays: 0
            };
        }
        
        let totalTheta = 0;
        let totalPremium = 0;
        let netDelta = 0;
        let totalGamma = 0;
        let atmOptions = [];
        const spot = parseFloat(document.getElementById('spotPrice')?.value) || 0;
        
        window.options.forEach(option => {
            totalTheta += Math.abs(option.theta || 0);
            totalPremium += option.premium || 0;
            netDelta += option.delta || 0;
            totalGamma += option.gamma || 0;
            
            // Check if option is ATM (±1%)
            const strikeDiff = Math.abs(option.strike - spot) / spot;
            if (strikeDiff <= 0.01) {
                atmOptions.push({
                    strike: option.strike,
                    gamma: option.gamma,
                    type: option.type,
                    days: option.days
                });
            }
        });
        
        return {
            totalTheta,
            totalPremium,
            netDelta,
            totalGamma,
            avgGamma: window.options.length > 0 ? totalGamma / window.options.length : 0,
            atmOptions,
            totalDays: window.options.length > 0 ? 
                window.options.reduce((sum, opt) => sum + (opt.days || 0), 0) / window.options.length : 0
        };
    }
    
    /**
     * Evaluate Theta Risk
     */
    evaluateThetaRisk(portfolio, days) {
        let score = 0;
        let message = '';
        let description = '';
        
        // Condition A: Time-based (≤ 7 days)
        if (days <= RiskConfig.THETA.DAYS_TO_EXPIRY_MAX) {
            score += 80;
            message = 'Weekly expiry approaching';
        }
        
        // Condition B: Value-based (≥ 1.2% daily decay)
        if (portfolio.totalPremium > 0) {
            const dailyDecayPercent = (portfolio.totalTheta / portfolio.totalPremium) * 100;
            if (dailyDecayPercent >= RiskConfig.THETA.DAILY_DECAY_PERCENT_MIN) {
                score += 70;
                message = 'High daily theta decay detected';
                description = `₹${portfolio.totalTheta.toFixed(2)}/day decay (${dailyDecayPercent.toFixed(1)}% of premium)`;
            }
        }
        
        if (score > 0) {
            return {
                type: 'THETA',
                score,
                message: message || 'Theta decay risk detected',
                description: description || 'Time decay dominates without price movement',
                data: {
                    totalTheta: portfolio.totalTheta,
                    dailyDecayPercent: portfolio.totalPremium > 0 ? 
                        (portfolio.totalTheta / portfolio.totalPremium) * 100 : 0,
                    daysToExpiry: days
                }
            };
        }
        
        return { type: 'THETA', score: 0, message: '', data: {} };
    }
    
    /**
     * Evaluate IV Risk/Opportunity
     * Note: For v1, we're using a simplified IV percentile calculation
     */
    evaluateIVRisk(currentIV, underlying) {
        // Simplified IV percentile calculation for v1
        // In production, this would use historical IV data
        const ivPercentile = this.calculateIVPercentile(currentIV, underlying);
        
        if (ivPercentile >= RiskConfig.IV.HIGH_PERCENTILE) {
            return {
                type: 'IV_HIGH',
                score: 65,
                message: 'IV elevated relative to historical range',
                description: 'Implied volatility favorable for premium selling strategies',
                data: {
                    currentIV,
                    ivPercentile,
                    threshold: RiskConfig.IV.HIGH_PERCENTILE
                }
            };
        }
        
        if (ivPercentile <= RiskConfig.IV.LOW_PERCENTILE) {
            return {
                type: 'IV_LOW',
                score: 55,
                message: 'IV compressed relative to historical range',
                description: 'Limited premium erosion potential - unfavorable for selling',
                data: {
                    currentIV,
                    ivPercentile,
                    threshold: RiskConfig.IV.LOW_PERCENTILE
                }
            };
        }
        
        return { type: 'IV', score: 0, message: '', data: {} };
    }
    
    /**
     * Simplified IV percentile calculation for v1
     * In production, replace with actual historical data
     */
    calculateIVPercentile(currentIV, underlying) {
        // Default historical IV ranges for Indian indices (simplified for v1)
        const historicalRanges = {
            'NIFTY': { min: 10, max: 35, median: 15 },
            'BANKNIFTY': { min: 15, max: 45, median: 20 },
            'FINNIFTY': { min: 12, max: 40, median: 18 },
            'DEFAULT': { min: 10, max: 40, median: 16 }
        };
        
        const range = historicalRanges[underlying] || historicalRanges.DEFAULT;
        
        // Calculate percentile (simplified linear interpolation)
        let percentile = ((currentIV - range.min) / (range.max - range.min)) * 100;
        percentile = Math.max(0, Math.min(100, percentile)); // Clamp to 0-100
        
        return Math.round(percentile);
    }
    
    /**
     * Evaluate Gamma Risk
     */
    evaluateGammaRisk(portfolio, days, spot, underlying) {
        // Check time condition (≤ 10 days)
        if (days > RiskConfig.GAMMA.DAYS_TO_EXPIRY_MAX) {
            return { type: 'GAMMA', score: 0, message: '', data: {} };
        }
        
        // Check if we have ATM options
        if (portfolio.atmOptions.length === 0) {
            return { type: 'GAMMA', score: 0, message: '', data: {} };
        }
        
        // Get gamma threshold for this underlying
        const gammaThreshold = RiskConfig.GAMMA.INSTRUMENT_THRESHOLDS[underlying] || 
                              RiskConfig.GAMMA.INSTRUMENT_THRESHOLDS.DEFAULT;
        
        // Check if any ATM option exceeds gamma threshold
        const highGammaOptions = portfolio.atmOptions.filter(opt => opt.gamma >= gammaThreshold);
        
        if (highGammaOptions.length > 0) {
            return {
                type: 'GAMMA',
                score: 60,
                message: 'ATM options with high gamma detected',
                description: 'Small price moves may cause rapid P&L swings',
                data: {
                    highGammaCount: highGammaOptions.length,
                    maxGamma: Math.max(...highGammaOptions.map(opt => opt.gamma)),
                    threshold: gammaThreshold,
                    daysToExpiry: days
                }
            };
        }
        
        return { type: 'GAMMA', score: 0, message: '', data: {} };
    }
    
    /**
     * Evaluate Delta Exposure
     */
    evaluateDeltaRisk(portfolio) {
        const netDeltaAbs = Math.abs(portfolio.netDelta);
        
        if (netDeltaAbs >= RiskConfig.DELTA.NET_DELTA_THRESHOLD) {
            const direction = portfolio.netDelta > 0 ? '+' : '-';
            
            return {
                type: 'DELTA',
                score: 40,
                message: 'Significant directional exposure',
                description: `Net delta ${direction}${netDeltaAbs.toFixed(2)} — P&L sensitive to market direction`,
                data: {
                    netDelta: portfolio.netDelta,
                    netDeltaAbs,
                    threshold: RiskConfig.DELTA.NET_DELTA_THRESHOLD,
                    direction: direction
                }
            };
        }
        
        return { type: 'DELTA', score: 0, message: '', data: {} };
    }
    
    // ============================================================================
    // UI UPDATES
    // ============================================================================
    
    /**
     * Update the risk display with new risk state
     */
    updateRiskDisplay(riskType, description = '') {
        const template = this.riskTemplates[riskType] || this.riskTemplates.NEUTRAL;
        const riskData = this.currentRisk?.data || {};
        
        // Update CSS classes
        const card = this.elements.container.querySelector('.risk-spotlight-card');
        card.className = 'card risk-spotlight-card ' + template.className;
        
        // Update content
        this.elements.icon.textContent = template.icon;
        this.elements.title.textContent = template.title;
        
        if (description) {
            this.elements.description.textContent = description;
        } else {
            // Generate description based on risk type
            switch(riskType) {
                case 'THETA':
                    const theta = riskData.totalTheta?.toFixed(2) || '0.00';
                    this.elements.description.textContent = `₹${theta}/day decay — time decay dominates without movement`;
                    break;
                case 'IV_HIGH':
                    this.elements.description.textContent = `Implied volatility elevated relative to recent range`;
                    break;
                case 'IV_LOW':
                    this.elements.description.textContent = `Limited premium erosion potential — unfavorable for selling`;
                    break;
                case 'GAMMA':
                    this.elements.description.textContent = `Small price moves may cause rapid P&L swings`;
                    break;
                case 'DELTA':
                    const direction = riskData.direction || '+';
                    const delta = riskData.netDeltaAbs?.toFixed(2) || '0.00';
                    this.elements.description.textContent = `Net delta ${direction}${delta} — P&L sensitive to market direction`;
                    break;
                default:
                    this.elements.description.textContent = `No single factor currently dominates risk`;
            }
        }
        
        // Update details panel
        this.updateRiskDetails(riskType, riskData);
        
        // Add animation for state change
        card.classList.add('risk-state-change');
        setTimeout(() => {
            card.classList.remove('risk-state-change');
        }, 500);
        
        // Update timestamp
        this.lastUpdate = new Date();
        this.elements.riskLastUpdate.textContent = this.formatTime(this.lastUpdate);
        
        // Store in history (limit to last 10)
        this.riskHistory.unshift({
            type: riskType,
            timestamp: this.lastUpdate,
            data: riskData
        });
        if (this.riskHistory.length > 10) {
            this.riskHistory.pop();
        }
        
        console.log(`%c🔦 Risk Spotlight: ${template.title}`, 
            `color: ${this.getRiskColor(riskType)}; font-weight: bold;`);
    }
    
    /**
     * Update the risk details panel
     */
    updateRiskDetails(riskType, riskData) {
        const template = this.riskTemplates[riskType] || this.riskTemplates.NEUTRAL;
        
        // Update current state badge
        this.elements.currentStateBadge.textContent = riskType.replace('_', ' ');
        this.elements.currentStateBadge.className = 'badge ' + this.getRiskBadgeClass(riskType);
        
        // Update priority score
        const score = this.currentRisk?.score || 0;
        this.elements.priorityScore.textContent = `${score}/100`;
        
        // Update next risk indicator
        this.elements.nextRiskIndicator.textContent = this.getNextRiskIndicator();
    }
    
    /**
     * Get next risk in priority order
     */
    getNextRiskIndicator() {
        const currentPriority = this.currentRisk ? 
            this.riskTemplates[this.currentRisk.type]?.priority || 5 : 5;
        
        // Find next lower priority risk that has a score > 0
        const allRisks = Object.keys(this.riskScores)
            .filter(type => this.riskScores[type] > 0)
            .sort((a, b) => {
                const aPriority = this.riskTemplates[a]?.priority || 5;
                const bPriority = this.riskTemplates[b]?.priority || 5;
                return aPriority - bPriority;
            });
        
        if (allRisks.length > 1) {
            const nextRisk = allRisks.find(type => {
                const priority = this.riskTemplates[type]?.priority || 5;
                return priority > currentPriority;
            });
            
            if (nextRisk) {
                const nextTemplate = this.riskTemplates[nextRisk];
                return `${nextTemplate.icon} ${nextTemplate.title}`;
            }
        }
        
        return 'No other active risks';
    }
    
    /**
     * Toggle risk details visibility
     */
    toggleDetails() {
        const details = this.elements.details;
        const isVisible = details.style.display === 'block';
        
        if (isVisible) {
            details.style.display = 'none';
            this.elements.detailsToggle.innerHTML = '<i class="bi bi-info-circle"></i> Details';
        } else {
            details.style.display = 'block';
            this.elements.detailsToggle.innerHTML = '<i class="bi bi-chevron-up"></i> Hide';
        }
    }
    
    // ============================================================================
    // UTILITY FUNCTIONS
    // ============================================================================
    
    /**
     * Get color for risk type
     */
    getRiskColor(riskType) {
        const colors = {
            THETA: '#dc3545',
            IV_HIGH: '#28a745',
            IV_LOW: '#ffc107',
            GAMMA: '#fd7e14',
            DELTA: '#0dcaf0',
            NEUTRAL: '#6c757d'
        };
        return colors[riskType] || '#6c757d';
    }
    
    /**
     * Get badge class for risk type
     */
    getRiskBadgeClass(riskType) {
        const classes = {
            THETA: 'bg-danger',
            IV_HIGH: 'bg-success',
            IV_LOW: 'bg-warning',
            GAMMA: 'bg-orange',
            DELTA: 'bg-info',
            NEUTRAL: 'bg-secondary'
        };
        return classes[riskType] || 'bg-secondary';
    }
    
    /**
     * Format time for display
     */
    formatTime(date) {
        if (!date) return 'Never';
        
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        
        if (diffSec < 60) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // ============================================================================
    // AUTO-UPDATE SYSTEM
    // ============================================================================
    
    /**
     * Start auto-updating the risk spotlight
     */
    startAutoUpdate() {
        // Initial update
        this.updateRiskSpotlight();
        
        // Set up periodic updates
        setInterval(() => {
            this.updateRiskSpotlight();
        }, RiskConfig.UPDATE_INTERVAL);
        
        // Also update when BSM calculations update
        this.setupEventListeners();
    }
    
    /**
     * Update the risk spotlight
     */
    updateRiskSpotlight() {
        // Check if we should update (respect minimum display time)
        if (this.lastDisplayChange) {
            const timeSinceChange = Date.now() - this.lastDisplayChange;
            if (timeSinceChange < RiskConfig.MIN_DISPLAY_TIME && this.currentRisk?.type !== 'NEUTRAL') {
                return; // Too soon to change from a non-neutral state
            }
        }
        
        // Calculate new risk
        const newRisk = this.calculateDominantRisk();
        
        // Update risk scores
        this.riskScores[newRisk.type] = newRisk.score;
        
        // Check if risk state has changed
        if (!this.currentRisk || this.currentRisk.type !== newRisk.type) {
            this.currentRisk = newRisk;
            this.updateRiskDisplay(newRisk.type, newRisk.description);
            this.lastDisplayChange = Date.now();
        }
    }
    
    /**
     * Set up event listeners for manual updates
     */
    setupEventListeners() {
        // Listen for BSM calculation updates
        window.addEventListener('riskUpdateRequest', () => {
            this.updateRiskSpotlight();
        });
        
        // Listen for options changes
        const originalUpdateAllCalculations = window.updateAllCalculations;
        if (originalUpdateAllCalculations) {
            window.updateAllCalculations = function() {
                const result = originalUpdateAllCalculations.apply(this, arguments);
                window.dispatchEvent(new Event('riskUpdateRequest'));
                return result;
            };
        }
    }
}

// ============================================================================
// GLOBAL INITIALIZATION
// ============================================================================

// Create global instance
window.RiskSpotlight = new RiskSpotlight();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for other components to initialize
    setTimeout(() => {
        window.RiskSpotlight.initialize();
    }, 1000);
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RiskSpotlight;
}

// Global function to manually trigger risk update
window.updateRiskSpotlight = function() {
    if (window.RiskSpotlight) {
        window.RiskSpotlight.updateRiskSpotlight();
    }
};

// Global function to toggle details
window.toggleRiskDetails = function() {
    if (window.RiskSpotlight) {
        window.RiskSpotlight.toggleDetails();
    }
};

console.log('%c🔦 Risk Spotlight Module Loaded', 'color: #0dcaf0; font-weight: bold;');