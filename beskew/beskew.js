

let fileInp = document.getElementById("fileInp"),
	programInp = document.getElementById("programInp"),
	runButton = document.getElementById("runButton"),
	maxStepsInp = document.getElementById("maxStepsInp"),
	errorElem = document.getElementById("errorElem"),
	jsonIoInp = document.getElementById("jsonIoInp"),
	inputInp = document.getElementById("inputInp"),
	outputElem = document.getElementById("outputElem");

let programName, // gets set to null when the file input is changed
	programText,
	stepsLimit; // modified as steps are taken


runButton.addEventListener("click", async () => {
	try {
		hideError();
		outputElem.innerHTML = "";
		
		stepsLimit = +maxStepsInp.value;
		
		if (programInp.value !== programName) {
			programName = programInp.value;
			if (programName === "file") {
				if (fileInp.files.length) {
					programText = await fileInp.files[0].text();
				} else {
					throw new Error("No file selected");
				}
			} else {
				programText = await (await fetch(programName)).text();
			}
		}
		
		run();
	} catch(e) {
		showError(e);
	}
});

fileInp.addEventListener("change", () => programName = null);


function showError(message) {
	errorElem.textContent = message;
}

function hideError() {
	errorElem.innerHTML = "";
}

function run() {
	let expr = convertText(programText).concat(
		["eof", "out"],
		convertText(jsonIoInp.checked ? JSON.parse("\"" + inputInp.value + "\"") : inputInp.value),
		["eof"]
	);
	
	evalExpr(expr);
}

function convertText(text) {
	return Array.from((function*() {
		for (let c of text) {
			yield "BSK".includes(c) ? c : c.codePointAt(0);
		}
	})());
}

function evalExpr(expr) {
	let prevExpr;
	
	while (expr !== prevExpr && stepsLimit-- > 0) {
		prevExpr = expr;
		expr = step(expr);
	}
	
	if (stepsLimit < 0) throw new Error("Reached maximum step count");
	
	return expr;
}

let stepFuncs = {
	B(expr) {
		if (expr.length >= 4) {
			return [expr[1], [expr[2], expr[3]]].concat(expr.slice(4));
		}
	},
	S(expr) {
		if (expr.length >= 4) {
			return [expr[1], expr[3], [expr[2], expr[3]]].concat(expr.slice(4));
		}
	},
	K(expr) {
		if (expr.length >= 3) {
			return [expr[1]].concat(expr.slice(3));
		}
	},
	eof(expr) {
		if (expr.length >= 10) {
			return expr.slice(10);
		}
	},
	out(expr) {
		if (expr.length >= 2) {
			doOutput([expr[1]]);
			return expr.slice(2);
		}
	},
	swap(expr) {
		if (expr.length >= 3) {
			return [expr[2], expr[1]].concat(expr.slice(3));
		}
	},
	third(expr) {
		if (expr.length >= 3) {
			return expr.slice(3);
		}
	}/*,
	target0: symbolIdTargetFunc(0),
	target1: symbolIdTargetFunc(1),
	target2: symbolIdTargetFunc(2),
	target3: symbolIdTargetFunc(3),
	target4: symbolIdTargetFunc(4)
	*/
};

function symbolIdTargetFunc(index) {
	let numArgs = 6 + (4 - index);
	return expr => {
		if (expr.length >= numArgs) {
			return [expr[5]].concat(expr.slice(numArgs));
		}
	};
}

function step(expr) {
	if (expr.length) {
		if (Array.isArray(expr[0])) {
			return expr[0].concat(expr.slice(1));
		} else if (typeof expr[0] === "number") {
			if (expr[0] === 1) {
				return expr.slice(1);
			} else if (expr[0] === 0) {
				if (expr.length >= 2) {
					return expr.slice(2);
				}
			} else {
				if (expr.length >= 3) {
					return [expr[1], [expr[0] - 1, expr[1], expr[2]]].concat(expr.slice(3));
				}
			}
		} else if (typeof expr[0] === "function") {
			return expr[0](expr) || expr;
		} else {
			let f = stepFuncs[expr[0]];
			if (f) {
				return f(expr) || expr;
			} else {
				throw new Error("Unknown expression type");
			}
		}
	}
	
	return expr;
}

function doOutput(expr) {
	expr = evalExpr(expr);
	
	let symbolType;
	
	evalExpr(expr.concat([
		"swap", 0, 0, "K", "third",
		typeFunc("B", 4), typeFunc("K", 3), typeFunc("S", 2), typeFunc("num", 1), typeFunc("eof", 0)
	]));
	
	if (symbolType && symbolType !== "eof") {
		if (symbolType === "num") {
			let n = 0;
			evalExpr(expr.concat([expr => (n++, expr.slice(1)), 1]));
			addOutput(String.fromCodePoint(n));
		} else {
			addOutput(symbolType);
		}
	}
	
	
	function typeFunc(type, deleteNum) {
		return expr => {
			if (expr.length >= 1 + deleteNum) {
				return [
					expr => {
						symbolType = type;
						return expr.slice(1);
					}
				].concat(expr.slice(1 + deleteNum));
			}
		};
	}
}

function addOutput(c) {
	if (jsonIoInp.checked) {
		c = JSON.stringify(c);
		c = c.substring(1, c.length - 1);
	}
	outputElem.textContent += c;
}

