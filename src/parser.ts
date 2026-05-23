/**
 * Tree-sitter parser manager using web-tree-sitter (WASM).
 *
 * Maintains one Parser instance per language with cached
 * Language objects loaded from WASM files.
 */

import { Parser, Language, Query } from "web-tree-sitter";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { LanguageConfig } from "./languages.ts";

const __dirname = new URL(".", import.meta.url).pathname;
const rootDir = resolve(__dirname, "..");

interface CachedParser {
  parser: Parser;
  language: Language;
}

interface ParseResult {
  tree: any; // Parser.Tree
  rootNode: any; // Parser.SyntaxNode
}

// ─── Parser cache ────────────────────────────────────────────────────

const parserCache = new Map<string, CachedParser>();
let parserInitialized = false;

/**
 * Initialize web-tree-sitter (call once).
 */
export async function initParser(): Promise<void> {
  if (parserInitialized) return;
  await Parser.init();
  parserInitialized = true;
}

/**
 * Get or create a parser for the given language.
 * Loads the WASM grammar on first use.
 */
export async function getParser(
  lang: LanguageConfig,
): Promise<CachedParser> {
  const cached = parserCache.get(lang.id);
  if (cached) return cached;

  await initParser();

  const wasmPath = resolve(rootDir, lang.wasmPath);
  const wasmBytes = readFileSync(wasmPath);
  const language = await Language.load(wasmBytes);

  const parser = new Parser();
  parser.setLanguage(language);

  const entry: CachedParser = { parser, language };
  parserCache.set(lang.id, entry);
  return entry;
}

/**
 * Parse source code and return tree.
 */
export function parse(
  parser: Parser,
  source: string,
): ParseResult {
  const tree = parser.parse(source);
  return {
    tree,
    rootNode: tree.rootNode,
  };
}

/**
 * Parse source and return a structured capture using a query.
 */
export function query(
  parserCtx: CachedParser,
  source: string,
  queryStr: string,
): Array<Record<string, { text: string; startRow: number; startCol: number; endRow: number; endCol: number }>> {
  const { rootNode } = parse(parserCtx.parser, source);
  const q = new Query(parserCtx.language, queryStr);
  const matches = q.matches(rootNode);

  return matches.map((match) => {
    const captures: Record<string, any> = {};
    for (const cap of match.captures) {
      const name = cap.name;
      if (captures[name]) {
        if (!Array.isArray(captures[name])) {
          captures[name] = [captures[name]];
        }
        captures[name].push(nodeInfo(cap.node));
      } else {
        captures[name] = nodeInfo(cap.node);
      }
    }
    return captures;
  });
}

/**
 * Extract node metadata for JSON output.
 */
function nodeInfo(node: any) {
  return {
    text: node.text,
    startRow: node.startPosition.row,
    startCol: node.startPosition.column,
    endRow: node.endPosition.row,
    endCol: node.endPosition.column,
  };
}

/**
 * Get the comment text that immediately precedes a node (same or previous line).
 * Used to associate docstrings with definitions.
 */
export function getPrecedingComment(
  rootNode: any,
  targetNode: any,
): string | undefined {
  const targetStart = targetNode.startPosition;
  const comments: Array<{ row: number; text: string }> = [];

  collectComments(rootNode, comments);

  // Walk backwards from the target row, collecting all consecutive comment
  // lines. Stop at the first non-comment row (skip empty/whitespace lines).
  const adjacentComments: Array<{ row: number; text: string }> = [];
  const sorted = comments
    .filter((c) => c.row <= targetStart.row)
    .sort((a, b) => b.row - a.row); // descending by row

  if (sorted.length === 0) return undefined;

  // Collect consecutive comments walking upwards from target
  let expectedRow = targetStart.row - 1;
  for (const c of sorted) {
    if (c.row === expectedRow || c.row === targetStart.row) {
      adjacentComments.unshift(c);
      expectedRow = c.row - 1;
    } else if (c.row < expectedRow - 1) {
      // Gap found — stop
      break;
    }
  }

  if (adjacentComments.length === 0) return undefined;
  return adjacentComments.map((c) => c.text).join("\n");
}

function collectComments(
  node: any,
  result: Array<{ row: number; text: string }>,
) {
  try {
    if (node.type === "comment") {
      result.push({
        row: node.endPosition.row,
        text: node.text,
      });
    }
    for (const child of node.namedChildren) {
      collectComments(child, result);
    }
  } catch {
    // Skip nodes that cause traversal errors
  }
}

/**
 * Strip comment syntax to get raw doc text.
 */
export function stripCommentSyntax(
  text: string,
  lang: LanguageConfig,
): string {
  const delims = lang.commentDelimiters;
  if (!delims) return text;

  let cleaned = text;

  if (delims.blockStart && delims.blockEnd) {
    const start = delims.blockStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const end = delims.blockEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(`^${start}\\s*|\\s*${end}$`, "g"), "");
  }

  if (delims.line) {
    const esc = delims.line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned
      .split("\n")
      .map((l) => l.replace(new RegExp(`^\\s*${esc}\\s?`), ""))
      .join("\n");
  }

  return cleaned.trim();
}
