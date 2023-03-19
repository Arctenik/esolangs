

function parseKwert(code) { // uses the same object for commands with the same parameters
	const backtickIndex = code.indexOf("`");
	if (backtickIndex !== -1) throw new Error("Unexpected backtick at " + (backtickIndex + 1));
	const commands = [];
	const commandsByParams = {};
	let nextCommandId = 0;
	let closeIndex = -1;
	let openIndex;
	while (true) {
		openIndex = code.indexOf("[", closeIndex + 1);
		closeIndex = code.indexOf("]", closeIndex + 1);
		if (openIndex === -1 && closeIndex === -1) break;
		if (closeIndex === -1) throw new Error("Unclosed bracket");
		if (closeIndex < openIndex || openIndex === -1) throw new Error("Invalid syntax at " + (closeIndex + 1));
		const parts = code.substring(openIndex + 1, closeIndex).trim().split(/\s*;\s*/);
		if (parts.length > 2) badCommand();
		const copies = parts[0].split(/\s*,\s*/).map((copy, i, arr) => {
			if (!copy) {
				if (i < arr.length - 1) badCommand();
				else return;
			}
			const copyParts = copy.split(/\s+/);
			if (copyParts.length !== 2) badCommand();
			const [length, distance] = copyParts.map(v => /^\d+$/.test(v) ? +v : badCommand());
			if (length === 0) throw new Error("Invalid length 0 in command at " + (openIndex + 1));
			if (distance === 0) throw new Error("Invalid distance 0 in command at " + (openIndex + 1));
			return {length, distance};
		});
		if (!copies[copies.length - 1]) copies.pop();
		const skip = parts[1] ? (/^\d+$/.test(parts[1]) ? +parts[1] : badCommand()) : 0;
		commands.push(getCommand(copies, skip));
	}
	return commands;
	
	function getCommand(copies, skip) {
		let obj = commandsByParams[skip] || (commandsByParams[skip] = {});
		for (const {length, distance} of copies) {
			obj = obj[length] || (obj[length] = {});
			obj = obj[distance] || (obj[distance] = {});
		}
		if (obj[""] === undefined) obj[""] = {id: nextCommandId++, copies, skip};
		return obj[""];
	}
	
	function badCommand() {
		throw new Error("Invalid syntax in command at " + (openIndex + 1));
	}
}

