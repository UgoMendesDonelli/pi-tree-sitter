/**
 * Tests for src/languages.ts — capture groups and language utilities.
 *
 * These tests require fixture files in src/__tests__/fixtures/ and
 * rely on the parser tests having passed (initParser must be called).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { initParser, getParser, query, stripCommentSyntax, getPrecedingComment, parse, type CaptureInfo } from "../parser";
import {
  LANGUAGES,
  getLanguageForFile,
  getAllExtensions,
  type LanguageConfig,
  type CaptureGroup,
} from "../languages";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

let parserInitialized = false;

beforeAll(async () => {
  if (!parserInitialized) {
    await initParser();
    parserInitialized = true;
  }
}, 30_000);

// ─── Helpers ──────────────────────────────────────────────────────────

function fixturePath(...segments: string[]): string {
  return resolve(FIXTURES, ...segments);
}

function readFixture(...segments: string[]): string {
  return readFileSync(fixturePath(...segments), "utf-8");
}

/**
 * Run a capture group query against a fixture file and return the matches.
 */
async function runCaptureGroup(langId: string, fixtureFile: string, groupName: string) {
  const lang = LANGUAGES[langId]!;
  const group = lang.captureGroups.find((g) => g.name === groupName);
  expect(group, `Capture group "${groupName}" not found for ${langId}`).toBeDefined();

  const source = readFixture(langId, fixtureFile);
  const ctx = await getParser(lang);
  return { matches: query(ctx, source, group!.query), source, lang, group: group! };
}

// ══════════════════════════════════════════════════════════════════════
// 2.1–2.4 Ruby
// ══════════════════════════════════════════════════════════════════════

