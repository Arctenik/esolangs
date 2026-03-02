import { parseAlkmini } from "../alkmini-parser.mjs";
import { colorGraph } from "./graph-coloring.mjs";

const programInp = document.getElementById("programInp");
const compileButton = document.getElementById("compileButton");
const compileStatusElem = document.getElementById("compileStatusElem");
const resultElem = document.getElementById("resultElem");

compileButton.addEventListener("click", async () => {
  try {
    const code = programInp.value;
    const { code: resultCode, commandCollisionGroups } = compileAlkmini(parseAlkmini(code));
    resultElem.textContent = resultCode;
    if (commandCollisionGroups.length) {
      const groupTextParts = commandCollisionGroups.map(g => "(" + g.join(" ") + ")");
      showCompileError(
        `Warning: The generated Kwert program is not valid, as there ${
          commandCollisionGroups.length === 1 ? "is a set" : "are sets"
        } of identical commands ${
          groupTextParts.length > 2
          ? groupTextParts.slice(0, groupTextParts.length - 1).join(", ") + ", and " + groupTextParts[groupTextParts.length - 1]
          : groupTextParts.join(" and ")
        }`
      );
    } else {
      hideCompileStatus();
    }
  } catch (e) {
    console.error(e);
    showCompileError(e);
  }
});

function showCompileError(message) {
  compileStatusElem.textContent = message;
  compileStatusElem.classList.add("error");
}

function hideCompileStatus() {
  compileStatusElem.classList.remove("error");
}

resultElem.addEventListener("dblclick", () => {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNode(resultElem);
  selection.removeAllRanges();
  selection.addRange(range);
});


const BASE_COMMAND_NAME_SIZE = 5;

const NOOP_COMMAND = { type: "noOp", name: "noop" };
const TRANSFERRED_HALT_COMMAND = { type: "transferredHalt" };
const EMPTY_INTER_SYMBOL_COMMAND = { type: "emptyIntermediateSymbol", name: "eisym" };
const TWO_SKIPPER_COMMAND = { type: "twoSkipper", name: "2skip" };
const THREE_SKIPPER_COMMAND = { type: "threeSkipper", name: "3skip" };
const TRANS_PRE_SKIP_COMMAND = { type: "transitionPreSkipper", name: "tpskp" };
const TRANS_SKIPPER_COMMAND = { type: "transitionSkipper", name: "tskip" };
const CATALOG_GEN_COMMAND = { type: "catalogGenerator", name: "catgn" };
const PADDING_PRE_GEN_COMMAND = { type: "paddingPreGenerator", name: "padpg" };
const SYMBOL_SKIPPER_COMMAND = { type: "symbolSkipper", name: "smskp" };
const PHASE_ONE_HANDLER_COMMAND = { type: "phaseOneHandler", name: "phas1" };
const PHASE_TWO_HANDLER_COMMAND = { type: "phaseTwoHandler", name: "phas2" };
const PHASE_THREE_HANDLER_COMMAND = { type: "phaseThreeHandler", name: "phas3" };
const PHASE_FOUR_HANDLER_COMMAND = { type: "phaseFourHandler", name: "phas4" };
const PHASE_FIVE_HANDLER_COMMAND = { type: "phaseFiveHandler", name: "phas5" };
const BEGINNING_PADDING_PRE_COMMAND = { type: "beginningPaddingPreGenerator", name: "bppgn" };
const BEGINNING_CATALOG_GEN_COMMAND = { type: "beginningCatalogGenerator", name: "bctgn" };
const INTER_PADDING_PRE_COMMAND = { type: "intermediatePaddingPreGenerator", name: "ippgn" };
const INTER_CATALOG_GEN_COMMAND = { type: "intermediateCatalogGenerator", name: "ictgn" };
const NOOP_PRESERVER_COMMAND = { type: "noOpPreserver", name: "noppr" };
const PADDING_GEN_COMMAND = { type: "paddingGenerator", name: "padgn" };
const HALT_SKIPPER_COMMAND = { type: "haltSkipper", name: "hskip" };
const BEGINNING_SKIPPER_COMMAND = { type: "beginningSkipper", name: "bskip" };
const HALT_COMMAND = { type: "halt", getName: size => "$".repeat(size) };

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
  
  getSymbolSlots(info, program);
  getHaltSlots(info);
  
  Object.assign(info, generateLibraries(info));
  
  Object.assign(info, makeCatalog(info));
  Object.assign(info, makeInterCatalog(info));
  
  resolvePaddingSize(info);
  
  Object.assign(info, makeBeginningData(info));
  
  info.symbolCommandDefs = makeSymbolCommandDefs(info);
  info.interSymbolCommandDefs = makeInterSymbolCommandDefs(info);
  info.otherCommandDefs = makeOtherCommandDefs(info);
  
  info.initialState = makeInitialProgramState(info);
  
  // console.log(info);
  // console.log(getPhase2CellSize(info), getPhase4CellSize(info), getPhase5CellSize(info));
  
  return makeKwertCode(info);
}

