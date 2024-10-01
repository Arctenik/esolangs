

const programInp = document.getElementById("programInp");
const compileButton = document.getElementById("compileButton");
const updateFromStateButton = document.getElementById("updateFromStateButton");
const dlButton = document.getElementById("dlButton");
const fileInp = document.getElementById("fileInp");
const exportBase64Button = document.getElementById("exportBase64Button");
const loadBase64Button = document.getElementById("loadBase64Button");
const base64Inp = document.getElementById("base64Inp");
const resetDataButton = document.getElementById("resetDataButton");
const inflateButton = document.getElementById("inflateButton");
const cycleElem = document.getElementById("cycleElem");
const dataElem = document.getElementById("dataElem");
const dataLengthElem = document.getElementById("dataLengthElem");
const commandLengthElem = document.getElementById("commandLengthElem");
const commandsElem = document.getElementById("commandsElem");
const numCommandsElem = document.getElementById("numCommandsElem");

let fileName;
let fileExt;
let dataInfo;
let initialData;
let currentData;
let currentCycle;
let dataDlUrl;

compileButton.addEventListener("click", () => {
	try {
		fileName = "program";
		fileExt = ".deflate";
		loadData(compile(programInp.value));
	} catch(e) {
		showError(e);
	}
});

updateFromStateButton.addEventListener("click", () => {
	try {
		programInp.value = updateProgramWithCommands(programInp.value, dataInfo.commands);
		programInp.focus();
		programInp.select();
	} catch(e) {
		showError(e);
	}
});

dlButton.addEventListener("click", () => {
	try {
		discardDlUrl();
		const a = document.createElement("a");
		a.download = fileName + (currentCycle ? "_cycle" + currentCycle : "") + fileExt;
		a.href = dataDlUrl = URL.createObjectURL(new Blob([currentData]));
		a.dispatchEvent(new MouseEvent("click"));
	} catch(e) {
		showError(e);
	}
});

fileInp.addEventListener("change", async () => {
	try {
		const file = fileInp.files[0];
		if (file) {
			[, fileName, fileExt] = /^([^.]*)((?:\..*)?)/.exec(file.name);
			loadData(new Uint8Array(await file.arrayBuffer()));
		}
	} catch(e) {
		showError(e);
	}
});

exportBase64Button.addEventListener("click", () => {
	try {
		const r = new FileReader();
		r.addEventListener("load", () => {
			base64Inp.value = r.result.slice(r.result.indexOf(",") + 1);
			base64Inp.focus();
			base64Inp.select();
		});
		r.readAsDataURL(new Blob([currentData]));
	} catch(e) {
		showError(e);
	}
});

loadBase64Button.addEventListener("click", async () => {
	try {
		fileName = "program";
		fileExt = ".deflate";
		loadData(new Uint8Array(await (await fetch("data:application/octet-stream;base64," + base64Inp.value)).arrayBuffer()));
	} catch(e) {
		showError(e);
	}
});

resetDataButton.addEventListener("click", () => {
	try {
		loadData(initialData);
	} catch(e) {
		showError(e);
	}
});

inflateButton.addEventListener("click", () => {
	if (!currentData) return;
	let inflated;
	try {
		inflated = pako.inflateRaw(currentData);
	} catch(e) {
		const s = String(e);
		showError(
			e,
			s === "invalid block type"
				? `${s} (probably a halt)`
				: `${s} (possibly a halt?)`
		);
		return;
	}
	try {
		currentCycle++;
		loadData(inflated, false);
	} catch(e) {
		showError(e);
	}
});

function showError(e, message = e) {
	console.error(e);
	clearStatus();
	statusElem.textContent = message;
	statusElem.classList.add("error");
}

function clearStatus() {
	statusElem.innerHTML = "";
	statusElem.classList.remove("error");
}

function loadData(bytes, initial = true) {
	discardDlUrl();
	if (initial) {
		initialData = bytes;
		currentCycle = 0;
	}
	currentData = bytes;
	dataInfo = decompile(bytes);
	showData();
	dlButton.disabled = false;
	exportBase64Button.disabled = false;
	resetDataButton.disabled = false;
	inflateButton.disabled = false;
}

