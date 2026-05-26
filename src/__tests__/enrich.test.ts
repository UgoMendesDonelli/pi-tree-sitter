/**
 * Tests for src/enrich.ts — enrichMatchesWithDoc.
 *
 * Verifies that documentation comments are correctly associated with
 * query matches, and that the function does NOT call parse() internally
 * (it receives rootNode as a parameter).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { initParser, getParser, parse, query } from "../parser";
import { LANGUAGES } from "../languages";
import { enrichMatchesWithDoc } from "../enrich";

let parserInitialized = false;

beforeAll(async () => {
  if (!parserInitialized) {
    await initParser();
    parserInitialized = true;
  }
}, 30_000);

describe("enrichMatchesWithDoc", () => {
  it("dovrebbe arricchire i match con i commenti precedenti", async () => {
    const source = `# Primo metodo
def foo; end
# Secondo metodo
def bar; end
# Terzo metodo
def baz; end`;

    const ruby = LANGUAGES["ruby"]!;
    const ctx = await getParser(ruby);
    const { rootNode } = parse(ctx.parser, source);
    const group = ruby.captureGroups.find((g) => g.name === "methods")!;
    const matches = query(ctx, source, group.query);

    const enriched = enrichMatchesWithDoc(matches, rootNode, ruby);

    expect(enriched.length).toBe(3);
    expect(enriched[0]!._doc).toBeDefined();
    expect(enriched[0]!._doc!.cleaned).toContain("Primo metodo");
    expect(enriched[1]!._doc!.cleaned).toContain("Secondo metodo");
    expect(enriched[2]!._doc!.cleaned).toContain("Terzo metodo");
  });

  it("non dovrebbe arricchire match senza commento precedente", async () => {
    const source = `def bare; end`;
    const ruby = LANGUAGES["ruby"]!;
    const ctx = await getParser(ruby);
    const { rootNode } = parse(ctx.parser, source);
    const group = ruby.captureGroups.find((g) => g.name === "methods")!;
    const matches = query(ctx, source, group.query);

    const enriched = enrichMatchesWithDoc(matches, rootNode, ruby);

    expect(enriched.length).toBe(1);
    expect(enriched[0]!._doc).toBeUndefined();
  });
});
