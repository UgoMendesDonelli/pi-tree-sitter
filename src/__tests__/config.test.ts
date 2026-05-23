/**
 * Tests for src/config.ts — resolveConfig.
 *
 * Pure function tests. Creates temporary directories to simulate
 * .tree-sitter.json files without modifying the real project.
 */

import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { resolveConfig, DEFAULTS } from "../config";

// ─── Helper: create a temp dir with optional .tree-sitter.json ──────

function createTempDir(): string {
  return mkdtempSync(resolve(tmpdir(), "pi-ts-test-"));
}

function writeConfig(dir: string, content: string): void {
  writeFileSync(resolve(dir, ".tree-sitter.json"), content, "utf-8");
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// ══════════════════════════════════════════════════════════════════════
// 6.1 Default senza file config
// ══════════════════════════════════════════════════════════════════════

describe("resolveConfig — defaults", () => {
  it("dovrebbe restituire i default senza file config", () => {
    const dir = createTempDir();
    try {
      const config = resolveConfig(dir);
      expect(config.excludeDirs).toEqual(DEFAULTS.excludeDirs);
      expect(config.maxFileSize).toBe(DEFAULTS.maxFileSize);
      expect(config.maxDepth).toBe(DEFAULTS.maxDepth);
    } finally {
      cleanup(dir);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6.2 Load e merge da file config
// ══════════════════════════════════════════════════════════════════════

describe("resolveConfig — file config", () => {
  it("dovrebbe caricare e mergiare excludeDirs dal file", () => {
    const dir = createTempDir();
    try {
      writeConfig(dir, JSON.stringify({
        excludeDirs: ["tmp", "coverage"],
        maxFileSize: 500000,
      }));

      const config = resolveConfig(dir);
      // I default devono essere presenti
      for (const d of DEFAULTS.excludeDirs) {
        expect(config.excludeDirs).toContain(d);
      }
      // I custom devono essere presenti
      expect(config.excludeDirs).toContain("tmp");
      expect(config.excludeDirs).toContain("coverage");
      // maxFileSize sovrascritto
      expect(config.maxFileSize).toBe(500000);
      // maxDepth rimasto default
      expect(config.maxDepth).toBe(DEFAULTS.maxDepth);
    } finally {
      cleanup(dir);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6.3 Override con priorità massima
// ══════════════════════════════════════════════════════════════════════

describe("resolveConfig — overrides", () => {
  it("le override dovrebbero avere priorità sul file config", () => {
    const dir = createTempDir();
    try {
      writeConfig(dir, JSON.stringify({
        maxFileSize: 500000,
        maxDepth: 3,
        excludeDirs: ["tmp"],
      }));

      const config = resolveConfig(dir, {
        maxFileSize: 999,
        maxDepth: 1,
        excludeDirs: ["override"],
      });

      // Override vince
      expect(config.maxFileSize).toBe(999);
      expect(config.maxDepth).toBe(1);
      // excludeDirs: merge di default + file + override
      expect(config.excludeDirs).toContain("tmp");
      expect(config.excludeDirs).toContain("override");
      for (const d of DEFAULTS.excludeDirs) {
        expect(config.excludeDirs).toContain(d);
      }
    } finally {
      cleanup(dir);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6.4 JSON invalido → default silenziosi
// ══════════════════════════════════════════════════════════════════════

describe("resolveConfig — JSON invalido", () => {
  it("dovrebbe restituire default su JSON malformato", () => {
    const dir = createTempDir();
    try {
      writeConfig(dir, "{ invalid json }");
      const config = resolveConfig(dir);
      expect(config.maxFileSize).toBe(DEFAULTS.maxFileSize);
      expect(config.maxDepth).toBe(DEFAULTS.maxDepth);
      expect(config.excludeDirs).toEqual(DEFAULTS.excludeDirs);
    } finally {
      cleanup(dir);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6.5 File config con solo alcuni campi
// ══════════════════════════════════════════════════════════════════════

describe("resolveConfig — campi parziali", () => {
  it("dovrebbe usare default per i campi non specificati", () => {
    const dir = createTempDir();
    try {
      writeConfig(dir, JSON.stringify({ maxFileSize: 100 }));
      const config = resolveConfig(dir);
      expect(config.maxFileSize).toBe(100);
      expect(config.maxDepth).toBe(DEFAULTS.maxDepth);
      expect(config.excludeDirs).toEqual(DEFAULTS.excludeDirs);
    } finally {
      cleanup(dir);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6.6 maxDepth: 0 significa unlimited
// ══════════════════════════════════════════════════════════════════════

describe("resolveConfig — maxDepth 0", () => {
  it("maxDepth = 0 dovrebbe rimanere 0 (unlimited)", () => {
    const dir = createTempDir();
    try {
      writeConfig(dir, JSON.stringify({ maxDepth: 0 }));
      const config = resolveConfig(dir);
      expect(config.maxDepth).toBe(0);
    } finally {
      cleanup(dir);
    }
  });
});
