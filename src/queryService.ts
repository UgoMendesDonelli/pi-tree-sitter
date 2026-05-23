/**
 * Centralized query service for pi-tree-sitter.
 *
 * Unifies the "read file → detect language → get parser → run query" pattern
 * that was previously duplicated across tree_sitter_query, tree_sitter_capture
 * (single-file case), and partially in analyzer.ts.
 *
 * All tool handlers should delegate to this service instead of reimplementing
 * the logic inline.
 */

import { readFileSync, statSync } from "node:fs";
import { getParser, parse, queryNode, type MatchRecord } from "./parser.ts";
import { LANGUAGES, getLanguageForFile, type LanguageConfig } from "./languages.ts";
import { enrichMatchesWithDoc, type EnrichedMatch } from "./enrich.ts";

// ─── Types ───────────────────────────────────────────────────────────

export interface QueryFileOptions {
  /** Absolute path to the file */
  file: string;
  /** Query string or capture group name */
  query: string;
  /** Language ID (auto-detected from extension if omitted) */
  language?: string;
  /** Enrich matches with doc comments? (default: false) */
  enrich?: boolean;
  /** Maximum file size in bytes (default: no limit). Set to 0 for unlimited. */
  maxFileSize?: number;
}

export interface QueryFileResult {
  file: string;
  language: string;
  matchCount: number;
  matches: MatchRecord[];
  enrichedMatches?: EnrichedMatch[];
}

export interface QueryFileError {
  error: string;
  message: string;
  file?: string;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Query a single file with Tree-sitter.
 *
 * Handles: file reading, language detection, parser loading,
 * query execution (via capture group name or raw S-expression),
 * and optional doc comment enrichment.
 *
 * **Parse is called exactly once** — the same rootNode is reused for
 * both query execution and doc enrichment.
 *
 * @returns result on success, error object on failure (never throws)
 */
export async function queryFile(
  opts: QueryFileOptions,
): Promise<QueryFileResult | QueryFileError> {
  const { file, query: queryOrGroup } = opts;

  // Check file size (optional limit)
  if (opts.maxFileSize && opts.maxFileSize > 0) {
    try {
      const stat = statSync(file);
      if (stat.size > opts.maxFileSize) {
        return {
          error: "file_too_large",
          message: `File too large (${stat.size} bytes, max ${opts.maxFileSize}). Use tree_sitter_analyze instead.`,
        };
      }
    } catch (err: unknown) {
      return { error: "read_error", message: (err as Error).message };
    }
  }

  // Load source
  let source: string;
  try {
    source = readFileSync(file, "utf-8");
  } catch (err: unknown) {
    return { error: "read_error", message: (err as Error).message };
  }

  if (source.trim().length === 0) {
    return { error: "empty_file", message: "File is empty." };
  }

  // Determine language
  const lang = resolveLanguage(opts.language, file);
  if (!lang) {
    return {
      error: "unknown_language",
      message: opts.language
        ? `Unknown language: "${opts.language}". Use tree_sitter_languages to see supported languages.`
        : `Could not determine language for file "${file}". Specify the language parameter.`,
    };
  }

  // Get parser
  let parserCtx;
  try {
    parserCtx = await getParser(lang);
  } catch (err: unknown) {
    return {
      error: "parser_load_error",
      message: `Failed to load parser for ${lang.id}: ${(err as Error).message}`,
    };
  }

  // Resolve query: check if it's a capture group name
  let queryStr = queryOrGroup;
  const group = lang.captureGroups.find((g) => g.name === queryOrGroup);
  if (group) {
    queryStr = group.query;
  }

  // Parse ONCE — rootNode reused for both query and enrichment
  let rootNode;
  try {
    rootNode = parse(parserCtx.parser, source).rootNode;
  } catch (err: unknown) {
    return {
      error: "parse_error",
      message: `Failed to parse ${file}: ${(err as Error).message}`,
    };
  }

  // Run query against the already-parsed rootNode (no re-parse)
  let matches: MatchRecord[];
  try {
    matches = queryNode(parserCtx, rootNode, queryStr);
  } catch (err: unknown) {
    return {
      error: "query_exec_error",
      message: `Query execution error for ${lang.id}: ${(err as Error).message}. Source length: ${source.length}`,
    };
  }

  // Optional enrichment with doc comments — same rootNode, no re-parse
  if (group?.capturesDoc && opts.enrich) {
    const enrichedMatches = enrichMatchesWithDoc(matches, rootNode, lang);
    return {
      file,
      language: lang.id,
      matchCount: enrichedMatches.length,
      matches,
      enrichedMatches,
    };
  }

  return {
    file,
    language: lang.id,
    matchCount: matches.length,
    matches,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Resolve language config: explicit language ID or auto-detect from extension.
 */
function resolveLanguage(
  langId: string | undefined,
  filePath: string,
): LanguageConfig | undefined {
  if (langId) {
    return LANGUAGES[langId];
  }
  return getLanguageForFile(filePath);
}
