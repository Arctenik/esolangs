const modeInp = document.getElementById("modeInp");
const programInp = document.getElementById("programInp");
const compileButton = document.getElementById("compileButton");
const resultElem = document.getElementById("resultElem");

compileButton.addEventListener("click", () => {
  const mode = modeInp.value;
  const code = programInp.value;
  resultElem.textContent =
    mode === "kmidt_kmidi"
    ? kmidiToText(kmidtToKmidi(parseKmidt(code)))
    : mode === "kmidt_kwert"
    ? kmidiToKwert(kmidtToKmidi(parseKmidt(code)))
    : mode === "kmidi_kwert"
    ? kmidiToKwert(parseKmidi(code))
    : kmidiToText(kmidiFromKwert(code));
});

resultElem.addEventListener("dblclick", () => {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNode(resultElem);
  selection.removeAllRanges();
  selection.addRange(range);
});


function kmidiToText(program) {
  // the explicit ordering is probably unnecessary because maps are ordered. but you know just to be safe
  const orderedSymbols = [program.firstSymbol, ...Array.from(program.rules.keys()).filter(s => s !== program.firstSymbol)];
  return orderedSymbols.map(s => {
    const rule = program.rules.get(s);
    return s + " " + (rule.constant ? ":: " + rule.constant : ": " + rule.offset + " : " + rule.index) + " [" + rule.library.join(" ") + "]";
  }).join("\n") + "\n\n" + program.data.join(program.symbolLength === 1 ? "" : " ");
}

function kmidtToKmidi(program) {
  const symbolConflicts = new Map(
    Array.from(
      program.rules.entries(),
      ([symbol, rule]) =>
        rule.table
        ? [
            [
              symbol,
              Array.from(program.rules.keys()).filter(otherSymbol => {
                const otherRule = program.rules.get(otherSymbol);
                for (const [leftSymbol, out] of rule.table.entries()) {
                  const otherOut = otherRule.table?.get(leftSymbol);
                  if (otherOut && otherOut !== out) return true;
                }
                return false;
              })
            ]
          ]
        : []
    ).flat()
  );
  const slots = [];
  // not sure whether this is the best algorithm to use. it's basically treating it as normal bin packing with item "size" being number of conflicting symbols
  const sortedSymbols = Array.from(program.rules.keys()).filter(s => symbolConflicts.has(s)).sort((a, b) => symbolConflicts.get(b).length - symbolConflicts.get(a).length);
  for (const s of sortedSymbols) {
    let slot = slots.find(slot =>
      !symbolConflicts.get(s).some(conflictSym => slot.has(conflictSym))
    );
    if (!slot) slots.push(slot = new Set());
    slot.add(s);
  }
  const rulesByLeft = new Map();
  for (const [right, rule] of program.rules.entries()) {
    if (rule.constant) continue;
    for (const [left, out] of rule.table.entries()) {
      let leftRule = rulesByLeft.get(left);
      if (!leftRule) rulesByLeft.set(left, leftRule = new Map());
      leftRule.set(right, out);
    }
  }
  return {
    rules: new Map(
      Array.from(program.rules.entries(), ([symbol, rule]) => [
        symbol,
        {
          ...(
            rule.constant
            ? rule
            : {
                offset: rule.offset,
                index: slots.findIndex(slot => slot.has(symbol)),
              }
          ),
          library: slots.map(
            slot => {
              const leftRule = rulesByLeft.get(symbol);
              if (leftRule) {
                const right = Array.from(leftRule.keys()).find(s => slot.has(s));
                if (right) return leftRule.get(right);
              }
              return program.firstSymbol;
            }
          ),
        },
      ])
    ),
    data: program.data,
    symbolLength: program.symbolLength,
    firstSymbol: program.firstSymbol,
    haltSymbol: program.haltSymbol,
    librarySize: slots.length,
  };
}


