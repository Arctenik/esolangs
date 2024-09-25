

function parseKwert(code) { // uses the same object for commands with the same parameters
	const sections = [];
	const sectionsExpr = /\[([^\]]*)\]|`([^`\r\n\[\]]*)`?|[\[\]`]/g;
	let match;
	
	while (match = sectionsExpr.exec(code)) {
		if (typeof match[1] === "string") sections.push(["command", match.index + 1, match.index + 1 + match[1].length]);
		else if (match[2]) sections.push(["ids", match.index + 1, match.index + 1 + match[2].length]);
		else throw new Error("Invalid syntax at " + (match.index + 1));
	}
	
	const commands = [];
	const commandsByParams = {};
	const commandsById = {};
	const idlessCommands = new Set();
	let idLength = null;
	
	for (let i = 0; i < sections.length; i++) {
		const [type, startIndex, endIndex] = sections[i];
		if (type === "command") {
			const command = parseCommand(startIndex, endIndex);
			commands.push(command);
			idlessCommands.add(command);
		} else {
			const content = code.substring(startIndex, endIndex).trim();
			if (!content) throw new Error("Empty IDs section at " + startIndex);
			const ids = content.split(/\s+/).map(piece => {
				const pieceIds = [];
				if (idLength === null) {
					pieceIds.push(piece);
					idLength = piece.length;
				} else {
					for (let j = 0; j < piece.length; j += idLength) {
						const id = piece.substring(j, j + idLength);
						if (id.length !== idLength) throw new Error("Unexpected end of ID in section at " + startIndex);
						pieceIds.push(id);
					}
				}
				return pieceIds;
			}).flat();
			if (ids.length === 1 && !commandsById[ids[0]]) {
				i++;
				if (sections[i][0] !== "command") throw new Error("Missing command after new ID in section at " + startIndex);
				const command = parseCommand(...sections[i].slice(1));
				if (command.id) throw new Error("ID " + JSON.stringify(command.id) + " assigned to command with existing ID");
				command.id = ids[0];
				idlessCommands.delete(command);
				commandsById[ids[0]] = command;
			} else {
				for (const id of ids) {
					const command = commandsById[id];
					if (!command) throw new Error("Unknown ID " + JSON.stringify(id) + " in section at " + startIndex);
					commands.push(command);
				}
			}
		}
	}
	
	if (idLength === null) idLength = 1;
	
	let nextId = 0;
	let idString;
	
	for (const command of idlessCommands) {
		while (commandsById[idString = (nextId++).toString(36).padStart(idLength, "0")]) {};
		command.id = idString;
	}
	
	if (idString && idString.length > idLength) {
		idLength = idString.length;
		for (const command of Object.values(commandsById)) {
			command.id = command.id.padStart(idLength, "0");
		}
		for (const command of idlessCommands) {
			command.id = command.id.padStart(idLength, "0");
		}
	}
	
	return commands;
	
	
	function parseCommand(startIndex, endIndex) {
		const parts = code.substring(startIndex, endIndex).trim().split(/\s*;\s*/);
		if (parts.length > 2) badCommand(startIndex);
		const copies = parts[0].split(/\s*,\s*/).map((copy, i, arr) => {
			if (!copy) {
				if (i < arr.length - 1) badCommand(startIndex);
				else return;
			}
			const copyParts = copy.split(/\s+/);
			if (copyParts.length !== 2) badCommand(startIndex);
			const [length, distance] = copyParts.map(v => /^\d+$/.test(v) ? +v : badCommand(startIndex));
			if (length === 0) throw new Error("Invalid length 0 in command at " + startIndex);
			if (distance === 0) throw new Error("Invalid distance 0 in command at " + startIndex);
			return {length, distance};
		});
		if (!copies[copies.length - 1]) copies.pop();
		const skip = parts[1] ? (/^\d+$/.test(parts[1]) ? +parts[1] : badCommand(startIndex)) : 0;
		return getCommand(copies, skip);
	}
	
	function getCommand(copies, skip) {
		let obj = commandsByParams[skip] || (commandsByParams[skip] = {});
		for (const {length, distance} of copies) {
			obj = obj[length] || (obj[length] = {});
			obj = obj[distance] || (obj[distance] = {});
		}
		if (obj[""] === undefined) obj[""] = {copies, skip};
		return obj[""];
	}
	
	function badCommand(startIndex) {
		throw new Error("Invalid syntax in command at " + startIndex);
	}
}

