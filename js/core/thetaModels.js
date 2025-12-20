export function calculateNonLinearTheta(theta, d, total, atm) {
    const t = total - d;
    if (t <= 0) return 0;
    return theta * (1 / Math.sqrt(t)) * (atm ? 1.2 : 0.8);
}

export function totalNonLinear(premium, theta, days, atm) {
    let total = 0, cur = premium;
    for (let i = 0; i < days; i++) {
        const d = calculateNonLinearTheta(theta, i, days, atm);
        if (Math.abs(d) > cur) break;
        total += d;
        cur += d;
    }
    return total;
}

export function totalLinear(theta, days, accel = 1.2) {
    let t = 0;
    for (let i = 0; i < days; i++) {
        t += theta * (1 + (i / days) * (accel - 1));
    }
    return t;
}
