/**
 * Match enrichment — associates documentation comments with query captures.
 *
 * Extracted from index.ts to be testable and reusable.
 * The key design decision: enrichMatchesWithDoc receives a pre-computed
 * rootNode, making it impossible to call parse() inside the enrichment loop.
 */

import { type Node } from "web-tree-sitter";
import { findNodeAtPosition, getPrecedingComment, stripCommentSyntax, type CaptureInfo, type MatchRecord } from "./parser.ts";
import type { LanguageConfig } from "./languages.ts";

/**
 * A match enriched with an optional _doc field.
 * Uses a generic record type to allow both CaptureInfo values and _doc.
 */
export type EnrichedMatch = MatchRecord & {
  _doc?: {
    raw: string;
    cleaned: string;
  };
};

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
  matches: MatchRecord[],
  rootNode: Node,
  lang: LanguageConfig,
): EnrichedMatch[] {
  return matches.map((match) => {
    // Find the first single (non-array) capture value to determine position
    const mainCapture = Object.values(match).find(
      (v): v is CaptureInfo =>
        v !== null && typeof v === "object" && "startRow" in v && !Array.isArray(v),
    );

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
            const enriched = match as EnrichedMatch;
            enriched._doc = {
              raw: comment,
              cleaned: stripCommentSyntax(comment, lang),
            };
            return enriched;
          }
        }
      } catch {
        // getPrecedingComment may fail on some trees; skip enrichment silently
      }
    }
    return match as EnrichedMatch;
  });
}
