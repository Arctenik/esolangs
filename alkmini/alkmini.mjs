import { initInterpreter } from "../kmidlike/kmidlike-interpreter.mjs";
import { parseAlkmini } from "./alkmini-parser.mjs";

const programInp = document.getElementById("programInp");
const initializeButton = document.getElementById("initializeButton");
const stepAmountInp = document.getElementById("stepAmountInp");
const stepButton = document.getElementById("stepButton");
const haltStatusElem = document.getElementById("haltStatusElem");
const dataElem = document.getElementById("dataElem");

const alkmini = initInterpreter({
  getProgramSource() {
    return programInp.value;
  },
  parse(source) {
    return parseAlkmini(source);
  },
  getStepAmount() {
    return stepAmountInp.value;
  },
  displayData(str) {
    dataElem.textContent = str;
  },
  displayHalted(halted) {
    if (halted) haltStatusElem.classList.add("halted");
    else haltStatusElem.classList.remove("halted");
  },
  doTransition(rule, i, program) {
    if (rule.constant) return rule.constant;
    const refSymbol = program.data[i - 1];
    if (!refSymbol) throw new Error(`No symbols before ${JSON.stringify(program.data[i])} at ${i}`);
    const resultInfo = rule.table.get(refSymbol);
    if (!resultInfo) throw new Error(`No transition found for symbol ${JSON.stringify(program.data[i])} referencing ${JSON.stringify(refSymbol)}`);
    if (resultInfo.halt) program.halted = true;
    return resultInfo.result;
  }
});

initializeButton.addEventListener("click", () => alkmini.tryInitProgram());

stepButton.addEventListener("click", () => alkmini.tryDoSteps());
