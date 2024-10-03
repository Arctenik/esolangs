const programInp = document.getElementById("programInp");
const variantInp = document.getElementById("variantInp");
const initializeButton = document.getElementById("initializeButton");
const stepAmountInp = document.getElementById("stepAmountInp");
const stepButton = document.getElementById("stepButton");
const dataElem = document.getElementById("dataElem");

let stepFunc, program;

initializeButton.addEventListener("click", () => {
  try {
    initProgram();
  } catch(e) {
    console.error(e);
    alert(e);
  }
});

stepButton.addEventListener("click", () => {
  try {
    if (!program) {
      initProgram();
      return;
    }
    const stepAmount = Number(stepAmountInp.value);
    if (stepAmount < 1 || !Number.isInteger(stepAmount)) throw new Error(`Invalid step amount: ${JSON.stringify(stepAmountInp.value)}`);
    for (let i = 0; i < stepAmount && !program.halted; i++) {
      stepFunc();
    }
    showData();
  } catch(e) {
    console.error(e);
    alert(e);
  }
});

function initProgram() {
  stepFunc = variantInp.value === "kmidt" ? stepKmidt : stepKmidi;
  program = (variantInp.value === "kmidt" ? parseKmidt : parseKmidi)(programInp.value);
  program.halted = program.data.includes(program.haltSymbol);
  showData();  
}

function showData() {
  dataElem.textContent = program.data.join(program.symbolLength === 1 ? "" : " ");
  // TODO show halt status here maybe?
}

function stepKmidt() {
  if (program.halted) return;
  const newData = [];
  for (const [i, symbol] of program.data.entries()) {
    const rule = program.rules.get(symbol);
    if (!rule) throw new Error(`No rule found for symbol ${JSON.stringify(symbol)}`);
    if (rule.constant) {
      newData.push(rule.constant);
      continue;
    }
    const refSymbol = program.data[i - rule.offset];
    if (!refSymbol) throw new Error(`Not enough symbols before ${JSON.stringify(symbol)} at ${i}`);
    const outSymbol = rule.table.get(refSymbol);
    if (!outSymbol) throw new Error(`No transition found for symbol ${JSON.stringify(symbol)} referencing ${JSON.stringify(refSymbol)}`);
    newData.push(outSymbol);
  }
  newData.push(program.firstSymbol);
  program.data = newData;
  if (program.data.includes(program.haltSymbol)) program.halted = true;
}

function stepKmidi() {
  if (program.halted) return;
  const newData = [];
  for (const [i, symbol] of program.data.entries()) {
    const rule = program.rules.get(symbol);
    if (!rule) throw new Error(`No rule found for symbol ${JSON.stringify(symbol)}`);
    if (rule.constant) {
      newData.push(rule.constant);
      continue;
    }
    const refSymbol = program.data[i - rule.offset];
    if (!refSymbol) throw new Error(`Not enough symbols before ${JSON.stringify(symbol)} at ${i}`);
    newData.push(program.rules.get(refSymbol).library[rule.index]);
  }
  newData.push(program.firstSymbol);
  program.data = newData;
  if (program.data.includes(program.haltSymbol)) program.halted = true;
}