describe("Ruby capture groups", () => {
  it("classes_and_modules — estrae classi e moduli da sample.rb", async () => {
    const { matches, source, lang, group } = await runCaptureGroup("ruby", "sample.rb", "classes_and_modules");

    expect(matches.length).toBe(2); // Calculator + MathUtils

    // Trova Calculator
    const calcMatch = matches.find((m) => (m.class_name as CaptureInfo | undefined)?.text === "Calculator");
    expect(calcMatch).toBeDefined();
    expect(calcMatch!.superclass).toBeUndefined();

    // MathUtils
    const mathMatch = matches.find((m) => (m.module_name as CaptureInfo | undefined)?.text === "MathUtils");
    expect(mathMatch).toBeDefined();
  });

  it("methods — estrae metodi di istanza e singleton", async () => {
    const { matches } = await runCaptureGroup("ruby", "sample.rb", "methods");

    expect(matches.length).toBe(4); // add, subtract, create, circle_area

    const methodNames = matches.map((m) => (m.method_name as CaptureInfo | undefined)?.text || (m.singleton_method_name as CaptureInfo | undefined)?.text).sort();
    expect(methodNames).toContain("add");
    expect(methodNames).toContain("subtract");
    expect(methodNames).toContain("create");
    expect(methodNames).toContain("circle_area");
  });

  it("calls — estrae chiamate a metodo", async () => {
    const { matches } = await runCaptureGroup("ruby", "sample.rb", "calls");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("requires — estrae require/require_relative", async () => {
    const { matches } = await runCaptureGroup("ruby", "sample.rb", "requires");

    expect(matches.length).toBe(2);
    const paths = matches.map((m) => (m.req_path as CaptureInfo | undefined)?.text);
    const methods = matches.map((m) => (m.req_method as CaptureInfo | undefined)?.text);
    expect(paths).toContain('"json"');
    expect(paths).toContain('"helpers"');
    expect(methods).toContain("require");
    expect(methods).toContain("require_relative");
  });

  it("constants — estrae costanti", async () => {
    const { matches } = await runCaptureGroup("ruby", "sample.rb", "constants");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect((matches[0]!.const_name as CaptureInfo | undefined)?.text).toBe("PI");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.5–2.6 Python
// ══════════════════════════════════════════════════════════════════════

describe("Python capture groups", () => {
  it("classes — estrae classi con superclass", async () => {
    const { matches } = await runCaptureGroup("python", "sample.py", "classes");

    expect(matches.length).toBe(1);
    expect((matches[0]!.class_name as CaptureInfo).text).toBe("Calculator");
  });

  it("functions — estrae funzioni e metodi", async () => {
    const { matches } = await runCaptureGroup("python", "sample.py", "functions");

    const funcNames = matches.map((m) => (m.func_name as CaptureInfo | undefined)?.text);
    expect(funcNames).toContain("add");
    expect(funcNames).toContain("subtract");
    expect(funcNames).toContain("multiply");
    expect(funcNames).toContain("helper");
  });

  it("imports — estrae import e from-import", async () => {
    const { matches } = await runCaptureGroup("python", "sample.py", "imports");
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("decorators — estrae decoratori", async () => {
    const { matches } = await runCaptureGroup("python", "sample.py", "decorators");
    expect(matches.length).toBe(1);
    expect((matches[0]!.decorator as CaptureInfo).text).toContain("staticmethod");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.7–2.8 JavaScript
// ══════════════════════════════════════════════════════════════════════

describe("JavaScript capture groups", () => {
  it("classes — estrae classi", async () => {
    const { matches } = await runCaptureGroup("javascript", "sample.js", "classes");
    expect(matches.length).toBe(1);
    expect((matches[0]!.class_name as CaptureInfo).text).toBe("Calculator");
  });

  it("functions — estrae funzioni e metodi", async () => {
    const { matches } = await runCaptureGroup("javascript", "sample.js", "functions");

    const names = matches.map((m) => (m.func_name as CaptureInfo | undefined)?.text || (m.method_name as CaptureInfo | undefined)?.text);
    expect(names).toContain("add");
    expect(names).toContain("subtract");
    expect(names).toContain("multiply");
  });

  it("variables — estrae var/let/const", async () => {
    const { matches } = await runCaptureGroup("javascript", "sample.js", "variables");
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("imports — estrae require e import", async () => {
    const { matches } = await runCaptureGroup("javascript", "sample.js", "imports");

    const requireCalls = matches.filter((m) => m.require_call !== undefined);
    expect(requireCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("exports — estrae export da exports.js", async () => {
    const { matches } = await runCaptureGroup("javascript", "exports.js", "exports");
    expect(matches.length).toBe(3); // VERSION, greet, default class
  });

  it("calls — estrae chiamate a funzione", async () => {
    const { matches } = await runCaptureGroup("javascript", "sample.js", "calls");
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.9 TypeScript
// ══════════════════════════════════════════════════════════════════════

describe("TypeScript capture groups", () => {
  it("classes — estrae classi", async () => {
    const { matches } = await runCaptureGroup("typescript", "sample.ts", "classes");
    expect(matches.length).toBe(1);
    expect((matches[0]!.class_name as CaptureInfo).text).toBe("Calculator");
  });

  it("functions — estrae funzioni e metodi", async () => {
    const { matches } = await runCaptureGroup("typescript", "sample.ts", "functions");
    const names = matches.map((m) => (m.func_name as CaptureInfo | undefined)?.text || (m.method_name as CaptureInfo | undefined)?.text);
    expect(names).toContain("add");
    expect(names).toContain("multiply");
  });

  it("interfaces — estrae interfacce", async () => {
    const { matches } = await runCaptureGroup("typescript", "sample.ts", "interfaces");
    expect(matches.length).toBe(1);
    expect((matches[0]!.interface_name as CaptureInfo).text).toBe("Shape");
  });

  it("types — estrae type alias", async () => {
    const { matches } = await runCaptureGroup("typescript", "sample.ts", "types");
    expect(matches.length).toBe(1);
    expect((matches[0]!.type_name as CaptureInfo).text).toBe("Point");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.10 HTML
// ══════════════════════════════════════════════════════════════════════

describe("HTML capture groups", () => {
  it("elements — estrae elementi con tag name", async () => {
    const { matches } = await runCaptureGroup("html", "sample.html", "elements");
    expect(matches.length).toBeGreaterThanOrEqual(5); // html, body, div, h1, p

    const tags = matches.map((m) => (m.tag_name as CaptureInfo | undefined)?.text);
    expect(tags).toContain("html");
    expect(tags).toContain("body");
    expect(tags).toContain("div");
    expect(tags).toContain("h1");
    expect(tags).toContain("p");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.11 CSS
// ══════════════════════════════════════════════════════════════════════

describe("CSS capture groups", () => {
  it("rules — estrae regole con selettori", async () => {
    const { matches } = await runCaptureGroup("css", "sample.css", "rules");
    expect(matches.length).toBe(2); // body, .container
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.12 C/C++
// ══════════════════════════════════════════════════════════════════════

describe("C/C++ capture groups", () => {
  it("functions — estrae funzioni", async () => {
    const { matches } = await runCaptureGroup("c", "sample.c", "functions");
    const funcNames = matches.map((m) => (m.func_name as CaptureInfo | undefined)?.text);
    expect(funcNames).toContain("add");
    expect(funcNames).toContain("multiply");
  });

  it("includes — estrae #include directives", async () => {
    const { matches } = await runCaptureGroup("c", "sample.c", "includes");
    expect(matches.length).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.13 getLanguageForFile
// ══════════════════════════════════════════════════════════════════════

describe("getLanguageForFile", () => {
  it("dovrebbe mappare estensioni corrette", () => {
    expect(getLanguageForFile("app.rb")?.id).toBe("ruby");
    expect(getLanguageForFile("script.py")?.id).toBe("python");
    expect(getLanguageForFile("component.tsx")?.id).toBe("typescript");
    expect(getLanguageForFile("style.scss")?.id).toBe("css");
    expect(getLanguageForFile("main.cpp")?.id).toBe("c");
    expect(getLanguageForFile("index.js")?.id).toBe("javascript");
    expect(getLanguageForFile("page.html")?.id).toBe("html");
  });

  it("dovrebbe restituire undefined per estensione sconosciuta", () => {
    expect(getLanguageForFile("unknown.xyz")).toBeUndefined();
  });

  it("dovrebbe gestire file senza estensione", () => {
    expect(getLanguageForFile("Makefile")).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.14 getAllExtensions
// ══════════════════════════════════════════════════════════════════════

describe("getAllExtensions", () => {
  it("dovrebbe restituire tutte le estensioni supportate", () => {
    const exts = getAllExtensions();
    expect(exts).toContain("rb");
    expect(exts).toContain("py");
    expect(exts).toContain("js");
    expect(exts).toContain("ts");
    expect(exts).toContain("html");
    expect(exts).toContain("css");
    expect(exts).toContain("c");
    expect(exts).toContain("cpp");
  });

  it("non dovrebbe avere duplicati", () => {
    const exts = getAllExtensions();
    const unique = new Set(exts);
    expect(unique.size).toBe(exts.length);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2.15 capturesDoc flag
// ══════════════════════════════════════════════════════════════════════

describe("capturesDoc flag", () => {
  it("classi e funzioni dovrebbero avere capturesDoc: true", () => {
    for (const [id, lang] of Object.entries(LANGUAGES)) {
      for (const group of lang.captureGroups) {
        if (["classes", "classes_and_modules", "methods", "functions", "types"].includes(group.name)
            || (group.name === "structs" && id === "rust")
            || (group.name === "enums" && id === "rust")
            || (group.name === "traits" && id === "rust")
            || (group.name === "interfaces" && id === "typescript")) {
          expect(group.capturesDoc, `${id}.${group.name} dovrebbe avere capturesDoc: true`).toBe(true);
        }
      }
    }
  });

  it("commenti, chiamate e import non dovrebbero avere capturesDoc", () => {
    for (const [id, lang] of Object.entries(LANGUAGES)) {
      for (const group of lang.captureGroups) {
        if (["comments", "calls", "imports", "requires", "variables", "exports", "elements", "rules", "includes", "decorators", "constants", "macros"].includes(group.name)) {
          expect(group.capturesDoc, `${id}.${group.name} NON dovrebbe avere capturesDoc`).toBeFalsy();
        }
      }
    }
  });
});
