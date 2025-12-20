import { totalLinear, totalNonLinear } from './thetaModels.js';

export function calculateErosion({
    premium, theta, vega, volatilityChange,
    daysToExpiry, isATM, useNonLinear, thetaAcceleration
}) {
    let erosion = useNonLinear
        ? totalNonLinear(premium, theta, daysToExpiry, isATM)
        : totalLinear(theta, daysToExpiry, thetaAcceleration);

    if (vega && volatilityChange) {
        erosion += vega * (volatilityChange / 100);
    }

    return {
        totalErosion: erosion,
        premiumAtExpiry: Math.max(0.01, premium + erosion)
    };
}
