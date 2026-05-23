/**
 * Tests for src/parser.ts
 *
 * Order matters: initParser must be called before any other parser operations.
 * These tests use inline source code (no fixture dependencies).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { initParser, getParser, parse, query, stripCommentSyntax, getPrecedingComment } from "../parser";
import { LANGUAGES, type LanguageConfig } from "../languages";

// ─── Helpers ──────────────────────────────────────────────────────────

let parserInitialized = false;

beforeAll(async () => {
  if (!parserInitialized) {
    await initParser();
    parserInitialized = true;
  }
}, 30_000);

async function getRubyParser() {
  return getParser(LANGUAGES.ruby);
}

// ─── 1.1 initParser ───────────────────────────────────────────────────

describe("initParser", () => {
  it("dovrebbe inizializzare web-tree-sitter e essere idempotente", async () => {
    // Chiamata alla prima inizializzazione (già fatta in beforeAll)
    await expect(initParser()).resolves.toBeUndefined();
  });
});

// ─── 1.2 getParser cache ─────────────────────────────────────────────

describe("getParser", () => {
  it("dovrebbe caricare la grammatica Ruby e usare la cache", async () => {
    const first = await getRubyParser();
    expect(first).toHaveProperty("parser");
    expect(first).toHaveProperty("language");

    const second = await getRubyParser();
    expect(second).toBe(first); // stessa istanza grazie alla cache
  });

  it("dovrebbe lanciare errore per linguaggio senza WASM", async () => {
    const fakeLang: LanguageConfig = {
      id: "nonexistent",
      label: "Nonexistent",
      extensions: ["foo"],
      wasmPath: "node_modules/nonexistent/nonexistent.wasm",
      captureGroups: [],
    };
    await expect(getParser(fakeLang)).rejects.toThrow();
  });

  it("dovrebbe caricare tutti e 7 i linguaggi", async () => {
    const langIds = Object.keys(LANGUAGES);
    for (const id of langIds) {
      const ctx = await getParser(LANGUAGES[id]);
      expect(ctx.parser).toBeDefined();
      expect(ctx.language).toBeDefined();
    }
  });

  it("dovrebbe usare la cache tra caricamenti di linguaggi diversi", async () => {
    const rubyA = await getParser(LANGUAGES.ruby);
    await getParser(LANGUAGES.python);
    const rubyB = await getParser(LANGUAGES.ruby);
    expect(rubyB).toBe(rubyA);
  });
});

// ─── 1.4 parse ────────────────────────────────────────────────────────

describe("parse", () => {
  it("dovrebbe produrre un albero valido per codice Ruby semplice", async () => {
    const ctx = await getRubyParser();
    const { tree, rootNode } = parse(ctx.parser, "class Foo\nend");

    expect(tree).toBeDefined();
    expect(rootNode).toBeDefined();
    expect(rootNode.namedChildren.length).toBeGreaterThan(0);
  });

  it("dovrebbe gestire stringa vuota senza crash", async () => {
    const ctx = await getRubyParser();
    const { rootNode } = parse(ctx.parser, "");
    expect(rootNode).toBeDefined();
  });

  it("dovrebbe produrre albero fault-tolerant per codice invalido", async () => {
    const ctx = await getRubyParser();
    const { rootNode } = parse(ctx.parser, "class Foo\n  def oops(\nend");
    expect(rootNode).toBeDefined();
    // Tree-sitter è fault-tolerant: produce nodi ERROR ma non crasha
    expect(rootNode.namedChildren.length).toBeGreaterThan(0);
  });
});

// ─── 1.5 query ────────────────────────────────────────────────────────

describe("query", () => {
  it("dovrebbe estrarre classe e superclasse Ruby", async () => {
    const ctx = await getRubyParser();
    const source = `class Foo < Bar\n  def greet\n    puts "hi"\n  end\nend`;
    const q = `(class name: (constant) @class_name superclass: (superclass (constant) @superclass)?) @class_def`;

    const matches = query(ctx, source, q);
    expect(matches.length).toBe(1);
    expect(matches[0].class_name.text).toBe("Foo");
    expect(matches[0].superclass.text).toBe("Bar");
  });

  it("dovrebbe restituire array vuoto per query senza match", async () => {
    const ctx = await getRubyParser();
    const matches = query(ctx, "x = 1", "(module) @module_def");
    expect(matches).toEqual([]);
  });

  it("dovrebbe restituire più match per query con risultati multipli", async () => {
    const ctx = await getRubyParser();
    const source = `def a; end\ndef b; end`;
    const q = `(method name: (identifier) @method_name) @method_def`;

    const matches = query(ctx, source, q);
    expect(matches.length).toBe(2);
    expect(matches[0].method_name.text).toBe("a");
    expect(matches[1].method_name.text).toBe("b");
  });
});

// ─── 1.6 query con capture group predefinito ──────────────────────────

describe("query with capture group", () => {
  it("dovrebbe usare il capture group 'methods' di Ruby", async () => {
    const ctx = await getRubyParser();
    const source = `def hello(name)\n  name.upcase\nend\n\ndef goodbye\n  "bye"\nend`;
    const group = LANGUAGES.ruby.captureGroups.find((g) => g.name === "methods");
    expect(group).toBeDefined();

    const matches = query(ctx, source, group!.query);
    expect(matches.length).toBe(2);
    expect(matches[0].method_name.text).toBe("hello");
    expect(matches[1].method_name.text).toBe("goodbye");
  });
});

// ─── 1.7–1.10 stripCommentSyntax ──────────────────────────────────────

describe("stripCommentSyntax", () => {
  it("dovrebbe rimuovere commenti Ruby (#)", () => {
    const result = stripCommentSyntax("# This is a comment", LANGUAGES.ruby);
    expect(result).toBe("This is a comment");
  });

  it("dovrebbe rimuovere commenti Ruby senza spazio (#)", () => {
    const result = stripCommentSyntax("#This is a comment", LANGUAGES.ruby);
    expect(result).toBe("This is a comment");
  });

  it("dovrebbe rimuovere commenti Ruby indentati", () => {
    const result = stripCommentSyntax("  # indented comment", LANGUAGES.ruby);
    expect(result).toBe("indented comment");
  });

  it("dovrebbe gestire commento Ruby vuoto", () => {
    const result = stripCommentSyntax("#", LANGUAGES.ruby);
    expect(result).toBe("");
  });

  it("dovrebbe rimuovere commenti Python (#)", () => {
    const result = stripCommentSyntax("# line comment", LANGUAGES.python);
    expect(result).toBe("line comment");
  });

  it("dovrebbe rimuovere docstring Python con \"\"\"", () => {
    const result = stripCommentSyntax('"""block docstring"""', LANGUAGES.python);
    expect(result).toBe("block docstring");
  });

  it("dovrebbe rimuovere commenti JS singola linea (//)", () => {
    const result = stripCommentSyntax("// single line", LANGUAGES.javascript);
    expect(result).toBe("single line");
  });

  it("dovrebbe rimuovere commenti JS multi-linea (/* */)", () => {
    const result = stripCommentSyntax("/* multi\n line */", LANGUAGES.javascript);
    expect(result).toBe("multi\n line");
  });

  it("dovrebbe rimuovere commenti HTML (<!-- -->)", () => {
    const result = stripCommentSyntax("<!-- HTML comment -->", LANGUAGES.html);
    expect(result).toBe("HTML comment");
  });

  it("dovrebbe restituire testo invariato senza delimitatori configurati", () => {
    const langNoDelim: LanguageConfig = {
      id: "test",
      label: "Test",
      extensions: ["test"],
      wasmPath: "",
      captureGroups: [],
    };
    const result = stripCommentSyntax("some text", langNoDelim);
    expect(result).toBe("some text");
  });
});

