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

### Registered Tools

| Tool | Description |
|------|-------------|
| `tree_sitter_query` | Run an S-expression query on one or more files |
| `tree_sitter_analyze` | Structural directory analysis: classes, methods, functions, imports, **docstrings/documentation comments** |
| `tree_sitter_languages` | List supported languages and available node types |
| `tree_sitter_capture` | Capture specific nodes (e.g. all class definitions in `app/models/`) |

### Documentation Comments

Comments preceding a definition (class, method, function) are captured and
associated with the corresponding node. This enables:
- Extracting YARD/RDoc docstrings (Ruby), docstrings (Python), JSDoc (JS/TS)
- Understanding inline API documentation of a module
- Checking whether a public function is documented

### Supported Languages (phase 1)

- Ruby
- Python
- JavaScript / TypeScript
- HTML / CSS
- C / C++

More languages can be added by installing their respective npm grammar packages.

## Architecture

```
~/.pi/agent/extensions/pi-tree-sitter/
├── index.ts                    # Entry point: registers tools
├── package.json                # npm dependencies (tree-sitter, grammars)
├── src/
│   ├── parser.ts               # Parser management and per-language caching
│   ├── analyzer.ts             # Directory analysis (walk + parse)
│   └── languages.ts            # Supported language configurations
└── node_modules/               # After npm install
```

### Design Decision: Extension vs Skill

**Extension** is the better choice because:
- Tools must be directly callable by the LLM with typed parameters
- State must be maintained (cached parsers, loaded grammars)
- Native integration with `pi.registerTool()` and TypeBox schemas
- npm dependencies (tree-sitter, grammars) are managed via `package.json`

### Typical Flow

1. The agent receives a request like "analyze the Ruby project in `app/models/`"
2. The agent calls `tree_sitter_analyze` with `{ directory: "app/models", language: "ruby" }`
3. The extension:
   - Scans `.rb` files in the directory
   - Parses each file with tree-sitter (Ruby grammar)
   - Extracts classes, modules, methods, constants
   - Builds a structured JSON report
4. The agent receives the JSON and responds with precise insights

### Optimizations

- **Parser caching**: each grammar is loaded once and reused
- **Lazy parsing**: large files parsed only when necessary
- **Pre-built queries**: common queries ready to use (e.g. `classes`, `functions`, `imports`)
- **Structured output**: JSON reports, text summaries, LLM-friendly formats

## Stretch Goals (phase 2)

- **Dependency graph**: import/require between files
- **AST diff**: compare two versions of the same file
- **Scope analysis**: defined/used variables, shadowing
- **Code metrics**: cyclomatic complexity, lines of code per function

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

Then add the language config in `src/languages.ts`.

## References

- [Tree-sitter](https://tree-sitter.github.io/tree-sitter/)
- [tree-sitter npm](https://www.npmjs.com/package/tree-sitter)
- [Pi Extensions docs](https://github.com/badlogic/pi-coding-agent/blob/main/docs/extensions.md)
- [Agent Skills spec](https://agentskills.io/specification)
