// utils/analytics.js

export function trackEvent(name, payload = {}) {
    console.log(`[EVENT] ${name}`, payload);
}