function showData() {
	cycleElem.textContent = currentCycle;
	dataLengthElem.textContent = currentData.length;
	commandLengthElem.textContent = dataInfo.commandLength;
	numCommandsElem.textContent = dataInfo.commands.length;
	dataElem.innerHTML = "";
	commandsElem.innerHTML = "";
	let currentDataElem = dataElem;
	let i = 0;
	while (i < dataInfo.commandIndices[0]) {
		addByte();
	}
	for (const c of dataInfo.commands) {
		const commandDataElem = currentDataElem = document.createElement("span");
		commandDataElem.classList.add("commandData");
		dataElem.appendChild(commandDataElem);
		for (let j = 0; j < dataInfo.commandLength; j++) {
			addByte();
		}
		currentDataElem = dataElem;
		const commandElem = document.createElement("span");
		commandElem.classList.add("command");
		commandElem.textContent = stringifyCommand(c);
		commandsElem.appendChild(commandElem);
		commandElem.addEventListener("mouseenter", () => {
			commandDataElem.classList.add("selected");
			const {top: dataTop, height: dataHeight} = dataElem.getBoundingClientRect();
			const dataBottom = dataTop + dataHeight;
			const {top: commandTop, height: commandHeight} = commandDataElem.getBoundingClientRect();
			const commandBottom = commandTop + commandHeight;
			if (commandBottom < dataTop || commandTop > dataBottom) {
				dataElem.scrollTop += ((commandTop - dataTop) - (dataBottom - commandBottom))/2;
			} else if (commandTop < dataTop) {
				dataElem.scrollTop -= dataTop - commandTop;
			} else if (commandBottom > dataBottom) {
				dataElem.scrollTop += commandBottom - dataBottom;
			}
		});
		commandElem.addEventListener("mouseleave", () => {
			commandDataElem.classList.remove("selected");
		});
	}
	while (i < currentData.length) {
		addByte();
	}
	
	function addByte() {
		if (i) {
			if (i%16) {
				currentDataElem.insertAdjacentText("beforeend", " ");
			} else {
				currentDataElem.insertAdjacentText("beforeend", "\n");
			}
		}
		currentDataElem.insertAdjacentText("beforeend", currentData[i].toString(16).padStart(2, "0"));
		i++;
	}
}

function stringifyCommand(c) {
	if (c.halt) return "[$]";
	return "[" + (c.copies.length || c.skip ? c.copies.map(({length, distance}) => length + " " + distance).join(",") : "") + (c.skip ? ";" + c.skip : "") + "]";
}

function discardDlUrl() {
	URL.revokeObjectURL(dataDlUrl);
}



function updateProgramWithCommands(code, commands) {
	const stateCommandParams = commands.map(getParams);
	let commandIdsByParams, idLength;
	if (code) {
		const programCommands = parseKwert(code);
		idLength = programCommands[0].id.length;
		commandIdsByParams = new Map(Array.from(new Set(programCommands), c => [getParams(c), c.id]));
	} else {
		const uniqueParams = new Set(stateCommandParams);
		const numNormalIds = uniqueParams.size - (uniqueParams.has("halt") ? 1 : 0);
		idLength = (numNormalIds - 1).toString(36).length;
		commandIdsByParams = new Map();
		let i = 0;
		for (const p of uniqueParams) {
			if (p === "halt") {
				commandIdsByParams.set(p, "$".repeat(idLength));
				continue;
			}
			commandIdsByParams.set(p, (i++).toString(36).padStart(idLength, "0"));
		}
	}
	const commandsById = new Map();
	const commandsText = commands.map((c, i) => {
		const p = getParams(c);
		const id = commandIdsByParams.get(p);
		if (!id) throw new Error(`Command not found in target program: ${stringifyCommand(c)}`);
		if (!commandsById.has(id)) commandsById.set(id, c);
		return id;
	}).join(idLength > 1 ? " " : "");
	return Array.from(commandsById, ([id, c]) => "` " + id + " " + stringifyCommand(c)).join("\n") + "\n\n` " + commandsText;
	
	function getParams(c) {
		const copies = [];
		for (const copy of c.copies) {
			const prevCopy = copies[copies.length - 1];
			if (prevCopy?.distance === copy.distance) {
				copies[copies.length - 1] = {length: prevCopy.length + copy.length, distance: copy.distance};
				continue;
			}
			copies.push(copy);
		}
		return c.halt ? "halt" : copies.map(copy => [copy.length, copy.distance]).flat().join("_") + "_" + c.skip;
	}
}