function makeKwertCode(info) {
  const idSize = Math.max(BASE_COMMAND_NAME_SIZE, 2 + info.program.symbolLength);
  
  const processedIds = new Set();
  const commandsByCode = new Map();
  
  for (const command of info.initialState) {
    if (command.type === "separator") continue;
    const id = getId(command);
    if (!processedIds.has(id)) {
      processedIds.add(id);
      const def =
        command.type === "symbol"
        ? info.symbolCommandDefs.get(command.symbol)
        : command.type === "intermediateSymbol"
        ? info.interSymbolCommandDefs.get(command.symbol)
        : info.otherCommandDefs.get(command.type);
      let commandCode;
      if (def.halt) {
        commandCode = "[$]";
      } else {
        const copiesCode = (def.copies ?? []).map(c => `${c.length} ${c.distance}`).join(", ");
        commandCode = `[${copiesCode}${def.skip ? "; " + def.skip : ""}]`;
      }
      if (!commandsByCode.has(commandCode)) commandsByCode.set(commandCode, []);
      commandsByCode.get(commandCode).push({ command, id });
    }
  };
  
  const commandCodeById = new Map();
  const commandCollisionGroups = [];
  const idReplacements = new Map();
  
  for (const [code, commands] of commandsByCode) {
    if (commands.length > 1) {
      if (commands.every(({ command }) => command.type === "intermediateSymbol")) {
        const newId = getId(commands[0].command, "+");
        commandCodeById.set(newId, code);
        for (const { id } of commands) {
          idReplacements.set(id, newId);
        }
        continue;
      } else {
        commandCollisionGroups.push(commands.map(({ id }) => id));
      }
    }
    for (const { id } of commands) {
      commandCodeById.set(id, code);
    }
  }
  
  const definitionsCode = Array.from(commandCodeById, ([id, code]) => `\` ${id} ${code}`).join("\n");
  
  let commandsCode = "` ";
  let needsSpace = false;
  
  for (const command of info.initialState) {
    if (command.type === "separator") {
      commandsCode += command.size === "small" ? "   " : "\n` ";
      needsSpace = false;
      continue;
    }
    if (needsSpace) commandsCode += " ";
    let id = getId(command);
    if (idReplacements.has(id)) id = idReplacements.get(id);
    commandsCode += id;
    needsSpace = true;
  };
  
  return {
    code: definitionsCode + "\n\n" + commandsCode + "\n",
    commandCollisionGroups
  };
  
  
  function getId(command, symbolSep = "_") {
    if (command.type === "symbol") return "s" + symbolSep + command.symbol.padStart(idSize - 2, "_");
    if (command.type === "intermediateSymbol") return "i" + symbolSep + command.symbol.padStart(idSize - 2, "_");
    const baseName = command.name ?? command.getName(idSize);
    return baseName.padEnd(idSize, "_");
  }
}

function makeInitialProgramState(info) {
  return [
    BEGINNING_SKIPPER_COMMAND,
    BEGINNING_SKIPPER_COMMAND,
    ...info.beginningData,
    { type: "separator", size: "large" },
    PHASE_ONE_HANDLER_COMMAND,
    BEGINNING_PADDING_PRE_COMMAND,
    ...arrayOfN(BEGINNING_CATALOG_GEN_COMMAND, info.catalogGenCount),
    { type: "separator", size: "large" },
    ...(
      info.program.data.map((symbol, i) => {
        return [
          ...(i ? [ {type: "separator", size: "small" }] : []),
          makeSymbolCommand(symbol),
          PADDING_PRE_GEN_COMMAND,
          ...arrayOfN(CATALOG_GEN_COMMAND, info.catalogGenCount),
        ];
      }).flat()
    ),
    { type: "separator", size: "large" },
    HALT_SKIPPER_COMMAND,
    HALT_COMMAND,
  ];
}

