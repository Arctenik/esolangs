# Beskew

*(note: this file is mainly meant as a mirror of the [wiki article](https://esolangs.org/wiki/Beskew), which may be more up-to-date)*

Beskew is variant of [combinatory logic](https://esolangs.org/wiki/Combinatory_logic) created by [User:Arctenik](https://esolangs.org/wiki/User:Arctenik), based on the idea of a very minimal language that can turn itself into any other language (or, at least, any other Unicode-based syntax). In Beskew, every Unicode character is a function (though the vast majority are formulaically defined as Church numerals), which theoretically allows a Beskew program to create a function that interprets its subsequent arguments as arbitrary program source code. Whether this is possible with any degree of time-efficiency has yet to be seen.

## Syntax

Since every character is a function, a Beskew program just consists of a sequence of implicit function applications. Like with usual combinatory logic notation, these function applications are left-associative -- `abcd` can be thought of as being grouped like `((ab)c)d` (though note that the latter is an abstract notation that wouldn't work as Beskew code, since the parentheses would be interpreted as functions rather than grouping).

The only characters with especially unique behavior are `B`, `S`, and `K`, which represent the same functions that they do in the BCKW and SKI calculi:

- B binds three arguments, applies the second argument to the third argument, and passes the result of that to the first argument
- S binds three arguments, applies each of the first two arguments to the third argument, and passes the result of the second argument's application to the result of the first argument's application
- K binds two arguments and returns the first (or, equivalently, takes one argument `x` and returns a function that consumes an argument and returns `x`)

All other characters represent Church numerals; any given character other than B, S, or K represents the Church numeral for that character's Unicode code point. For example, `%` is a function that applies its first argument to its second argument 37 times, since 37 is the Unicode value of the percent sign.

### Notation in this article

It's often very useful to use characters in Beskew programs for their numeric values, so for the sake of clarity and to allow control characters to be shown here, some characters in code examples may be replaced with the notation `[n]`, where `n` is the character's code point.

Additionally, when functions are being talked about more abstractly rather than in terms of actual Beskew code, parentheses may be used to represent grouping.

Line endings in example code should be assumed to be single-character.

## Evaluation

In order to support input/output and parsing, a Beskew program has several additional arguments appended to it, in this order:

- The EOF symbol, defined as a function that binds ten arguments and returns the tenth
- The output function, described below
- The characters of the input stream, each interpreted as a function in the same manner as the program code (note that this means that the characters B, S, and K need to be handled specially)
- Another instance of the EOF symbol

The output function takes one argument, (potentially) produces output based on the argument, and returns the identity function. The argument must be (equivalent to) one of the three primitive combinators `B` `S` `K`, a Church numeral, or the EOF symbol; the behavior for any other value is undefined. If the argument is the EOF symbol, no side effect happens; if the argument is a numeral, the character with that code point is added to output; and if the argument is a combinator, that combinator's name is added to output.

One relatively simple algorithm for distinguishing these five types of symbols is this:

```
qw[0][0]Krbksne
```

Where `q` is the symbol is question, `w` is a function that applies its second argument to its first argument, `r` is a function that returns its third argument, and `b`, `k`, `s`, `n`, and `e` are functions that consume some number of arguments (4-0 respectively) and then return a function corresponding to the symbol's type (`B`, `K`, `S`, numeral, or EOF, respectively).

In order for side effects to work in a useful way, Beskew must be lazily evaluated -- an expression is never evaluated unless its result is needed (if only indirectly) in order to process the next character in the program/input (or theoretical character, if there aren't actually any further arguments). On the other hand, however, functions should also be evaluated as soon as they have the absolute minimum number of arguments; for example, although `[1]` nominally takes two arguments since it's a Church numeral, it behaves equivalently to the identity function and so can be evaluated with only one argument.

## Useful patterns

### Grouping

There are no grouping symbols in Beskew, but grouping can be simulated by using numerals with the `B` and `S` combinators. A grouped expression of the form `f(abcd...)` can be simulated as `[n-1]Bfabcd...`, where `n` is the length of `abcd...`, and an expression like `(abcd...)(pqrs...)` can be simulated as `S[n-1][m-1]Babcd...pqrs...`, where `n` is the length of `abcd...` and `m` is the length of `pqrs...`.

### Comments

A comment can be simulated with arguments to the function `[n]K[1]`, where `n` is the length of the comment:

```
[38]K[1]\\ This program prints a comet symbol
[7]BKS[1][1]BS[1]K☄
```

## Example programs

Additional examples may be found in the [external resources](#external-resources).

### Hello world

```
[53]BK[35]B[13]S[4][26]B[1]BS[2]B[23]BKS[17][1]B[14]BSS[1][8]BBBS[1][2]BBSSS[0]KK[1][0]Hello, world!
```

......which is derived from this pair of abstract expressions (including a lambda expression written as `(L <args>.<body>)`):

```
<output builder> = (L rpx.r(S(Sp[1])(Kx)))
K([13]<output builder>[1][0]Hello, world!)
```

The program builds up a function that that applies its final argument (the output function) to each of the characters in `Hello, world!`, and is wrapped in a `K` application in order to get rid of the first EOF symbol.

### Cat program

```
[74]K[1]\\ Derived from (L f.ff)(L fos.osffo) = K(S[1][1](B(SS)(B(BK)(S[1][1]))))
[27]BKS[2][20]BS[1][1]S[4][11]B[1]BBSSS[4][2]B[1]BBBKS[1][1]
```

### Deadfish (ish)

This program implements a [Deadfish](https://esolangs.org/wiki/Deadfish)-like syntax within the program itself; the Deadfish code is written following the main program, with two preceding spacing characters. The main difference from actual Deadfish is that it outputs characters rather than numbers. However, the numeric operations are too slow (at least in the existing interpreter) to actually do much in a reasonable amount of time. The Deadfish code used here outputs a hash sign (Unicode value 35).

```
S[1][464]B[2]KS[2][455]BS[1][1]S[343][107]B[340]BSS[1][334]BBBS[327][2]B[324]BBS[28][291]B[24]B[3]S[5][14]B[2]BSBBB[11]BKS[5][1]B[2]BSBBSKK[1][287]BSS[280][2]BS[31][238]B[24]B[10]S[5][14]B[2]BSBBB[11]BKS[5][1]B[2]BSBBSKK[1][1][0][1]S[1][232]B[7]KS[226][1]B[223]BSS[19][199]B[16]BSS[1][10]BS[1][7]BKS[1][1]BS[1]K[0][196]BKS[1][190]B[100]KS[71][114]B[68]BSS[1][62]BS[1][59]BKS[1][53]BSB[50]BKS[11][34]B[8]B[2]S[1][2]BSS[2]K[0]S[28][1]B[25]BSS[1][19]BS[1][16]BKS[1][10]BBKS[1][4]BSS[1]BKSBKK[111]BKS[1][105]B[4]KS[20][80]B[17]BSS[1][11]BS[1][8]BKS[2][1]BS[1]KSB[77]BKS[1][71]B[5]KS[50][16]B[47]BSS[1][41]BS[1][38]BKS[10][23]B[7]BSS[1][1]BBSBB[20]BKS[14][1]B[11]BB[8]BSS[1][2]BBSSS[0][2]K[13]BKS[1][7]B[4]KS[1][1]BSBK[2]KK[46][46][46][46][46][46][3]K[1][1]S[1][1][104]BK[100]BSS[94][1]B[91]BSS[19][67]B[16]BSS[1][10]BS[1][7]BKS[1][1]BS[1]K[0][64]BKS[12][47]B[9]B[256][5]BB[2]BSS[1][0]KS[11][31]B[8]BSS[1][2]BS[1][2]K[0][28]BKS[2][21]BS[1][1]S[8][8]B[5]BB[2]BSS[1][0]S[1][2]BBKS[1][1]KK[1][0][0]

iisiisdo
```

The expressions used to create this program can be found [here](https://github.com/Arctenik/esolangs/blob/main/beskew/examples/char-deadfish-info.txt).

## Computational class

Beskew is Turing-complete, as it's equivalent to a superset of SK calculus. (Even though there's a finite number of Unicode characters, which might seem to limit the grouping patterns that can be used, it's possible to create very large numbers in very few characters by applying one numeral to another -- an operation equivalent to exponentiation. This would allow a smaller grouping operation to set up a larger grouping operation.)

## External resources

-   [Actual files for example programs](https://github.com/Arctenik/esolangs/tree/master/beskew/examples)
-   [An online interpreter](https://arctenik.github.io/esolangs/beskew/), featuring the above example programs as options
-   [A few utilities](https://arctenik.github.io/esolangs/beskew/utils/) for simplifying the tedious formulaic aspects of programming in Beskew
