/**
 * Integration tests for src/analyzer.ts — analyzeDirectory.
 *
 * Tests require fixture directories in src/__tests__/fixtures/.
 * initParser must be called before these tests run.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

import { initParser } from "../parser";
import { analyzeDirectory } from "../analyzer";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

// ─── Helper: temp dirs for config tests ─────────────────────────────

const tempDirs: string[] = [];

function makeTempDir(): string {
  const d = mkdtempSync(resolve(tmpdir(), "pi-ts-int-"));
  tempDirs.push(d);
  return d;
}

function writeFile(dir: string, subpath: string, content: string): void {
  const fullPath = resolve(dir, subpath);
  mkdirSync(resolve(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, content, "utf-8");
}

afterAll(() => {
  for (const d of tempDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

let parserInitialized = false;

beforeAll(async () => {
  if (!parserInitialized) {
    await initParser();
    parserInitialized = true;
  }
}, 30_000);

// ══════════════════════════════════════════════════════════════════════
// 3.1 analyzeDirectory — Ruby
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — Ruby", () => {
  it("dovrebbe analizzare directory Ruby con classi, metodi e require", async () => {
    const result = await analyzeDirectory({
      directory: resolve(FIXTURES, "ruby"),
      language: "ruby",
    });

    expect(result.filesFound).toBeGreaterThanOrEqual(3); // sample, empty, broken
    expect(result.languages.ruby).toBeDefined();

    // Calculator + MathUtils
    expect(result.classes.length).toBeGreaterThanOrEqual(2);

    // add, subtract, create
    expect(result.functions.length + result.classes.reduce((sum, c) => sum + c.methods.length, 0)).toBeGreaterThanOrEqual(3);

    // require "json", require_relative "helpers"
    expect(result.imports.length).toBeGreaterThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3.2 analyzeDirectory — Python
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — Python", () => {
  it("dovrebbe analizzare directory Python con classi e funzioni", async () => {
    const result = await analyzeDirectory({
      directory: resolve(FIXTURES, "python"),
      language: "python",
    });

    expect(result.filesFound).toBe(2); // sample.py, no_doc.py
    expect(result.languages.python).toBe(2);

    // Calculator class
    const calcs = result.classes.filter((c) => c.name === "Calculator");
    expect(calcs.length).toBe(1);

    // add, subtract (methods) + multiply, helper (top-level)
    const allFuncs = [
      ...result.functions,
      ...result.classes.flatMap((c) => c.methods),
    ];
    const funcNames = allFuncs.map((f) => f.name);
    expect(funcNames).toContain("add");
    expect(funcNames).toContain("subtract");
    expect(funcNames).toContain("multiply");
    expect(funcNames).toContain("helper");
  });

  it("dovrebbe gestire definizioni senza docstring (no_doc.py)", async () => {
    const result = await analyzeDirectory({
      directory: resolve(FIXTURES, "python"),
      language: "python",
    });

    const bareClass = result.classes.find((c) => c.name === "BareClass");
    expect(bareClass).toBeDefined();
    // La classe non ha docstring
    expect(bareClass!.doc).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3.3 multi-linguaggio
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — multi-linguaggio", () => {
  it("dovrebbe analizzare file misti senza filtro linguaggio", async () => {
    const result = await analyzeDirectory({
      directory: FIXTURES,
    });

    expect(result.languages).toHaveProperty("ruby");
    expect(result.languages).toHaveProperty("python");
    expect(result.languages).toHaveProperty("javascript");
    expect(result.languages).toHaveProperty("typescript");
    expect(result.languages).toHaveProperty("html");
    expect(result.languages).toHaveProperty("css");
    expect(result.languages).toHaveProperty("c");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3.4 filtro per linguaggio
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — filtro per linguaggio", () => {
  it("dovrebbe processare solo file TypeScript", async () => {
    const result = await analyzeDirectory({
      directory: FIXTURES,
      language: "typescript",
    });

    expect(Object.keys(result.languages)).toEqual(["typescript"]);
    expect(result.filesFound).toBe(2); // sample.ts, no_comments.ts
  });

  it("dovrebbe restituire filesFound = 0 per linguaggio non presente", async () => {
    const result = await analyzeDirectory({
      directory: resolve(FIXTURES, "ruby"),
      language: "typescript",
    });

    expect(result.filesFound).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3.5 filtro per capture group
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — filtro capture group", () => {
  it("dovrebbe estrarre solo classi quando richiesto", async () => {
    const result = await analyzeDirectory({
      directory: resolve(FIXTURES, "ruby"),
      groups: ["classes_and_modules"],
    });

    expect(result.classes.length).toBeGreaterThanOrEqual(2);
    // functions e imports dovrebbero essere vuoti perché non richiesti
    expect(result.functions.length).toBe(0);
    expect(result.imports.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3.6 limite maxFiles
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — limite maxFiles", () => {
  it("dovrebbe rispettare il limite di file analizzati", async () => {
    const result = await analyzeDirectory({
      directory: FIXTURES,
      maxFiles: 2,
    });

    expect(result.filesFound).toBeLessThanOrEqual(2);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3.7 directory inesistente
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — directory inesistente", () => {
  it("non dovrebbe crashare su directory che non esiste", async () => {
    const result = await analyzeDirectory({
      directory: "/tmp/nonexistent_dir_xyz_12345",
    });

    expect(result.filesFound).toBe(0);
    expect(result.filesParsed).toBe(0);
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3.8 assegnazione metodi a classi
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — assegnazione metodi a classi", () => {
  it("i metodi definiti dentro una classe dovrebbero essere assegnati a quella classe", async () => {
    const result = await analyzeDirectory({
      directory: resolve(FIXTURES, "ruby"),
      language: "ruby",
    });

    const calc = result.classes.find((c) => c.name === "Calculator");
    expect(calc).toBeDefined();
    expect(calc!.methods.length).toBeGreaterThanOrEqual(2);

    const methodNames = calc!.methods.map((m) => m.name);
    expect(methodNames).toContain("add");
    expect(methodNames).toContain("subtract");

    // I metodi di classe non dovrebbero essere in functions (sono dentro la classe)
    const topLevelNames = result.functions.map((f) => f.name);
    expect(topLevelNames).not.toContain("add");
    expect(topLevelNames).not.toContain("subtract");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6.7 excludeDirs
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — excludeDirs", () => {
  it("dovrebbe saltare le directory in excludeDirs", async () => {
    const dir = makeTempDir();
    writeFile(dir, "good/a.py", "print('hello')");
    writeFile(dir, "skipped/b.py", "x = 1");

    const result = await analyzeDirectory({
      directory: dir,
      language: "python",
      excludeDirs: ["skipped"],
    });

    expect(result.filesFound).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6.8 maxFileSize
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — maxFileSize", () => {
  it("dovrebbe saltare file piu grandi del limite", async () => {
    const dir = makeTempDir();
    writeFile(dir, "small.py", "x = 1"); // ~6 byte
    writeFile(dir, "large.py", "# " + "x".repeat(200)); // ~204 byte

    const result = await analyzeDirectory({
      directory: dir,
      language: "python",
      maxFileSize: 100,
    });

    expect(result.filesFound).toBe(2);
    expect(result.filesParsed).toBe(1); // solo small.py
    expect(result.errors.some((e) => e.includes("file too large"))).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6.9 maxDepth
// ══════════════════════════════════════════════════════════════════════

describe("analyzeDirectory — maxDepth", () => {
  it("dovrebbe limitare la profondita di ricorsione", async () => {
    const dir = makeTempDir();
    writeFile(dir, "a.py", "x = 1");                     // livello 0
    writeFile(dir, "sub/b.py", "y = 2");                  // livello 1
    writeFile(dir, "sub/deep/c.py", "z = 3");             // livello 2
    writeFile(dir, "sub/deep/deeper/d.py", "w = 4");      // livello 3

    const result = await analyzeDirectory({
      directory: dir,
      language: "python",
      maxDepth: 1,
    });

    // a.py (livello 0) e b.py (livello 1) trovati
    // c.py (livello 2) e d.py (livello 3) NON trovati
    expect(result.filesFound).toBe(2);
  });
});
