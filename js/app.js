// app.js — CTA + Navigation enabled

const ₹ = v => "₹" + Number(v).toFixed(2);

function showCTA() {
  document.getElementById("analysisCTA").classList.remove("d-none");
}

function calcCall() {
  const theta = Number(callTheta.value);
  const days = Number(callDaysToExpiry.value);
  const premium = Number(callPremium.value);

  callDailyTheta.textContent = ₹(theta);
  callWeeklyErosion.textContent = ₹(theta * 7);
  callPremiumExpiry.textContent = ₹(premium + theta * days);
  callTotalErosion.textContent = ₹(theta * days);

  callResults.classList.remove("d-none");
  showCTA();
}

function calcPut() {
  const theta = Number(putTheta.value);
  const days = Number(putDaysToExpiry.value);
  const premium = Number(putPremium.value);

  putDailyTheta.textContent = ₹(theta);
  putWeeklyErosion.textContent = ₹(theta * 7);
  putPremiumExpiry.textContent = ₹(premium + theta * days);
  putTotalErosion.textContent = ₹(theta * days);

  putResults.classList.remove("d-none");
  showCTA();
}

function calcBoth() {
  calcCall();
  calcPut();
}

btnCalcCall.onclick = calcCall;
btnCalcPut.onclick = calcPut;
btnCalcBoth.onclick = calcBoth;

btnReset.onclick = () => location.reload();
