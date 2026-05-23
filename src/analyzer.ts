/**
 * Directory-level code analysis.
 *
 * Walks a directory tree, parses files with Tree-sitter,
 * and returns structured information about functions, classes,
 * imports, and documentation comments.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Query, type Node } from "web-tree-sitter";
import {
  getLanguageForFile,
  type LanguageConfig,
  type CaptureGroup,
} from "./languages.ts";
import {
  getParser,
  parse,
  getPrecedingComment,
  stripCommentSyntax,
  type CachedParser,
} from "./parser.ts";

// ─── Types ───────────────────────────────────────────────────────────

export interface Location {
  file: string;
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export interface DocComment {
  text: string;
  cleaned: string;
  location?: Location;
}

export interface FunctionInfo {
  name: string;
  location: Location;
  params?: string;
  doc?: DocComment;
}

export interface ClassInfo {
  name: string;
  location: Location;
  superclass?: string;
  methods: FunctionInfo[];
  doc?: DocComment;
}

export interface ImportInfo {
  type: "require" | "import" | "include";
  path: string;
  location: Location;
}

export interface AnalysisResult {
  path: string;
  filesFound: number;
  filesParsed: number;
  errors: string[];
  languages: Record<string, number>;
  functions: FunctionInfo[];
  classes: ClassInfo[];
  imports: ImportInfo[];
  captures?: Record<string, unknown>;
}

export interface AnalyzeOptions {
  directory: string;
  language?: string;
  groups?: string[];
  maxFiles?: number;
  recursive?: boolean;
}

// ─── File discovery ──────────────────────────────────────────────────

function findFiles(
  dir: string,
  extensions: string[],
  maxFiles: number,
  recursive: boolean,
): string[] {
  const results: string[] = [];
  const extSet = new Set(extensions);

  function walk(current: string): void {
    if (results.length >= maxFiles) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) return;

        const fullPath = path.join(current, entry.name);

        // Skip hidden and common non-source directories
        if (entry.name.startsWith(".")) continue;
        if (
          entry.isDirectory() &&
          ["node_modules", "vendor", "dist", "build", "__pycache__", "target"].includes(
            entry.name,
          )
        )
          continue;

        if (entry.isDirectory() && recursive) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = entry.name.split(".").pop()?.toLowerCase();
          if (ext && extSet.has(ext)) {
            results.push(fullPath);
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(dir);
  return results;
}

// ─── Main analysis ───────────────────────────────────────────────────

export async function analyzeDirectory(
  opts: AnalyzeOptions,
): Promise<AnalysisResult> {
  const maxFiles = opts.maxFiles ?? 200;
  const recursive = opts.recursive ?? true;

  const result: AnalysisResult = {
    path: opts.directory,
    filesFound: 0,
    filesParsed: 0,
    errors: [],
    languages: {},
    functions: [],
    classes: [],
    imports: [],
    captures: {},
  };

  // Determine which extensions to look for
  let extensions: string[];
  let langOverride: LanguageConfig | undefined;

  if (opts.language) {
    const { LANGUAGES } = await import("./languages.ts");
    const lang = Object.values(LANGUAGES).find((l) => l.id === opts.language);
    if (!lang) {
      result.errors.push(`Unknown language: ${opts.language}`);
      return result;
    }
    langOverride = lang;
    extensions = lang.extensions;
  } else {
    const { getAllExtensions } = await import("./languages.ts");
    extensions = getAllExtensions();
  }

  // Discover files
  const files = findFiles(opts.directory, extensions, maxFiles, recursive);
  result.filesFound = files.length;

  // Group files by language
  const filesByLang = new Map<LanguageConfig, string[]>();
  for (const file of files) {
    const lang = langOverride ?? getLanguageForFile(file);
    if (!lang) continue;

    const group = filesByLang.get(lang);
    if (group) {
      group.push(file);
    } else {
      filesByLang.set(lang, [file]);
    }
  }

  // Analyze each language group
  for (const [lang, langFiles] of filesByLang) {
    result.languages[lang.id] = langFiles.length;

    try {
      const parserCtx = await getParser(lang);

      // Determine which capture groups to use
      let groups = lang.captureGroups;
      if (opts.groups) {
        groups = groups.filter((g) => opts.groups!.includes(g.name));
      }

      for (const file of langFiles) {
        try {
          const source = fs.readFileSync(file, "utf-8");

          // Skip empty / very large files
          if (source.trim().length === 0) continue;
          if (source.length > 1_000_000) {
            result.errors.push(`${file}: file too large (${source.length} bytes), skipping`);
            continue;
          }

          // Parse step
          let rootNode: Node;
          try {
            rootNode = parse(parserCtx.parser, source).rootNode;
          } catch (parseErr: any) {
            result.errors.push(`${file}: parse failed: ${parseErr.message} (source size: ${source.length}, lang: ${lang.id})`);
            continue;
          }
          result.filesParsed++;

          // Run each capture group
          for (const group of groups) {
            try {
              processCaptureGroup(
                result,
                parserCtx,
                lang,
                file,
                source,
                rootNode,
                group,
              );
            } catch (groupErr: any) {
              result.errors.push(`${file}: query error (${group.name}): ${groupErr.message}`);
            }
          }
        } catch (err: any) {
          result.errors.push(`${file}: read error: ${err.message}`);
        }
      }
    } catch (err: any) {
      result.errors.push(
        `Failed to load parser for ${lang.id}: ${err.message}`,
      );
    }
  }

  return result;
}

// ─── Capture group processing ────────────────────────────────────────

function processCaptureGroup(
  result: AnalysisResult,
  parserCtx: CachedParser,
  lang: LanguageConfig,
  file: string,
  _source: string,
  rootNode: Node,
  group: CaptureGroup,
): void {
  try {
    const q = new Query(parserCtx.language, group.query);
    const matches = q.matches(rootNode);

    for (const match of matches) {
      const caps: Record<string, Node> = {};
      for (const cap of match.captures) {
        caps[cap.name] = cap.node;
      }

      const loc = (node: Node): Location => ({
        file,
        startRow: node.startPosition.row,
        startCol: node.startPosition.column,
        endRow: node.endPosition.row,
        endCol: node.endPosition.column,
      });

      switch (group.name) {
        case "classes_and_modules":
        case "classes": {
          const node = caps["class_def"] || caps["module_def"];
          if (!node) continue;
          const nameNode = caps["class_name"] || caps["module_name"];
          if (!nameNode) continue;

          const className = nameNode.text;
          const superclass = caps["superclass"]?.text;

          let doc: DocComment | undefined;
          if (group.capturesDoc) {
            try {
              const commentText = getPrecedingComment(rootNode, node);
              if (commentText) {
                doc = {
                  text: commentText,
                  cleaned: stripCommentSyntax(commentText, lang),
                };
              }
            } catch {
              // getPrecedingComment may fail on some files; skip
            }
          }

          result.classes.push({
            name: className,
            location: loc(node),
            superclass,
            methods: [],
            doc,
          });
          break;
        }

        case "methods":
        case "functions": {
          const node = caps["method_def"] || caps["func_def"] || caps["singleton_method_def"];
          if (!node) continue;
          const nameNode =
            caps["method_name"] ||
            caps["func_name"] ||
            caps["singleton_method_name"];
          if (!nameNode) continue;

          const funcName = nameNode.text;
          const params = caps["params"]?.text;

          let doc: DocComment | undefined;
          if (group.capturesDoc) {
            try {
              const commentText = getPrecedingComment(rootNode, node);
              if (commentText) {
                doc = {
                  text: commentText,
                  cleaned: stripCommentSyntax(commentText, lang),
                };
              }
            } catch {
              // getPrecedingComment may fail on some files; skip
            }
          }

          const funcInfo: FunctionInfo = {
            name: funcName,
            location: loc(node),
            params,
            doc,
          };

          // Try to determine parent class from node ancestry
          // and assign method to its class
          let assignedToClass = false;
          if (result.classes.length > 0) {
            for (let i = result.classes.length - 1; i >= 0; i--) {
              const cls = result.classes[i]!;
              // Method belongs to class if it's inside the class's row range
              if (
                cls.location.file === file &&
                cls.location.startRow <= node.startPosition.row &&
                node.startPosition.row <= cls.location.endRow
              ) {
                cls.methods.push(funcInfo);
                assignedToClass = true;
                break;
              }
            }
          }

          // If not assigned to a class, it's a top-level function
          if (!assignedToClass) {
            result.functions.push(funcInfo);
          }
          break;
        }

        case "requires":
        case "imports":
        case "includes": {
          const pathNode = caps["req_path"];
          if (pathNode) {
            result.imports.push({
              type: "require",
              path: pathNode.text,
              location: loc(pathNode),
            });
          }
          const importNode = caps["import"] || caps["import_from"];
          if (importNode) {
            result.imports.push({
              type: "import",
              path: importNode.text,
              location: loc(importNode),
            });
          }
          const includeNode = caps["include"];
          if (includeNode) {
            result.imports.push({
              type: "include",
              path: includeNode.text,
              location: loc(includeNode),
            });
          }
          break;
        }
      }
    }
  } catch (err: any) {
    result.errors.push(
      `${file}: query error (${group.name}): ${err.message}`,
    );
  }
}
