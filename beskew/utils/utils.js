

let unnestInp = document.getElementById("unnestInp"),
	unnestResultInp = document.getElementById("unnestResultInp"),
	numeralsEnforceEndingsInp = document.getElementById("numeralsEnforceEndingsInp"),
	numeralsInp = document.getElementById("numeralsInp"),
	numeralsResultElem = document.getElementById("numeralsResultElem"),
	numeralsDlLink = document.getElementById("numeralsDlLink"),
	renumeralsInp = document.getElementById("renumeralsInp"),
	renumeralsResultInp = document.getElementById("renumeralsResultInp");

let combinatorChars = Array.from("BSK"),
	combinatorValues = combinatorChars.map(c => c.codePointAt(0)),
	numeralsDlUrl;


unnestInp.addEventListener("change", () => {
	try {
		unnestResultInp.value = unnest(unnestInp.value);
	} catch(e) {
		unnestResultInp.value = e;
	}
});

numeralsInp.addEventListener("change", () => {
	try {
		URL.revokeObjectURL(numeralsDlUrl);
		numeralsResultElem.innerHTML = "";
		let input = numeralsInp.value;
		if (numeralsEnforceEndingsInp.checked) input = input.replace(/\r\n/g, "\n");
		let items = convertNumerals(input);
		items.forEach((s, i) => {
			s = JSON.stringify(s);
			s = s.substring(1, s.length - 1);
			if (i%2 === 0) {
				numeralsResultElem.insertAdjacentText("beforeend", s);
			} else {
				let e = document.createElement("span");
				e.classList.add("numeral");
				e.textContent = s;
				numeralsResultElem.appendChild(e);
			}
		});
		numeralsDlUrl = URL.createObjectURL(new Blob([items.join("")]));
		numeralsDlLink.href = numeralsDlUrl;
	} catch(e) {
		numeralsResultElem.textContent = e;
	}
});

renumeralsInp.addEventListener("change", async () => {
	if (renumeralsInp.files.length) {
		try {
			renumeralsResultInp.value = convertNumeralsBack(await renumeralsInp.files[0].text());
		} catch(e) {
			renumeralsResultInp.value = e;
		}
	} else {
		renumeralsResultInp.value = "";
	}
});


function unnest(src) {
	return unnestExpr(parse(src)).join("");
	
	
	function unnestExpr(expr) {
		while (Array.isArray(expr[0])) {
			expr = expr[0].concat(expr.slice(1));
		}
		
		expr = expr.map(e => {
			if (Array.isArray(e)) {
				if (e.length === 0) throw new Error("Ambiguous empty parentheses");
				else return unnestExpr(e);
			} else {
				return e;
			}
		});
		
		let result = [];
		
		for (let e of expr) {
			if (Array.isArray(e)) {
				if (combinatorValues.includes(e.length - 1)) e = ["[1]"].concat(e);
				if (result.length === 1) {
					result = ["[" + (e.length - 1) + "]", "B", result[0]].concat(e);
				} else {
					if (combinatorValues.includes(result.length - 1)) result = ["[1]"].concat(result);
					result = ["S", "[" + (result.length - 1) + "]", "[" + (e.length - 1) + "]", "B"].concat(result).concat(e);
				}
			} else {
				result.push(e);
			}
		}
		
		return result;
	}
	
	function parse(src) {
		let stack = [[]],
			parsedLength = 0,
			expr = /\[\d+\]|[^\[\]]/g,
			match;
		
		while (match = expr.exec(src)) {
			parsedLength += match[0].length;
			
			if (match[0] === "(") {
				let a = [];
				stack[stack.length - 1].push(a);
				stack.push(a);
			} else if (match[0] === ")") {
				stack.pop();
				if (stack.length === 0) throw new Error("Unmatched closing parenthesis");
			} else {
				stack[stack.length - 1].push(match[0]);
			}
		}
		
		if (parsedLength < src.length) throw new Error("Invalid syntax");
		
		if (stack.length > 1) throw new Error("Unmatched open " + (stack.length > 2 ? "parentheses" : "parenthesis"));
		
		return stack[0];
	}
}


function convertNumerals(src) {
	let result = [],
		parsedLength = 0,
		expr = /\[\d+\]|[^\[\]]/g,
		match;
	
	while (match = expr.exec(src)) {
		parsedLength += match[0].length;
		if (result.length%2 === 0) result.push("");
		if (match[0][0] === "[") {
			let n = +match[0].substring(1, match[0].length - 1);
			if (combinatorValues.includes(n)) throw new Error("Numeral " + match[0] + " conflicts with combinator");
			result.push(String.fromCodePoint(n));
		} else {
			result[result.length - 1] += match[0];
		}
	}
	
	if (parsedLength < src.length) throw new Error("Invalid syntax");
	
	return result;
}


function convertNumeralsBack(text) {
	return Array.from(text, c => combinatorChars.includes(c) ? c : "[" + c.codePointAt(0) + "]").join("");
}

