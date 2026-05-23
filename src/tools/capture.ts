/**
 * Tool: tree_sitter_capture
 *
 * Captures specific node types using pre-built capture groups.
 * Works on both files and directories.
 */

import { Type } from "typebox";
import { statSync } from "node:fs";
import { queryFile } from "../queryService.ts";
import { analyzeDirectory } from "../analyzer.ts";

/**
 * Tool definition for tree_sitter_capture.
 * Pass this to pi.registerTool().
 */
export const captureTool = {
  name: "tree_sitter_capture",
  label: "Capture Nodes",
  description:
    "Capture specific node types across an entire directory or a single file using pre-built capture groups. Simpler than writing raw S-expression queries — just specify the group name (e.g. 'functions', 'classes', 'comments').",
  parameters: Type.Object({
    path: Type.String({
      description: "Absolute path to a file or directory",
    }),
    captureGroup: Type.String({
      description:
        "Capture group name (e.g. 'functions', 'classes', 'comments', 'imports'). Run tree_sitter_languages to see all available groups.",
    }),
    language: Type.Optional(
      Type.String({
        description:
          "Language ID. If omitted when targeting a file, auto-detects from extension.",
      }),
    ),
    maxFiles: Type.Optional(
      Type.Number({
        description: "Max files when targeting a directory (default: 200)",
      }),
    ),
    excludeDirs: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Additional directories to exclude (merged with .tree-sitter.json + defaults)",
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
      path: string;
      captureGroup: string;
      language?: string;
      maxFiles?: number;
      excludeDirs?: string[];
      maxFileSize?: number;
      maxDepth?: number;
    },
  ) {
    const targetPath = params.path;
    const captureGroupName = params.captureGroup;
    const maxFiles = params.maxFiles ?? 200;

    // Determine if file or directory
    let stat;
    try {
      stat = statSync(targetPath);
    } catch (err: unknown) {
      return {
        content: [{ type: "text", text: `Path not found: ${(err as Error).message}` }],
        details: { error: "path_not_found" },
      };
    }

    if (stat.isDirectory()) {
      // Directory mode: delegate to analyzeDirectory
      const result = await analyzeDirectory({
        directory: targetPath,
        language: params.language,
        groups: [captureGroupName],
        maxFiles,
        excludeDirs: params.excludeDirs,
        maxFileSize: params.maxFileSize,
        maxDepth: params.maxDepth,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                path: targetPath,
                captureGroup: captureGroupName,
                filesParsed: result.filesParsed,
                languages: result.languages,
                classes: result.classes,
                functions: result.functions,
                imports: result.imports,
                errors: result.errors.slice(0, 20),
              },
              null,
              2,
            ),
          },
        ],
        details: {
          filesParsed: result.filesParsed,
          classCount: result.classes.length,
          functionCount: result.functions.length,
        },
      };
    } else {
      // Single file mode: delegate to queryFile
      const result = await queryFile({
        file: targetPath,
        query: captureGroupName,
        language: params.language,
      });

      if ("error" in result) {
        return {
          content: [{ type: "text", text: result.message }],
          details: { error: result.error },
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                file: targetPath,
                language: result.language,
                captureGroup: captureGroupName,
                matchCount: result.matchCount,
                matches: result.matches,
              },
              null,
              2,
            ),
          },
        ],
        details: { matchCount: result.matchCount },
      };
    }
  },
};