function kmidiToKwert(program) {
  const symbols = Array.from(program.rules.keys()).concat(program.haltSymbol ? [program.haltSymbol] : []);
  const commandNameLength = Math.max(4, program.symbolLength + 2);
  const numCatalogNoops = symbols.length + program.librarySize - 1;
  const numTransitionPreNoops = symbols.length - 1;
  const transitionCellSize = numTransitionPreNoops + 1 + program.librarySize;
  
  const BEGINNING_CARRIER = makeCommandName("bcar");
  
  const PRIMED_CARRIER = makeCommandName("pcar");
  const TRANSITION_CARRIER = makeCommandName("tcar");
  const CLEANUP_CARRIER = makeCommandName("ccar");
  
  const PRIMED_GENERATOR = makeCommandName("pgen");
  const TRANSITION_GENERATOR = makeCommandName("tgen");
  const HEAD_CLEANUP_GENERATOR = makeCommandName("cgnh");
  const BODY_CLEANUP_GENERATOR = makeCommandName("cgnb");
  const CLEANUP_GENERATOR = makeCommandName("cgen");
  
  const NO_OP = makeCommandName("noop");
  
  const PRIMED_SYMBOL = {};
  const TRANSITION_SYMBOL = {};
  const CLEANUP_SYMBOL = {};
  for (const s of symbols) {
    PRIMED_SYMBOL[s] = makeCommandName(s, "p");
    TRANSITION_SYMBOL[s] = makeCommandName(s, "t");
    CLEANUP_SYMBOL[s] = makeCommandName(s, "c");
  }
  
  const PRE_NO_OP = TRANSITION_SYMBOL[symbols[symbols.length - 1]];
  
  const CATALOG = [
    ...symbols.map(s => PRIMED_SYMBOL[s]),
    ...symbols.map(s => TRANSITION_SYMBOL[s]),
    ...symbols.map(s => CLEANUP_SYMBOL[s]),
    ...new Array(numCatalogNoops).fill(NO_OP),
    PRIMED_GENERATOR,
    TRANSITION_GENERATOR,
    HEAD_CLEANUP_GENERATOR,
    BODY_CLEANUP_GENERATOR,
    CLEANUP_GENERATOR,
    PRIMED_CARRIER,
    TRANSITION_CARRIER,
    CLEANUP_CARRIER,
  ];
  
  const transitionCellInterval = transitionCellSize + 1 + CATALOG.length;
  
  const catalogWithCarrierSize = CATALOG.length + 1;
  const catalogPieceSize = Math.ceil(Math.sqrt(catalogWithCarrierSize));
  const catalogNumPieces = Math.floor(catalogWithCarrierSize/catalogPieceSize);
  const catalogExtraSize = catalogWithCarrierSize - (catalogNumPieces * catalogPieceSize);
  
  return (
    [
      [BEGINNING_CARRIER, [[1, 1], CATALOG.length]],
      ...symbols.map(s => [PRIMED_SYMBOL[s], s === program.haltSymbol ? "$" : getPrimedSymbolCopies(s)]),
      ...symbols.map(s => [TRANSITION_SYMBOL[s], [getCatalogCopy(CLEANUP_SYMBOL[s], 0)]]),
      ...symbols.map(s => [CLEANUP_SYMBOL[s], [getCatalogCopy(PRIMED_SYMBOL[s], 0)]]),
      [NO_OP, []],
      [PRIMED_GENERATOR, [getCatalogCopy(TRANSITION_GENERATOR, 0)]],
      [TRANSITION_GENERATOR, [getCatalogCopy(HEAD_CLEANUP_GENERATOR, 0), getCatalogCopy(BODY_CLEANUP_GENERATOR, 1), [catalogNumPieces - 1, 1], getCatalogCopy(CLEANUP_GENERATOR, catalogNumPieces + 1)]],
      [HEAD_CLEANUP_GENERATOR, [getCatalogCopy(PRIMED_SYMBOL[program.firstSymbol], 0), ...(catalogExtraSize ? [[catalogExtraSize, catalogWithCarrierSize + 1]] : [])]],
      [BODY_CLEANUP_GENERATOR, [[catalogPieceSize, catalogWithCarrierSize + 1]]],
      [CLEANUP_GENERATOR, [getCatalogCopy(PRIMED_GENERATOR, 0)]],
      [PRIMED_CARRIER, [getCatalogCopy(TRANSITION_CARRIER, transitionCellSize), CATALOG.length]],
      [TRANSITION_CARRIER, [getCatalogCopy(CLEANUP_CARRIER, transitionCellSize), CATALOG.length]],
      [CLEANUP_CARRIER, [getCatalogCopy(PRIMED_CARRIER, 1), CATALOG.length]],
    ].map(([id, commandInfo]) => {
      if (typeof commandInfo !== "string") {
        commandInfo = commandInfo.slice();
        const skip = typeof commandInfo[commandInfo.length - 1] === "number" ? commandInfo.pop() : null;
        commandInfo = commandInfo.map(item => item.join(" ")).join(",") + (skip ? ";" + skip : "");
      }
      return "` " + id + " [" + commandInfo + "]"
    }).join("\n")
    
    + "\n\n"
    
    + [
      [BEGINNING_CARRIER, BEGINNING_CARRIER, ...CATALOG],
      ...program.data.map(s => [PRIMED_SYMBOL[s], " ", PRIMED_CARRIER, ...CATALOG]),
      [PRIMED_GENERATOR],
    ].map(row => "` " + row.join(" ")).join("\n")
  );
  
  
  function getPrimedSymbolCopies(s) {
    const rule = program.rules.get(s);
    const outCopy = rule.constant
      ? getCatalogCopy(TRANSITION_SYMBOL[rule.constant], 0)
      : [1, transitionCellInterval * (rule.offset - 1) + CATALOG.length + 1 + program.librarySize - rule.index];
    return [
      outCopy,
      getCatalogCopy(PRE_NO_OP, 1),
      [numTransitionPreNoops - 1, 1],
      ...rule.library.map((ls, i) => getCatalogCopy(TRANSITION_SYMBOL[ls], 1 + numTransitionPreNoops + i)),
    ];
  }
  
  function getCatalogCopy(command, offsetFromCellStart) {
    return [1, CATALOG.length - CATALOG.indexOf(command) + offsetFromCellStart];
  }
  
  function makeCommandName(baseName, prefix) {
    return prefix
      ? prefix + "_".repeat(commandNameLength - baseName.length - prefix.length) + baseName
      : baseName + "_".repeat(commandNameLength - baseName.length);
  }
}


