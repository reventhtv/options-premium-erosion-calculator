export function getMoneyness(strike, spot, isCall) {
    const diff = (spot - strike) / strike * 100;
    if (Math.abs(diff) < 2) return { moneyness: 'ATM' };
    if ((isCall && diff > 0) || (!isCall && diff < 0)) return { moneyness: 'ITM' };
    return { moneyness: 'OTM' };
}
