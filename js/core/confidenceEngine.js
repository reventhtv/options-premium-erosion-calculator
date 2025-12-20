// js/core/confidenceEngine.js

export function getConfidenceBand(premium, dailyTheta) {
    const impactPct = Math.abs(dailyTheta) / premium * 100;

    if (impactPct >= 2) {
        return { level: 'HIGH', className: 'confidence-high', label: 'High Erosion Risk' };
    }

    if (impactPct >= 1) {
        return { level: 'MEDIUM', className: 'confidence-medium', label: 'Medium Erosion Risk' };
    }

    return { level: 'LOW', className: 'confidence-low', label: 'Low Erosion Risk' };
}