function kmidiFromKwert(code) {
  const commands = parseKwert(code);
  const dataStart = 2 + commands[1].skip;
  const catalogCommands = commands.slice(2, dataStart);
  let symbolNames = catalogCommands.filter(c => c.id.startsWith("t_")).map(c => c.id.substring(2));
  if (symbolNames.every(n => n.startsWith("_"))) symbolNames = symbolNames.map(n => n.substring(1));
  const transitionCommandsStart = catalogCommands.findIndex(c => c.id.startsWith("t_"));
  const primedCommands = catalogCommands.filter(c => c.id.startsWith("p_"));
  const librarySize = primedCommands[0].copies.slice(3).reduce((s, copy) => s + copy.length, 0);
  const transitionCellFullSize = symbolNames.length + librarySize + 1 + catalogCommands.length;
  const rules = new Map();
  for (const [i, c] of primedCommands.entries()) {
    if (c.halt) continue;
    const rule = {};
    const outDist = c.copies[0].distance;
    if (outDist <= catalogCommands.length) {
      rule.constant = symbolNames[catalogCommands.length - outDist - transitionCommandsStart];
    } else {
      const distIntoCell = outDist%transitionCellFullSize;
      rule.index = librarySize - (distIntoCell - 1 - catalogCommands.length);
      rule.offset = (outDist - distIntoCell)/transitionCellFullSize + 1;
    }
    rule.library = [];
    let offsetFromTransitionsStart = catalogCommands.length - transitionCommandsStart + symbolNames.length;
    for (const copy of c.copies.slice(3)) {
      for (let i = 0; i < copy.length; i++) {
        rule.library.push(symbolNames[offsetFromTransitionsStart - copy.distance]);
        offsetFromTransitionsStart++;
      }
    }
    rules.set(symbolNames[i], rule);
  }
  const primedCommandIds = primedCommands.map(c => c.id);
  const primedCellFullSize = 2 + catalogCommands.length;
  const data = [];
  for (let i = dataStart; i < commands.length - 1; i += primedCellFullSize) {
    const c = commands[i];
    data.push(symbolNames[primedCommandIds.indexOf(c.id)]);
  }
  const primedCommandsStart = catalogCommands.findIndex(c => c.id.startsWith("p_"));
  const firstSymbol = symbolNames[catalogCommands.length - catalogCommands.find(c => c.id.startsWith("cgnh")).copies[0].distance - primedCommandsStart];
  const haltSymbol = symbolNames.find(n => /^\$+$/.test(n)) ?? null;
  return {
    rules,
    data,
    symbolLength: symbolNames[0].length,
    firstSymbol,
    haltSymbol,
    librarySize,
  };
}
