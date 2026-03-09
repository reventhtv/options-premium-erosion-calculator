"""
Dhan HQ Options Backend — FastAPI
==================================
Endpoints:
  GET  /health               → uptime check
  GET  /api/expiries         → expiry list for an underlying
  GET  /api/option-chain     → full option chain (OI, IV, greeks, LTP)
  GET  /api/spot             → last traded price of underlying only
  GET  /api/instruments      → supported underlying list

Rate limit note: Dhan option-chain API = max 1 unique request per 3 seconds.
We enforce this with a simple in-process debounce cache (ttl = 3s).
"""

import os
import time
import httpx
import logging
from typing import Optional
from functools import lru_cache

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

# ── Config ──────────────────────────────────────────────────────────────
load_dotenv()

DHAN_ACCESS_TOKEN = os.getenv("DHAN_ACCESS_TOKEN", "")
DHAN_CLIENT_ID    = os.getenv("DHAN_CLIENT_ID", "")
DHAN_BASE_URL     = "https://api.dhan.co/v2"

# Allowed frontend origins
ALLOWED_ORIGINS = [
    "https://voliq.in",                  # ← primary production domain
    "https://www.voliq.in",
    "https://reventhtv.github.io",       # ← legacy GitHub Pages URL
    "http://localhost:3000",
    "http://127.0.0.1:5500",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "null",   # local file:// opened directly in browser
]

# ── Supported Underlyings ────────────────────────────────────────────────
# SecurityID → (name, segment, lot_size, step)
#
# Verified Dhan HQ scrip IDs (source: api.dhan.co/v2/instrument/IDX_I):
#   13  = NIFTY 50       NSE   IDX_I
#   25  = BANKNIFTY      NSE   IDX_I
#   442 = MIDCAP NIFTY   NSE   IDX_I   (NOT SENSEX — common mislabel)
#   51  = SENSEX         BSE   IDX_I
#
# Lot sizes as per NSE/BSE circulars (Feb 2025):
#   NIFTY 50    = 65
#   BANKNIFTY   = 15
#   MIDCAP NIFTY= 75
#   SENSEX      = 10
#
# FINNIFTY (scrip=27): NSE discontinued weekly + monthly contracts Nov 2024.
# No active expiries exist — removed from supported list.