function makeOtherCommandDefs(info) {
  const defs = new Map();
  
  
  defs.set(
    BEGINNING_SKIPPER_COMMAND.type,
    buildCommand(info.beginningData.length, addCopy => { addCopy(1, 1) })
  );
  
  defs.set(NOOP_COMMAND.type, {});
  
  defs.set(NOOP_PRESERVER_COMMAND.type, buildCommand(1));
  
  defs.set(PADDING_GEN_COMMAND.type, buildCommand(0, addCopy => { addCopy(info.paddingGenLength, 1) }));
  
  defs.set(
    TWO_SKIPPER_COMMAND.type,
    buildCommand(2)
  );
  
  defs.set(
    THREE_SKIPPER_COMMAND.type,
    buildCommand(3)
  );
  
  defs.set(HALT_COMMAND.type, { halt: true });
  
  
  defs.set(
    PHASE_ONE_HANDLER_COMMAND.type,
    buildCommand(0, addCopy => {
      let index = 0;
      index += addCopy(makeBeginningCopyOf(PHASE_TWO_HANDLER_COMMAND, info, index));
      index += addCopy(makeBeginningCopyOf(NOOP_COMMAND, info, index));
      index += addCopy(getPhase2BeginningPaddingSize(info) - 1, 1);
    })
  );
  
  defs.set(
    BEGINNING_PADDING_PRE_COMMAND.type,
    buildCommand(0, addCopy => {
      let index = adaptPhase2PosForBeginning(getPhase2PaddingGenPos(info));
      index += addCopy(makeBeginningCopy(info, index, info.beginningPaddingGenIndex, 2 + info.paddingGenCount));
    })
  );
  
  defs.set(
    BEGINNING_CATALOG_GEN_COMMAND.type,
    buildCommand(0, addCopy => {
      let index = adaptPhase2PosForBeginning(getPhase2CatalogPos(info));
      index += addCopy(makeBeginningCopy(info, index, info.beginningCatalogIndex, info.catalogGenLength));
    })
  );
  
  defs.set(
    PADDING_PRE_GEN_COMMAND.type,
    buildCommand(0, addCopy => {
      addCopy(2 + info.paddingGenCount, getPhase2CellSize(info));
    })
  );
  
  defs.set(
    CATALOG_GEN_COMMAND.type,
    buildCommand(0, addCopy => {
      addCopy(info.catalogGenLength, getPhase2CellSize(info));
    })
  );
  
  defs.set(
    HALT_SKIPPER_COMMAND.type,
    buildCommand(1, addCopy => {
      let index = 0;
      index += addCopy(makeCatalogCopyOf(THREE_SKIPPER_COMMAND, info, index));
      index += addCopy(makeCatalogCopyOf(TWO_SKIPPER_COMMAND, info, index));
      index += addCopy(4, 2);
      index += addCopy(1, index + getPhase2CellSize(info));
    })
  );
  
  
  defs.set(
    PHASE_TWO_HANDLER_COMMAND.type,
    buildCommand(0, addCopy => {
      addCopy(makeBeginningCopyOf(PHASE_THREE_HANDLER_COMMAND, info, 0));
    })
  );
  
  if (info.transPreSkipCommand.type === TRANS_PRE_SKIP_COMMAND.type) {
    defs.set(
      TRANS_PRE_SKIP_COMMAND.type,
      buildCommand(getTransPreSkipSkip(info))
    );
  }
  
  
  defs.set(
    PHASE_THREE_HANDLER_COMMAND.type,
    buildCommand(0, addCopy => {
      let index = 0;
      index += addCopy(makeBeginningCopyOf(PHASE_FOUR_HANDLER_COMMAND, info, index));
      index += addCopy(makeBeginningCopyOf(INTER_PADDING_PRE_COMMAND, info, index));
      index += addCopy(makeBeginningCopyOf(INTER_CATALOG_GEN_COMMAND, info, index));
      index += addCopy(info.interCatalogGenCount - 1, 1);
      index += addCopy(makeBeginningCopyOf(EMPTY_INTER_SYMBOL_COMMAND, info, index));
      index += addCopy(info.maxOutputSymbols - 1, 1);
    })
  );
  
  defs.set(
    TRANS_SKIPPER_COMMAND.type,
    buildCommand(getTransSkipperSkip(info), addCopy => {
      const cellSize = getPhase4CellSize(info);
      addCopy(1, cellSize);
      addCopy(info.interCatalogGenCount, cellSize);
    })
  );
  
  
  defs.set(
    PHASE_FOUR_HANDLER_COMMAND.type,
    buildCommand(0, addCopy => {
      addCopy(makeBeginningCopyOf(PHASE_FIVE_HANDLER_COMMAND, info, 0));
    })
  );
  
  defs.set(
    INTER_PADDING_PRE_COMMAND.type,
    buildCommand(0, addCopy => {
      addCopy(2 + info.paddingGenCount, getPhase5OldCellSize(info));
    })
  );
  
  defs.set(
    INTER_CATALOG_GEN_COMMAND.type,
    buildCommand(0, addCopy => {
      addCopy(info.interCatalogGenLength, getPhase5OldCellSize(info));
    })
  );
  
  defs.set(
    EMPTY_INTER_SYMBOL_COMMAND.type,
    buildCommand(0, addCopy => {
      const cellSize = getPhase5CellSize(info);
      let index = 0;
      index += addCopy(1, cellSize);
      index += addCopy(makeInterCatalogCopyOf(NOOP_COMMAND, info, index));
      index += addCopy(getSymbolSkipperSkip(info) - 1, 1);
    })
  );
  
  
  defs.set(
    PHASE_FIVE_HANDLER_COMMAND.type,
    buildCommand(0, addCopy => {
      let index = 0;
      index += addCopy(makeBeginningCopyOf(PHASE_ONE_HANDLER_COMMAND, info, index));
      index += addCopy(makeBeginningCopyOf(BEGINNING_PADDING_PRE_COMMAND, info, index));
      index += addCopy(makeBeginningCopyOf(BEGINNING_CATALOG_GEN_COMMAND, info, index));
      index += addCopy(info.catalogGenCount - 1, 1);
    })
  );
  
  defs.set(
    SYMBOL_SKIPPER_COMMAND.type,
    buildCommand(getSymbolSkipperSkip(info))
  );
  
  
  return defs;
}

