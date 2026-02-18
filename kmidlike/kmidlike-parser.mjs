export function checkForSymbolDefinitions(symbols, program) {
  if (!Array.isArray(symbols)) symbols = [symbols];
  for (const s of symbols) {
    if (s !== program.haltSymbol && !program.rules.has(s))
      throw new Error(`Undefined symbol: \`${s}\``);
  }
}

// config fields:
// - ruleSymbolSeparators: array of characters that may follow a symbol to mark a rule definition
// - hasHaltSymbol: (required if true) whether a symbol composed only of dollar signs should be interpreted as a halt symbol
// - extraNonSymbols: optional iterable of additional characters to disallow from symbol names
// - constantRuleBody: rule body definition for constant rules (starting after double colon)
// - conditionalRuleBody: rule body definition for conditional rules (starting after symbol)
// - sharedRuleBody: rule body definition for shared elements at the end of both rule types
// a rule body definition is an array of item definitions, with a "type" field indicating one of the types:
// - "symbol": a symbol; value is the symbol's name
// - "number": a colon followed by a number; value is the represented number
// - "list": a list of symbols and potentially other tokens enclosed in square brackets; optional field "allowedNonSymbol" is an array specifying non-symbol characters that may appear; value is an array of symbol names and non-symbol characters
// each item has a "handle" field with a function that receives the item's value, the rule object being built, and a context object
// context object contains:
// - "haltSymbol": theoretical halt symbol name
// - "badChar": function taking an invalid character to throw an error
export function parseKmidlike(code, config) {
  const nonSymbolChars = new Set(["`", "[", "]", ":", ...(config.extraNonSymbols ?? [])]);
  code = code.replace(/[\s;,]+|#[^\r\n]*/g, "");
  
  let firstSymbolEndIndex = 0;
  while (firstSymbolEndIndex < code.length && !nonSymbolChars.has(code[firstSymbolEndIndex])) {
    firstSymbolEndIndex++;
  }
  const firstSymbol = code.substring(0, firstSymbolEndIndex);
  const firstSymbolSep = code[firstSymbolEndIndex];
  if (!firstSymbol || !config.ruleSymbolSeparators.includes(firstSymbolSep)) {
    if (firstSymbolSep) badChar(firstSymbolSep);
    else badEnd();
  }
  const symbolLength = firstSymbol.length;
  
  const haltSymbol = config.hasHaltSymbol ? "$".repeat(symbolLength) : null;
  let haltSymbolUsed = false;
  
  const bodyHandlerContext = {haltSymbol, badChar};
  
  let i = 0;
  
  const rules = new Map();
  while (i < code.length && config.ruleSymbolSeparators.includes(code[i + symbolLength])) {
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
    ...(config.hasHaltSymbol ? {haltSymbol: haltSymbolUsed ? haltSymbol : null} : {}),
  };
  
  
  function parseSymbolRule() {
    const rule = {};
    
    const symbol = parseSymbol();
    expectChar(config.ruleSymbolSeparators);
    
    if (symbol === haltSymbol) throw new Error("Can't define symbol with same name as halt symbol");
    
    if (code[i] === ":" && code[i + 1] === ":") {
      i += 2;
      parseRuleBody(rule, config.constantRuleBody);
    } else {
      parseRuleBody(rule, config.conditionalRuleBody);
    }
    parseRuleBody(rule, config.sharedRuleBody);
    
    return [symbol, rule];
  }
  
  function parseRuleBody(rule, bodyDef) {
    for (const item of bodyDef) {
      if (item.type === "symbol") {
        const symbol = parseSymbol();
        if (symbol === haltSymbol) haltSymbolUsed = true;
        item.handle(symbol, rule, bodyHandlerContext);
      } else if (item.type === "number") {
        expectChar(":");
        i++;
        item.handle(parseNumber(), rule, bodyHandlerContext);
      } else if (item.type === "list") {
        expectChar("[");
        i++;
        let items = [];
        while (i < code.length && code[i] !== "]") {
          if (nonSymbolChars.has(code[i])) {
            if (!item.allowedNonSymbol?.includes(code[i])) badChar(code[i]);
            items.push(code[i]);
            i++;
          } else {
            const symbol = parseSymbol();
            if (symbol === haltSymbol) haltSymbolUsed = true;
            items.push(symbol);
          }
        }
        expectChar("]");
        i++;
        item.handle(items, rule, bodyHandlerContext);
      } else {
        throw new Error("Invalid body item type in language config: " + JSON.stringify(item.type));
      }
    }
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
    while (i < code.length && !nonSymbolChars.has(code[i])) {
      const s = parseSymbol();
      if (s === haltSymbol) haltSymbolUsed = true;
      symbols.push(s);
    }
    return symbols;
  }
  
  function parseSymbol() {
    const symbol = code.substring(i, i + symbolLength);
    i += symbol.length;
    const nsc = Array.from(symbol).find(c => nonSymbolChars.has(c));
    if (nsc) badChar(nsc);
    if (symbol.length < symbolLength) badEnd();
    return symbol;
  }
  
  function expectChar(c) {
    if (i >= code.length) badEnd();
    if (c && !(Array.isArray(c) ? c.includes(code[i]) : code[i] === c)) badChar();
  }
  
  function badChar(c) {
    throw new Error(`Unexpected character ${JSON.stringify(c)}` );
  }
  
  function badEnd() {
    throw new Error("Unexpected end of input");
  }
}