UNDERLYINGS = {
    13:  {"name": "NIFTY 50",      "segment": "IDX_I", "lot": 65,  "step": 50},
    25:  {"name": "BANKNIFTY",     "segment": "IDX_I", "lot": 30,  "step": 100},
    442: {"name": "MIDCAP NIFTY",  "segment": "IDX_I", "lot": 120,  "step": 25},
    51:  {"name": "SENSEX",        "segment": "IDX_I", "lot": 20,  "step": 100},
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ── Simple TTL Cache (avoids hammering Dhan's 3s rate limit) ─────────────
_cache: dict = {}   # key → (timestamp, data)
CACHE_TTL = 3.5     # seconds — slightly above Dhan's 3s window

def cache_get(key: str):
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None

def cache_set(key: str, data):
    _cache[key] = (time.time(), data)

# ── Dhan HTTP client ─────────────────────────────────────────────────────
def dhan_headers() -> dict:
    if not DHAN_ACCESS_TOKEN or not DHAN_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="DHAN_ACCESS_TOKEN / DHAN_CLIENT_ID not configured on server"
        )
    return {
        "Content-Type": "application/json",
        "access-token": DHAN_ACCESS_TOKEN,
        "client-id": DHAN_CLIENT_ID,
    }

async def dhan_post(path: str, body: dict) -> dict:
    url = f"{DHAN_BASE_URL}{path}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(url, json=body, headers=dhan_headers())
    if resp.status_code != 200:
        log.warning("Dhan %s returned %d: %s", path, resp.status_code, resp.text[:300])
        raise HTTPException(status_code=resp.status_code, detail=f"Dhan API error: {resp.text[:300]}")
    data = resp.json()
    if data.get("status") not in ("success", None):
        raise HTTPException(status_code=502, detail=f"Dhan returned non-success: {data}")
    return data

# ── App ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Dhan Options Backend",
    description="Proxy API for Dhan HQ option chain data — powers Voliq (voliq.in)",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # open — tighten to ALLOWED_ORIGINS after confirming live
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {
        "service": "Dhan Options Backend — Voliq",
        "status":  "online",
        "endpoints": ["/health", "/api/instruments", "/api/expiries", "/api/option-chain", "/api/spot", "/docs"]
    }


@app.get("/health")
def health():
    token_configured = bool(DHAN_ACCESS_TOKEN and DHAN_CLIENT_ID)
    return {
        "status": "ok",
        "timestamp": time.time(),
        "token_configured": token_configured,
        "client_id": DHAN_CLIENT_ID if DHAN_CLIENT_ID else "NOT SET",
    }


@app.get("/api/token-check")
async def token_check():
    """Quick auth check — verifies token is valid without hitting rate limits."""
    if not DHAN_ACCESS_TOKEN or not DHAN_CLIENT_ID:
        return {"valid": False, "reason": "Token or Client ID not set in environment"}
    try:
        body = {"UnderlyingScrip": 13, "UnderlyingSeg": "IDX_I"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{DHAN_BASE_URL}/optionchain/expirylist",
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "access-token": DHAN_ACCESS_TOKEN,
                    "client-id": DHAN_CLIENT_ID,
                }
            )
        if resp.status_code == 200:
            return {"valid": True, "client_id": DHAN_CLIENT_ID}
        elif resp.status_code == 401:
            return {
                "valid": False,
                "reason": "TOKEN_EXPIRED",
                "message": "Regenerate token on DhanHQ and update DHAN_ACCESS_TOKEN in Render dashboard",
                "client_id": DHAN_CLIENT_ID,
            }
        else:
            return {"valid": False, "reason": f"Dhan returned HTTP {resp.status_code}"}
    except Exception as e:
        return {"valid": False, "reason": str(e)}


@app.get("/api/instruments")
def instruments():
    """Return supported underlying instruments with lot sizes."""
    return {
        "status": "success",
        "data": [
            {"scrip": scrip, **meta}
            for scrip, meta in UNDERLYINGS.items()
        ]
    }


@app.get("/api/expiries")
async def get_expiries(
    scrip: int = Query(13, description="UnderlyingScrip ID, default=13 (NIFTY 50)"),
):
    """Fetch active expiry dates for the given underlying."""
    cache_key = f"expiries:{scrip}"
    cached = cache_get(cache_key)
    if cached:
        log.info("Cache hit: %s", cache_key)
        return cached

    meta = UNDERLYINGS.get(scrip)
    if not meta:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported scrip {scrip}. Supported: {list(UNDERLYINGS.keys())}. See /api/instruments"
        )

    body = {"UnderlyingScrip": scrip, "UnderlyingSeg": meta["segment"]}
    raw = await dhan_post("/optionchain/expirylist", body)

    result = {
        "status":   "success",
        "scrip":    scrip,
        "name":     meta["name"],
        "expiries": raw.get("data", []),
    }
    cache_set(cache_key, result)
    return result