function makeBeginningCopyOf(command, info, indexAfterBeginning) {
  return makeBeginningCopy(info, indexAfterBeginning, getLastIndexOfCommandIn(command, info.beginningData));
}

function makeBeginningCopy(info, indexAfterBeginning, indexInBeginning, length = 1) {
  return { length, distance: indexAfterBeginning + info.beginningData.length - indexInBeginning };
}

function getPhase2BeginningPaddingSize(info) {
  // everything between the handler and the padding gen is padding
  return adaptPhase2PosForBeginning(getPhase2PaddingGenPos(info)) - 1;
}

function adaptPhase2PosForBeginning(pos) {
  // halt command extends into the beginning data
  return pos - 1;
}

function getPhase2CatalogPos(info) {
  // no-op preserver, no-op, padding generators
  return getPhase2PaddingGenPos(info) + 2 + info.paddingGenCount;
}

function getPhase2PaddingGenPos(info) {
  // halt command, no-op, library, two skippers, output symbols
  return 2 + info.librarySize + 2 + info.maxOutputSymbols;
}

function makeInterSymbolCommandDefs(info) {
  const defs = new Map();
  for (const symbol of info.rules.keys()) {
    defs.set(symbol, makeInterSymbolCommandDef(symbol, info));
  }
  return defs;
}

function makeInterSymbolCommandDef(symbol, info) {
  return buildCommand(0, addCopy => {
    let indexInCell = 0;
    indexInCell += addCopy(1, indexInCell + getPhase5CellSize(info));
    indexInCell += addCopy(makeInterCatalogCopyOf(symbol, info, indexInCell));
    indexInCell += addCopy(makeInterCatalogCopyOf(PADDING_PRE_GEN_COMMAND, info, indexInCell));
    indexInCell += addCopy(makeInterCatalogCopyOf(CATALOG_GEN_COMMAND, info, indexInCell));
    indexInCell += addCopy(info.catalogGenCount - 1, 1);
  });
}

