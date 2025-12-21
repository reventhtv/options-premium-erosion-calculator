console.log("app.js loaded");

const ₹ = v => "₹" + Number(v).toFixed(2);

// Inputs
const callPremium = document.getElementById("callPremium");
const callTheta = document.getElementById("callTheta");
const callDays = document.getElementById("callDays");

const putPremium = document.getElementById("putPremium");
const putTheta = document.getElementById("putTheta");
const putDays = document.getElementById("putDays");

// Outputs
const callResult = document.getElementById("callResult");
const putResult = document.getElementById("putResult");

function calcCall() {
  const total = Number(callTheta.value) * Number(callDays.value);
  callResult.textContent = `Total Erosion: ${₹(total)}`;
  return total;
}

function calcPut() {
  const total = Number(putTheta.value) * Number(putDays.value);
  putResult.textContent = `Total Erosion: ${₹(total)}`;
  return total;
}

document.getElementById("btnCalcCall").onclick = calcCall;
document.getElementById("btnCalcPut").onclick = calcPut;

document.getElementById("btnCalcBoth").onclick = () => {
  const callTotal = calcCall();
  const putTotal = calcPut();

  const snapshot = {
    call: { totalErosion: callTotal },
    put: { totalErosion: putTotal },
    days: Number(callDays.value),
    timestamp: Date.now()
  };

  sessionStorage.setItem("erosionSnapshot", JSON.stringify(snapshot));
  console.log("Snapshot stored", snapshot);

  window.location.href = "analysis.html";
};