const quineBeginningLength = 155;
const minDeflateLength = 3;
const maxDeflateLength = 258;
const maxDeflateDistance = 32768;
const lengthRanges = [
	{
		minSymbol: 256,
		minCode: 0b0000000,
		codeLength: 7
	},
	{
		minSymbol: 280,
		minCode: 0b11000000,
		codeLength: 8
	}
];
const distanceRanges = [
	{
		minSymbol: 0,
		minCode: 0b00000,
		codeLength: 5
	}
];
const lengths = [
	...new Array(257).fill([-1, -1]),
	[0, 3],
	[0, 4],
	[0, 5],
	[0, 6],
	[0, 7],
	[0, 8],
	[0, 9],
	[0, 10],
	[1, 11],
	[1, 13],
	[1, 15],
	[1, 17],
	[2, 19],
	[2, 23],
	[2, 27],
	[2, 31],
	[3, 35],
	[3, 43],
	[3, 51],
	[3, 59],
	[4, 67],
	[4, 83],
	[4, 99],
	[4, 115],
	[5, 131],
	[5, 163],
	[5, 195],
	[5, 227],
	[0, 258],
];
const distances = [
	[0, 1],
	[0, 2],
	[0, 3],
	[0, 4],
	[1, 5],
	[1, 7],
	[2, 9],
	[2, 13],
	[3, 17],
	[3, 25],
	[4, 33],
	[4, 49],
	[5, 65],
	[5, 97],
	[6, 129],
	[6, 193],
	[7, 257],
	[7, 385],
	[8, 513],
	[8, 769],
	[9, 1025],
	[9, 1537],
	[10, 2049],
	[10, 3073],
	[11, 4097],
	[11, 6145],
	[12, 8193],
	[12, 12289],
	[13, 16385],
	[13, 24577],
];


function compile(code) {
	const commands = parseKwert(code);
	const commandEncodings = convertCommandTypes(commands);
	const commandLength = commandEncodings[commands[0].id].length;
	const startQuine = getDeflateQuineBase([0b00000000, ...makeUncompressedLengths(commandLength)]);
	const endQuine = getDeflateQuineBase([0b00000001, 0, 0, 255, 255]);
	const result = new Uint8Array(startQuine.length + commands.length * commandLength + endQuine.length);
	result.set(startQuine);
	let i = startQuine.length;
	for (const c of commands) {
		result.set(commandEncodings[c.id], i);
		i += commandLength;
	}
	result.set(endQuine, i);
	return result;
}

function getDeflateQuineBase(finalBeginning) {
	return [
		0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00,
		0x00, 0xFF, 0xFF, 0x00, 0x14, 0x00, 0xEB, 0xFF, 0x00, 0x00, 0x00, 0xFF,
		0xFF, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00,
		0x14, 0x00, 0xEB, 0xFF, 0xC2, 0x26, 0x06, 0x20, 0x00, 0x8E, 0x8D, 0x24,
		0x49, 0x92, 0x20, 0x08, 0x02, 0x22, 0x5A, 0x01, 0x00, 0x12, 0x00, 0xED,
		0xFF, 0x16, 0xD9, 0x7B, 0x00, 0xAD, 0x23, 0x7F, 0x00, 0x2E, 0x00, 0xD1,
		0xFF, 0xC2, 0x26, 0x06, 0x20, 0x00, 0x8E, 0x8D, 0x24, 0x49, 0x92, 0x20,
		0x08, 0x02, 0x22, 0x5A, 0x01, 0x00, 0x12, 0x00, 0xED, 0xFF, 0x16, 0xD9,
		0x7B, 0x00, 0xAD, 0x23, 0x7F, 0x00, 0x2E, 0x00, 0xD1, 0xFF, 0xC2, 0x26,
		0x06, 0x20, 0x00, 0x8E, 0x8D, 0x24, 0x49, 0x92, 0x20, 0x08, 0x02, 0x22,
		0x5A, 0x01, 0x00, 0x12, 0x00, 0xED, 0xFF, 0x02, 0x8B, 0x80, 0x05, 0x00,
		0x5B,            ...finalBeginning, 0x5D, 0x23, 0x23, 0x23, 0x23, 0x23,
		0x23, 0x02, 0x8B, 0x80, 0x05, 0x00,            ...finalBeginning
	];
}