function makeInterCatalogCopyOf(commandOrSymbol, info, indexInCell) {
  const command = typeof commandOrSymbol === "string" ? makeInterSymbolCommand(commandOrSymbol) : commandOrSymbol;
  if (command.type === "intermediateSymbol") {
    return makeInterCatalogCopy(info, indexInCell, info.interCatalogSymbolPositions.get(command.symbol));
  } else {
    return makeInterCatalogCopy(info, indexInCell, info.interCatalogOtherPositions.get(command.type));
  }
}

function makeInterCatalogCopy(info, indexInCell, indexInCatalog) {
  return { length: 1, distance: indexInCell + info.interCatalog.length - indexInCatalog };
}

function makeSymbolCommandDefs(info) {
  const defs = new Map();
  for (const symbol of info.rules.keys()) {
    defs.set(symbol, makeSymbolCommandDef(symbol, info));
  }
  return defs;
}

function makeSymbolCommandDef(symbol, info) {
  return buildCommand(0, addCopy => {
    let indexInCell = 0;
    
    indexInCell += addCopy(makeSlotCopy(info.transitionSlots.get(getHaltSlotId(symbol)), info, indexInCell));
    indexInCell += addCopy(makeCatalogCopyOf(NOOP_COMMAND, info, indexInCell));
    
    for (const command of info.libraries.get(symbol)) {
      if (command.type === TRANSFERRED_HALT_COMMAND.type) {
        indexInCell += addCopy(1, indexInCell);
      } else {
        indexInCell += addCopy(makeCatalogCopyOf(command, info, indexInCell));
      }
    }
    
    indexInCell += addCopy(makeCatalogCopyOf(info.transPreSkipCommand, info, indexInCell));
    indexInCell += addCopy(makeCatalogCopyOf(TRANS_SKIPPER_COMMAND, info, indexInCell));
    
    for (let i = 0; i < info.maxOutputSymbols; i++) {
      indexInCell += addCopy(makeSlotCopy(info.transitionSlots.get(getSymbolSlotId(symbol, i)), info, indexInCell));
    }
  });
}

function makeSlotCopy(slot, info, indexInCell) {
  if (slot.table) {
    return { length: 1, distance: indexInCell + getPhase2CellSize(info) - 2 - slot.libraryCopyIndex };
  } else {
    if (slot.constant.type === TRANSFERRED_HALT_COMMAND.type) {
      return { length: 1, distance: indexInCell + getPhase2CellSize(info) };
    } else {
      return makeCatalogCopyOf(slot.constant, info, indexInCell);
    }
  }
}

function makeCatalogCopyOf(command, info, indexInCell) {
  return makeCatalogCopy(info, indexInCell, getLastIndexOfCommandIn(command, info.catalog));
}

function makeCatalogCopy(info, indexInCell, indexInCatalog) {
  return { length: 1, distance: indexInCell + info.catalog.length - indexInCatalog };
}

function getLastIndexOfCommandIn(command, commandList) {
  for (let i = commandList.length - 1; i >= 0; i--) {
    if (commandsEqual(commandList[i], command)) return i;
  }
  throw Object.assign(new Error("Failed to find command"), { command, commandList });
}

function buildCommand(skip, cb) {
  const copies = [];
  cb?.((...args) => {
    let copy;
    if (args.length === 1) {
      [copy] = args;
    } else {
      const [length, distance] = args;
      copy = { length, distance };
    }
    copies.push(copy);
    return copy.length;
  });
  return { ...(skip ? { skip } : {}), ...(copies.length ? { copies } : {}) };
}

function makeBeginningData(info) {
  const beforeCatalog = [
    PHASE_ONE_HANDLER_COMMAND,
    PHASE_TWO_HANDLER_COMMAND,
    PHASE_THREE_HANDLER_COMMAND,
    PHASE_FOUR_HANDLER_COMMAND,
    PHASE_FIVE_HANDLER_COMMAND,
    BEGINNING_PADDING_PRE_COMMAND,
    BEGINNING_CATALOG_GEN_COMMAND,
    INTER_PADDING_PRE_COMMAND,
    INTER_CATALOG_GEN_COMMAND,
  ];
  
  const beginningCatalogIndex = beforeCatalog.length;
  
  const beforePaddingGen = [
    ...beforeCatalog,
    ...info.catalog,
  ];
  
  const beginningPaddingGenIndex = beforePaddingGen.length;
  
  const beginningData = [
    ...beforePaddingGen,
    NOOP_PRESERVER_COMMAND,
    NOOP_COMMAND,
    ...arrayOfN(PADDING_GEN_COMMAND, info.paddingGenCount),
    ...info.interCatalog,
    ...repeatNoOp(info.maxOutputSymbols * getPhase5CellSize(info) - 2),
    HALT_SKIPPER_COMMAND,
  ];
  
  return { beginningData, beginningCatalogIndex, beginningPaddingGenIndex };
}

