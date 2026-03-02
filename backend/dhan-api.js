/**
 * dhan-api.js  —  Frontend API client for the Dhan Options Backend
 * ================================================================
 * Drop this <script> into dhan-bsm-pro.html BEFORE your main script.
 *
 * Usage inside dhan-bsm-pro.html:
 *   const chain  = await DhanAPI.getOptionChain(13, '2025-03-27');
 *   const expiries = await DhanAPI.getExpiries(13);
 *   const spot   = await DhanAPI.getSpot(13);
 *
 * The functions return null on any error (they never throw to the caller).
 * Check DhanAPI.lastError for a human-readable error string.
 */

const DhanAPI = (() => {

  // ── Config ────────────────────────────────────────────────────────────
  // Change this to your deployed backend URL when live.
  // During local dev it should be http://localhost:8000
  const BASE_URL = 'https://options-premium-erosion-calculator.onrender.com';   // ← update after deploy

  // Supported underlyings — mirrors the backend UNDERLYINGS dict
  const UNDERLYINGS = [
    { scrip: 13,    name: 'NIFTY',      lot: 75,  step: 50  },
    { scrip: 25,    name: 'BANKNIFTY',  lot: 30,  step: 100 },
    { scrip: 14366, name: 'FINNIFTY',   lot: 40,  step: 50  },
    { scrip: 442,   name: 'SENSEX',     lot: 20,  step: 100 },
    { scrip: 51909, name: 'MIDCPNIFTY', lot: 75,  step: 25  },
  ];

  // ── State ─────────────────────────────────────────────────────────────
  let lastError = null;
  let _backendLive = null;   // tri-state: null=untested, true, false

  // ── Private ───────────────────────────────────────────────────────────
  async function _get(path) {
    try {
      const resp = await fetch(BASE_URL + path, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      if (!resp.ok) {
        lastError = `HTTP ${resp.status} from ${path}`;
        return null;
      }
      const data = await resp.json();
      lastError = null;
      return data;
    } catch (err) {
      lastError = `Network error on ${path}: ${err.message}`;
      return null;
    }
  }

  // ── Public API ────────────────────────────────────────────────────────

  /** Check if the backend is reachable. */
  async function ping() {
    const data = await _get('/health');
    _backendLive = data !== null;
    return _backendLive;
  }

  /**
   * Get all active expiry dates for an underlying.
   * @param {number} scrip  - UnderlyingScrip ID (default 13 = NIFTY)
   * @returns {string[]|null}  - ['2025-03-27', '2025-04-03', ...] or null on error
   */
  async function getExpiries(scrip = 13) {
    const data = await _get(`/api/expiries?scrip=${scrip}`);
    return data ? data.expiries : null;
  }

  /**
   * Get the full option chain for a scrip + expiry.
   * @param {number}  scrip       - UnderlyingScrip ID
   * @param {string}  expiry      - 'YYYY-MM-DD'
   * @param {number?} nStrikes    - Limit to N strikes around ATM (optional)
   * @returns {OptionChainResult|null}
   *
   * OptionChainResult shape:
   * {
   *   status, scrip, name, expiry, dte, lot, step, spot,
   *   chain: [
   *     { strike, ce: LegData, pe: LegData },
   *     ...
   *   ]
   * }
   *
   * LegData shape:
   * { ltp, oi, prev_oi, volume, iv, avg_price,
   *   bid, bid_qty, ask, ask_qty, prev_close, security_id,
   *   delta, theta, gamma, vega }
   */
  async function getOptionChain(scrip = 13, expiry, nStrikes) {
    if (!expiry) {
      lastError = 'getOptionChain: expiry is required';
      return null;
    }
    let url = `/api/option-chain?scrip=${scrip}&expiry=${expiry}`;
    if (nStrikes) url += `&strikes=${nStrikes}`;
    return await _get(url);
  }

  /**
   * Get just the spot price (LTP of underlying).
   * Uses a warm cache on the backend — very fast if chain was recently fetched.
   * @param {number} scrip
   * @returns {number|null}
   */
  async function getSpot(scrip = 13) {
    const data = await _get(`/api/spot?scrip=${scrip}`);
    return data ? data.spot : null;
  }

  /**
   * Get list of supported underlyings with lot sizes.
   * @returns {Array|null}
   */
  async function getInstruments() {
    const data = await _get('/api/instruments');
    return data ? data.data : null;
  }

  // ── Helpers to bridge Dhan data into the BSM calculator ───────────────

  /**
   * Convert a Dhan chain result into the format expected by buildChain().
   * Returns an array of rows ready for the existing option chain UI.
   *
   * Each row:  { K, ce_ltp, pe_ltp, ce_iv, pe_iv,
   *              ce_delta, pe_delta, ce_theta, pe_theta,
   *              ce_gamma, ce_vega, ce_oi, pe_oi,
   *              ce_bid, ce_ask, pe_bid, pe_ask }
   */
  function transformChain(chainResult) {
    if (!chainResult || !chainResult.chain) return [];
    return chainResult.chain.map(row => ({
      K:         row.strike,
      // CE
      ce_ltp:    row.ce?.ltp    ?? null,
      ce_iv:     row.ce?.iv     ?? null,
      ce_delta:  row.ce?.delta  ?? null,
      ce_theta:  row.ce?.theta  ?? null,
      ce_gamma:  row.ce?.gamma  ?? null,
      ce_vega:   row.ce?.vega   ?? null,
      ce_oi:     row.ce?.oi     ?? null,
      ce_bid:    row.ce?.bid    ?? null,
      ce_ask:    row.ce?.ask    ?? null,
      // PE
      pe_ltp:    row.pe?.ltp    ?? null,
      pe_iv:     row.pe?.iv     ?? null,
      pe_delta:  row.pe?.delta  ?? null,
      pe_theta:  row.pe?.theta  ?? null,
      pe_gamma:  row.pe?.gamma  ?? null,
      pe_vega:   row.pe?.vega   ?? null,
      pe_oi:     row.pe?.oi     ?? null,
      pe_bid:    row.pe?.bid    ?? null,
      pe_ask:    row.pe?.ask    ?? null,
    }));
  }

  /**
   * Pull OI data from a chain result into the Max Pain table format.
   * Returns array of { K, ce, pe } ready for mpStrikesCache.
   */
  function chainToMaxPainInput(chainResult) {
    if (!chainResult || !chainResult.chain) return [];
    return chainResult.chain.map(row => ({
      K:  row.strike,
      ce: row.ce?.oi ?? 0,
      pe: row.pe?.oi ?? 0,
    }));
  }

  // ── Public surface ─────────────────────────────────────────────────────
  return {
    get lastError()    { return lastError; },
    get isLive()       { return _backendLive; },
    UNDERLYINGS,
    ping,
    getExpiries,
    getOptionChain,
    getSpot,
    getInstruments,
    transformChain,
    chainToMaxPainInput,
  };

})();


// ── Auto-ping on load so the UI knows if the backend is reachable ──────
(async () => {
  const alive = await DhanAPI.ping();
  console.info('[DhanAPI]', alive ? '✅ Backend reachable' : '❌ Backend offline — BSM-only mode');

  // Dispatch a custom event so dhan-bsm-pro.html can react
  window.dispatchEvent(new CustomEvent('dhan-backend-status', {
    detail: { live: alive, error: DhanAPI.lastError }
  }));
})();