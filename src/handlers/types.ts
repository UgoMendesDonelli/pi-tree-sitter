/**
 * Shared types for the capture group handler registry.
 */

import { type Node } from "web-tree-sitter";
import { getPrecedingComment, stripCommentSyntax } from "../parser.ts";
import type { AnalysisResult, Location, DocComment } from "../analyzer.ts";
import type { LanguageConfig, CaptureGroup } from "../languages.ts";
import type { CachedParser } from "../parser.ts";

/**
 * Context passed to each handler during capture group processing.
 */
export interface HandlerContext {
  result: AnalysisResult;
  file: string;
  rootNode: Node;
  lang: LanguageConfig;
  parserCtx: CachedParser;
  group: CaptureGroup;
}

/**
 * A handler for a specific capture group type.
 */
export interface CaptureGroupHandler {
  /** The name(s) of capture groups this handler processes */
  names: string[];
  /**
   * Process captures from a Tree-sitter query match.
   * @param caps — flat map of capture name → Node (from a single match)
   * @param ctx — processing context
   */
  process(caps: Record<string, Node>, ctx: HandlerContext): void;
}

// ─── Helper factories ────────────────────────────────────────────────

/**
 * Build a Location from a syntax node.
 */
export function locationOf(file: string, node: Node): Location {
  return {
    file,
    startRow: node.startPosition.row,
    startCol: node.startPosition.column,
    endRow: node.endPosition.row,
    endCol: node.endPosition.column,
  };
}

/**
 * Extract documentation comment for a node, if available.
 */
export function extractDoc(
  rootNode: Node,
  node: Node,
  lang: LanguageConfig,
): DocComment | undefined {
  try {
    const commentText = getPrecedingComment(rootNode, node);
    if (commentText) {
      return {
        text: commentText,
        cleaned: stripCommentSyntax(commentText, lang),
      };
    }
  } catch {
    // Skip on failure
  }
  return undefined;
}

/**
 * Determine if a method belongs to a class already in the result,
 * and return the class index or -1.
 */
export function findParentClass(
  result: AnalysisResult,
  file: string,
  node: Node,
): number {
  for (let i = result.classes.length - 1; i >= 0; i--) {
    const cls = result.classes[i]!;
    if (
      cls.location.file === file &&
      cls.location.startRow <= node.startPosition.row &&
      node.startPosition.row <= cls.location.endRow
    ) {
      return i;
    }
  }
  return -1;
}
