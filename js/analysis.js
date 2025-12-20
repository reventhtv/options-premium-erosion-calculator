// analysis.js — Snapshot + Confidence Bands + Risk Labels (FULL FILE)

console.log("analysis.js loaded");

// --------------------
// Helpers
// --------------------
const formatINR = v => "₹" + Number(v).toFixed(2);

// Risk classification
function erosionRisk(totalErosion, premiumExpiry) {
  const erosion = Math.abs(totalErosion);
  const base = erosion + Math.max(premiumExpiry, 0);
  const ratio = base === 0 ? 0 : erosion / base;

  if (ratio < 0.3) return { label: "🟢 Low Erosion Risk", cls: "text-success" };
  if (ratio < 0.6) return { label: "🟡 Medium Erosion Risk", cls: "text-warning" };
  return { label: "🔴 High Erosion Risk", cls: "text-danger" };
}

// --------------------
// DOM Elements
// --------------------
const elCallErosion = document.getElementById("summaryCallErosion");
const elPutErosion = document.getElementById("summaryPutErosion");
const elCallExpiry = document.getElementById("summaryCallPremiumExpiry");
const elPutExpiry = document.getElementById("summaryPutPremiumExpiry");
const elDays = document.getElementById("summaryDays");

const elCallRisk = document.getElementById("callRiskLabel");
const elPutRisk = document.getElementById("putRiskLabel");

// --------------------
// Load snapshot
// --------------------
const raw = sessionStorage.getItem("erosionSnapshot");

if (!raw) {
  alert("No calculation data found. Please calculate from home page first.");
} else {
  const snapshot = JSON.parse(raw);
  console.log("Snapshot received", snapshot);

  // Populate numbers
  elCallErosion.textContent = formatINR(snapshot.call.totalErosion);
  elPutErosion.textContent = formatINR(snapshot.put.totalErosion);
  elCallExpiry.textContent = formatINR(snapshot.call.premiumExpiry);
  elPutExpiry.textContent = formatINR(snapshot.put.premiumExpiry);
  elDays.textContent = snapshot.daysToExpiry + " days";

  // Risk labels
  const callRisk = erosionRisk(
    snapshot.call.totalErosion,
    snapshot.call.premiumExpiry
  );
  const putRisk = erosionRisk(
    snapshot.put.totalErosion,
    snapshot.put.premiumExpiry
  );

  elCallRisk.textContent = callRisk.label;
  elCallRisk.className = callRisk.cls;

  elPutRisk.textContent = putRisk.label;
  elPutRisk.className = putRisk.cls;

  // Chart
  renderConfidenceChart(
    snapshot.daysToExpiry,
    snapshot.call.totalErosion,
    snapshot.put.totalErosion
  );
}

// --------------------
// Chart logic
// --------------------
function renderConfidenceChart(days, callTotal, putTotal) {
  const labels = Array.from({ length: days + 1 }, (_, i) => i);

  const band = (total, factor) =>
    labels.map(d => total * (1 - (d / days) * factor));

  const callLow  = band(callTotal, 0.7);
  const callMid  = band(callTotal, 1.0);
  const callHigh = band(callTotal, 1.3);

  const putLow  = band(putTotal, 0.7);
  const putMid  = band(putTotal, 1.0);
  const putHigh = band(putTotal, 1.3);

  new Chart(document.getElementById("confidenceChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Call – High Erosion",
          data: callHigh,
          backgroundColor: "rgba(220,53,69,0.25)",
          borderColor: "rgba(220,53,69,0)",
          fill: true
        },
        {
          label: "Call – Expected",
          data: callMid,
          borderColor: "#0d6efd",
          borderWidth: 2,
          fill: false
        },
        {
          label: "Call – Low Erosion",
          data: callLow,
          backgroundColor: "rgba(25,135,84,0.25)",
          borderColor: "rgba(25,135,84,0)",
          fill: "-1"
        },
        {
          label: "Put – High Erosion",
          data: putHigh,
          backgroundColor: "rgba(255,193,7,0.25)",
          borderColor: "rgba(255,193,7,0)",
          fill: true
        },
        {
          label: "Put – Expected",
          data: putMid,
          borderColor: "#ffc107",
          borderWidth: 2,
          borderDash: [6, 4],
          fill: false
        },
        {
          label: "Put – Low Erosion",
          data: putLow,
          backgroundColor: "rgba(13,202,240,0.25)",
          borderColor: "rgba(13,202,240,0)",
          fill: "-1"
        }
      ]
    },
    options: {
      responsive: true,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${formatINR(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { title: { display: true, text: "Days Passed" } },
        y: { title: { display: true, text: "Premium Erosion (₹)" } }
      }
    }
  });
}
