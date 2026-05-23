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

import { readFileSync } from "node:fs";
import { getParser, parse, query, type MatchRecord } from "./parser.ts";
import { LANGUAGES, getLanguageForFile, type LanguageConfig, type CaptureGroup } from "./languages.ts";
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
 * @returns result on success, error object on failure (never throws)
 */
export async function queryFile(
  opts: QueryFileOptions,
): Promise<QueryFileResult | QueryFileError> {
  const { file, query: queryOrGroup } = opts;

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

  // Run query
  let matches: MatchRecord[];
  try {
    matches = query(parserCtx, source, queryStr);
  } catch (err: unknown) {
    return {
      error: "query_exec_error",
      message: `Query execution error for ${lang.id}: ${(err as Error).message}. Source length: ${source.length}`,
    };
  }

  // Optional enrichment with doc comments
  if (group?.capturesDoc && opts.enrich) {
    const { rootNode } = parse(parserCtx.parser, source);
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
