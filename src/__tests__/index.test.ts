/**
 * Tests for index.ts — tool registration and TypeBox schema validation.
 *
 * These tests verify that the TypeBox schemas for each tool parameter
 * accept/reject values correctly.
 */

import { describe, it, expect } from "vitest";
import { Type, type TSchema } from "typebox";
import { Value } from "typebox/value";

// We test the schemas directly by recreating them inline (same as in index.ts).
// This avoids importing the extension which requires a pi runtime.
//
// If the schemas in index.ts change, these tests must be updated.

// ─── Schema definitions (mirrored from index.ts) ─────────────────────

const languagesSchema = Type.Object({});

const querySchema = Type.Object({
  file: Type.String({ description: "Absolute path to the file to query" }),
  language: Type.String({ description: "Language ID (e.g. ruby, python, javascript, typescript)" }),
  query: Type.String({ description: "Tree-sitter S-expression query string, OR a capture group name" }),
});

const analyzeSchema = Type.Object({
  directory: Type.String({ description: "Absolute path to the directory to analyze" }),
  language: Type.Optional(Type.String({ description: "Filter by language ID" })),
  groups: Type.Optional(Type.Array(Type.String(), { description: "Capture groups to run" })),
  maxFiles: Type.Optional(Type.Number({ description: "Maximum files to analyze" })),
});

const captureSchema = Type.Object({
  path: Type.String({ description: "Absolute path to a file or directory" }),
  captureGroup: Type.String({ description: "Capture group name (e.g. 'functions', 'classes')" }),
  language: Type.Optional(Type.String({ description: "Language ID" })),
  maxFiles: Type.Optional(Type.Number({ description: "Max files when targeting a directory" })),
});

// ─── Validation helper ───────────────────────────────────────────────

function validate(schema: TSchema, data: unknown): { ok: boolean; errors?: string } {
  const result = Value.Check(schema, data);
  if (result) return { ok: true };
  // Collect first error
  const errors = [...Value.Errors(schema, data)];
  return { ok: false, errors: errors.map((e: any) => `${e.instancePath || e.schemaPath}: ${e.message}`).join("; ") };
}

// ══════════════════════════════════════════════════════════════════════
// 4.1 tree_sitter_languages
// ══════════════════════════════════════════════════════════════════════

describe("tree_sitter_languages schema", () => {
  it("dovrebbe accettare parametri vuoti", () => {
    const result = validate(languagesSchema, {});
    expect(result.ok).toBe(true);
  });

  it("dovrebbe accettare parametri extra (ignorati)", () => {
    const result = validate(languagesSchema, { extra: "field" });
    expect(result.ok).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4.2 tree_sitter_query
// ══════════════════════════════════════════════════════════════════════

describe("tree_sitter_query schema", () => {
  it("dovrebbe accettare parametri validi", () => {
    const result = validate(querySchema, {
      file: "/path/to/file.rb",
      language: "ruby",
      query: "classes",
    });
    expect(result.ok).toBe(true);
  });

  it("dovrebbe rifiutare parametri mancanti (senza file)", () => {
    const result = validate(querySchema, {
      language: "ruby",
      query: "classes",
    });
    expect(result.ok).toBe(false);
  });

  it("dovrebbe rifiutare tipi sbagliati (file come numero)", () => {
    const result = validate(querySchema, {
      file: 123,
      language: "ruby",
      query: "classes",
    });
    expect(result.ok).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4.3 tree_sitter_analyze
// ══════════════════════════════════════════════════════════════════════

describe("tree_sitter_analyze schema", () => {
  it("dovrebbe accettare solo directory obbligatorio", () => {
    const result = validate(analyzeSchema, { directory: "/path" });
    expect(result.ok).toBe(true);
  });

  it("dovrebbe accettare tutti i parametri", () => {
    const result = validate(analyzeSchema, {
      directory: "/path",
      language: "ruby",
      groups: ["classes", "methods"],
      maxFiles: 50,
    });
    expect(result.ok).toBe(true);
  });

  it("dovrebbe rifiutare parametri vuoti (senza directory)", () => {
    const result = validate(analyzeSchema, {});
    expect(result.ok).toBe(false);
  });

  it("dovrebbe rifiutare maxFiles con tipo sbagliato (stringa)", () => {
    const result = validate(analyzeSchema, {
      directory: "/path",
      maxFiles: "abc",
    });
    expect(result.ok).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4.4 tree_sitter_capture
// ══════════════════════════════════════════════════════════════════════

describe("tree_sitter_capture schema", () => {
  it("dovrebbe accettare path e captureGroup obbligatori", () => {
    const result = validate(captureSchema, {
      path: "/dir",
      captureGroup: "functions",
    });
    expect(result.ok).toBe(true);
  });

  it("dovrebbe rifiutare senza path", () => {
    const result = validate(captureSchema, { captureGroup: "functions" });
    expect(result.ok).toBe(false);
  });

  it("dovrebbe rifiutare senza captureGroup", () => {
    const result = validate(captureSchema, { path: "/dir" });
    expect(result.ok).toBe(false);
  });
});
