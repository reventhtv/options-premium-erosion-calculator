// analysis.js — Snapshot + Confidence Bands + Risk Labels

console.log("analysis.js loaded");

// --------------------
// Helpers
// --------------------
const formatINR = v => "₹" + Number(v).toFixed(2);

function getRiskLabel(totalErosion) {
  const abs = Math.abs(totalErosion);

  if (abs < 80) {
    return { text: "Low Erosion Risk", cls: "text-success" };
  }
  if (abs < 150) {
    return { text: "Medium Erosion Risk", cls: "text-warning" };
  }
  return { text: "High Erosion Risk", cls: "text-danger" };
}

// --------------------
// Load Snapshot
// --------------------
const snapshot = JSON.parse(sessionStorage.getItem("erosionSnapshot"));

if (!snapshot) {
  console.warn("No erosion snapshot found");
  return;
}

// --------------------
// DOM Elements
// --------------------
const snapCall = document.getElementById("snapCall");
const snapPut = document.getElementById("snapPut");
const snapDays = document.getElementById("snapDays");

const callRiskLabel = document.getElementById("callRiskLabel");
const putRiskLabel = document.getElementById("putRiskLabel");

// --------------------
// Populate Snapshot
// --------------------
const callErosion = snapshot.call.totalErosion;
const putErosion = snapshot.put.totalErosion;
const days = snapshot.daysToExpiry;

snapCall.textContent = formatINR(callErosion);
snapPut.textContent = formatINR(putErosion);
snapDays.textContent = `${days} days`;

// --------------------
// Inject Risk Labels (🔥 FIX)
// --------------------
const callRisk = getRiskLabel(callErosion);
callRiskLabel.textContent = callRisk.text;
callRiskLabel.className = `fw-bold ${callRisk.cls}`;

const putRisk = getRiskLabel(putErosion);
putRiskLabel.textContent = putRisk.text;
putRiskLabel.className = `fw-bold ${putRisk.cls}`;

// --------------------
// Confidence Bands Chart
// --------------------
function renderConfidenceChart(days, callTotal, putTotal) {
  const labels = Array.from({ length: days + 1 }, (_, i) => i);

  const makeBand = (total, factor) =>
    labels.map(d => total * (1 - (d / days) * factor));

  const callMid = makeBand(callTotal, 1.0);
  const callHigh = makeBand(callTotal, 1.25);
  const callLow = makeBand(callTotal, 0.75);

  const putMid = makeBand(putTotal, 1.0);
  const putHigh = makeBand(putTotal, 1.25);
  const putLow = makeBand(putTotal, 0.75);

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
          label: "Put – Expected",
          data: putMid,
          borderColor: "#ffc107",
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false
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

// Render chart
renderConfidenceChart(days, callErosion, putErosion);
