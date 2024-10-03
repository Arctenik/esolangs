function parseKmidt(code) {
  const program = parseKmid(code, true);
  
  for (const [symbol, rule] of program.rules) {
    if (rule.table) {
      if (rule.table.size === 0) throw new Error(`Symbol \`${symbol}\` has empty table`);
      checkForSymbolDefinitions(Array.from(rule.table).flat(), program);
    } else {
      checkForSymbolDefinitions(rule.constant, program);
    }
  }
  
  checkForSymbolDefinitions(program.data, program);
  
  return program;
}

function parseKmidi(code) {
  const program = parseKmid(code, false);
  
  for (const [symbol, rule] of program.rules) {
    if (rule.constant) checkForSymbolDefinitions(rule.constant, program);
    else if (rule.index >= program.librarySize) throw new Error(`Index to large for symbol \`${symbol}\``);
    if (rule.library.length !== program.librarySize) throw new Error("Inconsistent library sizes");
    checkForSymbolDefinitions(rule.library, program);
  }
  
  checkForSymbolDefinitions(program.data, program);
  
  return program;
}

function checkForSymbolDefinitions(symbols, program) {
  if (!Array.isArray(symbols)) symbols = [symbols];
  for (const s of symbols) {
    if (s !== program.haltSymbol && !program.rules.has(s))
      throw new Error(`Undefined symbol: \`${s}\``);
  }
}

function parseKmid(code, isKmidt) {
  const nonSymbolCharRegex = /[`\[\]:]/;
  code = code.replace(/[\s;,]+|#[^\r\n]*/g, "");
  
  const [, firstSymbol, firstSymbolSep] = /^([^`\[\]#:]*)(.?)/.exec(code);
  if (!firstSymbol || firstSymbolSep !== ":") {
    if (firstSymbolSep) badChar(firstSymbolSep);
    else badEnd();
  }
  const symbolLength = firstSymbol.length;
  
  const haltSymbol = "$".repeat(symbolLength);
  let haltSymbolUsed = false;
  
  let i = 0;
  
  const rules = new Map();
  while (i < code.length && code[i + symbolLength] === ":") {
    const [symbol, rule] = parseSymbolRule();
    rules.set(symbol, rule);
  }
  
  const data = parseSymbols();
  
  if (i < code.length) badChar(code[i]);
  
  return {
    rules,
    data,
    symbolLength,
    firstSymbol,
    haltSymbol: haltSymbolUsed ? haltSymbol : null,
    ...(isKmidt ? {} : {librarySize: rules.get(firstSymbol).library.length}),
  };
  
  
  function parseSymbolRule() {
    const rule = {};
    
    const symbol = parseSymbol();
    expectChar(":");
    i++;
    
    if (symbol === haltSymbol) throw new Error("Can't define symbol with same name as halt symbol");
    
    expectChar();
    
    if (code[i] === ":") {
      i++;
      rule.constant = parseSymbol();
      if (rule.constant === haltSymbol) haltSymbolUsed = true;
      if (isKmidt) return [symbol, rule];
    } else {
      rule.offset = parseNumber();
      if (rule.offset === 0) throw new Error("Offset can't be 0");
      if (!isKmidt) {
        expectChar(":");
        i++;
        rule.index = parseNumber();
      }
    }
    
    if (isKmidt) {
      expectChar("[");
      i++;
      const symbols = parseSymbols();
      expectChar("]");
      i++;
      if (symbols.length%2 === 1) throw new Error("Unpaired symbol in table");
      const table = new Map();
      for (let i = 0; i < symbols.length; i += 2) {
        if (symbols[i] === haltSymbol) throw new Error("Can't match on halt symbol");
        table.set(symbols[i], symbols[i + 1]);
      }
      rule.table = table;
    } else {
      expectChar("[");
      i++;
      rule.library = parseSymbols();
      expectChar("]");
      i++;
    }
    
    return [symbol, rule];
  }
  
  function parseNumber() {
    let text = "";
    while (i < code.length && /\d/.test(code[i])) {
      text += code[i++];
    }
    if (!text) {
      if (i >= code.length) badEnd();
      else badChar(code[i]);
    }
    return Number(text);
  }
  
  function parseSymbols() {
    const symbols = [];
    while (i < code.length && !nonSymbolCharRegex.test(code[i])) {
      const s = parseSymbol();
      if (s === haltSymbol) haltSymbolUsed = true;
      symbols.push(s);
    }
    return symbols;
  }
  
  function parseSymbol() {
    const symbol = code.substring(i, i + symbolLength);
    i += symbol.length;
    const nscMatch = nonSymbolCharRegex.exec(symbol);
    if (nscMatch) badChar(nscMatch[0]);
    if (symbol.length < symbolLength) badEnd();
    return symbol;
  }
  
  function expectChar(c) {
    if (i >= code.length) badEnd();
    if (c && code[i] !== c) badChar();
  }
  
  function badChar(c) {
    throw new Error(`Unexpected character ${JSON.stringify(c)}` );
  }
  
  function badEnd() {
    throw new Error("Unexpected end of input");
  }
}