function resolvePaddingSize(info) {
  let baseSize = Math.max(info.interCatalog.length, getPhase4CellSize(info));
  for (let i = 0; i < 1000000; i++) {
    [info.paddingGenCount, info.paddingGenLength] = getNearSquareFactors(baseSize);
    info.paddingSize = info.paddingGenCount * info.paddingGenLength;
    const p2Size = getPhase2CellSize(info);
    if (info.paddingSize >= p2Size) return;
    baseSize = p2Size;
  }
  throw new Error("Failed to resolve padding size");
}

function makeInterCatalog({ info, rules, maxOutputSymbols }) {
  const cellSize = getPhase5CellSize(info);
  
  const symbolPatterns = new Map(Array.from(rules.keys(), sym => [sym, new Array(maxOutputSymbols).fill(false)]));
  for (const rule of rules.values()) {
    if (rule.table) {
      for (const prod of rule.table.values()) {
        for (let i = 0; i < maxOutputSymbols; i++) {
          if (prod.result[i]) symbolPatterns.get(prod.result[i])[i] = true;
        }
      }
    } else {
      for (let i = 0; i < maxOutputSymbols; i++) {
        if (rule.constant[i]) symbolPatterns.get(rule.constant[i])[i] = true;
      }
    }
  }
  
  const commandPatterns = [
    ...Array.from(symbolPatterns, ([symbol, pattern]) => getCommandPattern(pattern, [makeSymbolCommand(symbol)])),
    getCommandPattern(
      Array.from(symbolPatterns.values()).reduce(
        (combinedPattern, pattern) => combinedPattern.map((v, i) => v || pattern[i]),
        new Array(maxOutputSymbols).fill(false)
      ),
      [CATALOG_GEN_COMMAND, PADDING_PRE_GEN_COMMAND]
    ),
    getCommandPattern(new Array(maxOutputSymbols).fill(true), [NOOP_COMMAND]),
  ];
  
  commandPatterns.sort(({ pattern: a }, { pattern: b }) => {
    const widthDiff = b.length - a.length;
    if (widthDiff !== 0) return widthDiff;
    return getNonEmptyCount(b) - getNonEmptyCount(a);
  });
  
  const interCatalogPattern = [];
  const interCatalogSymbolPositions = new Map();
  const interCatalogOtherPositions = new Map();
  
  for (const patternInfo of commandPatterns) {
    for (let i = 0; i <= interCatalogPattern.length; i++) {
      if (patternFitsAt(patternInfo, i)) {
        insertPatternAt(patternInfo, i);
        break;
      }
    }
  }
  
  const end = [SYMBOL_SKIPPER_COMMAND, ...repeatNoOp(getSymbolSkipperSkip(info))];
  
  const baseSize = interCatalogPattern.length + end.length;
  const [interCatalogGenCount, interCatalogGenLength] = getNearSquareFactors(baseSize);
  
  const interCatalog = [
    ...interCatalogPattern.map(v => v === null ? NOOP_COMMAND : v),
    ...repeatNoOp(interCatalogGenCount * interCatalogGenLength - baseSize),
    ...end,
  ];
  
  return {
    interCatalog,
    interCatalogGenCount,
    interCatalogGenLength,
    interCatalogSymbolPositions,
    interCatalogOtherPositions
  };
  
  
  function patternFitsAt({ pattern }, i) {
    for (const [j, item] of pattern.entries()) {
      if (item !== null && interCatalogPattern[i + j]) return false;
    }
    return true;
  }
  
  function insertPatternAt({ pattern, commands, offset }, i) {
    for (const [j, item] of pattern.entries()) {
      if (item === null) {
        if (interCatalogPattern[i + j] === undefined) interCatalogPattern[i + j] = null;
      } else {
        interCatalogPattern[i + j] = item;
      }
    }
    for (const [j, command] of commands.entries()) {
      const pos = i - offset + j;
      if (command.type === "symbol") {
        interCatalogSymbolPositions.set(command.symbol, pos);
      } else {
        interCatalogOtherPositions.set(command.type, pos);
      }
    }
  }
  
  function getNonEmptyCount(commandPattern) {
    return commandPattern.reduce((c, v) => c + (v === null ? 0 : 1), 0)
  }
  
  function getCommandPattern(symbolPattern, commands) {
    const result = new Array(symbolPattern.length * cellSize).fill(null);
    for (const [i, filled] of symbolPattern.entries()) {
      if (!filled) continue;
      for (const [j, command] of commands.entries()) {
        result[i * cellSize + j] = command;
      }
    }
    let offset = 0;
    while (result[0] === null) {
      result.shift();
      offset++;
    }
    while (result[result.length - 1] === null) result.pop();
    if (!result.length) result.push(...commands); // for simplicity, require that every symbol appear
    return { pattern: result, commands, offset };
  }
}

