*(note: this file is mainly meant as a mirror of the [wiki article](https://esolangs.org/wiki/Alkmini), which may be more up-to-date)*

Alkmini is a successor to [Kmid](https://esolangs.org/wiki/Kmid) created by [User:Arctenik](https://esolangs.org/wiki/User:Arctenik). Like Kmid, the language is a symbol-replacement system designed to be compiled to [Kwert](https://esolangs.org/wiki/Kwert), but it makes certain tasks more convenient, and avoids Kmid's endlessly-growing data, by allowing productions to output arbitrary numbers of symbols.

## Syntax

Alkmini's syntax is broadly similar to Kmid's, with notable differences being:

- `$` is a syntactic character.
- Only a table-based syntax exists (no index-based variant).
- The syntax is made to allow arbitrary output symbol quantities.
- No match offsets are specified, as only the preceding symbol can be referenced.

Whitespace, semicolon, comma, and comments are ignored entirely in parsing. A comment begins with `#` and continues until the end of the line.

All symbol names must have the same length, and may include any characters other than ```[]`:;,#$``` and whitespace.

A symbol definition begins with the symbol's name, followed by either:

- Two colons followed by square brackets enclosing a list of zero or more symbol names, representing a constant transition.
- A lookup table enclosed in square brackets. A table consists of a list of productions, each consisting of, in order, a symbol name to match, a colon or dollar sign, and a list of zero or more output symbol names. If a dollar sign is used rather than a colon, the production represents a halting transition.

The data string comes after the symbol definitions, and consists of a sequence of symbol names.

Every symbol used in the program must have a definition.

### Evaluation

At each evaluation step, every symbol in the data string is replaced with another sequence of symbols, after which, if a halting transition occurred for any symbol, the program halts.

A transition is determined differently depending on the original symbol's transition type:

- For an original symbol with a constant transition, the replacement symbol sequence is always the one listed on the right-hand side of the original symbol's definition. A transition defined as constant is never halting.
- For an original symbol with a tabled transition, the symbol directly to the left of the original symbol is matched against the original symbol's lookup table, and the corresponding sequence of replacement symbols from the table is used to replace the original symbol. The transition is halting if the matched production is defined as such. If there is no symbol to the left of the original symbol, or the symbol to the left has no matching entry in the table, the program is considered to be in error.

Within a step, all symbol replacements happen simultaneously.

## Example programs

### Collatz function

```
# calculates collatz total stopping time by cycling through a unary number,
# switching between a floored-divide-by-two operation and a multiply-by-three-
# and-add-two operation
# (this is not the standard way of expressing the function, but it allows
# division to be done *while* determining parity)

# symbols representing the current operation
# (division and multiplication phases, and details within each phase)
d'0 :: []
d'1 :: []
dd0 :: []
dd1 :: []
mmm :: []
mm2 :: []
mm1 :: []
mm+ :: []
mm. :: []

# "stationary" data representing the current number
# the number is represented in unary via the digit 1, with 0 terminating it
1__ [
  d'0 : d'1
  d'1 : dd0 __1
  dd0 : dd1
  dd1 : dd0 __1
  mmm : mm2 __1
  __1 : 1_1
  __0 : 1_0
  1_1 : 1_1
  1_0 : 1_0
  0_1 : 1_1
  1__ : 1__
  0__ : 1__
]
0__ [
  d'1 $ d'1 0__
  dd0 : d'0 __0
  dd1 : mmm __0
  mmm : mm+ 0_1
  __1 : 0_1
  1_1 : 0_1
  1__ : 0__
]

# right-moving data, used to send a digit from the left edge across the stationary data
__0 [
  d'0 : d'0
  mmm : mmm
]
__1 [
  dd0 : dd0
  mm2 : mm1 __1
  mm1 : mmm __1
  mmm : mmm
  __1 : __1
]

# symbols representing a digit moving right past a stationary digit
1_1 [
  dd0 : dd0 1__
  mmm : mmm 1__
  __1 : 1_1
  __0 : 1_0
  1__ : 1__
  0__ : 1__
  1_1 : 1_1
  1_0 : 1_0
  0_1 : 1_1
]
1_0 [
  d'0 : d'0 1__
  mmm : mmm 1__
  1__ : 1__
]
0_1 [
  dd0 : dd0 0__
  mmm : mmm 0__
  mm+ : mm. 0_1
  mm. : d'0 __0
  __1 : 0_1
  1__ : 0__
  1_1 : 0_1
]

# symbols that handle creating the output symbols
%%% [
  0__ : %%%
  1__ : %%%
  0_1 : 1__ %%+
  1_1 : 1__ %%%
  1_0 : 0__ %%%
]
%%+ [
  1__ : %%% RRR
]

# output symbol
RRR :: [RRR]


# input = amount of 1__ = 7; output will be amount of RRR

d'0 1__ 1__ 1__ 1__ 1__ 1__ 1__ 0__ %%%
```

## Computational class

An Alkmini program with only single-symbol transition outputs is very similar to a Kmid program with no match offsets greater than 1, the only differences being in halting conditions and in Kmid's automatically-appended default symbol. Kmid's behavior in these areas can be simulated in Alkmini by:

- Defining a symbol to use in place of Kmid's halt symbol, and defining any production that outputs it as halting. (A halting constant transition can be simulated by defining a table containing a halting production for every possible match symbol.)
- Defining a special symbol, to be placed at the end of the program, with a constant transition causing it to be replaced with the default symbol followed by a new instance of itself.

Given this translation and the fact that offset-1 Kmid is Turing-complete (via its correspondence to Couplet [2C](https://esolangs.org/wiki/2C) or [ability](https://esolangs.org/wiki/Kwert#Application_to_DEFLATE) to implement [Bitwise Cyclic Tag](https://esolangs.org/wiki/Bitwise_Cyclic_Tag)), Alkmini is also Turing-complete.

Alkmini's computational class may also be observed via its own implementation of Bitwise Cyclic Tag, an example of which is linked below in the [external links](#external-links).

## Relationship to Kwert

Alkmini is designed to be compiled to Kwert using a strategy somewhat similar to the one used for Kmid, with each symbol having an associated "library" of commands that the following simulated symbol can copy from for conditional behavior, and with a "catalog" next to every simulated symbol providing commands to be copied for unconditional behavior. However, in order to support transitions that remove symbols, the catalog is not skipped, and instead, its commands are allowed to be evaluated with no-ops preceding them, similar to the library. Because the catalog gets evaluated, it cannot contain a halt command, so halting is done by having a halt command at the end of the program, with commands preceding it that skip it and get refreshed at some point in each simulated Alkmini step; one of these commands can then be replaced with a no-op propagated through the program in order to induce a halt.

An example design for a system such as this, used by the compiler linked below, can be found at [compiler/readme.md](./compiler/readme.md).

## External links

- [Online interpreter](https://arctenik.github.io/esolangs/alkmini/)
- [Alkmini-to-Kwert compiler](https://arctenik.github.io/esolangs/alkmini/compiler/)
- [GitHub folder with additional programs](https://github.com/Arctenik/esolangs/tree/main/alkmini/programs)
	- [Bitwise Cyclic Tag program](https://github.com/Arctenik/esolangs/blob/main/alkmini/programs/bct.alkmini), featuring a not-exactly-bitwise extension to provide an additional instruction that can be used to implement halting
