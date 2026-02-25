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
const TRANSFERRED_HALT_COMMAND = { type: "transferredHalt" };

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
  
  const transitionSlots = getTransitionSlots(program, maxOutputSymbols);
  
  console.log(transitionSlots);
  
  const haltSlots = getHaltSlots(program);
  
  console.log(haltSlots);
  
  const libraries = generateLibraries(transitionSlots, haltSlots);
  
  console.log(libraries);
}

function generateLibraries(transitionSlots, haltSlots) {
  const imaginarySlots = new Map();
  for (const slotSet of [transitionSlots, haltSlots]) {
    for (const [slotId, slot] of slotSet) {
      if (!slot.table) continue;
      const table = new Map();
      for (const [matchSymbol, result] of slot.table) {
        if (result.type === SYM_PRESERVER_COMMAND.type || result.type === HALT_SKIPPER_COMMAND.type) {
          table.set(matchSymbol, NOOP_COMMAND);
        }
      }
      if (table.size) imaginarySlots.set(slotId + "::i", { table });
    }
  }
  console.log(imaginarySlots);
}

function getHaltSlots(program) {
  const haltSlots = new Map();
  
  for (const [symbol, rule] of program.rules) {
    const slotId = symbol + ":h";
    if (rule.table) {
      const types = new Set(Array.from(rule.table.values(), prod => prod.halt ? TRANSFERRED_HALT_COMMAND : HALT_SKIPPER_COMMAND));
      if (types.size === 1) {
        haltSlots.set(slotId, { constant: [...types][0] });
      } else {
        haltSlots.set(
          slotId,
          {
            table: new Map(
              Array.from(rule.table, ([matchSym, prod]) => [matchSym, prod.halt ? TRANSFERRED_HALT_COMMAND : HALT_SKIPPER_COMMAND])
            )
          }
        );
      }
    } else {
      haltSlots.set(slotId, { constant: HALT_SKIPPER_COMMAND });
    }
  }
  
  return haltSlots;
}

function getTransitionSlots(program, maxOutputSymbols) {
  const transitionSlots = new Map();
  
  for (const [symbol, rule] of program.rules) {
    if (rule.table) {
      getSlotsForTabledRule(symbol, rule);
    } else {
      getSlotsForConstantRule(symbol, rule);
    }
  }
  
  return transitionSlots;
  
  
  function getSlotsForTabledRule(symbol, rule) {
    rule = getSpacedTabledRule(rule);
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
  }
  
  function getSpacedTabledRule(rule) {
    let constantCount = getConstantCount(rule);
    
    posLoop:
    for (let i = maxOutputSymbols - 1; i > 0; i--) {
      const updatedRule = { ...rule, table: new Map(rule.table) };
      let updatedAll = true;
      let symbol;
      for (const [matchSymbol, prod] of updatedRule.table) {
        // get the final non-empty symbol up to the current index
        const prodSymbolInfo = prod.result.reduce((res, sym, j) => j <= i && sym ? [sym, j] : res, undefined);
        if (!prodSymbolInfo) break posLoop; // no symbol to move
        const [prodSymbol, prodSymbolIndex] = prodSymbolInfo;
        if (!symbol) symbol = prodSymbol;
        if (prodSymbol !== symbol) break posLoop; // symbol isn't consistent
        if (prodSymbolIndex === i) {
          updatedAll = false;
          continue; // no need to move
        }
        // move the symbol to the current index
        const newProd = { ...prod, result: prod.result.slice() };
        updatedRule.table.set(matchSymbol, newProd);
        newProd.result[prodSymbolIndex] = undefined;
        newProd.result[i] = symbol;
      }
      if (updatedAll) continue; // whole column is empty; probably better left as-is
      const newConstantCount = getConstantCount(updatedRule);
      if (newConstantCount <= constantCount) break; // the updated provided no benefit
      // every row's last non-empty symbol up to the current index was the same,
      // and has been moved to the current index, reducing the constant count
      // the rule has been successfully updated
      rule = updatedRule;
      constantCount = newConstantCount;
    }
    
    return rule;
    
    
    function getConstantCount(rule) {
      let count = 0;
      for (let i = 0; i < maxOutputSymbols; i++) {
        const symbols = new Set();
        for (const prod of rule.table.values()) {
          symbols.add(prod.result[i] ?? null);
        }
        if (symbols.size === 1) {
          count += 3;
        } else if (!symbols.has(null)) {
          count += 2;
        }
      }
      return count;
    }
  }
  
  function getSlotsForConstantRule(symbol, rule) {
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
