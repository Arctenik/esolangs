import { parseAlkmini } from "../alkmini-parser.mjs";

const programInp = document.getElementById("programInp");
const compileButton = document.getElementById("compileButton");
const resultElem = document.getElementById("resultElem");

compileButton.addEventListener("click", async () => {
  const code = programInp.value;
  resultElem.textContent = compileAlkmini(parseAlkmini(code));
});

resultElem.addEventListener("dblclick", () => {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNode(resultElem);
  selection.removeAllRanges();
  selection.addRange(range);
});


const NOOP_COMMAND = { type: "noOp" };
const PP_CATALOG_COMMAND = { type: "prePreCatalog" };
const SYM_PRESERVER_COMMAND = { type: "symbolPreserver" };
const HALT_SKIPPER_COMMAND = { type: "haltSkipper" };

function compileAlkmini(program) {
  console.log(program);
  
  let maxOutputSymbols = Math.max(
    ...Array.from(
      program.rules.values(),
      rule => {
        if (rule.constant) {
          return rule.constant.length;
        } else {
          return Array.from(
            rule.table.values(),
            production => production.result.length
          );
        }
      }
    ).flat()
  );
  
  const transitionSlots = new Map();
  
  for (const [symbol, rule] of program.rules) {
    if (rule.table) {
      for (let i = 0; i < maxOutputSymbols; i++) {
        const slots = makeTransitionSlotsFor(symbol, i, transitionSlots);
        const resultOptions = new Set(Array.from(rule.table.values(), prod => prod.result[i] ?? null));
        if (resultOptions.size === 1 && resultOptions.has(null)) {
          for (const slot of slots) {
            slot.constant = NOOP_COMMAND;
          }
        } else {
          let varySymbol = true;
          let varyStructure = true;
          if (resultOptions.size === 1) {
            varySymbol = false;
            varyStructure = false;
          } else if (!resultOptions.has(null)) {
            varyStructure = false;
          }
          if (varySymbol) {
            slots[1].table = new Map();
            for (const [matchSymbol, production] of rule.table) {
              const resultSymbol = production.result[i];
              slots[1].table.set(matchSymbol, resultSymbol ? makeSymbolCommand(resultSymbol) : NOOP_COMMAND);
            }
          } else {
            slots[1].constant = makeSymbolCommand([...resultOptions][0]);
          }
          if (varyStructure) {
            slots[0].table = new Map();
            slots[2].table = new Map();
            for (const [matchSymbol, production] of rule.table) {
              if (production.result[i]) {
                slots[0].table.set(matchSymbol, SYM_PRESERVER_COMMAND);
                slots[2].table.set(matchSymbol, PP_CATALOG_COMMAND);
              } else {
                slots[0].table.set(matchSymbol, NOOP_COMMAND);
                slots[2].table.set(matchSymbol, NOOP_COMMAND);
              }
            }
          } else {
            slots[0].constant = SYM_PRESERVER_COMMAND;
            slots[2].constant = PP_CATALOG_COMMAND;
          }
        }
      }
    } else {
      for (let i = 0; i < maxOutputSymbols; i++) {
        const slots = makeTransitionSlotsFor(symbol, i, transitionSlots);
        const resultSymbol = rule.constant[i];
        if (resultSymbol) {
          slots[0].constant = SYM_PRESERVER_COMMAND;
          slots[1].constant = makeSymbolCommand(resultSymbol);
          slots[2].constant = PP_CATALOG_COMMAND;
        } else {
          for (const slot of slots) {
            slot.constant = NOOP_COMMAND;
          }
        }
      }
    }
  }
  
  console.log(transitionSlots);
}

function makeTransitionSlotsFor(symbol, resultIndex, transitionSlots) {
  return Array.from(
    { length: 3 },
    (_, i) => {
      const slotId = `${symbol}:${resultIndex * 3 + i}`;
      const slot = {};
      transitionSlots.set(slotId, slot);
      return slot;
    }
  );
}

function makeSymbolCommand(symbol) {
  return { type: "symbol", symbol };
}
