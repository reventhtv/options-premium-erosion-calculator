// analysis.js — Confidence Bands with PUT Asymmetry (DEBUG STEP)

console.log("analysis.js loaded");

const formatINR = v => "₹" + Number(v).toFixed(2);

// --------------------
// Load Snapshot
// --------------------
const snapshot = JSON.parse(sessionStorage.getItem("erosionSnapshot"));

if (!snapshot) {
  alert("No snapshot found. Please calculate from main page.");
  window.location.href = "index.html";
}

// --------------------
// DOM
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

callRiskLabel.textContent = "Medium Erosion Risk";
putRiskLabel.textContent = "Medium Erosion Risk";

// --------------------
// Confidence Bands
// --------------------
function renderConfidenceChart(days, callTotal, putTotal) {
  const labels = Array.from({ length: days + 1 }, (_, i) => i);

  const band = (total, factor) =>
    labels.map(d => total * (1 - (d / days) * factor));

  // CALL — symmetric
  const callExpected = band(callTotal, 1.0);
  const callHigh = band(callTotal, 1.25);
  const callLow = band(callTotal, 0.75);

  // PUT — asymmetric (bearish skew realism)
  const putExpected = band(putTotal, 1.0);
  const putHigh = band(putTotal, 1.35);
  const putLow = band(putTotal, 0.55);

  // 🔍 TEMPORARY VALIDATION (REMOVE LATER)
  console.table({
    "PUT High (Day 0)": putHigh[0],
    "PUT Expected (Day 0)": putExpected[0],
    "PUT Low (Day 0)": putLow[0],

    "PUT High (Mid)": putHigh[Math.floor(days / 2)],
    "PUT Expected (Mid)": putExpected[Math.floor(days / 2)],
    "PUT Low (Mid)": putLow[Math.floor(days / 2)]
  });

  new Chart(document.getElementById("confidenceChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        // CALL
        {
          label: "Call – High Erosion",
          data: callHigh,
          backgroundColor: "rgba(220,53,69,0.25)",
          borderColor: "rgba(220,53,69,0)",
          fill: true
        },
        {
          label: "Call – Expected",
          data: callExpected,
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

        // PUT
        {
          label: "Put – High Erosion",
          data: putHigh,
          backgroundColor: "rgba(255,193,7,0.25)",
          borderColor: "rgba(255,193,7,0)",
          fill: true
        },
        {
          label: "Put – Expected",
          data: putExpected,
          borderColor: "#ffc107",
          borderDash: [6, 4],
          borderWidth: 2,
          fill: false
        },
        {
          label: "Put – Low Erosion (IV Support)",
          data: putLow,
          backgroundColor: "rgba(32,201,151,0.25)",
          borderColor: "rgba(32,201,151,0)",
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

renderConfidenceChart(days, callErosion, putErosion);
