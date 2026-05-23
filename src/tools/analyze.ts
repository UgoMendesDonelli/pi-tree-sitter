/**
 * Tool: tree_sitter_analyze
 *
 * Analyzes an entire directory of source code, returning structured
 * information about classes, functions, imports, and documentation.
 */

import { Type } from "typebox";
import { analyzeDirectory } from "../analyzer.ts";

/**
 * Tool definition for tree_sitter_analyze.
 * Pass this to pi.registerTool().
 */
export const analyzeTool = {
  name: "tree_sitter_analyze",
  label: "Analyze Directory",
  description:
    "Analyze a directory of source code using Tree-sitter. Returns structured information: classes, functions, imports, and documentation comments for all supported files. Use this for project-wide code understanding.",
  parameters: Type.Object({
    directory: Type.String({
      description: "Absolute path to the directory to analyze",
    }),
    language: Type.Optional(
      Type.String({
        description:
          "Filter by language ID (e.g. 'ruby', 'python'). If omitted, auto-detects from file extensions.",
      }),
    ),
    groups: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Capture groups to run (e.g. ['functions', 'classes', 'imports']). Default: all available for each language.",
      }),
    ),
    maxFiles: Type.Optional(
      Type.Number({
        description: "Maximum files to analyze (default: 200, safety limit)",
      }),
    ),
    excludeDirs: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Additional directories to exclude (merged with .tree-sitter.json + defaults like node_modules, dist, etc.)",
      }),
    ),
    maxFileSize: Type.Optional(
      Type.Number({
        description: "Maximum file size in bytes (default: 1000000)",
      }),
    ),
    maxDepth: Type.Optional(
      Type.Number({
        description: "Maximum directory recursion depth, 0 = unlimited (default: 0)",
      }),
    ),
  }),
  async execute(
    _toolCallId: string,
    params: {
      directory: string;
      language?: string;
      groups?: string[];
      maxFiles?: number;
      excludeDirs?: string[];
      maxFileSize?: number;
      maxDepth?: number;
    },
  ) {
    const result = await analyzeDirectory({
      directory: params.directory,
      language: params.language,
      groups: params.groups,
      maxFiles: params.maxFiles ?? 200,
      excludeDirs: params.excludeDirs,
      maxFileSize: params.maxFileSize,
      maxDepth: params.maxDepth,
    });

    const summary = {
      path: result.path,
      filesFound: result.filesFound,
      filesParsed: result.filesParsed,
      languages: result.languages,
      classCount: result.classes.length,
      functionCount: result.functions.length,
      importCount: result.imports.length,
      errorCount: result.errors.length,
    };

    const errors =
      result.errors.length > 50
        ? result.errors.slice(0, 50).concat([
            `... and ${result.errors.length - 50} more errors`,
          ])
        : result.errors;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              summary,
              classes: result.classes,
              functions: result.functions,
              imports: result.imports,
              errors,
            },
            null,
            2,
          ),
        },
      ],
      details: summary,
    };
  },
};
