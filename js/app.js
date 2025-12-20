// app.js — VERIFIED SAFE VERSION

console.log("app.js loaded"); // 🔍 execution proof

// --------------------
// Helpers
// --------------------
function formatINR(v) {
  return "Rs " + Number(v).toFixed(2);
}

// --------------------
// DOM Elements
// --------------------
const btnCalcCall = document.getElementById("btnCalcCall");
const btnCalcPut = document.getElementById("btnCalcPut");
const btnCalcBoth = document.getElementById("btnCalcBoth");
const btnReset = document.getElementById("btnReset");

const analysisCTA = document.getElementById("analysisCTA");

// Call inputs
const callTheta = document.getElementById("callTheta");
const callDaysToExpiry = document.getElementById("callDaysToExpiry");
const callPremium = document.getElementById("callPremium");

// Call outputs
const callResults = document.getElementById("callResults");
const callDailyTheta = document.getElementById("callDailyTheta");
const callWeeklyErosion = document.getElementById("callWeeklyErosion");
const callPremiumExpiry = document.getElementById("callPremiumExpiry");
const callTotalErosion = document.getElementById("callTotalErosion");

// Put inputs
const putTheta = document.getElementById("putTheta");
const putDaysToExpiry = document.getElementById("putDaysToExpiry");
const putPremium = document.getElementById("putPremium");

// Put outputs
const putResults = document.getElementById("putResults");
const putDailyTheta = document.getElementById("putDailyTheta");
const putWeeklyErosion = document.getElementById("putWeeklyErosion");
const putPremiumExpiry = document.getElementById("putPremiumExpiry");
const putTotalErosion = document.getElementById("putTotalErosion");

// --------------------
// UI helpers
// --------------------
function showCTA() {
  if (analysisCTA) {
    analysisCTA.classList.remove("d-none");
  }
}

// --------------------
// Calculations
// --------------------
function calcCall() {
  console.log("calcCall fired");

  const theta = Number(callTheta.value);
  const days = Number(callDaysToExpiry.value);
  const premium = Number(callPremium.value);

  callDailyTheta.textContent = formatINR(theta);
  callWeeklyErosion.textContent = formatINR(theta * 7);
  callPremiumExpiry.textContent = formatINR(premium + theta * days);
  callTotalErosion.textContent = formatINR(theta * days);

  callResults.classList.remove("d-none");
  showCTA();
}

function calcPut() {
  console.log("calcPut fired");

  const theta = Number(putTheta.value);
  const days = Number(putDaysToExpiry.value);
  const premium = Number(putPremium.value);

  putDailyTheta.textContent = formatINR(theta);
  putWeeklyErosion.textContent = formatINR(theta * 7);
  putPremiumExpiry.textContent = formatINR(premium + theta * days);
  putTotalErosion.textContent = formatINR(theta * days);

  putResults.classList.remove("d-none");
  showCTA();
}

function calcBoth() {
  console.log("calcBoth fired");
  calcCall();
  calcPut();
}

// --------------------
// Event bindings
// --------------------
if (btnCalcCall) btnCalcCall.addEventListener("click", calcCall);
if (btnCalcPut) btnCalcPut.addEventListener("click", calcPut);
if (btnCalcBoth) btnCalcBoth.addEventListener("click", calcBoth);

if (btnReset) {
  btnReset.addEventListener("click", () => {
    location.reload();
  });
}
