/**
 * pi-tree-sitter — Pi Extension
 *
 * Registers 4 structural code analysis tools powered by Tree-sitter.
 * This file is a pure orchestrator: each tool lives in its own module
 * under src/tools/.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { languagesTool } from "./src/tools/languages.ts";
import { queryTool } from "./src/tools/query.ts";
import { analyzeTool } from "./src/tools/analyze.ts";
import { captureTool } from "./src/tools/capture.ts";

export default function treeSitterExtension(pi: ExtensionAPI) {
  pi.registerTool(languagesTool);
  pi.registerTool(queryTool);
  pi.registerTool(analyzeTool);
  pi.registerTool(captureTool);
}