// ─── 1.11 getPrecedingComment ─────────────────────────────────────────

describe("getPrecedingComment", () => {
  it("dovrebbe trovare il commento che precede un metodo", async () => {
    const ctx = await getRubyParser();
    const source = `# Returns the sum\ndef add(a, b)\n  a + b\nend`;
    const { rootNode } = parse(ctx.parser, source);

    // Trova il nodo del metodo
    const methodNode = findNamedChild(rootNode, "method");
    expect(methodNode).toBeDefined();

    const comment = getPrecedingComment(rootNode, methodNode!);
    expect(comment).toContain("Returns the sum");
  });

  it("dovrebbe restituire undefined per definizione senza commento", async () => {
    const ctx = await getRubyParser();
    const source = `def bare\n  nil\nend`;
    const { rootNode } = parse(ctx.parser, source);

    const methodNode = findNamedChild(rootNode, "method");
    expect(methodNode).toBeDefined();

    const comment = getPrecedingComment(rootNode, methodNode!);
    expect(comment).toBeUndefined();
  });

  it("dovrebbe concatenare commenti adiacenti", async () => {
    const ctx = await getRubyParser();
    const source = `# First line\n# Second line\ndef foo\nend`;
    const { rootNode } = parse(ctx.parser, source);

    const methodNode = findNamedChild(rootNode, "method");
    expect(methodNode).toBeDefined();

    const comment = getPrecedingComment(rootNode, methodNode!);
    expect(comment).toContain("First line");
    expect(comment).toContain("Second line");
  });
});

// ─── Helper: find first named child by type ───────────────────────────

function findNamedChild(node: any, type: string): any {
  for (const child of node.namedChildren) {
    if (child.type === type) return child;
    const found = findNamedChild(child, type);
    if (found) return found;
  }
  return null;
}
