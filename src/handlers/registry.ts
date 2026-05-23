/**
 * Registry of capture group handlers.
 *
 * Maps capture group names to their handlers, replacing the old switch-case
 * in analyzer.ts processCaptureGroup.
 */

import { type Node } from "web-tree-sitter";
import type { CaptureGroupHandler, HandlerContext } from "./types.ts";
import { classHandler } from "./classHandler.ts";
import { methodHandler } from "./methodHandler.ts";
import { importHandler } from "./importHandler.ts";
import { rawHandler } from "./rawHandler.ts";

// ─── Registry ────────────────────────────────────────────────────────

const handlers = new Map<string, CaptureGroupHandler>();

/** Default handler: silently ignores unregistered capture groups */
const defaultHandler: CaptureGroupHandler = {
  names: ["__default__"],
  process(_caps, _ctx) {
    // No-op for unregistered capture groups
  },
};

// Register all handlers
function register(handler: CaptureGroupHandler): void {
  for (const name of handler.names) {
    handlers.set(name, handler);
  }
}

register(classHandler);
register(methodHandler);
register(importHandler);
register(rawHandler);

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Process a capture group match using the registered handler.
 *
 * @param groupName — the capture group name to look up
 * @param caps — flat map of capture name → Node (from a single query match)
 * @param ctx — processing context
 */
export function processCaptureGroup(
  groupName: string,
  caps: Record<string, Node>,
  ctx: HandlerContext,
): void {
  const handler = handlers.get(groupName) ?? defaultHandler;
  handler.process(caps, ctx);
}

/**
 * Get all registered handler names.
 */
export function getRegisteredHandlers(): string[] {
  return [...handlers.keys()];
}
