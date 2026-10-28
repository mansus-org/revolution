---
title: A functional language that speaks Python
title_es: Un lenguaje funcional que habla Python
dek: A small Lisp where indentation does the grouping, compiled to Python's own syntax tree so it can call any Python library. We did the research. Someone else should build it.
dek_es: Un Lisp pequeño en el que la sangría agrupa, compilado al árbol sintáctico de Python para poder llamar a cualquier librería de Python. Hicimos la investigación. Que lo construya otra persona.
summary: Immutable by default, everything an expression, and every Python library one import away. The parts exist; nobody has put them together.
summary_es: Inmutable por defecto, todo es una expresión y cualquier librería de Python a un import de distancia. Las piezas existen; nadie las ha juntado.
category: ideas
number: 2
date: 2026-10-19
needs_summary: someone with a compilers background who knows Python's internals
needs_summary_es: alguien con base en compiladores que conozca las tripas de Python
needs_label: to reach a first release
needs_label_es: para llegar a una primera versión
needs:
  - Programming language theory, enough to own the semantics
  - Python internals, the ast module and the import system
  - About 1,000 to 2,000 lines for the first usable version
  - Patience with indentation edge cases and golden tests
needs_es:
  - Teoría de lenguajes, lo bastante para decidir la semántica
  - Conocer Python por dentro, el módulo ast y el sistema de imports
  - Unas 1.000 a 2.000 líneas para la primera versión usable
  - Paciencia con los casos raros de sangría y los tests de referencia
---

## What we want

We like writing functional code: values that do not change, functions that return the same thing for the same input, programs built out of expressions rather than sequences of instructions. We also need Python's libraries. NumPy, pandas, the scientific stack, every client for every API. Choosing one means giving up the other, or writing functional Python by discipline and fighting the language at every `for` loop.

So the idea is a language that is functional first and Python underneath. Immutable by default, expression-oriented, with first-class pipelines and laziness, that can import any Python module and be imported from Python in return. Not a new runtime, not a bridge to another process: the same interpreter, the same objects, the same tracebacks.

## A Lisp, without the parentheses

The easiest way to get a small, regular language with macros is a Lisp. The fastest way to lose most Python programmers is a wall of parentheses. We think the way through is a Lisp where indentation does the grouping.

