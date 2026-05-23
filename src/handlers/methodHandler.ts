/**
 * Handler for methods and functions capture groups.
 *
 * Extracts method/function definitions with params and doc comments.
 * Assigns methods to their parent class if one exists.
 */

import type { CaptureGroupHandler } from "./types.ts";
import { locationOf, extractDoc, findParentClass } from "./types.ts";

export const methodHandler: CaptureGroupHandler = {
  names: ["methods", "functions"],

  process(caps, ctx) {
    const node = caps["method_def"] || caps["func_def"] || caps["singleton_method_def"];
    if (!node) return;

    const nameNode =
      caps["method_name"] ||
      caps["func_name"] ||
      caps["singleton_method_name"];
    if (!nameNode) return;

    const params = caps["params"]?.text;

    const doc = ctx.group.capturesDoc
      ? extractDoc(ctx.rootNode, node, ctx.lang)
      : undefined;

    const funcInfo = {
      name: nameNode.text,
      location: locationOf(ctx.file, node),
      params,
      doc,
    };

    // Try to assign to parent class
    const parentIdx = findParentClass(ctx.result, ctx.file, node);
    if (parentIdx >= 0) {
      ctx.result.classes[parentIdx]!.methods.push(funcInfo);
    } else {
      ctx.result.functions.push(funcInfo);
    }
  },
};
