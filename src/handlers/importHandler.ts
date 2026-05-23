/**
 * Handler for requires, imports, and includes capture groups.
 *
 * Extracts require/import/include statements from Ruby, Python, JS, C, etc.
 */

import type { CaptureGroupHandler } from "./types.ts";
import { locationOf } from "./types.ts";

export const importHandler: CaptureGroupHandler = {
  names: ["requires", "imports", "includes"],

  process(caps, ctx) {
    // require / require_relative (Ruby)
    const pathNode = caps["req_path"];
    if (pathNode) {
      ctx.result.imports.push({
        type: "require",
        path: pathNode.text,
        location: locationOf(ctx.file, pathNode),
      });
    }

    // import / from-import (Python, JS)
    const importNode = caps["import"] || caps["import_from"];
    if (importNode) {
      ctx.result.imports.push({
        type: "import",
        path: importNode.text,
        location: locationOf(ctx.file, importNode),
      });
    }

    // #include (C/C++)
    const includeNode = caps["include"];
    if (includeNode) {
      ctx.result.imports.push({
        type: "include",
        path: includeNode.text,
        location: locationOf(ctx.file, includeNode),
      });
    }
  },
};
