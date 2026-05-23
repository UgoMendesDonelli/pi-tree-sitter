/**
 * Tool: tree_sitter_query
 *
 * Runs a Tree-sitter S-expression query on a single file.
 * Supports capture group names (e.g. 'classes', 'functions') or raw queries.
 */

import { Type } from "typebox";
import { queryFile } from "../queryService.ts";

/**
 * Tool definition for tree_sitter_query.
 * Pass this to pi.registerTool().
 */
export const queryTool = {
  name: "tree_sitter_query",
  label: "Tree-Sitter Query",
  description:
    "Run a Tree-sitter S-expression query on a specific file. Returns structured captures with positions. Use for targeted analysis of a single file. You can also use one of the pre-built capture group names (run tree_sitter_languages to see available groups per language).",
  parameters: Type.Object({
    file: Type.String({ description: "Absolute path to the file to query" }),
    language: Type.String({
      description: "Language ID (e.g. ruby, python, javascript, typescript)",
    }),
    query: Type.String({
      description:
        "Tree-sitter S-expression query string, OR a capture group name (e.g. 'functions', 'classes', 'comments')",
    }),
  }),
  async execute(_toolCallId: string, params: { file: string; language: string; query: string }) {
    const result = await queryFile({
      file: params.file,
      language: params.language,
      query: params.query,
      enrich: true, // enrich with doc comments when using a doc-capturing group
    });

    if ("error" in result) {
      return {
        content: [{ type: "text", text: result.message }],
        details: { error: result.error },
      };
    }

    const response = result.enrichedMatches
      ? {
          file: result.file,
          language: result.language,
          query: params.query,
          matchCount: result.matchCount,
          matches: result.enrichedMatches,
        }
      : {
          file: result.file,
          language: result.language,
          query: params.query,
          matchCount: result.matchCount,
          matches: result.matches,
        };

    return {
      content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      details: { matchCount: result.matchCount },
    };
  },
};
