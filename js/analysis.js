// analysis.js — Confidence Bands Chart

const data = JSON.parse(localStorage.getItem("optionCalculatorInputs")) || {};

const ₹ = v => "₹" + Number(v).toFixed(2);

function init() {
  if (!data.callTheta || !data.callPremium) return;

  const days = Number(data.callDaysToExpiry || 30);

  const callBase = data.callTheta * days;
  const putBase  = data.putTheta  * days;

  document.getElementById("snapCall").textContent = ₹(callBase);
  document.getElementById("snapPut").textContent  = ₹(putBase);
  document.getElementById("snapRatio").textContent =
    Math.abs(callBase / putBase).toFixed(2) + ":1";

  renderConfidenceChart(days, callBase, putBase);
}

function renderConfidenceChart(days, callTotal, putTotal) {
  const labels = Array.from({ length: days + 1 }, (_, i) => i);

  const makeBand = (total, factor) =>
    labels.map(d => Math.max(0, total * (1 - (d / days) * factor)));

  // Expected
  const callMid = makeBand(callTotal, 1.0);
  const putMid  = makeBand(putTotal, 1.0);

  // High erosion (faster decay)
  const callHigh = makeBand(callTotal, 1.25);
  const putHigh  = makeBand(putTotal, 1.25);

  // Low erosion (slower decay)
  const callLow = makeBand(callTotal, 0.75);
  const putLow  = makeBand(putTotal, 0.75);

  new Chart(document.getElementById("confidenceChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Call – High Erosion",
          data: callHigh,
          borderColor: "rgba(220,53,69,0)",
          backgroundColor: "rgba(220,53,69,0.25)",
          fill: true
        },
        {
          label: "Call – Expected",
          data: callMid,
          borderColor: "#0d6efd",
          backgroundColor: "rgba(13,110,253,0.15)",
          fill: false,
          borderWidth: 2
        },
        {
          label: "Call – Low Erosion",
          data: callLow,
          borderColor: "rgba(25,135,84,0)",
          backgroundColor: "rgba(25,135,84,0.25)",
          fill: "-1"
        },
        {
          label: "Put – Expected",
          data: putMid,
          borderColor: "#ffc107",
          borderDash: [5, 5],
          fill: false,
          borderWidth: 2
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
        y: { title: { display: true, text: "Premium Value (₹)" } }
      }
    }
  });
}

init();
