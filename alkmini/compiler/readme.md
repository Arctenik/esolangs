*(note: this file is mainly meant as a mirror of the information on the [wiki talk page](https://esolangs.org/wiki/Talk:Alkmini#Compilation_strategy), which may be more up-to-date)*

Here are the notes I made while determining how to compile Alkmini to Kwert. Each Alkmini step is evaluated over five Kwert cycles, which I refer to as "phases". I define a list of variables used to track the numbers involved; a list of commands that appear at the beginning of the program in every phase; and, for each phase, three lists of commands describing parts of the program: the start, the cell, and the end. The start appears once after the shared beginning; the cell is repeated some number of times following the start, representing the symbols of the Alkmini program; and the end appears once following the cells. Commands that will be evaluated in the current phase are bolded.


variables:
- nS: number of symbols in the program
- nL: library size
- nT: maximum number of symbols produced by any transition
- nC: catalog size, determined by constructing the list of commands described below and inserting enough padding to make the size a near-square
- rC: a near-square-root factor of nC
- nD: intermediate catalog size, determined by constructing the list of commands described below and inserting enough padding to make the size a near-square
- rD: a near-square-root factor of nD
- Cb: size of a phase 2 cell = 2 + nL + 2 + nT + 2 + rP + nC
- Cd: size of a phase 4 cell = 1 + rD + nT
- Ce: core size of a phase 5 cell = 3 + rC
- nB: size of skipped commands at the beginning = 5 + 4 + nC + 2 + rP + nD + nT * Ce - 2 + 1
- nP: size of padding that goes in front of the catalog and intermediate catalog, based on a minimum value rounded up to a near-square
	- strictly speaking, the minimum would be based on the distances used by non-skipped phase 2 and 5 commands and the amount of commands they copy (in catalog-halt-library order for the former)
	- i believe though that the maximum of nD, Cb, and Cd would be a safe value (this does mean that Cb and nP have a cyclic dependency)
- rP: a near-square-root factor of nP
- i: 0-based index in a sequence of commands


shared beginning:
- *start skipper*: automatically skipped
- **start skipper**:
	- copy *start skipper* at dist 1
	- skip nB commands
- *phase 1 handler*: skipped
- *phase 2 handler*: skipped
- *phase 3 handler*: skipped
- *phase 4 handler*: skipped
- *phase 5 handler*: skipped
- *beginning padding pre-generator*: skipped
- *beginning catalog generator*: skipped
- *intermediate padding pre-generator*: skipped
- *intermediate catalog generator*: skipped
- nC skipped commands constituting the catalog:
	- nS *intermediate symbol commands*
	- *empty intermediate symbol*
	- some amount of padding no-ops
	- *2-skipper* followed by 2 skipped no-ops
	- *3-skipper* followed by 3 skipped no-ops
	- *transition pre-skipper* followed by 1 + nT skipped no-ops, if it's distinct from the *2-skipper* and *3-skipper*
	- *transition skipper* followed by nT skipped no-ops
- *no-op preserver*: skipped
- no-op: skipped
- rP *padding generators*: skipped
- nD skipped commands constituting the intermediate catalog:
	- *symbol commands*, *padding pre-generators*, *catalog generators*, and no-ops, laid out such that:
		- there are (potentially) multiple copies of each spaced at multiples of Ce as necessary for them to be copied by *intermediate symbol commands* at different offsets
		- every *padding pre-generator* has a *catalog generator* before it, to ensure that there's a minimal distinct sequence that can be used to identify a phase-1 symbol in the compiled program
		- padding no-ops are inserted as necessary
	- *symbol skipper*
	- Ce - 1 no-ops
- nT * Ce - 2 no-ops: skipped
- *halt skipper*: skipped


phase 1

start:
- **phase 1 handler**:
	- copy *phase 2 handler* at dist nB - 1
	- copy no-op at dist 3
	- copy nL + 2 + nT - 1 no-ops at dist 1
- **beginning padding pre-generator**: copy *no-op preserver*, no-op, and rP *padding generators* at dist nL + 2  + nT - 1 + 2 + nB - 5 - 4 - nC
- rC **beginning catalog generators**: copy nC/rC commands at dist rP + 2 + nL + 2 + nT - 1 + 2 + nB - 5 - 4
- some amount of **no-ops**

cell:
- potentially, some amount of **no-ops**
- **symbol command**:
	- copy halt signal, either at dist Cb or at dist from Cb - 2 to Cb - 1 - nL
	- copy no-op at dist 2
	- copy nL commands, each at dist from i + 1 to i + 2 + nC, composed of some mix of:
		- an *intermediate symbol command*
		- *empty intermediate symbol*
		- *halt skipper* followed by no-op
		- no-op
	- copy *transition pre-skipper* at dist nL + 2 + nT + 1 + 1 + nT + 1 (maybe + 2 in some cases if it turns out to be possible for nT to be 1 and thus for the *transition pre-skipper* to be the same as the *2-skipper*?)
	- copy *transition skipper* at dist 1 + nL + 2 + nT + 1
	- copy nT commands, each at dist from 2 + nL + 2 + Cb - 1 - nL to 2 + nL + 2 + Cb - 2, and each being either:
		- an *intermediate symbol command*
		- *empty intermediate symbol*
- **padding pre-generator**: copy *no-op preserver*, no-op, and rP *padding generators* at dist Cb
- rC **catalog generators**: copy nC/rC commands at dist Cb

end:
- potentially, some amount of no-ops (from a former preceding cell)
- either:
	- **halt skipper**:
		- copy *3-skipper* at dist nT + 1 + (1 + nT + 1 if *transition pre-skipper* is distinct from *3-skipper* and *2-skipper*) + 4
		- copy *2-skipper* at dist 1 + nT + 1 + (1 + nT + 1 if *transition pre-skipper* is distinct from *3-skipper* and *2-skipper*) + 4 + 3
		- copy two more skipper pairs at dist 2
		- copy *halt skipper* or no-op at dist 6 + Cb
		- skip 1 command
	- **no-op**
- **halt**: skipped or not depending on preceding command


phase 2

start:
- **phase 2 handler**: copy *phase 3 handler* at dist nB - 2
- nL + 2 + nT **no-ops**
- **no-op preserver**: skip 1 command
- no-op: skipped
- rP **padding generators**
- nC commands constituting a **catalog**

cell:
- **halt skipper** or **no-op**
- **no-op**: skipped or not depending on preceding command
- nL commands, composed of some mix of:
	- an **intermediate symbol command**
	- **empty intermediate symbol**
	- **halt skipper** followed by a (skipped) no-op
	- **no-op**
- **transition pre-skipper**: skip 1 + nT commands
- *transition skipper*: skipped
- nT skipped commands, each either:
	- an *intermediate symbol command*
	- *empty intermediate symbol*
- **no-op preserver**
- no-op: skipped
- rP **padding generators**: copy nP/rP no-ops at dist 1
- nC commands constituting a **catalog**

end:
- **3-skipper**: skip 3 commands
- *2-skipper*: skipped
- *3-skipper*: skipped
- *2-skipper*: skipped
- **3-skipper**: skip 3 commands
- *2-skipper*: skipped
- *halt skipper* or no-op: skipped
- halt: skipped


phase 3

start:
- **phase 3 handler**:
	- copy *phase 4 handler* at dist nB - 3
	- copy *intermediate padding pre-generator* at dist 1 + nB - 5 - 2
	- copy *intermediate catalog generator* at dist 2 + nB - 5 - 3
	- copy rD - 1 *intermediate catalog generators* at dist 1
	- copy *empty intermediate symbol* from catalog at dist rD + 2 + nB - 5 - 4 - nS
	- copy nT - 1 *empty intermediate symbols* at dist 1
- some amount of **no-ops**

cell:
- some amount of **no-ops**
- **transition skipper**:
	- copy *intermediate padding pre-generator* at dist Cd
	- copy rD *intermediate catalog generators*
		- could copy the generators all at once at dist Cd, or copy one at dist Cd + 1 - rD and the rest at dist 1
	- skip nT commands
- nT skipped commands (same as before)
- some amount of **no-ops**

end:
	- **2-skipper**: skip 2 commands
	- *3-skipper*: skipped
	- *2-skipper*: skipped
	- **2-skipper**: skip 2 commands
	- *halt skipper* or no-op: skipped
	- halt: skipped


phase 4

start:
- **phase 4 handler**: copy *phase 5 handler* at dist nB - 4
- **intermediate padding pre-generator**
- rD **intermediate catalog generators**
- nT **empty intermediate symbols**

cell:
- **intermediate padding pre-generator**: copy *no-op preserver*, no-op, and rP *padding generators* at dist nT * Ce + nD + rP + 2
- rD **intermediate catalog generators**: copy nD/rD commands at dist nT * Ce + nD + rP + 2
- nT commands, each either:
	- an **intermediate symbol command**:
		- copy *symbol skipper* at dist Ce
		- copy corresponding *symbol command* at dist from 1 + Ce + 1 to 1 + nD
		- copy *padding pre-generator* at dist from 2 + Ce + 1 to 2 + nD - 1
		- copy *catalog generator* at dist from 3 + Ce + 1 to 3 + nD
		- copy rC - 1 *catalog generators* at dist 1
	- **empty intermediate symbol**:
		- copy *symbol skipper* at dist Ce
		- copy no-op at dist from 2 to 1 + nD
		- copy 1 + rC no-ops at dist 1

end:
	- **3-skipper**: skip 3 commands
	- *2-skipper*: skipped
	- *halt skipper* or no-op: skipped
	- halt: skipped


phase 5

start:
- **phase 5 handler**:
	- copy *phase 1 handler* at dist nB
	- copy *beginning padding pre-generator* at dist 1 + nB - 5
	- copy *beginning catalog generator* at dist 2 + nB - 5 - 1
	- copy rC - 1 *beginning catalog generators* at dist 1
- **no-op preserver**: skip 1 command
- no-op: skipped
- rP **padding generators**
- nD commands constituting an **intermediate catalog**
- nT instances of:
	- **symbol skipper**
	- 2 + rC no-ops: skipped

cell:
- on every *nT*th cell, starting with the first:
	- **no-op preserver**: skip 1 command
	- no-op: skipped
	- rP **padding generators**: copy nP/rP no-ops at dist 1
	- nD commands constituting an **intermediate catalog**
- **symbol skipper**: skip 2 + rC commands
- either:
	- non-empty cell:
		- a *symbol command*: skipped
		- *padding pre-generator*: skipped
		- rC *catalog generators*: skipped
	- 2 + rC no-ops: skipped

end:
- **2-skipper**: skip 2 commands
- *halt skipper* or no-op: skipped
- halt: skipped
