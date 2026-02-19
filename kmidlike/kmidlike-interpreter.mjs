// config has:
// - beforeInit: optional function called before initializing the program
// - getProgramSource: function that returns program source code to use
// - parse: function that takes a string and returns a parsed program
// - getStepAmount: function that returns number of steps for doSteps to run; may be a string to be parsed
// - displayData: function called with string to display as current program state
// - displayHalted: optional function called with halt state to be displayed
// - doTransition: function taking rule, symbol index in program data, and program, potentially updating the program, and returning new symbol(s) (individual or array)
// - afterTransitions: optional function called after applying all transitions for a step, taking this program and potentially updating it
// - detectHalted: optional function taking the program and returning a boolean indicating whether, based on its state, the program has halted
export function initInterpreter(config) {
  return {
    ...config,
    program: null,
    initProgram() {
      this.beforeInit?.();
      this.program = this.parse(this.getProgramSource());
      this.program.halted = false;
      this.detectAndUpdateHalted();
      this.getAndDisplayState();
    },
    tryInitProgram() {
      try {
        this.initProgram();
      } catch(e) {
        this.displayError(e);
      }
    },
    doSteps() {
      if (!this.program) {
        this.initProgram();
        return;
      }
      const stepAmountSource = this.getStepAmount();
      const stepAmount = Number(stepAmountSource);
      if (stepAmount < 1 || !Number.isInteger(stepAmount)) throw new Error(`Invalid step amount: ${JSON.stringify(stepAmountSource)}`);
      for (let i = 0; i < stepAmount && !this.program.halted; i++) {
        this.step();
      }
      this.getAndDisplayState();
    },
    tryDoSteps() {
      try {
        this.doSteps();
      } catch(e) {
        this.displayError(e);
      }
    },
    step() {
      if (this.program.halted) return;
      const newData = [];
      for (const [i, symbol] of this.program.data.entries()) {
        const rule = this.program.rules.get(symbol);
        if (!rule) throw new Error(`No rule found for symbol ${JSON.stringify(symbol)}`);
        const symbolOutput = this.doTransition(rule, i, this.program);
        if (Array.isArray(symbolOutput)) newData.push(...symbolOutput);
        else newData.push(symbolOutput);
      }
      this.program.data = newData;
      this.afterTransitions?.(this.program);
      this.detectAndUpdateHalted();
    },
    detectAndUpdateHalted() {
      if (this.detectHalted?.(this.program)) this.program.halted = true;
    },
    getAndDisplayState() {
      this.displayData(this.getDataString());
      this.displayHalted?.(this.program.halted);
    },
    getDataString() {
      return this.program.data.join(this.program.symbolLength === 1 ? "" : " ");
    },
    displayError(e) {
      console.error(e);
      alert(e);
    }
  };
}
