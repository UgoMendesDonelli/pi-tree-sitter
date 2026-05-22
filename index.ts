/**
 * pi-tree-sitter — Pi Extension
 *
 * Gives the pi agent structural access to source code via Tree-sitter.
 * Registers tools for AST querying, directory analysis, and language
 * introspection.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { LANGUAGES } from "./src/languages.ts";
import { analyzeDirectory } from "./src/analyzer.ts";
import { getParser, parse, query, stripCommentSyntax, getPrecedingComment, initParser } from "./src/parser.ts";

export default function treeSitterExtension(pi: ExtensionAPI) {
  // ── Tool: tree_sitter_languages ──────────────────────────────────

  pi.registerTool({
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
        content: [
          {
            type: "text",
            text: JSON.stringify(langs, null, 2),
          },
        ],
        details: { languageCount: langs.length },
      };
    },
  });

  // ── Tool: tree_sitter_query ──────────────────────────────────────

  pi.registerTool({
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
    async execute(_toolCallId, params) {
      const { file, language, query: queryOrGroup } = params;

      const lang = LANGUAGES[language];
      if (!lang) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown language: "${language}". Use tree_sitter_languages to see supported languages.`,
            },
          ],
          details: { error: "unknown_language" },
        };
      }

      // Load source
      let source: string;
      try {
        const fs = await import("node:fs");
        source = fs.readFileSync(file, "utf-8");
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to read file: ${err.message}`,
            },
          ],
          details: { error: "read_error", message: err.message },
        };
      }

      if (source.trim().length === 0) {
        return {
          content: [{ type: "text", text: "File is empty." }],
          details: { file },
        };
      }

      // Get parser
      let parserCtx;
      try {
        parserCtx = await getParser(lang);
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to load parser for ${language}: ${err.message}`,
            },
          ],
          details: { error: "parser_load_error", message: err.message },
        };
      }

      // Resolve query: check if it's a capture group name
      let queryStr = queryOrGroup;
      const group = lang.captureGroups.find((g) => g.name === queryOrGroup);
      if (group) {
        queryStr = group.query;
        // If using a group that captures doc, include preceding comments
        if (group.capturesDoc) {
          // We'll mark that doc should be extracted
        }
      }

      // Run query
      try {
        let matches;
        try {
          matches = query(parserCtx, source, queryStr);
        } catch (queryErr: any) {
          return {
            content: [{
              type: "text",
              text: `Query execution error for ${language}: ${queryErr.message}. Source length: ${source.length}`,
            }],
            details: { error: "query_exec_error", message: queryErr.message },
          };
        }

        // Enrich with doc comments if using a doc-capturing group
        const enrichedMatches = matches.map((match) => {
          if (group?.capturesDoc) {
            try {
              const { rootNode } = parse(parserCtx.parser, source);
              const mainCapture = Object.values(match).find(
                (v) => typeof v === "object" && "startRow" in v,
              ) as any;
              if (mainCapture) {
                const node = findNodeAtPosition(
                  rootNode,
                  mainCapture.startRow,
                  mainCapture.startCol,
                );
                if (node) {
                  const comment = getPrecedingComment(rootNode, node);
                  if (comment) {
                    match._doc = {
                      raw: comment,
                      cleaned: stripCommentSyntax(comment, lang),
                    };
                  }
                }
              }
            } catch {
              // getPrecedingComment may fail; skip enrichment
            }
          }
          return match;
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file,
                  language,
                  query: queryOrGroup,
                  matchCount: enrichedMatches.length,
                  matches: enrichedMatches,
                },
                null,
                2,
              ),
            },
          ],
          details: { matchCount: enrichedMatches.length },
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Query error: ${err.message}`,
            },
          ],
          details: { error: "query_error", message: err.message },
        };
      }
    },
  });

  // ── Tool: tree_sitter_analyze ────────────────────────────────────

  pi.registerTool({
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
    }),
    async execute(_toolCallId, params) {
      const result = await analyzeDirectory({
        directory: params.directory,
        language: params.language,
        groups: params.groups,
        maxFiles: params.maxFiles ?? 200,
      });

      // Build a compact summary for the LLM
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

      // Truncate error list if too long
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
  });

  // ── Tool: tree_sitter_capture ────────────────────────────────────

  pi.registerTool({
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
    }),
    async execute(_toolCallId, params) {
      const fs = await import("node:fs");
      const pathMod = await import("node:path");

      const targetPath = params.path;
      const captureGroupName = params.captureGroup;
      const maxFiles = params.maxFiles ?? 200;

      // Determine if file or directory
      let stat;
      try {
        stat = fs.statSync(targetPath);
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Path not found: ${err.message}` },
          ],
          details: { error: "path_not_found" },
        };
      }

      if (stat.isDirectory()) {
        // Use analyzeDirectory with the specific group
        const result = await analyzeDirectory({
          directory: targetPath,
          language: params.language,
          groups: [captureGroupName],
          maxFiles,
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
        // Single file
        const ext = targetPath.split(".").pop()?.toLowerCase();
        let langId = params.language;
        if (!langId) {
          for (const [id, lang] of Object.entries(LANGUAGES)) {
            if (lang.extensions.includes(ext || "")) {
              langId = id;
              break;
            }
          }
        }

        if (!langId || !LANGUAGES[langId]) {
          return {
            content: [
              {
                type: "text",
                text: `Could not determine language for file "${targetPath}". Specify the language parameter.`,
              },
            ],
            details: { error: "unknown_language" },
          };
        }

        const lang = LANGUAGES[langId];
        const group = lang.captureGroups.find(
          (g) => g.name === captureGroupName,
        );
        if (!group) {
          return {
            content: [
              {
                type: "text",
                text: `Capture group "${captureGroupName}" not available for ${langId}. Available: ${lang.captureGroups.map((g) => g.name).join(", ")}`,
              },
            ],
            details: { error: "unknown_capture_group" },
          };
        }

        // Delegate to tree_sitter_query logic (inline for simplicity)
        let source;
        try {
          source = fs.readFileSync(targetPath, "utf-8");
        } catch (err: any) {
          return {
            content: [
              { type: "text", text: `Failed to read file: ${err.message}` },
            ],
            details: { error: "read_error" },
          };
        }

        const parserCtx = await getParser(lang);
        const matches = query(parserCtx, source, group.query);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  file: targetPath,
                  language: langId,
                  captureGroup: captureGroupName,
                  matchCount: matches.length,
                  matches,
                },
                null,
                2,
              ),
            },
          ],
          details: { matchCount: matches.length },
        };
      }
    },
  });
}

// ── Helper: find a syntax node at a given position ───────────────────

function findNodeAtPosition(
  node: any,
  row: number,
  col: number,
): any {
  if (
    node.startPosition.row === row &&
    node.startPosition.column === col
  ) {
    return node;
  }
  for (const child of node.namedChildren || []) {
    const found = findNodeAtPosition(child, row, col);
    if (found) return found;
  }
  return null;
}
