# Kmid

*(note: this file is mainly meant as a mirror of the [wiki article](https://esolangs.org/wiki/Kmid), which may be more up-to-date)*

Kmid is a language created by [User:Arctenik](https://esolangs.org/wiki/User:Arctenik) as an abstraction of [Kwert](https://github.com/Arctenik/esolangs/blob/main/kwert/readme.md). It can be thought of as a kind of [string-rewriting system](https://esolangs.org/wiki/Category:String-rewriting_paradigm) or [cellular automaton](https://esolangs.org/wiki/Cellular_automaton). There are two variants of the language: Kmidt, the "table" variant, which is somewhat easier to write with; and Kmidi, the "index" variant, which can compile a bit more directly to Kwert.

## Kmidt

A Kmidt program consists of a list of symbol definitions and an initial data string of symbols. Evaluation primarily consists of repeatedly replacing all symbols in the data string with other symbols, which are determined by matching against specific preceding symbols in the string.

### Syntax

Whitespace, semicolon, comma, and comments are ignored entirely in parsing. A comment begins with `#` and continues until the end of the line.

All symbol names must have the same length, and may include any characters other than ```[]`:;,#``` and whitespace.

A symbol definition begins with the symbol's name, followed by a colon. Following that is either:

- A second colon followed by another symbol name, representing a constant transition.
- A positive integer describing a match offset, followed by a lookup table enclosed in square brackets. A table consists of a list of pairs of symbols, the first representing a matched symbol and the second representing a result symbol.

The first symbol defined in the program is the *default symbol.*

The data string comes after the symbol definitions, and consists of a sequence of symbol names.

Every symbol used in the program must have a definition, aside from the built-in halt symbol, which has a name consisting entirely of `$` and must not have a definition.

### Evaluation

At each evaluation step, every symbol in the data string is replaced with another symbol, and then an instance of the default symbol is appended to the data string.

A replacement symbol is determined differently depending on the original symbol's transition type:

- For an original symbol with a constant transition, the replacement symbol is always the one listed on the right-hand side of the original symbol's definition.
- For an original symbol with a tabled transition, a lookup symbol is determined by going left from the original symbol by a number of symbols equal to the original symbol's match offset. The lookup symbol is then matched against the original symbol's lookup table, and the corresponding replacement symbol from the table is used to replace the original symbol. If the match offset extends beyond the beginning of the data, or the lookup symbol has no matching entry in the table, the program is considered to be in error.

Within a step, all symbol replacements happen simultaneously.

At the beginning of a step, if the data string contains the halt symbol, the program halts.

## Kmidi

Kmidi is largely similar to Kmidt, but differs in the way in which replacement symbols are determined.

### Syntax

The one way in which Kmidi's syntax differs from Kmidt's is in how symbols are defined.

Like in Kmidt, a symbol definition begins with a name and a colon, which may be followed by another colon and name to represent a constant transition; however, instead of symbols with tabled transitions, there are symbols with indexed transitions.

Instead of a table, the match offset of an indexed-transition symbol definition is followed by a colon and then a nonnegative integer describing a lookup index.

Additionally, a symbol definition of either transition type must end with a symbol library consisting of a sequence of symbol names enclosed in square brackets. All symbol libraries in the program must have the same length.

### Evaluation

The replacement symbol for an indexed-transition symbol is determined by finding a lookup symbol based on the original symbol's match offset as in Kmidt, and then selecting the symbol from the lookup symbol's library that's at the original symbol's lookup index.

Otherwise, evaluation works as in Kmidt.

## Example programs

### Rule 110

```
* : 2 [
  A _
  B _
  P 0
  Q 0
  R 0
  _ *
]
x :: x
_ : 3 [x A; 0 A; 1 B]
0 : 2 [x P; 0 P; 1 Q]
1 : 2 [x Q; 0 Q; 1 R]
A :: _
B :: _
P : 1 [A 0; B 0]
Q : 1 [A 1; B 1]
R : 1 [A 1; B 0]

xxx_1_0*
```

This Kmidt program simulates the [Rule 110](https://esolangs.org/wiki/W110) cellular automaton. At every even step, each cell is represented by a `0` or `1` symbol preceded by an `_` symbol; at every odd step, this becomes a `P`, `Q`, or `R` symbol representing two neighboring cells, preceded by an `A` or `B` symbol representing another neighbor to the left. A new cell can then be determined based on these two symbols which represent three adjacent cells. The two `*` symbols appended over the course of this cycle become a new 0 cell.

A [version of the Rule 110 program](https://github.com/Arctenik/esolangs/blob/main/kmid/programs/rule-110.kmidt) with compilation-related notes can be found on GitHub.

Making a Rule 110 implementation that's more compact in space and/or time (without inflating the number of different symbols) is left as an exercise to the reader.

A conversion of this program to Kmidi might look like this:

```
* : 2 : 0 [* * * *]
x :: x [A P Q *]
_ : 3 : 0 [* * * *]
0 : 2 : 1 [A P Q *]
1 : 2 : 2 [B Q R *]
A :: _ [_ 0 1 1]
B :: _ [_ 0 1 0]
P : 1 : 1 [0 * * *]
Q : 1 : 2 [0 * * *]
R : 1 : 3 [0 * * *]

xxx_1_0*
```

(`*` is used as a filler symbol to make all the libraries the same length; the only one that's actually used is the first one in the library for `_`.)

### Halting

```
s1 :: s2
s2 :: s3
s3 :: $$

s1
```

A very basic example of halting: `s1` becomes `s2` becomes `s3` becomes the halt symbol, and the program ends. (As this is happening, there are also additional `s1` symbols -- the default symbol -- appended, which then also start to go through this process.)

## Computational class

### Kmidt

Kmidt's semantics closely resemble those of Couplet [2C](https://esolangs.org/wiki/2C "2C") (mostly by coincidence, although the halt symbol *is* borrowed); in fact, it's almost trivial to translate Couplet 2C to Kmidt -- the only non-straightforward aspect is the implicit leading 0 of a Couplet 2C program, which can be simulated by having a special Kmidt symbol for the beginning zero that has a constant transition to itself, and duplicating all transitions that match on the 0 symbol to match on the beginning zero as well.

Since Couplet 2C is Turing-complete, then, Kmidt is also Turing-complete.

(See [Kwert#Application to DEFLATE](https://github.com/Arctenik/esolangs/blob/main/kwert/readme.md#application-to-deflate) for an alternative construction.)

### Kmidi

Kmidt can be translated to Kmidi by choosing lookup indices and symbol libraries such that the replacement symbol retrieved from the library of a symbol *A* by a symbol *B* is always the same as the replacement symbol given by the table for *B* when matching against *A*.

A simple way of accomplishing this is to give the symbol libraries a length equal to the number of different symbols in the program, and assign each symbol a different index in the library; this index can then be used as the symbol's lookup index, and thus a symbol retrieved from a library corresponds uniquely to the pair of involved symbols. (There are other methods of library construction that may produce significantly smaller sizes, however.)

Given this translation, Kmidi is Turing-complete.

## External resources

-   [Online interpreter](https://arctenik.github.io/esolangs/kmid/)
-   [Kmidt-to-Kmidi and Kmid-to-Kwert](https://arctenik.github.io/esolangs/kmid/compiler/)
-   [GitHub folder with additional programs](https://github.com/Arctenik/esolangs/tree/main/kmid/programs)