function convertCommandTypes(commands) {
	let haltCommand = null;
	// it's assumed that commands with the same parameters will be the same object
	commands = Array.from(new Set(commands)).filter(c => {
		if (c.halt) {
			haltCommand = c;
			return false;
		}
		return true;
	});
	
	let bitsEstimate = 0;
	for (const c of commands) {
		bitsEstimate = Math.max(bitsEstimate, c.copies.length * 12 + 10); // minimum number of bits for a fixed-codes block with that many copies
	}
	
	const bytesEstimate = Math.ceil((bitsEstimate + 3)/8) + 4; // including the literal block? specifically the skips one i guess
	
	// get version with padding literal block(?)
	const byteAlignedInfo = getCommandBases(bytesEstimate, commands, 5);
	extendBitLengths(byteAlignedInfo, getBasisBitLength(byteAlignedInfo.maxLengthCommand));
	addExtraBytes(byteAlignedInfo);
	const byteAlignedLength = getFinalLength(byteAlignedInfo.genericCommand, 5);
	
	// get version with only compressed block padding(?)
	let info = getCommandBases(bytesEstimate, commands);
	let length = getFinalLength(info.genericCommand);
	while (getFinalLength(info.minLengthCommand) < length && length < byteAlignedLength) {
		const beforeBitLength = getBasisBitLength(info.minLengthCommand);
		extendBitLengths(info, getBasisBitLength(info.genericCommand));
		const afterBitLength = getBasisBitLength(info.minLengthCommand);
		if (beforeBitLength === afterBitLength) {
			info = getCommandBases(length + 1, commands);
		}
		length = getFinalLength(info.genericCommand);
	}
	
	if (byteAlignedLength <= length) {
		extendBitLengths(byteAlignedInfo, getBasisBitLength(byteAlignedInfo.genericCommand));
		info = byteAlignedInfo;
		length = getFinalLength(byteAlignedInfo.genericCommand, 5); // hopefully this is correct lol. otherwise the halt command will have issues
	}
	
	const result = Object.fromEntries(commands.map(c => {
		const {basis, basisBitsLeft: bitsLeft} = info.commands[c.id];
		const bytes = basis.slice();
		addBits(0b000, 3, bytes, bitsLeft);
		const skipLength = c.skip * (bytes.length + 4);
		if (skipLength > 0xffff) throw new Error("Skip length too high");
		bytes.push(...makeUncompressedLengths(skipLength));
		return [c.id, bytes];
	}));
	
	if (haltCommand) {
		const haltBytes = new Array(length).fill(0);
		haltBytes[0] = 0b00000110;
		haltBytes[haltBytes.length - 1] = 1;
		result[haltCommand.id] = haltBytes;
	}
	
	return result;
}

function addExtraBytes(info) {
	info.minUsedBitLength = Infinity;
	info.maxUsedBitLength = -Infinity;
	for (const ci of Object.values(info.commands)) {
		ci.basisBitsLeft = addBits(0b000, 3, ci.basis, ci.basisBitsLeft);
		ci.basis.push(0, 0, 255, 255);
		ci.basisBitsLeft = 0;
		updateLengthsInfo(ci);
	}
	info.genericCommand.basis.length = info.maxLengthCommand.basis.length + 1;
}

function extendBitLengths(info, maxLength) { // inclusive max
	info.minUsedBitLength = Infinity;
	info.maxUsedBitLength = -Infinity;
	for (const ci of Object.values(info.commands)) {
		while (getBasisBitLength(ci) + 10 <= maxLength) {
			ci.basisBitsLeft = addBits(0b0000000010, 10, ci.basis, ci.basisBitsLeft);
		}
		updateLengthsInfo(ci);
	}
}