The best-specified grammar for that is [Wisp](https://srfi.schemers.org/srfi-119/srfi-119.html), written up as SRFI-119. Its rules fit in a paragraph:

- each line is a list;
- lines indented under it are its trailing arguments;
- ` : ` opens a nested list that runs to the end of the line;
- a leading `. ` continues the arguments of the line above instead of starting a new list;
- parentheses still work inline, for when they are clearer.

There are older attempts at the same thing, [SRFI-49](https://srfi.schemers.org/srfi-49/srfi-49.html) and [SRFI-110](https://srfi.schemers.org/srfi-110/srfi-110.html), and they are worth reading for what they got wrong. Wisp is the one we would follow. Here is what a function looks like:

```example.pyl
import numpy as np

defn norm xs
  let
    arr : np.array xs
    np.sqrt : np.sum : * arr arr

print : norm [3 4]        ; 5.0
```

The reader turns that into ordinary nested lists. `defn` takes a name, the parameters, and a body as its last child. `let` takes its bindings as children and its body last. The same program with every list written out:

```same, with parentheses
(import numpy as np)

(defn norm xs
  (let (arr (np.array xs))
    (np.sqrt (np.sum (* arr arr)))))

(print (norm [3 4]))
```

## Compile to the syntax tree, not to bytecode

::: note 1
Bytecode is an implementation detail of CPython and changes between minor versions. The `ast` module is public and changes slowly, mostly by adding node types.
:::

There are two places to land inside Python: its bytecode or its abstract syntax tree. We would target the tree, through the standard [`ast`](https://docs.python.org/3/library/ast.html) module.[^1] It is documented, it changes slowly, and once you have a tree Python compiles it for you, with all of its optimisations and error checking.

The compiler walks the nested lists and builds `ast` nodes. Every node gets the line and column of the source it came from, so a traceback points at the `.pyl` file and not at generated code nobody has seen. The example above becomes, in effect:

```emitted python
import numpy as np

def norm(xs):
    arr = np.array(xs)
    return np.sqrt(np.sum(arr * arr))

print(norm((3, 4)))
```

A few rules make it feel native. Names are mangled the way [Hy](https://github.com/hylang/hy) does it, so `my-fn` becomes `my_fn` and `valid?` becomes `is_valid`, and Python code can call them without quoting tricks. Self tail calls are rewritten into `while` loops, because Python has no tail-call elimination and a functional language without it hits the recursion limit on the first real list. Mutual recursion goes through a small trampoline. An [`importlib`](https://docs.python.org/3/library/importlib.html) hook lets Python `import` a `.pyl` module directly, and the compiled result is cached as `.pyc` like any other module.

## A longer example

::: note 2
Illustrative only. The language does not exist, and none of this has been run. The Python is what we expect the compiler to emit, written by hand and tidied for reading.
:::

The small snippets above show the reader and the emitter. Here is a whole small program in the same syntax:[^2] read a CSV of sales, total the revenue by region without mutating anything, and report the top regions. It uses the standard `csv` module, a macro, a lazy sequence, an immutable fold and a `match`. The `match` belongs to the later pattern-matching work, not to the first release.

```sales.pyl (hypothetical)
import csv
from functools import reduce
from itertools import islice

; (-> x (f a) g) becomes (g (f x a)): thread x through the forms as first argument
defmacro -> x . forms
  reduce
    fn acc form
      let : f : if (list? form) form [form]
        `(,(first f) ,acc ,@(rest f))
    . forms x

defn read-rows path
  with f : open path newline=""
    tuple : csv.DictReader f

defn revenue row
  * : int : get row "units"
    . float : get row "price"

; filter is lazy: rows are tested only as the caller consumes them (read-rows has already loaded the file)
defn paid-rows path
  filter (fn r : > (revenue r) 0) : read-rows path

defn by-region rows
  reduce
    fn acc row
      let : region : get row "region"
        assoc acc region : + (acc.get region 0) : revenue row
    . rows {}

defn top-regions path n
  -> (paid-rows path)
    by-region
    .items
    sorted key=(fn kv : - : get kv 1)
    islice n
    tuple

defn describe top
  match top
    [] : "no sales"
    [[region total] . _] : f"best: {region} ({total:.0f})"

print : describe : top-regions "sales.csv" 3
```

`->` is an ordinary macro: it runs at compile time, rewrites the tree, and leaves nothing behind. `assoc` returns a new frozen mapping and leaves its argument alone, so the fold never mutates. Here is roughly what the compiler would emit:

```emitted python
import csv
from functools import reduce
from itertools import islice
from types import MappingProxyType
from pyl.core import assoc  # returns a new MappingProxyType

def read_rows(path):
    with open(path, newline="") as f:
        return tuple(csv.DictReader(f))

def revenue(row):
    return int(row["units"]) * float(row["price"])

def paid_rows(path):
    return filter(lambda r: revenue(r) > 0, read_rows(path))

def by_region(rows):
    def _fn1(acc, row):
        region = row["region"]
        return assoc(acc, region, acc.get(region, 0) + revenue(row))
    return reduce(_fn1, rows, MappingProxyType({}))

def top_regions(path, n):
    return tuple(islice(sorted(by_region(paid_rows(path)).items(),
                               key=lambda kv: -kv[1]), n))

def describe(top):
    match top:
        case ():
            return "no sales"
        case ((region, total), *_):
            return f"best: {region} ({total:.0f})"

print(describe(top_regions("sales.csv", 3)))
```

Python can use it too. With the import hook installed, `from sales import top_regions` works like any module, and `top_regions("sales.csv", 3)` returns an ordinary tuple of tuples. The functions are named `top_regions` and `paid_rows` because of the mangling rule above. The hoisting problem is invisible here, and that is the point: the hard cases are the ones where an `if` or a `let` sits in the middle of a call.

## Semantics

The point of a new language is the defaults, so here are ours.

- `def` and `let` bind once. There is no reassignment form.
- Vector literals like `[3 4]` become tuples. Map literals become a frozen mapping.
- Everything is an expression, including `if`, `let` and `do`. Where Python needs a statement, the compiler hoists it into a temporary and uses the temporary as the value.
- Laziness comes from generators, so infinite sequences are cheap and composable.
- Pipelines are built in, so a chain of transformations reads left to right instead of inside out.

Later, and only once the core is solid: pattern matching compiled to Python's own `match`, algebraic data types as frozen dataclasses, and optional types written as annotations and checked by mypy or pyright. Each of those reuses something Python already has, which is the theme. We are not trying to out-build Python; we are trying to give it a different surface.

::: pull
Nobody has built an indentation-based Lisp on Python to production quality. All the parts already exist.
:::

## Who has been here before

Quite a few people, and we learned from all of them.

| Project | What it is | Why it is not this |
| --- | --- | --- |
| [Hy](https://github.com/hylang/hy) | A Lisp compiled to Python's AST, imports both ways, version 1.1.0 in May 2025 | Parentheses only, and not functional by default |
| [Hissp](https://github.com/gilch/hissp) | A Python-hosted Lisp with swappable readers and macros | A foundation, not a finished functional language |
| [Hebigo](https://github.com/gilch/hebigo) | An experimental indentation reader for Hissp | The closest thing that exists, still a prototype |
| Wisp (SRFI-119) | The best-specified grammar for Lisp without parentheses | A grammar for Scheme, not a Python language |
| [Coconut](http://coconut-lang.org/) | A functional superset of Python that compiles to `.py` | The most production-ready option today, but Python syntax, not a Lisp |
| [Mochi](https://github.com/i2y/mochi) | A functional language on Python | Development has stalled |
| [Pyret](https://pyret.org/) | A functional teaching language | No Python interop |
| RPython | The restricted Python behind PyPy | A toolchain for building interpreters, not a language to write programs in |

If you want functional programming on Python today, use Coconut. It has pipes, pattern matching, data types, lazy lists and tail-call optimisation, and it works. What it does not give you is a small, regular, macro-friendly core, which is what a Lisp is for. Hebigo is the project to watch, and anyone picking this up should talk to its author before writing a reader of their own.

## What is hard

We would rather list the risks than discover them in someone else's issue tracker.

- **Indentation edge cases.** Blank lines, comments at odd depths, continuation lines, mixed tabs. Wisp specifies most of it, and the rest needs a large set of golden tests.
- **Hoisting expressions into statements.** This is the hardest part. An `if` used as a value in the middle of a call has to become temporaries and a statement before the call, without changing evaluation order or breaking short-circuit evaluation.
- **Macros and source maps.** A macro rewrites code, and the rewritten code still needs line numbers that point somewhere useful.
- **AST churn.** The tree changes a little with each Python release. Targeting 3.12 and later keeps the surface manageable.
- **Tooling.** Editors need highlighting and indentation support. A tree-sitter grammar would cover most of them, later.
- **Overlap with Hebigo.** Two prototypes of the same idea help nobody. Working with it, or on top of Hissp, may be better than starting fresh.

## The smallest useful version

1. A reader that turns indented source into nested lists, with golden tests for every rule in the grammar.
2. A core compiler for `def`, `defn`, `fn`, `let`, `if`, `do`, calls, attribute access, literals and `import`.
3. Two commands: `pyl run file.pyl` and `pyl --emit py file.pyl`, so people can see exactly what their code turns into.
4. The import hook, so Python can import `.pyl` modules and they get cached.
5. A handful of demos that use real libraries: NumPy, a web request, a data pipeline.

By our estimate that is somewhere between 1,000 and 2,000 lines, most of it in the reader, the hoisting and the tests.

## Who should build it

Someone with a programming languages background who also knows how Python works inside: the `ast` module, the import system, how tracebacks find their line numbers. It is a good project for one person with a few months of evenings, or for a small group that enjoys arguing about semantics.

We have done the research and we know what we would build. If you want to build it, take the design, change what you disagree with, and tell us how it goes. Open an issue on [this site's repository](https://github.com/mansus-org/revolution/issues) and we will share our notes and help where we can.
