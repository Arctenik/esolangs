Brook = (function() {
	
	const ioCommandNames = Array.from("iocIOC");
	const contCommandNames = Array.from("cC");
	const commandFuncs = {
		"v"(b) {
			b.popCurrent();
		},
		"U"(b) {
			const val = b.popCurrent();
			b.pushCurrent(val);
			b.pushCurrent(val);
		},
		"@"(b) {
			b.pushCurrent(b.popCurrent());
		},
		"+"(b) {
			b.pushCurrent(b.popCurrent() + b.popCurrent());
		},
		"-"(b) {
			b.pushCurrent(Math.abs(b.popCurrent() - b.popCurrent()));
		},
		"i"(b) {
			b.pushCurrent(b.getCharInput());
		},
		"o"(b) {
			b.addOutput(String.fromCodePoint(b.popCurrent()));
		},
		"c"(b) {
			b.outputContinuity(String.fromCodePoint(b.popCurrent()));
		},
		"I"(b) {
			b.pushCurrent(b.getNumInput());
		},
		"O"(b) {
			b.addOutput(b.popCurrent());
		},
		"C"(b) {
			b.outputContinuity(b.popCurrent());
		},
	};
	
	function Brook(program, input = "", opts = {}) {
		Object.assign(this, {
			stepsPerTimeCheck: 1000,
			discardCode: true,
			discardContinuities: true,
			getCharInput() {
				const n = this.input.codePointAt(0) || 0;
				this.input = this.input.substring(1);
				return n;
			},
			getNumInput() {
				const str = /^\d*/.exec(this.input)[0];
				this.input = this.input.substring(str.length);
				return +str;
			},
			addOutput(val) {
				console.log(val);
			}
		}, opts);
		this.input = input;
		this.continuityCount = 0;
		this.currentContinuity = this.newContinuity(null, program, true);
		while (this.parseNext());
		this.setProgramComplete();
		this.finished = false;
	}

	Brook.prototype = {
		run(maxTime) {
			return this.multiStep(Infinity, maxTime);
		},
		multiStep(steps, maxTime) {
			const maxTimestamp = Date.now() + maxTime;
			let timeCheckCounter = this.stepsPerTimeCheck;
			while (steps-- > 0 && !this.finished) {
				if (--timeCheckCounter === 0) {
					if (Date.now() > maxTimestamp) return true;
					timeCheckCounter = this.stepsPerTimeCheck;
				}
				this.step();
			}
		},
		runContinuity(maxTime) {
			const maxTimestamp = Date.now() + maxTime;
			let timeCheckCounter = this.stepsPerTimeCheck;
			while (!this.finished) {
				if (--timeCheckCounter === 0) {
					if (Date.now() > maxTimestamp) return true;
					timeCheckCounter = this.stepsPerTimeCheck;
				}
				if (this.step()) break;
			}
		},
		step() {
			const cont = this.currentContinuity;
			const command = cont.parsed[cont.index - cont.indicesOffset];
			let switchedCont = false;
			let failed = false;
			if (!command) {
				failed = true;
			} else if (typeof command === "string") {
				commandFuncs[command](this);
				cont.index++;
				if (ioCommandNames.includes(command)) {
					this.checkFinalIo();
					if (this.currentContinuity === cont) {
						if (contCommandNames.includes(command) && this.canRun(cont.child)) {
							this.currentContinuity = cont.child;
							switchedCont = true;
						}
					} else if (this.currentContinuity) {
						switchedCont = true;
					} else {
						this.finished = true;
					}
				}
			} else if (command.type === "push") {
				this.pushCurrent(command.number);
				cont.index++;
			} else if (command.type === "open") {
				if (command.number === 0) {
					if (command.end === null) {
						if (cont.programComplete) {
							cont.index++;
						} else {
							failed = true;
						}
					} else {
						cont.index = command.end + 1;
					}
				} else {
					if (command.iterCount === 0) command.iterCount = command.number;
					command.iterCount--;
					cont.index++;
				}
			} else if (command.type === "close") {
				const open = cont.parsed[command.start - cont.indicesOffset];
				if (open?.iterCount > 0) {
					cont.index = open.index + 1;
					open.iterCount--;
				} else {
					cont.index++;
				}
			}
			if (failed) {
				if (cont.parent) {
					this.currentContinuity = cont.parent;
					switchedCont = true;
				} else {
					this.finished = true;
				}
			}
			if (switchedCont && !cont.discarded && this.discardCode) {
				this.discardCommands(cont);
			}
			return switchedCont;
		},
		outputContinuity(val) {
			if (!this.currentContinuity.child) this.currentContinuity.child = this.newContinuity();
			this.currentContinuity.child.program += val;
			this.parseNext(this.currentContinuity.child);
		},
		newContinuity(parent = this.currentContinuity, program = "") {
			this.continuityCount++;
			return {
				discarded: false,
				parent,
				child: null,
				contIndex: parent ? parent.contIndex + 1 : 0,
				parsed: [],
				index: 0,
				indicesOffset: 0,
				parenStack: [],
				program,
				programComplete: false,
				lastIoCommand: null,
				lastContCommand: null,
				queue: []
			};
		},
		parseNext(cont = this.currentContinuity) {
			const match = /^(?:(\d*\()|(\))|(\d*\^)|\d+$|([vU@+\-iocIOC])|(.))/.exec(cont.program);
			let moved = false;
			
			if (match) {
				moved = true;
				if (match[1]) {
					const number = +match[0].substring(0, match[0].length - 1);
					const p = {type: "open", index: cont.parsed.length + cont.indicesOffset, number, end: null, iterCount: number};
					cont.parsed.push(p);
					cont.parenStack.push(p);
				} else if (match[2]) {
					if (cont.parenStack.length) {
						const p = cont.parenStack.pop();
						p.end = cont.parsed.length + cont.indicesOffset;
						cont.parsed.push({type: "close", start: p.index});
					}
				} else if (match[3]) {
					cont.parsed.push({type: "push", number: +match[0].substring(0, match[0].length - 1)});
				} else if (match[4]) {
					if (ioCommandNames.includes(match[0])) {
						let zeroParen = null;
						for (let i = cont.parenStack.length - 1; i >= 0; i--) {
							if (cont.parenStack[i].number === 0) {
								zeroParen = cont.parenStack[i];
								break;
							}
						}
					}
					cont.parsed.push(match[0]);
				} else if (!match[5]) {
					moved = false;
				}
				if (moved) {
					cont.program = cont.program.substring(match[0].length);
				}
			}
			
			return moved;
		},
		setProgramComplete(cont = this.currentContinuity) {
			const loops = [];
			
			for (let i = cont.parsed.length - 1; i >= 0; ) {
				if (i + cont.indicesOffset < cont.index && loops.length === 0) {
					break;
				}
				
				const command = cont.parsed[i];
				
				if (command.type === "close") {
					const open = cont.parsed[command.start - cont.indicesOffset];
					if (open?.number === 0) {
						i = open.index - cont.indicesOffset - 1;
					} else {
						if (open?.iterCount > 0) {
							loops.push(open);
						}
						i--;
					}
				} else if (command.type === "open") {
					if (command.end !== null && command.iterCount > 0) { // should be in `loops` in this case
						loops.pop();
					}
					i--;
				} else if (typeof command === "string" && ioCommandNames.includes(command)) {
					if (cont.lastIoCommand === null) {
						cont.lastIoCommand = [i + cont.indicesOffset, loops.slice()];
					}
					if (contCommandNames.includes(command)) {
						cont.lastContCommand = [i + cont.indicesOffset, loops.slice()];
						break;
					}
					i--;
				} else {
					i--;
				}
			}
			
			cont.programComplete = true;
		},
		checkFinalIo(cont = this.currentContinuity) {
			if (cont.programComplete) {
				while (cont) {
					let nextCont;
					if (cont.lastIoCommand === null || this.isPastCommand(cont, ...cont.lastIoCommand)) {
						if (this.discardContinuities) this.discard(cont);
					}
					if (cont.lastContCommand === null || this.isPastCommand(cont, ...cont.lastContCommand)) {
						if (cont.child) this.setProgramComplete(cont.child);
						cont = cont.child;
					}
					cont = nextCont;
				}
			}
		},
		isPastCommand(cont, index, loops) {
			return cont.index > index && loops.every(open => open.iterCount === 0);
		},
		discard(cont) {
			if (cont.parent) cont.parent.child = cont.child;
			if (cont.child) cont.child.parent = cont.parent;
			if (cont === this.currentContinuity) {
				if (cont.child) this.currentContinuity = cont.child;
				else if (cont.parent) this.currentContinuity = cont.parent;
				else this.finished = true;
			}
			cont.discarded = true;
		},
		canRun(cont) {
			if (cont) {
				const i = cont.index - cont.indicesOffset
				if (i < cont.parsed.length) {
					const command = cont.parsed[i];
					return !(command.type === "open" && command.number === 0 && command.end === null);
				}
			}
			return false;
		},
		discardCommands(cont) {
			let i = 0;
			while (i < cont.parsed.length && i < cont.index - cont.indicesOffset) {
				let command = cont.parsed[i];
				if (command.type === "open") {
					if (command.number === 0) {
						if (command.end === null) {
							break;
						} else {
							i = command.end + 1;
						}
					} else {
						if (command.iterCount === 0) {
							i++;
						} else {
							break;
						}
					}
				} else {
					i++;
				}
			}
			if (i) {
				cont.parsed = cont.parsed.slice(i);
				cont.indicesOffset += i;
			}
		},
		popCurrent() {
			return this.currentContinuity.queue.shift() || 0;
		},
		pushCurrent(val) {
			this.currentContinuity.queue.push(val);
		}
	};
	
	return Brook;
	
})();