function getCommandBases(usedByteLength, commands, extraByteCount = 0) {
	const info = {
		minUsedBitLength: Infinity,
		maxUsedBitLength: -Infinity
	};
	info.commands = Object.fromEntries(
		commands.map(command => [
			command.id,
			{
				info,
				command,
				basis: [],
				basisBitsLeft: 0
			}
		])
	);
	info.genericCommand = {
		info,
		basis: {length: 0},
		basisBitsLeft: 0
	};
	let lengthChanged = true;
	while (lengthChanged) {
		let newBytesEstimate = 0;
		for (const {command: c} of Object.values(info.commands)) {
			const bytes = [];
			let bitsLeft = 0;
			bitsLeft = addBits(0b010, 3, bytes, bitsLeft);
			for (const copy of c.copies) {
				bitsLeft = encodeCopy(copy.length * usedByteLength, copy.distance * usedByteLength, bytes, bitsLeft);
			}
			bitsLeft = addBits(0b0000000, 7, bytes, bitsLeft);
			const ci = info.commands[c.id];
			ci.basis = bytes;
			ci.basisBitsLeft = bitsLeft;
			newBytesEstimate = Math.max(newBytesEstimate, getFinalLength(ci, extraByteCount));
			updateLengthsInfo(ci);
		}
		lengthChanged = newBytesEstimate > usedByteLength;
		if (lengthChanged) usedByteLength = newBytesEstimate;
	}
	info.genericCommand.basis.length = usedByteLength - 4 - extraByteCount;
	info.genericCommand.basisBitsLeft = 3;
	return info;
}

function updateLengthsInfo(ci) {
	const l = getBasisBitLength(ci);
	if (l < ci.info.minUsedBitLength) {
		ci.info.minUsedBitLength = l;
		ci.info.minLengthCommand = ci;
	}
	if (l > ci.info.maxUsedBitLength) {
		ci.info.maxUsedBitLength = l;
		ci.info.maxLengthCommand = ci;
	}
}

function getBasisBitLength(ci) {
	return ci.basis.length * 8 - ci.basisBitsLeft;
}

function getFinalLength(ci, extraByteCount = 0) {
	return ci.basis.length + (ci.basisBitsLeft < 3 ? 1 : 0) + 4 + extraByteCount;
}

function encodeCopy(length, distance, bytes, bitsLeft) {
	if (distance > maxDeflateDistance) throw new Error("Distance too high");
	const lengthParts = [];
	while (length > maxDeflateLength) {
		if (length - maxDeflateLength < minDeflateLength) {
			lengthParts.push(length - minDeflateLength);
			length = minDeflateLength;
		} else {
			lengthParts.push(maxDeflateLength);
			length -= maxDeflateLength;
		}
	}
	lengthParts.push(length);
	for (const length of lengthParts) {
		bitsLeft = addBits(...encodeSymbol(lengthRanges, lengths, length), bytes, bitsLeft);
		bitsLeft = addBits(...encodeSymbol(distanceRanges, distances, distance), bytes, bitsLeft);
	}
	return bitsLeft;
}

function encodeSymbol(ranges, values, value) {
	for (let symbol = values.length - 1; symbol >= 0; symbol--) {
		const [numExtra, minValue] = values[symbol];
		if (minValue < 0) break;
		if (value >= minValue) {
			for (const {minSymbol, minCode, codeLength} of ranges.slice().reverse()) {
				if (symbol >= minSymbol) {
					return [
						((value - minValue) << codeLength) | reverseBits(minCode + symbol - minSymbol, codeLength),
						codeLength + numExtra
					];
				}
			}
			break;
		}
	}
	throw new Error("Unable to encode symbol value " + value);
}

function addBits(bits, numBits, bytes, bitsLeft) {
	while (numBits > 0) {
		if (bitsLeft === 0) {
			bytes.push(0);
			bitsLeft = 8;
		}
		if (numBits < bitsLeft) {
			bytes[bytes.length - 1] |= bits << (8 - bitsLeft)
			bitsLeft -= numBits;
			numBits = 0;
		} else {
			bytes[bytes.length - 1] |= (bits & ((1 << bitsLeft) - 1)) << (8 - bitsLeft);
			numBits -= bitsLeft;
			bits >>= bitsLeft;
			bitsLeft = 0;
		}
	}
	return bitsLeft;
}

function makeUncompressedLengths(length) {
	const inverseLength = 0xffff - length;
	return [length & 0xff, length >> 8, inverseLength & 0xff, inverseLength >> 8]
}

