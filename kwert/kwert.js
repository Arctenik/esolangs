

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
			return  "` " + c.id + " " + program.stringifyCommand(c);
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


function showMessage(m) {
	clearStatus();
	programStatusElem.textContent = m;
}

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
	if (program.halted) {
		showMessage("Program has halted");
	  programOpsElem.classList.add("halted");
	  programIdsElem.classList.add("halted");
	} else {
	  programOpsElem.classList.remove("halted");
	  programIdsElem.classList.remove("halted");
	}
	programOpsElem.innerHTML = "";
	programIdsElem.innerHTML = '<span class="skippedCommand">`</span>';
	let currentOpsElem;
	let currentIdElem;
	const skipRanges = program.getFutureSkipRanges();
	let skipRangeIndex = 0;
	for (const [i, c] of program.commands.entries()) {
		if (skipRanges[skipRangeIndex]?.[1] < i) skipRangeIndex++;
		if (i) programIdsElem.insertAdjacentText("beforeend", program.idSeparator);
		const opsElem = document.createElement("span");
		const idElem = document.createElement("span");
		opsElem.textContent = program.stringifyCommand(c);
		idElem.textContent = c.id;
		if (i === program.index) {
			opsElem.classList.add("currentCommand");
			idElem.classList.add("currentCommand");
			currentOpsElem = opsElem;
			currentIdElem = idElem;
		} else if (i === 0 || (skipRanges[skipRangeIndex]?.[0] <= i && i < skipRanges[skipRangeIndex]?.[1])) {
			opsElem.classList.add("skippedCommand");
			idElem.classList.add("skippedCommand");
		}
		if (program.insertStart <= i && i < program.insertEnd) {
			opsElem.classList.add("insertedCommand");
			idElem.classList.add("insertedCommand");
		}
		programOpsElem.appendChild(opsElem);
		programIdsElem.appendChild(idElem);
	}
	if (currentOpsElem) {
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
}


function loadProgram(code) {
	const commands = parseKwert(code);
	const commandTypes = Array.from(new Set(commands));
	return {
		commandTypes,
		idSeparator: commands[0].id.length === 1 ? "" : " ",
		commands,
		cycleInitialCommands: commands.slice(),
		initialCommandsIndex: 1,
		halted: false,
		index: 1,
		cycleStart: true,
		insertStart: null,
		insertEnd: null,
		cycleIndex: 0,
		step() {
			if (this.halted) return;
			this.insertStart = this.index;
			if (this.commands.length > 1) {
				this.cycleStart = false;
				const c = this.commands.splice(this.index, 1)[0];
				if (c.halt) {
					this.commands.splice(this.index, 0, c);
					this.insertEnd = this.index;
					this.halted = true;
					this.commands = this.cycleInitialCommands;
					this.index = this.initialCommandsIndex;
					return;
				}
				for (const {length, distance} of c.copies) {
					if (distance > this.index) throw new Error("Distance out of range");
					for (let i = this.index - distance, j = 0; j < length; i++, j++) {
						this.commands.splice(this.index, 0, this.commands[i]);
						this.index++;
					}
				}
				this.insertEnd = this.index;
				this.index += c.skip;
				this.initialCommandsIndex += 1 + c.skip;
				if (this.index > this.commands.length) throw new Error("Skip length out of range");
				if (this.index === this.commands.length) {
					this.index = 1;
					this.cycleStart = true;
					this.cycleInitialCommands = this.commands.slice();
					this.initialCommandsIndex = 1;
					this.cycleIndex++;
				}
			} else {
				this.insertEnd = this.index;
				this.cycleIndex++;
			}
		},
		cycle() {
			if (this.commands.length > 1 && !this.halted) {
				this.step();
				while (!this.cycleStart && !this.halted) this.step();
			}
		},
		cycles(n = 1) {
			while (n > 0 && this.commands.length > 1 && !this.halted) {
				this.cycle();
				n--;
			}
		},
		toString() {
			return this.commands.map(c => this.stringifyCommand(c)).join("");
		},
		toIdString() {
			return this.commands.map(c => c.id).join(this.idSeparator);
		},
		stringifyCommand(c) {
			if (c.halt) return "[$]";
			return "[" + (c.copies.length || c.skip ? c.copies.map(({length, distance}) => length + " " + distance).join(",") : "") + (c.skip ? ";" + c.skip : "") + "]";
		},
		getFutureSkipRanges() {
			const result = [];
			for (let i = this.index; i < this.commands.length; ) {
				const {skip} = this.commands[i];
				i++;
				if (skip) {
					const start = i;
					i += skip;
					result.push([start, i]);
				}
			}
			return result;
		}
	};
}

