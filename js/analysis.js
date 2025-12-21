console.log("analysis.js loaded");

const snapshotRaw = sessionStorage.getItem("erosionSnapshot");

if (!snapshotRaw) {
  alert("No snapshot found. Please calculate first.");
} else {

  const snapshot = JSON.parse(snapshotRaw);
  const ₹ = v => "₹" + Number(v).toFixed(2);

  const callTotal = snapshot.call.totalErosion;
  const putTotal = snapshot.put.totalErosion;
  const days = snapshot.days;

  // Populate snapshot
  document.getElementById("snapCall").textContent = ₹(callTotal);
  document.getElementById("snapPut").textContent = ₹(putTotal);
  document.getElementById("snapDays").textContent = days + " days";
  document.getElementById("snapRatio").textContent =
    Math.abs(callTotal / putTotal).toFixed(2) + " : 1";

  // Build chart data
  const labels = Array.from({ length: days + 1 }, (_, i) => i);

  const linear = (total, factor) =>
    labels.map(d => total * (1 - (d / days) * factor));

  // CALL (symmetric)
  const callExpected = linear(callTotal, 1.0);
  const callHigh = linear(callTotal, 1.2);
  const callLow = linear(callTotal, 0.8);

  // PUT (asymmetric – protection on downside)
  const putExpected = linear(putTotal, 1.0);
  const putHigh = linear(putTotal, 0.7);
  const putLow = linear(putTotal, 1.4);

  new Chart(document.getElementById("confidenceChart"), {
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
          label: "Call – High Erosion",
          data: callHigh,
          backgroundColor: "rgba(13,110,253,0.2)",
          fill: "-1",
          borderWidth: 0
        },
        {
          label: "Call – Low Erosion",
          data: callLow,
          backgroundColor: "rgba(25,135,84,0.2)",
          fill: "-1",
          borderWidth: 0
        },
        {
          label: "Put – Expected",
          data: putExpected,
          borderColor: "#ffc107",
          borderDash: [5,5],
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
