import { parseAlkmini } from "../alkmini-parser.mjs";
import { colorGraph } from "./graph-coloring.mjs";

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
const TRANSFERRED_HALT_COMMAND = { type: "transferredHalt" };
const EMPTY_INTER_SYMBOL_COMMAND = { type: "emptyIntermediateSymbol" };
const TWO_SKIPPER_COMMAND = { type: "twoSkipper" };
const THREE_SKIPPER_COMMAND = { type: "threeSkipper" };
const TRANS_PRE_SKIP_COMMAND = { type: "transitionPreSkipper" };
const TRANS_SKIPPER_COMMAND = { type: "transitionSkipper" };

function compileAlkmini(program) {
  const info = { program };
  info.info = info;
  
  info.maxOutputSymbols = Math.max(
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
  
  info.transitionSlots = new Map();
  
  getSymbolSlots(info);
  getHaltSlots(info);
  
  Object.assign(info, generateLibraries(info));
  
  Object.assign(info, makeCatalog(info));
  
  console.log(info);
}

function makeCatalog({ info, program }) {
  const start = [
    ...Array.from(program.rules.keys(), sym => makeInterSymbolCommand(sym)),
    EMPTY_INTER_SYMBOL_COMMAND,
  ];
  const tpsSkip = getTransPreSkipSkip(info);
  const transPreSkipCommand =
    tpsSkip === 2
    ? TWO_SKIPPER_COMMAND
    : tpsSkip === 3
    ? THREE_SKIPPER_COMMAND
    : TRANS_PRE_SKIP_COMMAND;
  const end = [
    TWO_SKIPPER_COMMAND, ...repeatNoOp(2),
    THREE_SKIPPER_COMMAND, ...repeatNoOp(3),
    ...(
      transPreSkipCommand.type === TRANS_PRE_SKIP_COMMAND.type
      ? [transPreSkipCommand, ...repeatNoOp(tpsSkip)]
      : []
    ),
    TRANS_SKIPPER_COMMAND, ...repeatNoOp(getTransSkipperSkip(info)),
  ];
  
  const baseSize = start.length + end.length;
  const preCatalogCount = Math.floor(Math.sqrt(baseSize));
  const preCatalogLength = Math.ceil(baseSize/preCatalogCount);
  
  const catalog = [
    ...start,
    ...repeatNoOp(preCatalogCount * preCatalogLength - baseSize),
    ...end,
  ];
  
  return { catalog, preCatalogCount, preCatalogLength, transPreSkipCommand };
}

function getTransPreSkipSkip(info) {
  return 1 + getTransSkipperSkip(info);
}

function getTransSkipperSkip(info) {
  return info.maxOutputSymbols;
}

function repeatNoOp(times) {
  return new Array(times).fill(NOOP_COMMAND);
}

function generateLibraries({ program, transitionSlots }) {
  for (const [slotId, slot] of Array.from(transitionSlots)) {
    if (!slot.table) continue;
    const table = new Map();
    for (const [matchSymbol, result] of slot.table) {
      if (result.type === TRANSFERRED_HALT_COMMAND.type) {
        table.set(matchSymbol, NOOP_COMMAND);
      }
    }
    if (table.size) {
      const imaginaryId = slotId + "::i";
      slot.imaginaryId = imaginaryId;
      transitionSlots.set(imaginaryId, { table });
    }
  }
  
  const graphNodes = [];
  for (const [slotId, slot] of transitionSlots) {
    if (slot.constant) continue;
    const node = { id: slotId, connections: [] };
    for (const otherNode of graphNodes) {
      const otherSlot = transitionSlots.get(otherNode.id);
      if (otherNode.id === slot.imaginaryId) {
        node.paired = otherNode;
        node.pairRole = "before";
        otherNode.paired = node;
        otherNode.pairRole = "after";
        node.connections.push(otherNode);
        otherNode.connections.push(node);
      } else if (node.id === otherSlot.imaginaryId) {
        node.paired = otherNode;
        node.pairRole = "after";
        otherNode.paired = node;
        otherNode.pairRole = "before";
        node.connections.push(otherNode);
        otherNode.connections.push(node);
      } else {
        const hasConflict = Array.from(slot.table).some(
          ([matchSym, result]) =>
            otherSlot.table.has(matchSym) && !commandsEqual(result, otherSlot.table.get(matchSym))
        );
        if (hasConflict) {
          node.connections.push(otherNode);
          otherNode.connections.push(node);
        }
      }
    }
    graphNodes.push(node);
  }
  
  const colors = colorGraph(graphNodes);
  
  for (const node of graphNodes) {
    const slot = transitionSlots.get(node.id);
    slot.libraryCopyIndex = colors.indexOf(node.color);
  }
  
  const libraries = new Map(Array.from(program.rules.keys(), k => [k, Array.from({ length: colors.length }).fill(null)]));
  
  for (const slot of transitionSlots.values()) {
    if (!slot.table) continue;
    for (const [matchSymbol, result] of slot.table) {
      const library = libraries.get(matchSymbol);
      if (library[slot.libraryCopyIndex] === null) {
        library[slot.libraryCopyIndex] = result;
      } else if (!commandsEqual(library[slot.libraryCopyIndex], result)) {
        throw new Error("Created invalid library layout");
      }
    }
  }
  
  for (const library of libraries.values()) {
    for (let i = 0; i < library.length; i++) {
      if (library[i] === null) library[i] = NOOP_COMMAND;
    }
  }
  
  return { libraries, librarySize: colors.length };
}

function getHaltSlots({ program, transitionSlots }) {
  for (const [symbol, rule] of program.rules) {
    const slotId = symbol + ":h";
    if (rule.table) {
      const types = new Set(Array.from(rule.table.values(), prod => prod.halt ? NOOP_COMMAND : TRANSFERRED_HALT_COMMAND));
      if (types.size === 1) {
        const [t] = types;
        transitionSlots.set(slotId, { constant: t });
      } else {
        transitionSlots.set(
          slotId,
          {
            table: new Map(
              Array.from(rule.table, ([matchSym, prod]) => [matchSym, prod.halt ? NOOP_COMMAND : TRANSFERRED_HALT_COMMAND])
            )
          }
        );
      }
    } else {
      transitionSlots.set(slotId, { constant: TRANSFERRED_HALT_COMMAND });
    }
  }
}

function getSymbolSlots({ program, maxOutputSymbols, transitionSlots }) {  
  for (const [symbol, rule] of program.rules) {
    if (rule.table) {
      getSlotsForTabledRule(symbol, rule);
    } else {
      getSlotsForConstantRule(symbol, rule);
    }
  }
  
  
  function getSlotsForTabledRule(symbol, rule) {
    rule = getAlignedTabledRule(rule);
    for (let i = 0; i < maxOutputSymbols; i++) {
      const slot = makeTransitionSlotFor(symbol, i, transitionSlots);
      const resultOptions = new Set(Array.from(rule.table.values(), prod => prod.result[i] ?? null));
      if (resultOptions.size === 1) {
        if (resultOptions.has(null)) {
          slot.constant = EMPTY_INTER_SYMBOL_COMMAND;
        } else {
          const [symbol] = resultOptions;
          slot.constant = makeInterSymbolCommand(symbol);
        }
      } else {
        slot.table = new Map(
          Array.from(
            rule.table,
            ([matchSym, prod]) => [
              matchSym,
              prod.result[i] ? makeInterSymbolCommand(prod.result[i]) : EMPTY_INTER_SYMBOL_COMMAND
            ]
          )
        );
      }
    }
  }
  
  function getAlignedTabledRule(rule) {
    let constantCount = getConstantCount(rule);
    
    posLoop:
    for (let i = maxOutputSymbols - 1; i > 0; i--) {
      const updatedRule = copyRule(rule);
      let symbol;
      for (const prod of updatedRule.table.values()) {
        // get the final non-empty symbol up to the current index
        const prodSymbolInfo = prod.result.reduce((res, sym, j) => j <= i && sym ? [sym, j] : res, undefined);
        if (!prodSymbolInfo) break posLoop; // no symbol to move
        const [prodSymbol, prodSymbolIndex] = prodSymbolInfo;
        if (!symbol) symbol = prodSymbol;
        if (prodSymbol !== symbol) break posLoop; // symbol isn't consistent
        if (prodSymbolIndex === i) {
          continue; // no need to move
        }
        // move the symbol to the current index
        prod.result[prodSymbolIndex] = undefined;
        prod.result[i] = symbol;
      }
      const newConstantCount = getConstantCount(updatedRule);
      if (newConstantCount <= constantCount) continue; // the updated provided no benefit
      // every row's last non-empty symbol up to the current index was the same,
      // and has been moved to the current index, reducing the constant count
      // the rule has been successfully updated
      rule = updatedRule;
      constantCount = newConstantCount;
    }
    
    // remove empty columns to make them implicit on the right edge
    for (let i = maxOutputSymbols - 2; i >= 0; i--) {
      if (Array.from(rule.table.values()).every(prod => !prod.result[i])) {
        rule = copyRule(rule);
        for (const prod of rule.table.values()) {
          prod.result.splice(i, 1);
        }
      }
    }
    
    return rule;
    
    
    function copyRule(rule) {
      return {
        ...rule,
        table: new Map(Array.from(rule.table, ([matchSym, prod]) => [matchSym, { ...prod, result: prod.result.slice() }])),
      };
    }
    
    function getConstantCount(rule) {
      let count = 0;
      for (let i = 0; i < maxOutputSymbols; i++) {
        const symbols = new Set();
        for (const prod of rule.table.values()) {
          symbols.add(prod.result[i] ?? null);
        }
        if (symbols.size === 1) count++;
      }
      return count;
    }
  }
  
  function getSlotsForConstantRule(symbol, rule) {
    for (let i = 0; i < maxOutputSymbols; i++) {
      const slot = makeTransitionSlotFor(symbol, i, transitionSlots);
      slot.constant = rule.constant[i] ? makeInterSymbolCommand(rule.constant[i]) : EMPTY_INTER_SYMBOL_COMMAND;
    }
  }
}

function makeTransitionSlotFor(symbol, resultIndex, transitionSlots) {
  const slotId = `${symbol}:${resultIndex}`;
  const slot = {};
  transitionSlots.set(slotId, slot);
  return slot;
}

function commandsEqual(a, b) {
  if (a.type !== b.type) return false;
  return a.type === "symbol" || a.type === "intermediateSymbol" ? a.symbol === b.symbol : true;
}

function makeInterSymbolCommand(symbol) {
  return { type: "intermediateSymbol", symbol };
}

function makeSymbolCommand(symbol) {
  return { type: "symbol", symbol };
}
