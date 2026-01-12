/*
expects only expressions of one of these forms:
NAME => EXPRESSION
NON_LAMBDA_EXPRESSION(EXPRESSION)
(EXPRESSION)
where NON_LAMBDA_EXPRESSION can be either of the latter two types, and EXPRESSION can be any of the three
NAME must consist only of alphanumeric ascii and underscore
(javascript comments and unrecognized characters are ignored)

outputs an ast object with a "type" property of either "variable" (variable reference), "lambda" (lambda expression), or "call" (function call)
additional properties for each type are:
variable: "name" (string representing the variable's name)
lambda: "parameter" (string representing the name of the lambda's parameter), "body" (ast object representing the return value of the lambda)
call: "function" (ast object representing the function value being called), "argument" (ast object representing the value being passed to the function)
*/

function parse(text) {
  const NON_NAME_TOKENS = new Set(["(", ")", "=>"]);

  const tokens = tokenize(text);
  let i = 0;
  const result = parseExpr();
  if (i < tokens.length) throw badSyntax();
  return result;


  function parseExpr() {
    let result = parseBaseExpr();
    while (tokens[i] === "(") {
      i++;
      const argument = parseExpr();
      if (tokens[i] !== ")") throw badSyntax();
      i++;
      result = {type: "call", function: result, argument};
    }
    return result;
  }

  function parseBaseExpr() {
    if (!NON_NAME_TOKENS.has(tokens[i])) {
      if (tokens[i + 1] === "=>") {
        const parameter = tokens[i];
        i += 2;
        const body = parseExpr();
        return {type: "lambda", parameter, body};
      } else {
        const name = tokens[i];
        i++;
        return {type: "variable", name};
      }
    } else if (tokens[i] === "(") {
      i++;
      const result = parseExpr();
      if (tokens[i] !== ")") throw badSyntax();
      i++;
      return result;
    } else {
      throw badSyntax();
    }
  }

  function badSyntax() {
    throw new Error(i < tokens.length ? `Unexpected token at ${i}` : "Unexpected end of input");
  }
}

function tokenize(text) {
  return Array.from(
    text.replace(/\/\/[^\r\n]*|\/\*(?:(?!\*\/)[^])*\*\//g, " ").matchAll(/\w+|[()]|=>/g),
    m => m[0]
  );
}


// function to convert back to js with parentheses around everything, for testing purposes
function astToJs(ast) {
  if (ast.type === "variable") {
    return `(${ast.name})`;
  } else if (ast.type === "lambda") {
    return `((${ast.parameter}) => (${astToJs(ast.body)}))`;
  } else if (ast.type === "call") {
    return `((${astToJs(ast.function)})(${astToJs(ast.argument)}))`;
  } else {
    throw "???";
  }
}
