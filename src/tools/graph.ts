/**
 * Tool: tree_sitter_graph
 *
 * Generates structured JSON graphs for AI agents:
 * - Import dependency graph (chi importa/esporta cosa)
 * - Call graph (chi chiama chi)
 * - Inheritance graph (gerarchia di classi)
 *
 * All outputs are pure JSON — no visualization.
 * Designed for agents, not humans.
 */

import { Type } from "typebox";
import { buildImportGraph, buildCallGraph, buildInheritanceGraph } from "../graph.ts";

export const graphTool = {
  name: "tree_sitter_graph",
  label: "Code Graph",
  description:
    "Generate a structured graph of the codebase in JSON format. Supports three types: "
    + "'imports' for import/export dependencies between files, "
    + "'calls' for function/method call relationships, "
    + "'inheritance' for class hierarchy. "
    + "All output is pure JSON designed for AI agent consumption.",
  parameters: Type.Object({
    directory: Type.String({
      description: "Absolute path to the directory to analyze",
    }),
    graph_type: Type.Union(
      [Type.Literal("imports"), Type.Literal("calls"), Type.Literal("inheritance")],
      { description: "Type of graph to build: imports, calls, or inheritance" },
    ),
  }),
  async execute(
    _toolCallId: string,
    params: { directory: string; graph_type: "imports" | "calls" | "inheritance" },
  ) {
    let result;

    switch (params.graph_type) {
      case "imports":
        result = await buildImportGraph(params.directory);
        break;
      case "calls":
        result = await buildCallGraph(params.directory);
        break;
      case "inheritance":
        result = await buildInheritanceGraph(params.directory);
        break;
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      details: {
        graphType: params.graph_type,
        nodeCount: result.nodes.length,
        edgeCount: result.edges.length,
      },
    };
  },
};
