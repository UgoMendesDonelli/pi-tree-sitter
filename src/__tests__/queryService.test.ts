/**
 * Tests for src/queryService.ts — queryFile.
 *
 * Uses fixture files from src/__tests__/fixtures/ and temp files.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { initParser } from "../parser";
import { queryFile } from "../queryService";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

let parserInitialized = false;

function makeTempFile(content: string, name = "test.rb"): string {
  const dir = mkdtempSync(resolve(tmpdir(), "pi-ts-qstest-"));
  const file = resolve(dir, name);
  writeFileSync(file, content, "utf-8");
  return file;
}

function cleanup(file: string): void {
  try { rmSync(resolve(file, ".."), { recursive: true, force: true }); } catch { /* ignore */ }
}

beforeAll(async () => {
  if (!parserInitialized) {
    await initParser();
    parserInitialized = true;
  }
}, 30_000);

describe("queryFile", () => {
  it("dovrebbe restituire errore per file inesistente", async () => {
    const result = await queryFile({
      file: "/tmp/nonexistent_xyz.rb",
      query: "(class) @class_def",
      language: "ruby",
    });

    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toBe("read_error");
    }
  });

  it("dovrebbe restituire errore per file vuoto", async () => {
    const file = makeTempFile("");
    try {
      const result = await queryFile({
        file,
        query: "(class) @class_def",
        language: "ruby",
      });

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("empty_file");
      }
    } finally {
      cleanup(file);
    }
  });

  it("dovrebbe eseguire query S-expression su file Ruby", async () => {
    const result = await queryFile({
      file: resolve(FIXTURES, "ruby/sample.rb"),
      query: `(class name: (constant) @class_name) @class_def`,
      language: "ruby",
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.matchCount).toBeGreaterThanOrEqual(1);
      expect(result.language).toBe("ruby");
    }
  });

  it("dovrebbe risolvere capture group name", async () => {
    const result = await queryFile({
      file: resolve(FIXTURES, "ruby/sample.rb"),
      query: "classes_and_modules",
      language: "ruby",
    });

    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.matchCount).toBeGreaterThanOrEqual(1);
    }
  });

  it("dovrebbe arricchire con doc comment quando enrich: true", async () => {
    const result = await queryFile({
      file: resolve(FIXTURES, "ruby/sample.rb"),
      query: "methods",
      language: "ruby",
      enrich: true,
    });

    expect("error" in result).toBe(false);
    if (!("error" in result) && result.enrichedMatches) {
      // Il metodo add ha un commento precedente
      const addMatch = result.enrichedMatches.find(
        (m) => typeof m.method_name === "object" && "text" in (m.method_name as any) && (m.method_name as any).text === "add"
      );
      expect(addMatch).toBeDefined();
      expect(addMatch!._doc).toBeDefined();
      expect(addMatch!._doc!.cleaned).toContain("Adds two numbers");
    }
  });

  it("dovrebbe rifiutare file troppo grandi con maxFileSize", async () => {
    const file = makeTempFile("# " + "x".repeat(500), "large.rb");
    try {
      const result = await queryFile({
        file,
        query: "classes_and_modules",
        language: "ruby",
        maxFileSize: 100,
      });

      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error).toBe("file_too_large");
      }
    } finally {
      cleanup(file);
    }
  });
});
