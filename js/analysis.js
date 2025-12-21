// analysis.js — Snapshot + Confidence Bands + Insight

console.log("analysis.js loaded");

const snapshot = JSON.parse(sessionStorage.getItem("erosionSnapshot"));
const ₹ = v => "₹" + Number(v).toFixed(2);

if (!snapshot) {
  console.warn("No snapshot found");
  return;
}

// --------------------
// Populate snapshot
// --------------------
const callErosion = snapshot.call.totalErosion;
const putErosion  = snapshot.put.totalErosion;
const days = snapshot.daysToExpiry;

document.getElementById("snapCall").textContent = ₹(callErosion);
document.getElementById("snapPut").textContent  = ₹(putErosion);
document.getElementById("snapRatio").textContent =
  Math.abs(callErosion / putErosion).toFixed(2) + " : 1";

// --------------------
// Insight logic
// --------------------
const insightBox = document.getElementById("erosionInsight");
const insightText = document.getElementById("insightText");

if (Math.abs(putErosion) < Math.abs(callErosion)) {
  insightText.textContent =
    "PUT downside risk is more protected than CALL upside";
  insightBox.classList.remove("d-none");
}

// --------------------
// Confidence bands
// --------------------
function renderConfidenceChart(days, callTotal, putTotal) {
  const labels = Array.from({ length: days + 1 }, (_, i) => i);

  const linear = (total, factor) =>
    labels.map(d => total * (1 - (d / days) * factor));

  // CALL (symmetric)
  const callMid = linear(callTotal, 1.0);
  const callHigh = linear(callTotal, 1.2);
  const callLow = linear(callTotal, 0.8);

  // PUT (asymmetric)
  const putExpected = linear(putTotal, 1.0);
  const putHigh = linear(putTotal, 0.65);
  const putLow = linear(putTotal, 1.45);

  // 🔍 DEBUG — COMMENTED, NOT DELETED
  /*
  console.table({
    "PUT High (Day 0)": putHigh[0],
    "PUT Expected (Day 0)": putExpected[0],
    "PUT Low (Day 0)": putLow[0],
    "PUT High (Mid)": putHigh[Math.floor(days / 2)],
    "PUT Expected (Mid)": putExpected[Math.floor(days / 2)],
    "PUT Low (Mid)": putLow[Math.floor(days / 2)]
  });
  */

  new Chart(document.getElementById("confidenceChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Call – Expected",
          data: callMid,
          borderColor: "#0d6efd",
          borderWidth: 2
        },
        {
          label: "Call – Range",
          data: callHigh,
          backgroundColor: "rgba(13,110,253,0.15)",
          fill: "-1",
          borderWidth: 0
        },
        {
          label: "Put – Expected",
          data: putExpected,
          borderColor: "#ffc107",
          borderDash: [5, 5],
          borderWidth: 2
        },
        {
          label: "Put – Range",
          data: putLow,
          backgroundColor: "rgba(255,193,7,0.25)",
          fill: "-1",
          borderWidth: 0
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
            label: ctx => `${ctx.dataset.label}: ${₹(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { title: { display: true, text: "Days Passed" } },
        y: { title: { display: true, text: "Premium (₹)" } }
      }
    }
  });
}

renderConfidenceChart(days, callErosion, putErosion);