function reverseBits(n, length) {
	let result = 0;
	for (let i = 0; i < length; i++) {
		result = (result << 1) | (n & 1);
		n >>= 1;
	}
	return result;
}



function decompile(bytes) {
	if (bytes.length < quineBeginningLength) throw new Error("Data too short");
	
	const commandLength = (bytes[quineBeginningLength - 3] << 8) | bytes[quineBeginningLength - 4];
	const commands = [];
	const commandIndices = [];
	let i = quineBeginningLength;
	let bitOffset;
	
	while (i < bytes.length) {
		if (onEmptyUncompressed()) {
			return {commands, commandIndices, commandLength};
		} else if (onErrorBlock()) {
			const commandStart = i;
			i += commandLength;
			if (i < bytes.length) {
				commands.push({halt: true});
				commandIndices.push(commandStart);
			}
		} else {
			const commandStart = i;
			const copies = parseCopies();
			i = commandStart + commandLength;
			if (i < bytes.length) {
				const skipBytes = (bytes[i - 3] << 8) | bytes[i - 4];
				if (skipBytes%commandLength !== 0) throw new Error("Unusable skip length at " + (i - 4));
				const skip = skipBytes/commandLength;
				commands.push({copies, skip});
				commandIndices.push(commandStart);
			}
		}
	}
	
	throw new Error("Unexpected end of data");
	
	
	function parseCopies() {
		bitOffset = 0;
		if (readBits(1) !== 0) throw new Error("Unexpected final block at " + i);
		if (readBits(2) !== 1) throw new Error("Unusable block type at " + i);
		const result = [];
		let copyByteLength;
		let copyByteDistance;
		let opStartByte;
		let opStartBit;
		while (i < bytes.length) {
			const startByte = i;
			const startBit = bitOffset;
			const symbol = readLengthSymbol();
			if (symbol === 256) {
				addOp();
				return result;
			}
			const l = readValue(symbol, lengths);
			const d = readValue(readDistanceSymbol(), distances);
			if (d%commandLength !== 0) throw new Error("Unusable distance in operation at " + startByte + " (bit " + startBit + ")");
			if (d === copyByteDistance) {
				copyByteLength += l;
			} else {
				addOp();
				copyByteLength = l;
				copyByteDistance = d;
				opStartByte = startByte;
				opStartBit = startBit;
			}
		}
		
		function addOp() {
			if (copyByteDistance !== undefined) {
				if (copyByteLength%commandLength !== 0) throw new Error("Unusable length in operation(s) at " + opStartByte + " (bit " + opStartBit + ")");
				result.push({
					length: copyByteLength/commandLength,
					distance: copyByteDistance/commandLength
				});
			}
		}
	}
	
	function readValue(symbol, values) {
		const [extraBits, minValue] = values[symbol];
		return minValue + (extraBits && readBits(extraBits));
	}
	
	function readLengthSymbol() {
		const start = reverseBits(readBits(7), 7);
		if (start < 0b1100000) {
			return 256 + start;
		} else {
			return 280 + ((start << 1) | readBits(1)) - 0b11000000;
		}
	}
	
	function readDistanceSymbol() {
		return reverseBits(readBits(5), 5);
	}
	
	function readBits(n) {
		let result = 0;
		let resultLength = 0;
		while (n >= 8 - bitOffset) {
			if (i >= bytes.length) throw new Error("Unexpected end of data");
			result |= (bytes[i] >> bitOffset) << resultLength;
			resultLength += 8 - bitOffset;
			n -= 8 - bitOffset;
			bitOffset = 0;
			i++;
		}
		if (n) {
			if (i >= bytes.length) throw new Error("Unexpected end of data");
			result |= ((bytes[i] >> bitOffset) & ((1 << n) - 1)) << resultLength;
			bitOffset += n;
		}
		return result;
	}
	
	function onEmptyUncompressed() {
		return bytes[i] === 0 && bytes[i + 1] === 0 && bytes[i + 2] === 0 && bytes[i + 3] === 255 && bytes[i + 4] === 255;
	}
	
	function onErrorBlock() {
		return (bytes[i] & 0b110) === 0b110;
	}
}

