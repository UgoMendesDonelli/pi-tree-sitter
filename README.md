# pi-tree-sitter — Structural Code Access for AI Agents

## Vision

A **pi extension** that gives the **pi agent** the ability to analyze source code through
Tree-sitter, the incremental, fault-tolerant parser. Instead of reading files blindly
with grep/text, the agent can query a project's AST (Abstract Syntax Tree) for precise
structural information.

## Why

Today the pi agent can:
- Read files (`read`)
- Search text patterns (`grep`, `rg`)
- Explore directories (`ls`, `find`)

But it is **syntax-blind**. It cannot answer questions like:
- "Which classes inherit from `BaseController`?"
- "Where is the `process_payment` method called?"
- "What public functions does this module expose?"
- "Is there dead code in this directory?"
- "Show me the dependency graph of `src/core`"

Tree-sitter solves this by producing accurate ASTs even on unparseable code.

## Features

### Registered Tools (6)

| Tool | Description |
|------|-------------|
| `tree_sitter_languages` | List supported languages and available capture groups |
| `tree_sitter_query` | Run an S-expression query on a single file |
| `tree_sitter_analyze` | Structural directory analysis: classes, methods, functions, imports, docstrings |
| `tree_sitter_capture` | Capture specific nodes using pre-built groups (file or directory) |
| `tree_sitter_graph` | Generate structured JSON graphs: import dependencies, call graph, inheritance hierarchy |

### Documentation Comments

Comments preceding a definition (class, method, function) are captured and
associated with the corresponding node. This enables:
- Extracting YARD/RDoc docstrings (Ruby), docstrings (Python), JSDoc (JS/TS)
- Understanding inline API documentation of a module
- Checking whether a public function is documented

### Supported Languages (9)

| Language | Extensions | Capture Groups |
|----------|-----------|----------------|
| Ruby | .rb, .rake, .gemspec, .ru | classes_and_modules, methods, comments, calls, constants, requires |
| Python | .py, .pyw, .pyi | classes, functions, comments, imports, calls, decorators |
| JavaScript | .js, .jsx, .mjs, .cjs | classes, functions, variables, comments, imports, exports, calls |
| TypeScript | .ts, .tsx, .mts, .cts | classes, functions, interfaces, types, comments, imports, exports |
| Go | .go | functions, methods, structs, interfaces, imports, comments |
| Rust | .rs | functions, structs, enums, traits, imports (use), macros, comments |
| C / C++ | .c, .h, .cpp, .hpp, .cc, .hh, .cxx, .hxx | functions, classes (C++), comments, includes |
| HTML | .html, .htm, .shtml, .xhtml | elements, comments |
| CSS | .css, .scss, .less | rules, comments |

More languages can be added by installing their respective npm grammar packages
and adding a config in `src/languages.ts`. Each new language requires ~20 lines.

### Graph Generation (`tree_sitter_graph`)

Generates structured JSON graphs designed for AI agent consumption (not visualization):

- **Import graph**: which files import/require which modules
- **Call graph**: which functions call which (with scope detection)
- **Inheritance graph**: class hierarchy with superclass relationships

Output format:
```json
{
  "type": "imports",
  "nodes": [{"id": "path/file.rb", "type": "file", "name": "file.rb"}],
  "edges": [{"from": "path/file.rb", "to": "module_name", "type": "imports"}],
  "metadata": {"totalFiles": 314, "totalImports": 271}
}
```

### External Configuration

You can customize analysis behavior by creating a `.tree-sitter.json` file in the
project root:

```json
{
  "excludeDirs": ["tmp", "coverage", ".next"],
  "maxFileSize": 2000000,
  "maxDepth": 5
}
```

Priority (highest to lowest): explicit tool parameters → `.tree-sitter.json` → built-in defaults.

Built-in default exclude dirs: `node_modules`, `vendor`, `dist`, `build`, `__pycache__`, `target`, `.git`, `.svn`, `.hg`

## Verified Performance on Real Projects

pi-tree-sitter has been tested on 8 real open-source projects across 9 languages:

| Language | Project | Files | LOC | **Grep** | **Tree-sitter** | **Value added** |
|-----------|--------|:----:|:---:|:--------:|:--------------:|:---------------|
| **Ruby** | Rails AR | 314 | 64K | 57ms | 23.0s | Call graph (1507 edges) + inheritance |
| **TypeScript** | Next.js | 543 | 18K | 48ms | 8.1s | **5× structures** (class+interface+type) |
| **Rust** | Serde | 200 | 42K | 200ms | 2.8s | Struct/enum/trait separated |
| **Python** | Django DB | 123 | 55K | 0.4s | 2.5s | Top-level vs methods, docstrings |
| **Go** | Chi | 78 | 5.5K | 100ms | 0.36s | Struct/interface distinct |
| **C** | fmtlib | 15 | 17K | 21ms | 0.16s | Precise functions, zero false positives |
| **JavaScript** | Express | 6 | 2.7K | 9ms | 67ms | Require with extracted paths |

**Key finding:** tree-sitter typically uses **2-3× fewer tokens** than the equivalent grep+read workflow,
because the structured JSON replaces dozens of individual file reads.

## Architecture

```
~/.pi/agent/extensions/pi-tree-sitter/
├── index.ts                         # Entry point: registers 6 tools
├── src/
│   ├── parser.ts                    # Parser manager (WASM caching, single-parse)
│   ├── languages.ts                 # 9 language configs + capture groups
│   ├── analyzer.ts                  # Directory analysis with external config
│   ├── enrich.ts                    # Doc comment enrichment
│   ├── queryService.ts              # Centralized file query (single-parse)
│   ├── graph.ts                     # Import/call/inheritance graph generation
│   ├── config.ts                    # .tree-sitter.json loader
│   ├── handlers/
│   │   ├── types.ts                 # Handler interfaces + helpers
│   │   ├── classHandler.ts          # Class/module extraction
│   │   ├── methodHandler.ts         # Method/function extraction
│   │   ├── importHandler.ts         # Import/require/include
│   │   ├── rawHandler.ts            # Generic capture (comments, interfaces, etc.)
│   │   └── registry.ts              # Name → handler lookup
│   ├── tools/
│   │   ├── languages.ts             # tree_sitter_languages tool
│   │   ├── query.ts                 # tree_sitter_query tool
│   │   ├── analyze.ts               # tree_sitter_analyze tool
│   │   ├── capture.ts               # tree_sitter_capture tool
│   │   └── graph.ts                 # tree_sitter_graph tool
│   └── __tests__/
│       ├── setup.ts                 # Vitest setup
│       ├── config.test.ts           # Config tests (6)
│       ├── parser.test.ts           # Parser tests (25)
│       ├── languages.test.ts        # Language tests (30)
│       ├── analyzer.test.ts         # Analyzer tests (17)
│       ├── enrich.test.ts           # Enrichment tests (2)
│       ├── queryService.test.ts     # Query service tests (6)
│       ├── graph.test.ts            # Graph tests (6)
│       ├── index.test.ts            # Schema validation (8)
│       └── fixtures/                # Test fixture files for 7 languages
├── package.json                     # 11 tree-sitter grammars
├── tsconfig.json                    # strict: true
└── vitest.config.ts
```

**Total: 100 passing tests, 8 test files, 0 `any` types.**

### Design Decision: Extension vs Skill

**Extension** is the better choice because:
- Tools must be directly callable by the LLM with typed parameters
- State must be maintained (cached parsers, loaded grammars)
- Native integration with `pi.registerTool()` and TypeBox schemas
- npm dependencies (tree-sitter, grammars) are managed via `package.json`

### Architecture Highlights

- **Handler registry** replaces the old switch-case: adding a new capture group requires
  only a query in `languages.ts` and optionally a handler in `src/handlers/`
- **queryService** centralizes the read → detect → parse → query pattern, avoiding
  duplication across 3 different code paths
- **Single-parse**: the same AST rootNode is reused for all queries and doc enrichment.
  `parse()` is called exactly once per file, no matter how many capture groups run
- **Configurable** via `.tree-sitter.json` or tool parameters (exclude dirs, max file size,
  recursion depth)

## Setup

```bash
cd ~/.pi/agent/extensions/pi-tree-sitter
npm install
```

The extension is auto-discovered by pi on startup from `~/.pi/agent/extensions/`.

To install grammars for additional languages:

```bash
npm install tree-sitter-<language>
```

Then add the language config in `src/languages.ts` (~20 lines).

## Development

```bash
# Run all 100 tests
npm test

# Watch mode
npm run test:watch

# Run a specific test file
npx vitest run parser.test.ts

# TypeScript strict check
npx tsc --noEmit
```

## References

- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)
- [web-tree-sitter npm](https://www.npmjs.com/package/web-tree-sitter)
- [Pi Extensions docs](https://github.com/earendil-works/pi-coding-agent/blob/main/docs/extensions.md)
