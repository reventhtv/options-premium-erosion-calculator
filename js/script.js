import {
    calculateCall,
    calculatePut,
    calculateBoth,
    resetAll,
    exportCSV
} from './app.js';

document.addEventListener('DOMContentLoaded', () => {
    calculateCallBtn.onclick = calculateCall;
    calculatePutBtn.onclick = calculatePut;
    calculateBothBtn.onclick = calculateBoth;
    resetBtn.onclick = resetAll;
    exportCsvBtn.onclick = exportCSV;
});
