/**
 * Handler for capture groups without dedicated processing logic.
 *
 * Stores raw capture data in result.captures for groups like
 * comments, calls, interfaces, types, exports, decorators, etc.
 */

import { type Node } from "web-tree-sitter";
import { locationOf } from "./types.ts";
import type { CaptureGroupHandler } from "./types.ts";

/**
 * Converts a Node to a serializable info object.
 */
function nodeToInfo(node: Node): Record<string, unknown> {
  return {
    text: node.text,
    startRow: node.startPosition.row,
    startCol: node.startPosition.column,
    endRow: node.endPosition.row,
    endCol: node.endPosition.column,
  };
}

export const rawHandler: CaptureGroupHandler = {
  names: [
    "comments",
    "calls",
    "constants",
    "variables",
    "exports",
    "interfaces",
    "types",
    "decorators",
    "elements",
    "rules",
  ],

  process(caps, ctx) {
    if (!ctx.result.captures) {
      ctx.result.captures = {};
    }

    const name = ctx.group.name;
    if (!ctx.result.captures[name]) {
      ctx.result.captures[name] = [];
    }

    // Convert all captures to serializable info
    const entry: Record<string, unknown> = {};
    for (const [key, node] of Object.entries(caps)) {
      entry[key] = nodeToInfo(node);
    }
    const firstNode = Object.values(caps)[0];
    if (firstNode) {
      entry["_location"] = locationOf(ctx.file, firstNode);
    }

    ctx.result.captures[name]!.push(entry);
  },
};
