

const programInp = document.getElementById("programInp");
const inputInp = document.getElementById("inputInp");
const initButton = document.getElementById("initButton");
const programStatusElem = document.getElementById("programStatusElem");
const inputQueueElem = document.getElementById("inputQueueElem");
const outputElem = document.getElementById("outputElem");
const timeLimitInp = document.getElementById("timeLimitInp");
const discardContsInp = document.getElementById("discardContsInp");
const discardCodeInp = document.getElementById("discardCodeInp");
const runButton = document.getElementById("runButton");
const stepContButton = document.getElementById("stepContButton");
const stepButton = document.getElementById("stepButton");
const stepSizeInp = document.getElementById("stepSizeInp");
const contIndexInp = document.getElementById("contIndexInp");
const focusCurrentContInp = document.getElementById("focusCurrentContInp");
const contCountElem = document.getElementById("contCountElem");
const contElem = document.getElementById("contElem");
const queueElem = document.getElementById("queueElem");

let program;
let viewedCont;
let viewedContIndex;
let viewedContParsedLength;
let viewedContProgramLength;


initButton.addEventListener("click", () => {
	try {
		viewedCont = null;
		viewedContIndex = null;
		viewedContParsedLength = null;
		viewedContProgramLength = null;
		contIndexInp.value = 0;
		outputElem.innerHTML = "";
		program = new Brook(programInp.value, inputInp.value, {
			discardContinuities: discardContsInp.checked,
			discardCode: discardCodeInp.checked,
			addOutput(val) {
				outputElem.textContent += val;
			}
		});
		displayEvalInfo(true);
	} catch(e) {
		console.error(e);
		showStatus(e, true);
	}
});

discardContsInp.addEventListener("change", () => program.discardContinuities = discardContsInp.checked);
discardCodeInp.addEventListener("change", () => program.discardCode = discardCodeInp.checked);

contIndexInp.addEventListener("change", () => {
	displayEvalInfo(false, true);
});

runButton.addEventListener("click", makeRunCallback(() =>
	program.run(timeLimitInp.value * 1000)));

stepContButton.addEventListener("click", makeRunCallback(() =>
	program.runContinuity(timeLimitInp.value * 1000)));

stepButton.addEventListener("click", makeRunCallback(() =>
	program.multiStep(+stepSizeInp.value, timeLimitInp.value * 1000)));


function makeRunCallback(func) {
	return () => {
		try {
			if (!program) throw new Error("Program not loaded");
			displayEvalInfo(false, false, func());
		} catch(e) {
			console.error(e);
			showStatus(e, true);
		}
	};
}

function showStatus(text, isError) {
	programStatusElem.textContent = text;
	if (isError) programStatusElem.classList.add("error");
	else programStatusElem.classList.remove("error");
}

function displayEvalInfo(isInit, keepIndex, wasInterrupted) {
	showStatus((isInit ? "Program initialized" : program.finished ? "Program halted" : "Program in progress") + (wasInterrupted ? ", interrupted" : ""));
	
	inputQueueElem.textContent = program.input;
	
	if (!keepIndex && focusCurrentContInp.checked && program.currentContinuity) contIndexInp.value = program.currentContinuity.contIndex;
	
	const targetIndex = +contIndexInp.value;
	let cont = program.currentContinuity;
	
	if (cont?.contIndex > targetIndex) {
		while (cont?.contIndex > targetIndex) {
			cont = cont.parent;
		}
	} else {
		while (cont?.contIndex < targetIndex) {
			cont = cont.child;
		}
	}
	
	if (cont?.contIndex !== targetIndex) cont = null;
	
	let focusPointer = false;
	let focusEnd = false;
	
	if (cont) {
		if (cont === viewedCont) {
			focusPointer = cont.index !== viewedContIndex;
			focusEnd = (cont.parsed.length > viewedContParsedLength || cont.program.length > viewedContProgramLength) && contElem.scrollLeft + contElem.clientWidth === contElem.scrollWidth;
		} else {
			focusPointer = true;
		}
	}
	
	viewedCont = cont;
	viewedContIndex = cont?.index;
	viewedContParsedLength = cont?.parsed.length;
	viewedContProgramLength = cont?.program.length;
	
	contCountElem.textContent = program.continuityCount;
	contIndexInp.max = program.continuityCount - 1;
	
	contElem.innerHTML = "";
	if (!cont || cont.indicesOffset > 0) {
		contElem.insertAdjacentHTML("beforeend", `<span class="discardedCode"></span>`);
	}
	let i = 0;
	let currentElem = contElem;
	let currentCommandElem;
	if (cont) {
		for (const command of cont.parsed) {
			if (typeof command === "string") {
				addText(command);
			} else if (command.type === "open") {
				addText((command.number || "") + "(");
			} else if (command.type === "close") {
				addText(")");
			} else if (command.type === "push") {
				addText(command.number + "^");
			}
			i++;
		}
		if (cont.program) {
			currentElem = document.createElement("span");
			currentElem.classList.add("unparsedProgram");
			contElem.appendChild(currentElem);
			addText(cont.program[0]);
			i++;
			addText(cont.program.substring(1));
		} else if (cont.index - cont.indicesOffset === cont.parsed.length) {
			contElem.insertAdjacentHTML("beforeend", `<span class="currentCommand emptyChar"></span>`);
			currentCommandElem = contElem.children[contElem.children.length - 1];
		}
		queueElem.textContent = cont.queue.join(" ");
	} else {
		queueElem.innerHTML = `<span class="discardedCode"></span>`;
	}
	if (focusPointer) {
		if (currentCommandElem) {
			const x = window.scrollX;
			const y = window.scrollY;
			currentCommandElem.scrollIntoView();
			window.scrollTo(x, y);
		}
	} else if (focusEnd) {
		contElem.scrollLeft = contElem.scrollWidth - contElem.clientWidth;
	}
	
	
	function addText(text) {
		if (i === cont.index - cont.indicesOffset) {
			const elem = document.createElement("span");
			elem.classList.add("currentCommand");
			elem.textContent = text;
			currentElem.appendChild(elem);
			currentCommandElem = elem;
		} else {
			currentElem.insertAdjacentText("beforeend", text);
		}
	}
}

