import { checkForSymbolDefinitions, parseKmidlike } from "../kmidlike/kmidlike-parser.mjs";

const TABLE_SOURCE_SEPARATORS = [":", "$"];

export function parseAlkmini(code) {
  const program = parseKmidlike(code, {
    ruleSymbolSeparators: [":", "["],
    extraNonSymbols: ["$"],
    constantRuleBody: [
      {
        type: "list",
        handle(items, rule) {
          rule.constant = items;
        }
      }
    ],
    conditionalRuleBody: [
      {
        type: "list",
        allowedNonSymbol: TABLE_SOURCE_SEPARATORS,
        handle(items, rule, context) {
          const table = new Map();
          let i = 0;
          while (i < items.length) {
            const sourceSymbol = items[i];
            if (TABLE_SOURCE_SEPARATORS.includes(sourceSymbol)) context.badChar(sourceSymbol);
            i++;
            if (!TABLE_SOURCE_SEPARATORS.includes(items[i])) context.badChar(items[i][0]);
            const halt = items[i] === "$";
            i++;
            const result = [];
            if (!TABLE_SOURCE_SEPARATORS.includes(items[i])) {
              while (i < items.length && !TABLE_SOURCE_SEPARATORS.includes(items[i + 1])) {
                result.push(items[i]);
                i++;
              }
            }
            table.set(sourceSymbol, {halt, result});
          }
          rule.table = table;
        }
      }
    ]
  });
  
  for (const [symbol, rule] of program.rules) {
    if (rule.table) {
      if (rule.table.size === 0) throw new Error(`Symbol \`${symbol}\` has empty table`);
      checkForSymbolDefinitions(Array.from(rule.table, ([s, def]) => [s, ...def.result]).flat(), program);
    } else {
      checkForSymbolDefinitions(rule.constant, program);
    }
  }
  
  checkForSymbolDefinitions(program.data, program);
  
  return program;
}

