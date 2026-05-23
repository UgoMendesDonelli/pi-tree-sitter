/**
 * Handler for classes_and_modules and classes capture groups.
 *
 * Extracts class/module definitions with superclass and doc comments.
 */

import type { CaptureGroupHandler } from "./types.ts";
import { locationOf, extractDoc } from "./types.ts";

export const classHandler: CaptureGroupHandler = {
  names: ["classes_and_modules", "classes"],

  process(caps, ctx) {
    const node = caps["class_def"] || caps["module_def"];
    if (!node) return;

    const nameNode = caps["class_name"] || caps["module_name"];
    if (!nameNode) return;

    const doc = ctx.group.capturesDoc
      ? extractDoc(ctx.rootNode, node, ctx.lang)
      : undefined;

    ctx.result.classes.push({
      name: nameNode.text,
      location: locationOf(ctx.file, node),
      superclass: caps["superclass"]?.text,
      methods: [],
      doc,
    });
  },
};
