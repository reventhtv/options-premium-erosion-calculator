console.log("analysis.js loaded");

const snapshotRaw = sessionStorage.getItem("erosionSnapshot");

if (!snapshotRaw) {
  alert("No snapshot found. Go back and calculate first.");
} else {

  const snapshot = JSON.parse(snapshotRaw);
  const ₹ = v => "₹" + Number(v).toFixed(2);

  document.getElementById("snapCall").textContent =
    ₹(snapshot.call.totalErosion);

  document.getElementById("snapPut").textContent =
    ₹(snapshot.put.totalErosion);

  document.getElementById("snapRatio").textContent =
    Math.abs(
      snapshot.call.totalErosion / snapshot.put.totalErosion
    ).toFixed(2);

  const days = snapshot.days;

  const labels = Array.from({ length: days + 1 }, (_, i) => i);

  const callLine = labels.map(d =>
    snapshot.call.totalErosion * (1 - d / days)
  );

  const putLine = labels.map(d =>
    snapshot.put.totalErosion * (1 - d / days)
  );

  new Chart(document.getElementById("chart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Call Expected",
          data: callLine,
          borderColor: "#0d6efd",
          borderWidth: 2
        },
        {
          label: "Put Expected",
          data: putLine,
          borderColor: "#ffc107",
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });
}