@app.get("/api/option-chain")
async def get_option_chain(
    scrip:   int = Query(13,  description="UnderlyingScrip ID"),
    expiry:  str = Query(...,  description="Expiry date YYYY-MM-DD"),
    strikes: Optional[int] = Query(None, description="Limit to N strikes around ATM. None = all."),
):
    """
    Full option chain for scrip + expiry.
    Returns: spot price, all strikes with CE/PE — OI, IV, greeks, LTP, bid/ask.
    Applies a 3.5s cache to respect Dhan's rate limit.
    """
    cache_key = f"chain:{scrip}:{expiry}"
    cached = cache_get(cache_key)
    if cached:
        log.info("Cache hit: %s", cache_key)
        return _maybe_trim(cached, strikes)

    meta = UNDERLYINGS.get(scrip)
    if not meta:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported scrip {scrip}. Supported: {list(UNDERLYINGS.keys())}"
        )

    body = {
        "UnderlyingScrip": scrip,
        "UnderlyingSeg":   meta["segment"],
        "Expiry":          expiry,
    }
    raw = await dhan_post("/optionchain", body)

    spot = raw["data"]["last_price"]
    oc   = raw["data"]["oc"]

    # Normalise: sort strikes ascending, parse float keys
    chain = []
    for strike_str, data in oc.items():
        strike = float(strike_str)
        chain.append({
            "strike": strike,
            "ce": _clean_leg(data.get("ce")),
            "pe": _clean_leg(data.get("pe")),
        })
    chain.sort(key=lambda x: x["strike"])

    # DTE from expiry
    from datetime import date
    try:
        exp_date = date.fromisoformat(expiry)
        dte = max(0, (exp_date - date.today()).days)
    except Exception:
        dte = None

    result = {
        "status":    "success",
        "scrip":     scrip,
        "name":      meta["name"],
        "segment":   meta["segment"],
        "expiry":    expiry,
        "dte":       dte,
        "lot":       meta["lot"],
        "step":      meta["step"],
        "spot":      spot,
        "chain":     chain,
        "timestamp": time.time(),
    }
    cache_set(cache_key, result)
    return _maybe_trim(result, strikes)


@app.get("/api/spot")
async def get_spot(scrip: int = Query(13)):
    """Lightweight endpoint — returns just the spot price (uses chain cache if warm)."""
    # Try chain cache first (any expiry will do for spot)
    for key, (ts, data) in list(_cache.items()):
        if key.startswith(f"chain:{scrip}:") and time.time() - ts < CACHE_TTL:
            return {"status": "success", "scrip": scrip, "spot": data["spot"], "timestamp": ts}

    # Otherwise fetch chain for nearest expiry
    meta = UNDERLYINGS.get(scrip)
    if not meta:
        raise HTTPException(status_code=400, detail=f"Unsupported scrip {scrip}")

    exp_result = await get_expiries(scrip=scrip)
    expiries = exp_result.get("expiries", [])
    if not expiries:
        raise HTTPException(status_code=502, detail="No expiries returned from Dhan")

    chain_result = await get_option_chain(scrip=scrip, expiry=expiries[0], strikes=1)
    return {"status": "success", "scrip": scrip, "spot": chain_result["spot"], "timestamp": time.time()}


# ── Helpers ───────────────────────────────────────────────────────────────

def _clean_leg(leg: Optional[dict]) -> Optional[dict]:
    """Normalise a CE or PE leg from Dhan response."""
    if not leg:
        return None
    g = leg.get("greeks", {})
    return {
        "ltp":         leg.get("last_price"),
        "oi":          leg.get("oi"),
        "prev_oi":     leg.get("previous_oi"),
        "volume":      leg.get("volume"),
        "iv":          leg.get("implied_volatility"),
        "avg_price":   leg.get("average_price"),
        "bid":         leg.get("top_bid_price"),
        "bid_qty":     leg.get("top_bid_quantity"),
        "ask":         leg.get("top_ask_price"),
        "ask_qty":     leg.get("top_ask_quantity"),
        "prev_close":  leg.get("previous_close_price"),
        "security_id": leg.get("security_id"),
        "delta":       g.get("delta"),
        "theta":       g.get("theta"),
        "gamma":       g.get("gamma"),
        "vega":        g.get("vega"),
    }


def _maybe_trim(result: dict, n_strikes: Optional[int]) -> dict:
    """If n_strikes requested, return only N strikes around ATM."""
    if not n_strikes or "chain" not in result:
        return result
    chain = result["chain"]
    spot  = result.get("spot", 0)
    if not chain or not spot:
        return result
    atm_i = min(range(len(chain)), key=lambda i: abs(chain[i]["strike"] - spot))
    lo = max(0, atm_i - n_strikes)
    hi = min(len(chain), atm_i + n_strikes + 1)
    trimmed = dict(result)
    trimmed["chain"] = chain[lo:hi]
    return trimmed