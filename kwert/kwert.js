

const programInp = document.getElementById("programInp");
const initButton = document.getElementById("initButton");
const commandIdsElem = document.getElementById("commandIdsElem");
const programLengthElem = document.getElementById("programLengthElem");
const programOpsElem = document.getElementById("programOpsElem");
const programIdsElem = document.getElementById("programIdsElem");
const stepButton = document.getElementById("stepButton");
const cycleButton = document.getElementById("cycleButton");
const nCyclesButton = document.getElementById("nCyclesButton");
const cyclesInp = document.getElementById("cyclesInp");
const programStatusElem = document.getElementById("programStatusElem");

let program;


initButton.addEventListener("click", () => {
	try {
		clearStatus();
		program = loadProgram(programInp.value);
		commandIdsElem.textContent = program.commandTypes.map(c => {
			return  program.stringifyId(c) + " " + program.stringifyCommand(c);
		}).join("\n");
		renderProgram();
	} catch(e) {
		showError(e);
	}
});

stepButton.addEventListener("click", () => {
	try {
		program.step();
		renderProgram();
	} catch(e) {
		showError(e);
	}
});

cycleButton.addEventListener("click", () => {
	try {
		program.cycle();
		renderProgram();
	} catch(e) {
		showError(e);
	}
});

nCyclesButton.addEventListener("click", () => {
	try {
		program.cycles(+cyclesInp.value);
		renderProgram();
	} catch(e) {
		showError(e);
	}
});


function showError(e) {
	console.error(e);
	clearStatus();
	programStatusElem.textContent = e;
	programStatusElem.classList.add("error");
}

function clearStatus() {
	programStatusElem.innerHTML = "";
	programStatusElem.classList.remove("error");
}


function renderProgram() {
	programLengthElem.textContent = program.commands.length;
	cycleIndexElem.textContent = program.cycleIndex;
	const prevSkipStart = program.index === 1 ? program.commands.length - program.prevSkipAmount : program.index - program.prevSkipAmount;
	const nextSkipStart = program.index + 1;
	programOpsElem.innerHTML = "";
	programIdsElem.innerHTML = "";
	let currentOpsElem;
	let currentIdElem;
	for (const [i, c] of program.commands.entries()) {
		if (i) programIdsElem.insertAdjacentText("beforeend", program.idSeparator);
		const opsElem = document.createElement("span");
		const idElem = document.createElement("span");
		opsElem.textContent = program.stringifyCommand(c);
		idElem.textContent = program.stringifyId(c);
		if (i === program.index) {
			opsElem.classList.add("currentCommand");
			idElem.classList.add("currentCommand");
			currentOpsElem = opsElem;
			currentIdElem = idElem;
		} else if ((i === 0 && (program.index === 1 || program.index + program.nextSkipAmount === program.commands.length - 1)) || (prevSkipStart <= i && i < prevSkipStart + program.prevSkipAmount) || (nextSkipStart <= i && i < nextSkipStart + program.nextSkipAmount)) {
			opsElem.classList.add("skippedCommand");
			idElem.classList.add("skippedCommand");
		}
		programOpsElem.appendChild(opsElem);
		programIdsElem.appendChild(idElem);
	}
	const x = window.scrollX;
	const y = window.scrollY;
	if (program.cycleStart) {
		programOpsElem.scrollLeft = 0;
		programIdsElem.scrollLeft = 0;
	} else if (program.index + program.nextSkipAmount === program.commands.length - 1) {
		programOpsElem.scrollLeft = programOpsElem.scrollWidth;
		programIdsElem.scrollLeft = programIdsElem.scrollWidth;
	}
	currentOpsElem.scrollIntoView();
	currentIdElem.scrollIntoView();
	window.scrollTo(x, y);
}


function loadProgram(code) {
	const commands = parseKwert(code);
	const commandTypes = [];
	for (const c of commands) {
		if (!commandTypes.includes(c)) commandTypes.push(c);
	}
	const decimalIdLength = (commandTypes.length - 1).toString().length;
	return {
		commandTypes,
		idSeparator: commandTypes.length > 36 ? " " : "",
		commands,
		index: 1,
		cycleStart: true,
		prevSkipAmount: 0,
		nextSkipAmount: commands[1].skip,
		cycleIndex: 0,
		step() {
			this.cycleStart = false;
			const c = this.commands.splice(this.index, 1)[0];
			for (const {length, distance} of c.copies) {
				if (distance > this.index) throw new Error("Distance out of range");
				for (let i = this.index - distance, j = 0; j < length; i++, j++) {
					this.commands.splice(this.index, 0, this.commands[i]);
					this.index++;
				}
			}
			this.index += c.skip;
			if (this.index > this.commands.length) throw new Error("Skip length out of range");
			if (this.index === this.commands.length) {
				this.index = 1;
				this.cycleStart = true;
				this.cycleIndex++;
			}
			this.prevSkipAmount = this.nextSkipAmount;
			this.nextSkipAmount = this.commands[this.index]?.skip || 0;
		},
		cycle() {
			if (this.commands.length > 1) {
				this.step();
				while (!this.cycleStart) this.step();
			}
		},
		cycles(n = 1) {
			while (n > 0 && this.commands.length > 1) {
				this.cycle();
				n--;
			}
		},
		toString() {
			return this.commands.map(c => this.stringifyCommand(c)).join("");
		},
		toIdString() {
			return this.commands.map(c => this.stringifyId(c)).join(this.idSeparator);
		},
		stringifyCommand(c) {
			return "[" + (c.copies.length || c.skip ? c.copies.map(({length, distance}) => length + " " + distance).join(",") : "") + (c.skip ? ";" + c.skip : "") + "]";
		},
		stringifyId(x) {
			if (typeof x !== "number") x = x.id;
			return commandTypes.length > 36 ? x.toString().padStart(decimalIdLength, "0") : x.toString(commandTypes.length);
		}
	};
}

