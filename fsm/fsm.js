

let machineInp = document.getElementById("machineInp"),
	inputInp = document.getElementById("inputInp"),
	runButton = document.getElementById("runButton"),
	outputElem = document.getElementById("outputElem"),
	sequenceElem = document.getElementById("sequenceElem");

runButton.addEventListener("click", () => {
	outputElem.innerHTML = "";
	sequenceElem.innerHTML = "";
	
	let [rules, [state]] = parseMachine(machineInp.value),
		input = inputInp.value.split(inputSepInp.value);
	
	for (let sym of input) {
		let {target = state, output} = rules[state]?.[sym] || {};
		sequenceElem.insertAdjacentText("beforeend", formatString(state, false) + " (" + formatString(sym, false) + (output === undefined ? "" : ", " + formatString(output)) + ")");
		sequenceElem.insertAdjacentHTML("beforeend", "<br>");
		if (output) outputElem.insertAdjacentText("beforeend", output);
		state = target;
	}
	
	sequenceElem.insertAdjacentText("beforeend", state);
});

function formatString(s, requireQuotes = true) {
	let result = Array.from(s).map(c => {
		if (c === "\\") return "\\\\";
		else if (c === "\"") return "\\\"";
		else if (c === "\n") return "\\n";
		else if (c === "\r") return "\\r";
		else if (c === "\t") return "\\t";
		else {
			let code = c.codePointAt(0);
			if ((0 <= code && code <= 31) || (127 <= code && code <= 159)) {
				return "\\u" + code.toString(16) + ";";
			} else {
				return c;
			}
		}
	}).join("");
	if (requireQuotes || /["\\\s\x00-\x1f\x7f-\x9f]/.test(s)) {
		result = "\"" + result + "\"";
	}
	return result;
}

function parseMachine(def) {
	let rules = {},
		states = [],
		targetStates = [],
		inputSymbols = [],
		outputSymbols = [];
	
	def.split(/\r\n|[\r\n]/).map((line, i) => {
		let trimmed = line.trim();
		if (trimmed && trimmed[0] !== "#") {
			let values = [];
			for (let i = 0, val; i < trimmed.length; ) {
				[val, i] = parseString(trimmed, i);
				values.push(val);
			}
			if (values.length === 3 || values.length === 4) {
				let [st, sym, st2, out] = values;
				
				if (!states.includes(st)) states.push(st);
				if (!targetStates.includes(st2)) targetStates.push(st2);
				if (!inputSymbols.includes(sym)) inputSymbols.push(sym);
				if (out !== undefined && !outputSymbols.includes(out)) outputSymbols.push(out);
				
				(rules[st] || (rules[st] = {}))[sym] = {target: st2, output: out};
			} else {
				throw new Error("Invalid line " + (i + 1) + " in machine");
			}
		}
	});
	
	targetStates.forEach(st => {
		if (!states.includes(st)) states.push(st);
	});
	
	return [rules, states, inputSymbols, outputSymbols];
	
	
	function parseString(text, i) {
		let expr = /\s*(?:"((?:\\.|[^\\"])*)"|([^\s]+))/g;
		expr.lastIndex = i;
		
		let match = expr.exec(text),
			content = match[2] || match[1],
			result = content.replace(/\\(?:([^u])|(u)([0-9a-fA-F]+;)?)/, (s, code, u, hex) => {
				if (hex) {
					return String.fromCodePoint(parseInt(hex, 16));
				} else {
					code = code || u;
					if (code === "n") return "\n";
					else if (code === "r") return "\r";
					else if (code === "t") return "\t";
					else return code;
				}
			});
		
		return [result, i + match[0].length];
	}
}

