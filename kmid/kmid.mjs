import { initInterpreter } from "../kmidlike/kmidlike-interpreter.mjs";
import { parseKmidi, parseKmidt } from "./kmid-parser.mjs";

const programInp = document.getElementById("programInp");
const variantInp = document.getElementById("variantInp");
const initializeButton = document.getElementById("initializeButton");
const stepAmountInp = document.getElementById("stepAmountInp");
const stepButton = document.getElementById("stepButton");
const dataElem = document.getElementById("dataElem");

let parseFunc, transitionFunc;

const kmid = initInterpreter({
  beforeInit() {
    parseFunc = variantInp.value === "kmidt" ? parseKmidt : parseKmidi;
    transitionFunc = variantInp.value === "kmidt" ? transitionKmidt : transitionKmidi;
  },
  getProgramSource() {
    return programInp.value;
  },
  parse(source) {
    return parseFunc(source);
  },
  getStepAmount() {
    return stepAmountInp.value;
  },
  displayData(str) {
    dataElem.textContent = str;
  },
  doTransition(rule, i, program) {
    return transitionFunc(rule, i, program);
  },
  afterTransitions(program) {
    program.data.push(program.firstSymbol);
  },
  detectHalted(program) {
    return program.data.includes(program.haltSymbol);
  }
});

initializeButton.addEventListener("click", () => kmid.tryInitProgram());

stepButton.addEventListener("click", () => kmid.tryDoSteps());

function transitionKmidt(rule, i, program) {
  if (rule.constant) return rule.constant;
  const refSymbol = program.data[i - rule.offset];
  if (!refSymbol) throw new Error(`Not enough symbols before ${JSON.stringify(program.data[i])} at ${i}`);
  const outSymbol = rule.table.get(refSymbol);
  if (!outSymbol) throw new Error(`No transition found for symbol ${JSON.stringify(program.data[i])} referencing ${JSON.stringify(refSymbol)}`);
  return outSymbol;
}

function transitionKmidi(rule, i, program) {
  if (rule.constant) return rule.constant;
  const refSymbol = program.data[i - rule.offset];
  if (!refSymbol) throw new Error(`Not enough symbols before ${JSON.stringify(program.data[i])} at ${i}`);
  return program.rules.get(refSymbol).library[rule.index];
}