function makeCatalog({ info, rules }) {
  const start = [
    ...Array.from(rules.keys(), sym => makeInterSymbolCommand(sym)),
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
  const [catalogGenCount, catalogGenLength] = getNearSquareFactors(baseSize);
  
  const catalog = [
    ...start,
    ...repeatNoOp(catalogGenCount * catalogGenLength - baseSize),
    ...end,
  ];
  
  return { catalog, catalogGenCount, catalogGenLength, transPreSkipCommand };
}

function getNearSquareFactors(n) {
  const f1 = Math.round(Math.sqrt(n));
  const f2 = Math.ceil(n/f1);
  return f1 < f2 ? [f1, f2] : [f2, f1];
}

function getTransPreSkipSkip(info) {
  return 1 + getTransSkipperSkip(info);
}

function getTransSkipperSkip(info) {
  return info.maxOutputSymbols;
}

function getSymbolSkipperSkip(info) {
  return getPhase5CellSize(info) - 1;
}

function getPhase2CellSize(info) {
  // halt signal, no-op, library, pre-skipper, skipper, output symbols,
  // no-op preserver, no-op, padding generators, catalog
  return 2 + info.librarySize + 2 + info.maxOutputSymbols + 2 + info.paddingGenCount + info.catalog.length;
}

function getPhase4CellSize(info) {
  // padding pre-generator, intermediate catalog generators, and intermediate symbol commands
  return 1 + info.interCatalogGenCount + info.maxOutputSymbols;
}

function getPhase5OldCellSize(info) {
  // no-op preserver, no-op, padding generators, intermediate catalog, new cells
  return 2 + info.paddingGenCount + info.interCatalog.length + info.maxOutputSymbols * getPhase5CellSize(info);
}

function getPhase5CellSize(info) {
  // skipper, symbol, padding pre-generator, and catalog generators
  return 3 + info.catalogGenCount;
}

function repeatNoOp(times) {
  return arrayOfN(NOOP_COMMAND, times);
}

function arrayOfN(item, times) {
  return new Array(times).fill(item);
}

function generateLibraries({ rules, transitionSlots }) {
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
  
  const libraries = new Map(Array.from(rules.keys(), k => [k, Array.from({ length: colors.length }).fill(null)]));
  
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

function getHaltSlots({ rules, transitionSlots }) {
  for (const [symbol, rule] of rules) {
    const slotId = getHaltSlotId(symbol);
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

function getHaltSlotId(symbol) {
  return symbol + ":h";
}

function getSymbolSlots({ info, maxOutputSymbols, transitionSlots }, program) {  
  const updatedRules = new Map();
  for (const [symbol, rule] of program.rules) {
    if (rule.table) {
      updatedRules.set(symbol, getSlotsForTabledRule(symbol, rule));
    } else {
      getSlotsForConstantRule(symbol, rule);
      updatedRules.set(symbol, rule);
    }
  }
  info.rules = updatedRules;
  
  
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
    return rule;
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
  const slotId = getSymbolSlotId(symbol, resultIndex);
  const slot = {};
  transitionSlots.set(slotId, slot);
  return slot;
}

function getSymbolSlotId(symbol, resultIndex) {
  return `${symbol}:${resultIndex}`;
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
