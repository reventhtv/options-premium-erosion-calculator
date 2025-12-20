// analysis.js

const data = JSON.parse(localStorage.getItem("optionCalculatorInputs")) || {};

function ₹(v) {
  return "₹" + Number(v).toFixed(2);
}

function init() {
  if (!data.callTheta) return;

  const callTotal = data.callTheta * data.callDaysToExpiry;
  const putTotal  = data.putTheta  * data.putDaysToExpiry;

  document.getElementById("snapCall").textContent = ₹(callTotal);
  document.getElementById("snapPut").textContent  = ₹(putTotal);
  document.getElementById("snapRatio").textContent =
    Math.abs(callTotal / putTotal).toFixed(2) + ":1";

  document.getElementById("cmpCallTheta").textContent = ₹(data.callTheta);
  document.getElementById("cmpPutTheta").textContent  = ₹(data.putTheta);
  document.getElementById("cmpCallWeekly").textContent = ₹(data.callTheta * 7);
  document.getElementById("cmpPutWeekly").textContent  = ₹(data.putTheta * 7);
  document.getElementById("cmpCallTotal").textContent = ₹(callTotal);
  document.getElementById("cmpPutTotal").textContent  = ₹(putTotal);

  drawChart(callTotal, putTotal);
}

function drawChart(callTotal, putTotal) {
  const days = [...Array(31).keys()];
  const callData = days.map(d => Math.max(0, callTotal * (1 - d / 30)));
  const putData  = days.map(d => Math.max(0, putTotal  * (1 - d / 30)));

  new Chart(document.getElementById("erosionChart"), {
    type: "line",
    data: {
      labels: days,
      datasets: [
        { label: "Call", data: callData, borderColor: "#28a745" },
        { label: "Put",  data: putData,  borderColor: "#dc3545" }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: "bottom" } }
    }
  });
}

document.getElementById("recalcAnalysis").addEventListener("click", init);

init();
