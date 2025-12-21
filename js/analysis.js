// analysis.js — Snapshot + Confidence Bands + Insight (STABLE)

console.log("analysis.js loaded");

const snapshot = JSON.parse(sessionStorage.getItem("erosionSnapshot"));
const ₹ = v => "₹" + Number(v).toFixed(2);

if (!snapshot) {
  console.warn("No snapshot found in sessionStorage");
} else {

  // --------------------
  // Populate snapshot
  // --------------------
  const callErosion = snapshot.call.totalErosion;
  const putErosion  = snapshot.put.totalErosion;
  const days = snapshot.daysToExpiry;

  const snapCall = document.getElementById("snapCall");
  const snapPut = document.getElementById("snapPut");
  const snapRatio = document.getElementById("snapRatio");

  if (!snapCall || !snapPut || !snapRatio) {
    console.error("Snapshot DOM elements missing");
  } else {
    snapCall.textContent = ₹(callErosion);
    snapPut.textContent  = ₹(putErosion);
    snapRatio.textContent =
      Math.abs(callErosion / putErosion).toFixed(2) + " : 1";
  }

  // --------------------
  // Insight logic
  // --------------------
  const insightBox = document.getElementById("erosionInsight");
  const insightText = document.getElementById("insightText");

  if (insightBox && insightText) {
    if (Math.abs(putErosion) < Math.abs(callErosion)) {
      insightText.textContent =
        "PUT downside risk is more protected than CALL upside";
      insightBox.classList.remove("d-none");
    }
  }

  // --------------------
  // Confidence bands
  // --------------------
  function renderConfidenceChart(days, callTotal, putTotal) {
    const labels = Array.from({ length: days + 1 }, (_, i) => i);

    const linear = (total, factor) =>
      labels.map(d => total * (1 - (d / days) * factor));

    // CALL (symmetric)
    const callExpected = linear(callTotal, 1.0);
    const callHigh = linear(callTotal, 1.2);

    // PUT (asymmetric)
    const putExpected = linear(putTotal, 1.0);
    const putLow = linear(putTotal, 1.45);

    // 🔍 DEBUG BLOCK (KEEP COMMENTED)
    /*
    console.table({
      "PUT Expected (Mid)": putExpected[Math.floor(days / 2)],
      "PUT Low (Mid)": putLow[Math.floor(days / 2)]
    });
    */

    const ctx = document.getElementById("confidenceChart");
    if (!ctx) {
      console.error("confidenceChart canvas missing");
      return;
    }

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Call – Expected",
            data: callExpected,
            borderColor: "#0d6efd",
            borderWidth: 2
          },
          {
            label: "Put – Expected",
            data: putExpected,
            borderColor: "#ffc107",
            borderDash: [5, 5],
            borderWidth: 2
          },
          {
            label: "Put – Protected Zone",
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
          legend: { position: "bottom" }
        },
        scales: {
          x: { title: { display: true, text: "Days Passed" } },
          y: { title: { display: true, text: "Premium (₹)" } }
        }
      }
    });
  }

  renderConfidenceChart(days, callErosion, putErosion);
}
