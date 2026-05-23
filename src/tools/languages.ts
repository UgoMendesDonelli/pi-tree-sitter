/**
 * Tool: tree_sitter_languages
 *
 * Lists all supported languages and their available capture groups.
 */

import { Type } from "typebox";
import { LANGUAGES } from "../languages.ts";

/**
 * Tool definition for tree_sitter_languages.
 * Pass this to pi.registerTool().
 */
export const languagesTool = {
  name: "tree_sitter_languages",
  label: "List Tree-sitter Languages",
  description:
    "List all programming languages supported by Tree-sitter and their available capture groups (pre-built query patterns like functions, classes, imports, comments). Use this first to discover what queries are available.",
  parameters: Type.Object({}),
  async execute() {
    const langs = Object.entries(LANGUAGES).map(([id, lang]) => ({
      id,
      label: lang.label,
      extensions: lang.extensions,
      captureGroups: lang.captureGroups.map((g) => ({
        name: g.name,
        description: g.description,
        capturesDoc: g.capturesDoc || false,
      })),
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(langs, null, 2) }],
      details: { languageCount: langs.length },
    };
  },
};
