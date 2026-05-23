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
  type CachedParser,
} from "./parser.ts";
import { resolveConfig } from "./config.ts";
import { processCaptureGroup as registryProcess } from "./handlers/registry.ts";
import type { HandlerContext } from "./handlers/types.ts";;

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
  /** Raw captures for groups without a dedicated handler */
  captures?: Record<string, Record<string, unknown>[]>;
}

export interface AnalyzeOptions {
  directory: string;
  language?: string;
  groups?: string[];
  maxFiles?: number;
  recursive?: boolean;
  /** Override directories to exclude (merged with .tree-sitter.json + defaults) */
  excludeDirs?: string[];
  /** Override max file size in bytes */
  maxFileSize?: number;
  /** Override max directory recursion depth (0 = unlimited) */
  maxDepth?: number;
}

// ─── File discovery ──────────────────────────────────────────────────

function findFiles(
  dir: string,
  extensions: string[],
  maxFiles: number,
  recursive: boolean,
  excludeDirs: string[],
  maxDepth: number,
): string[] {
  const results: string[] = [];
  const extSet = new Set(extensions);

  function walk(current: string, depth = 0): void {
    if (results.length >= maxFiles) return;
    try {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) return;

        const fullPath = path.join(current, entry.name);

        // Skip hidden directories
        if (entry.name.startsWith(".")) continue;
        // Skip configured exclude directories
        if (entry.isDirectory() && excludeDirs.includes(entry.name)) continue;

        if (entry.isDirectory() && recursive && (maxDepth === 0 || depth < maxDepth)) {
          walk(fullPath, depth + 1);
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

  // Load configuration from .tree-sitter.json + overrides
  const config = resolveConfig(opts.directory, {
    excludeDirs: opts.excludeDirs,
    maxFileSize: opts.maxFileSize,
    maxDepth: opts.maxDepth,
  });

  const result: AnalysisResult = {
    path: opts.directory,
    filesFound: 0,
    filesParsed: 0,
    errors: [],
    languages: {},
    functions: [],
    classes: [],
    imports: [],
    captures: {} as Record<string, Record<string, unknown>[]>,
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

  // Discover files with config
  const files = findFiles(
    opts.directory,
    extensions,
    maxFiles,
    recursive,
    config.excludeDirs,
    config.maxDepth,
  );
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
          if (source.length > config.maxFileSize) {
            result.errors.push(`${file}: file too large (${source.length} bytes, max ${config.maxFileSize}), skipping`);
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

      // Delegate to the handler registry instead of inline switch-case
      const ctx: HandlerContext = { result, file, rootNode, lang, parserCtx, group };
      registryProcess(group.name, caps, ctx);
    }
  } catch (err: any) {
    result.errors.push(
      `${file}: query error (${group.name}): ${err.message}`,
    );
  }
}
