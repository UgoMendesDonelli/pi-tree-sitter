/**
 * Match enrichment — associates documentation comments with query captures.
 *
 * Extracted from index.ts to be testable and reusable.
 * The key design decision: enrichMatchesWithDoc receives a pre-computed
 * rootNode, making it impossible to call parse() inside the enrichment loop.
 */

import { findNodeAtPosition, getPrecedingComment, stripCommentSyntax } from "./parser.ts";
import type { LanguageConfig } from "./languages.ts";

/**
 * A query match record with optional _doc enrichment.
 */
export interface EnrichedMatch {
  [key: string]: any;
  _doc?: {
    raw: string;
    cleaned: string;
  };
}

/**
 * Enrich query matches with documentation comments.
 *
 * Receives rootNode (pre-parsed) so that parse() is called exactly once
 * by the caller, not N times inside this function.
 *
 * @param matches — raw query matches from tree-sitter
 * @param rootNode — pre-parsed root node (parse() called once upstream)
 * @param lang — language config (for comment syntax stripping)
 * @returns matches enriched with _doc field where applicable
 */
export function enrichMatchesWithDoc(
  matches: Record<string, any>[],
  rootNode: any,
  lang: LanguageConfig,
): Record<string, any>[] {
  return matches.map((match) => {
    const mainCapture = Object.values(match).find(
      (v) => typeof v === "object" && v !== null && "startRow" in v,
    ) as any;
    if (mainCapture) {
      try {
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
      } catch {
        // getPrecedingComment may fail on some trees; skip enrichment silently
      }
    }
    return match;
  });
}
