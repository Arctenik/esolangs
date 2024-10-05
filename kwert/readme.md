# Kwert

*(note: this file is mainly meant as a mirror of the [wiki article](https://esolangs.org/wiki/Kwert), which may be more up-to-date)*

Kwert is a language designed by [User:Arctenik](https://esolangs.org/wiki/User:Arctenik) to correspond closely to certain aspects of the DEFLATE compression format. It involves a self-modifying program that is repeatedly evaluated, with commands that create copies of previous commands and/or cause following commands to be skipped.

## Syntax

A Kwert program is a sequence of *commands,* each enclosed in square brackets. A normal command consists of zero or more comma-separated copy operations, the final of which may be followed by an optional trailing comma, all followed by an optional skip count. The halt command consists of a dollar sign, e.g.: `[$]`.

A copy operation is written as a *length* followed by a *distance,* separated by whitespace. A skip count consists of a semicolon followed by a number, which may be omitted, in which case the skip count is taken to be zero. Lengths and distances must be positive integers, while skip counts are non-negative integers.

For example, here is a command: `[1 2,2 3,1 1;2]`

It has three copy operations, `1 2`, `2 3`, and `1 1`. It has a skip count of 2.

Inside commands, any whitespace may be used between syntax elements. Outside commands and ID sections (see below), all characters are ignored and may be used as comments, other than square brackets and backtick.

### Command IDs

Commands may be given IDs (in a one-to-one mapping), which allows programs to be represented more succinctly. IDs are written in *ID sections,* which begin with a backtick and may be terminated by either a line ending, another backtick on the same line, the presence of a command expression, or the end of the program.

An ID section's content consists of a list of IDs, which may or may not be separated by whitespace. All IDs in the program must be of the same length, and may use any characters other than `[]`` and whitespace.

An ID definition, which assigns an ID to a command, is created with an ID section containing a single, unassigned ID, followed by a command expression:

```
` x [1 1;2]
```

(This assigns the ID `x` to the command `[1 1;2]`, and does *not* represent an actual instance of the command in the program.)

An ID section containing only IDs that have been previously defined represents a section of the actual program; e.g., given the above ID definition, this line:

```
`xx
```

Is equivalent to this one:

```
[1 1;2][1 1;2]
```

Any other ID section (i.e., one containing multiple IDs including at least one unassigned ID, or one containing a single, unassigned ID that's followed by another ID section or the end of the program) is an error.

## Evaluation

The program is self-modifying, and is repeatedly evaluated from start to finish, stopping only if a halt command is evaluated. A single start-to-finish pass through the program is termed a *cycle.* When the program halts, the state that the program was in at the beginning of the cycle is considered to be the final state.

Any command other than halt is evaluated as follows:

- Each copy operation is evaluated, in sequence; this means copying <length> commands one-by-one, starting from the command <distance> spaces before the current command, and inserting each one directly before the current command. A distance that extends past the beginning of the program is an error.
- The next \<skip count> commands are skipped. A skip count that extends beyond the end of the program is an error.
- At some point in the process, the command being evaluated gets deleted. (It doesn't actually matter when this happens, since the command can't interact with itself.)

For instance, the example command `[1 2,2 3,1 1;2]` will copy 1 command from 2 before the current command, 2 commands starting from 3 before the current command, and 1 command from directly before the current command. (Note that the command copied by the first copy operation is actually the same as the first command copied by the length-2 copy; the distance in the second copy operation is different because of the additional command that has been inserted.)

Once a cycle is completed (that is, once the end of the program is reached), evaluation loops back around to the beginning of the program.

The first command of the program is always automatically skipped, making it easier to have an unchanging part of the program that can provide commands for following commands to copy.

## Relationship to DEFLATE

### Background: DEFLATE and DEFLATE quines

DEFLATE is a common compression format, with a decompression process that involves, in part, copying from sections of previously-output data. A DEFLATE stream is composed of blocks, which can be compressed blocks (where the copying is done) or uncompressed blocks (which contain a specified amount of literal data).

It's possible to create a DEFLATE stream that decompresses to itself (essentially a [quine](https://esolangs.org/wiki/Quine)). It's also possible to create a quine that has additional, changing data appended to it.

### Kwert and DEFLATE

Kwert is designed to correspond closely to certain possible behaviors of an extended DEFLATE quine. If Kwert commands are converted to sections of DEFLATE data that all have the same length, then Kwert's copy operations can be straightforwardly converted to DEFLATE's. Having commands skip some number of following commands can be done by having each converted command end with the header of an uncompressed block, causing some amount of following data to be treated as literal data that just stays in place, rather than as compressed blocks that can perform copies. The halt command can be simulated using any command-sized span of data that causes the DEFLATE data to be invalid, e.g. a block with type bits `11`. A converted program can be "run" by repeated inflating the data, corresponding to cycles of the Kwert program. If the data becomes invalid, the program has halted.

### Limitations

The relatively straightforward method outlined above of compiling Kwert to DEFLATE is limited by the bounded values present in the latter. If a distance or skip count is too long (taking into account the length of a compiled command), this method will fail. (DEFLATE's length values are also bounded, but larger ones can be simulated using multiple copy operations.)

Additionally, it's not entirely straightforward to make all compiled commands have the same length, so whether a program can be compiled might, in theory, be difficult to predict, and may depend on the specific set of commands used in the program. Because of this, if a method of constructing a Kwert program is to be described in a way that guarantees that the resulting program can be compiled to DEFLATE, it's necessary to show that the specific set of commands the program draws from can be compiled. (Technically it also works to show that a *superset* of the commands used in the program can be compiled when all used together, since any of those commands that are not already used in the program can be inserted at the beginning of the program and made to be always skipped.)

## Example programs

### Fibonacci words

```
[1 1;2][1 1;2][1 2,2 3,1 1;2][1 2;2]
[1 2;2][1 2,2 3,1 1;2][1 2;2]
```

This program simulates a symbol-replacement system where, repeatedly, all instances of A are replaced with AB and all instances of B are replaced with A -- a process which generates [Fibonacci words](https://en.wikipedia.org/wiki/Fibonacci_word).

The final three commands of the program are the initial symbol, which here is the B symbol. The first command of a symbol determines whether the symbol behaves as A or B. The other two commands are always skipped, and are always equal to the A and B commands, in that order -- they exist to be copied by other commands

The B command just replaces itself with the A command, by copying it from the previous symbol's skipped commands. The A command constructs an entirely new A symbol by copying commands from the previous symbol's skipped commands, and then replaces itself with the B command by copying it from the symbol that was just constructed.

The first four commands in the program stay the same after being evaluated, and are there to act like a preceding symbol for the first simulated symbol in the program.

The Fibonacci number corresponding to a given program cycle can be calculated by taking the number of commands in the program, subtracting 4, and then dividing by 3; additionally, a similar calculation can be performed with the compiled version of the program (given here as base64-encoded raw DEFLATE data):

```
AAAA//8AAAD//wAAAP//ABQA6/8AAAD//wAAAP//AAAA//8AFADr/8ImBiAAjo0kSZIgCAIiWgEAEgDt/xbZewCtI38ALgDR/8ImBiAAjo0kSZIgCAIiWgEAEgDt/xbZewCtI38ALgDR/8ImBiAAjo0kSZIgCAIiWgEAEgDt/wKLgAUAWwAMAPP/XSMjIyMjIwKLgAUAAAwA8/9CZgMEEEAAABgA5/9CZgMEEEAAABgA5/9CFselBpkNABgA5/9CFgcIIIAAABgA5/9CFgcIIIAAABgA5/9CFselBpkNABgA5/9CFgcIIIAAABgA5/8AAAD//wAAAP//AAAA//8AFADr/wAAAP//AAAA//8AAAD//wAUAOv/wiYGIACOjSRJkiAIAiJaAQASAO3/Ftl7AK0jfwAuANH/wiYGIACOjSRJkiAIAiJaAQASAO3/Ftl7AK0jfwAuANH/wiYGIACOjSRJkiAIAiJaAQASAO3/AouABQBbAQAA//9dIyMjIyMjAouABQABAAD//w==
```

If the length in bytes is plugged into the formula (x - 358)/36, or the length in base64 characters is plugged into (x - 480)/48, then a Fibonacci number will be produced corresponding to the number of inflations that have been performed.

### Thue-Morse sequence

```
` x [1 1;2]
` 0 [1 2,2 3,1 1;2]
` 1 [1 1,2 3,1 2;2]
`xx01 001
```

This program works similarly to the Fibonacci program, but is written using command IDs, and simulates a system where 0 is replaced with 01, and 1 is replaced with 10. The generated sequence can be read by looking at every third command, starting from the fifth in the program.

### Halting

```
[1 1;4][1 1;4][1 3][1 2][1 1][$][1 4]
```

A very basic example of using the halt command: the command on the right end of the program replaces itself with another command from the preceding group of skipped commands; this process repeats until the replacement command is the halt command, and the program ends in the next cycle.

## Computational class

### Reduction from Kmid

Kwert is Turing-complete via reduction from [Kmid](https://github.com/Arctenik/esolangs/blob/main/kmid/readme.md), specifically the Kmidi variant, as follows:

Every three cycles of the Kwert program corresponds to one step of the Kmid program. These cycles will be termed, in order of occurrence, *primed mode,* *transition mode,* and *cleanup mode.*

The program consists primarily of a sequence of *cells,* which correspond to the symbols in the Kmid program's data string. Each cell consists of a *body* and a *catalog*. The catalog is a collection of skipped commands, which enables following commands to copy arbitrary commands as needed. (This is similar to how the example programs implementing symbol replacement systems work.) Every catalog is the same. The cell bodies differ based on the current mode and the represented Kmid symbol, but will be of the same length when in the same mode.

The commands used in the Kwert program are:

- A *primed command* for each symbol used in the Kmid program (note that this includes the halt symbol, if present)
- A *transition command* for each symbol
  - As a special case, the transition command that appears last in the catalog is used as the *pre-no-op* command
- A *cleanup command* for each symbol
- A *beginning carrier* command, used to skip a catalog at the beginning of the program
- A *primed carrier* command, used to skip a cell's catalog in primed mode
- A *transition carrier* command
- A *cleanup carrier* command
- A *primed generator* command, which replaces itself with the transition generator command
- A *transition generator* command, which replaces itself with a sequence of cleanup generator commands
- A *head cleanup generator* command, which replaces itself with the beginning of a new cell
- A *body cleanup generator* command, which replaces itself with a part of a new cell
- A *principal cleanup generator* command, which replaces itself with the primed generator command
- The no-op command (Kwert command `[]`)

The overall program structure is:

- Initial skipped beginning carrier
- Beginning carrier, which copies itself from the previous command and then skips over a catalog
- A sequence of commands constituting cells that represent the Kmid data string
- One or more of the "generator" commands, of type and quantity depending on the current mode

As a program cycle is evaluated, the cell bodies are sequentially transformed from the current cycle's mode to the next cycle's mode. The specific behavior involved here is particularly relevant for the transformation from primed mode to transition mode, because this is when the symbol replacements take place. A transition mode cell contains a *library* consisting of a sequence of transition commands that correspond to the symbol library of the symbol that had occupied the cell in primed mode. Thus, when a primed mode cell is evaluated, the preceding cells have been converted to transition mode cells with libraries that the primed command can copy from.

#### Primed mode

At the beginning of a primed mode cycle, each cell's body consists of the corresponding symbol's primed command, followed by a primed carrier. Evaluation of the program cycle proceeds as follows:

- The beginning carrier copies itself and skips the beginning catalog
- For each cell representing a symbol *S*:
  - If *S* is the halt symbol, the primed command is the halt command and the program halts
  - If *S* has a constant transition, the primed command copies the replacement symbol's transition command from the preceding catalog
  - Otherwise, it copies a transition command from a preceding transition-mode cell's library; the distance for this copy is determined by the match offset and lookup index of *S*
  - In either case, the primed symbol then copies a number of pre-no-ops from the preceding catalog (described in more detail below), and then copies (from the preceding catalog) the commands necessary to create the library for *S*
  - The primed carrier replaces itself with a transition carrier and skips the cell's catalog
- The primed generator replaces itself with a transition generator

#### Transition mode

At the beginning of a transition mode cycle, each cell's body consists of:

- The transition command of the symbol represented by the cell
- A number of pre-no-ops equal to the number of symbols used in the Kmid program minus one
- The transition commands constituting the library of the symbol that the cell represented in the preceding cycle
- A transition carrier

The pre-no-op commands serve to neutralize the transition commands in the following library by offsetting them such that they copy from a different section of the catalog, which is filled with no-ops. These no-ops appear directly after the cleanup commands in the catalog, and appear in a number equal to the number of symbols used in the Kmid program, plus the library size, minus one. Because transition commands copy cleanup commands from the catalog, this structure means that the pre-no-op commands in a cell, which are the same command as the last-listed transition command, will also copy no-ops from the catalog.

The process of appending a new cell begins at the end of transition mode with the creation of several cleanup generators. Splitting the process across multiple cycles like this allows the use of smaller copy lengths per command, which makes it more likely that the program can be compiled to DEFLATE, as a large length can create a significant feedback loop that drives up the size of a compiled command.

Evaluation of the program cycle proceeds as follows:

- The beginning carrier copies itself and skips the beginning catalog
- For each cell:
  - The transition command at the beginning of the cell copies from the preceding catalog the cleanup command for the same represented symbol
  - The pre-no-ops replace themselves with no-ops copied from the preceding catalog
  - The transition commands constituting the library replace themselves with no-ops copied from the preceding catalog
  - The transition carrier replaces itself with a cleanup carrier and skips the cell's catalog
- The transition generator replaces itself with a head cleanup generator, some number of body cleanup generators, and a principal cleanup generator; the number of body cleanup generators is coordinated with the copy operations of the head and body cleanup generator commands such that when combined they will copy a whole catalog

#### Cleanup mode

At the beginning of a cleanup mode cycle, each cell's body consists of, in order, the corresponding symbol's cleanup command, a number of no-ops corresponding to the pre-no-ops and library commands from the preceding cycle, and a cleanup carrier.

Evaluation of the program cycle proceeds as follows:

- The beginning carrier copies itself and skips the beginning catalog
- For each cell:
  - The cleanup command replaces itself with the corresponding primed command
  - The no-ops are evaluated and thus removed
  - The cleanup carrier replaces itself with a primed carrier and skips the cell's catalog
- The head cleanup generator replaces itself with the primed command of the default symbol, followed by some portion of the beginning of a catalog and its preceding primed carrier; specifically, the amount copied from the catalog is whatever is necessary to make the following body cleanup generators copy the rest of the catalog
- Each body cleanup generator copies some portion of the catalog; since these body cleanup generators are consecutive instances of the same command, the total effect will be that they copy a contiguous region of the program, which should complete the newly-appended catalog
- The principal cleanup generator replaces itself with a primed generator

As long as the head cleanup generator and body cleanup generators have the combined effect of copying a whole catalog, their specific copy operations and the quantity of body cleanup generators don't necessarily matter, but presumably the most efficient choice (to minimize the size of copy lengths) would be to have the number of commands copied by a body cleanup generator be close to the square root of the size of the catalog. (Going lower would generally be ineffective, since that would mean the number of body cleanup generators required would go up, and so in turn would the copy length used by the transition generator to create those body cleanup generators.)

#### Additional notes

Of note is the fact that the set of commands used in a compiled program is not dependent on the initial data string, and thus further compiling the program to DEFLATE will be possible or impossible regardless of the initial data string.

### Application to DEFLATE

Although Kwert can be shown to be Turing-complete via Kmid, this doesn't inherently transfer to DEFLATE, since some programs might not be possible to compile to DEFLATE, depending on the specific commands required to implement them. However, if a specific program can be written that implements a Turing-complete system using a fixed set of commands, it would only be necessary to determine that that particular program can be compiled to DEFLATE.

Below is such a program, implementing [Bitwise Cyclic Tag](https://esolangs.org/wiki/Bitwise_Cyclic_Tag) in Kmidt.

```
*** : 1 [
  *** ***
  ___ $$$
  __0 ***
  __1 ***
  _^0 __0
  _^1 __1
  0^0 __0
  0^1 __1
  1^0 __0
  1^1 __1
  0>0 __0
  0>1 __0
  1>0 __1
  1>1 __1
]
||| :: |||
AAA :: |||
BBB :: CCC
CCC :: AAA
_"0 : 1 [
  AAA 0"_
  CCC _"0
  _"0 _"0
  _"1 _"0
  0"_ 0"0
  1"_ 1"0
  0"0 0"0
  1"0 1"0
  0"1 0"0
  1"1 1"0
]
_"1 : 1 [
  AAA 1"_
  CCC _"1
  _"0 _"1
  _"1 _"1
  0"_ 0"1
  1"_ 1"1
  0"0 0"1
  1"0 1"1
  0"1 0"1
  1"1 1"1
]
0"_ :: BBB
1"_ :: BBB
0"0 : 1 [
  BBB _"0
  _"0 _"0
  _"1 _"0
  0"_ 0"0
  1"_ 1"0
  0"0 0"0
  0"1 0"0
  1"0 1"0
  1"1 1"0
]
1"0 : 1 [
  BBB _"0
  _"0 _"0
  _"1 _"0
  0"_ 0"0
  1"_ 1"0
  0"0 0"0
  0"1 0"0
  1"0 1"0
  1"1 1"0
]
0"1 : 1 [
  BBB _"1
  _"0 _"1
  _"1 _"1
  0"_ 0"1
  1"_ 1"1
  0"0 0"1
  0"1 0"1
  1"0 1"1
  1"1 1"1
]
1"1 : 1 [
  BBB _"1
  _"0 _"1
  _"1 _"1
  0"_ 0"1
  1"_ 1"1
  0"0 0"1
  0"1 0"1
  1"0 1"1
  1"1 1"1
]
0'' :: _"0
1'' :: _"1
0'_ :: ___
1'_ :: ___
___ : 1 [
  ___ ___
  _"0 ___
  _"1 ___
  0"0 0''
  0"1 0''
  1"0 1''
  1"1 1''
  0'' 0'_
  1'' 1'_
  0'_ 0'_
  1'_ 1'_
]
__0 : 1 [
  ___ __0
  __0 __0
  __1 __0
  0'_ ___
  1'_ _^0
  _^0 0^0
  _^1 1^0
  _^_ _^0
  0^0 0^0
  0^1 1^0
  1^0 0^0
  1^1 1^0
  _>_ __0
  <>_ __0
  0>_ 0>0
  1>_ 1>0
  0>0 0>0
  0>1 0>0
  1>0 1>0
  1>1 1>0
]
__1 : 1 [
  ___ __1
  __0 __1
  __1 __1
  0'_ ___
  1'_ _^1
  _^0 0^1
  _^1 1^1
  _^_ _^1
  0^0 0^1
  0^1 1^1
  1^0 0^1
  1^1 1^1
  _>_ __1
  <>_ __1
  0>_ 0>1
  1>_ 1>1
  0>0 0>1
  0>1 0>1
  1>0 1>1
  1>1 1>1
]
_^0 : 1 [
  ___ _^_
  _^_ <>_
]
_^1 : 1 [
  ___ _^_
  _^_ _>_
]
_^_ : 1 [
  ___ _^_
  0'_ 0'_
  1'_ 1'_
]
0^0 : 1 [
  _^_ _^0
  _^0 0^0
  _^1 1^0
  _>_ __0
  <>_ __0
  0^0 0^0
  0^1 1^0
  1^0 0^0
  1^1 1^0
  __0 __0
  __1 __0
]
0^1 : 1 [
  _^_ _^0
  _^0 0^0
  _^1 1^0
  _>_ __0
  <>_ __0
  0^0 0^0
  0^1 1^0
  1^0 0^0
  1^1 1^0
  __0 __0
  __1 __0
]
1^0 : 1 [
  _^_ _^1
  _^0 0^1
  _^1 1^1
  _>_ __1
  <>_ __1
  0^0 0^1
  0^1 1^1
  1^0 0^1
  1^1 1^1
  __0 __1
  __1 __1
]
1^1 : 1 [
  _^_ _^1
  _^0 0^1
  _^1 1^1
  _>_ __1
  <>_ __1
  0^0 0^1
  0^1 1^1
  1^0 0^1
  1^1 1^1
  __0 __1
  __1 __1
]
_>_ : 1 [
  0'_ 0>_
  1'_ 1>_
]
<>_ :: ___
0>_ :: ___
1>_ :: ___
0>0 :: __0
1>0 :: __0
0>1 :: __1
1>1 :: __1

AAA
_"1 _"0 _"1 _"1 _"1 _"1 _"0 _"1 _"1 _"1 _"0 _"0 _"1 _"1 _"1 _"0 _"1 _"1 _"0
___ ___ ___ ___
__1
```

The Kmid data string contains both the Bitwise Cyclic Tag program and the BCT data string. Here, those are the ["simple illustration"](https://esolangs.org/wiki/Bitwise_Cyclic_Tag#Example_(simple_illustration)) from the BCT article (which has the program `1011110111001110110`).

Some notes on how the implementation works:

- The BCT program is written using a sequence of `_"0` and `_"1` symbols
- The BCT initial data string is written using a sequence of `__0` and `__1` symbols
- Some of the symbol names have a `0` or `1` on both the left and right; this represents two bits of the program or data occupying the same symbol, either because the left one is moving past the right one, or because the bit string is being shifted to the right in a sort of "compression wave" pattern
- The BCT program is looped by having the program bits start moving to the right once the left edge of the program reaches them, and then split into two when they reach the right edge of the program, one copy remaining in place and one going on to interact with the data string
- Because the program is constantly moving forward, it's necessary for the data string to move forward at the same rate; for a delete command, this happens automatically (as one program bit corresponds to one data bit removed from the front), but for an append command (consisting of two bits), it's necessary to shift the data string rightward by two symbols
- This rightward shift takes place via symbols named in the pattern of `0^1`, which, for example, represents a 0 entering from the left to occupy the symbol while a 1 exits to occupy the symbol to the right
- The `AAA`, `BBB`, and `CCC` symbols appear to the left of the program, and, by cycling between the three, control the rate at which program bits are triggered to start moving right; this ensures that there's enough space between program bits for an interaction with the data to resolve before the next program bit appears
- The `_>_` and `<>_` symbols facilitate evaluation of append commands; one of the two is created by a 1 program bit depending on the first bit of the data, and the former allows the next program bit to be propagated to the end of the data string, while the latter causes the next program bit to be discarded
- The state of the stationary data bits can be decoded by taking the right bit of each `__0`, `__1`, `_^0`, `_^1`, `0>0`, `0>1`, `1>0`, and `1>1` symbol, and both bits from each `0^0`, `0^1`, `1^0`, and `1^1` symbol; the state of the in-transit data bits can be decoded by taking the left bit of each `0>_`, `1>_`, `0>0`, `0>1`, `1>0`, and `1>1` symbol; and the full data string can be constructed by concatenating the two, with the latter being reversed
- One caveat to this Turing-completeness construction that may be of note is that it does not make use of the halt symbol except in the case that the BCT data string becomes empty, and so a halt would need to be simulated in some other way if a meaningful output state is needed

Because the BCT program is specified entirely in the Kmid data string using a consistent set of symbols, this program can be used to compile any BCT program to DEFLATE, as long as the Kmid program can compile to DEFLATE at all. As it turns out, using the compilers linked below, the program does compile to DEFLATE without any apparent issues, and thus [User:Arctenik](https://esolangs.org/wiki/User:Arctenik) believes that iterated inflation of raw DEFLATE data is Turing-complete.

#### Additional notes

It should be pointed out that an important part of what allows iterated inflation to be Turing-complete in this manner is that there's no upper bound on the length of a DEFLATE stream; the amount of data used by the BCT program can grow arbitrarily large, fulfilling one of the requirements for Turing-completeness.

## External resources

- [Online interpreter](https://arctenik.github.io/esolangs/kwert/)
- [Kwert-to-DEFLATE compiler](https://arctenik.github.io/esolangs/kwert/kwert-deflate/)
- [Kmid-to-Kwert compiler](https://arctenik.github.io/esolangs/kmid/compiler/)
