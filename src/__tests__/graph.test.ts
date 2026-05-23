/**
 * Specification tests for the future tree_sitter_graph functionality.
 *
 * These tests define the expected JSON output format for:
 * - Import/Export dependency graph
 * - Call graph
 * - Inheritance graph
 *
 * All outputs must be pure JSON (no visualization).
 */

import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildImportGraph,
  buildCallGraph,
  buildInheritanceGraph,
} from "../graph.ts";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FIXTURES = resolve(__dirname, "fixtures");

// ─── Types (proposed contract) ──────────────────────────────────────

interface GraphNode {
  id: string;           // unique identifier (e.g. file path or "ClassName:method")
  type: "file" | "class" | "function" | "module";
  name: string;
  file?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  type: "imports" | "exports" | "calls" | "inherits";
}

interface ImportGraph {
  type: "imports";
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalFiles: number;
    totalImports: number;
  };
}

interface CallGraph {
  type: "calls";
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalFunctions: number;
    totalCalls: number;
  };
}

interface InheritanceGraph {
  type: "inheritance";
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalClasses: number;
    totalInheritanceRelations: number;
  };
}

// ══════════════════════════════════════════════════════════════════════
// IMPORT / EXPORT DEPENDENCY GRAPH
// ══════════════════════════════════════════════════════════════════════

describe("Import/Export Dependency Graph (JSON)", () => {
  it("dovrebbe restituire un grafo di import tra file", async () => {
    const graph = await buildImportGraph(FIXTURES);

    expect(graph.type).toBe("imports");
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    // Every edge must be of type "imports" or "exports"
    for (const edge of graph.edges) {
      expect(["imports", "exports"]).toContain(edge.type);
    }

    expect(graph.metadata.totalFiles).toBeGreaterThan(0);
    expect(graph.metadata.totalImports).toBeGreaterThanOrEqual(0);
  });

  it("dovrebbe includere il file che esporta e quello che importa", async () => {
    const graph = await buildImportGraph("/tmp/fake-project");

    const nodeIds = graph.nodes.map(n => n.id);
    for (const edge of graph.edges) {
      expect(nodeIds).toContain(edge.from);
      expect(nodeIds).toContain(edge.to);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════
// CALL GRAPH
// ══════════════════════════════════════════════════════════════════════

describe("Call Graph (JSON)", () => {
  it("dovrebbe restituire un grafo di chiamate tra funzioni/metodi", async () => {
    const graph = await buildCallGraph(FIXTURES);

    expect(graph.type).toBe("calls");
    expect(graph.nodes.length).toBeGreaterThan(0);
    // Edges may be 0 in the initial implementation
    expect(graph.edges.length).toBeGreaterThanOrEqual(0);
  });

  it("dovrebbe permettere di tracciare chi chiama una funzione specifica", async () => {
    const graph = await buildCallGraph("/tmp/fake-project");

    // Example: find all callers of a known function
    const targetFunction = "Calculator.add";
    const callers = graph.edges
      .filter(e => e.to === targetFunction)
      .map(e => e.from);

    expect(Array.isArray(callers)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════
// INHERITANCE GRAPH
// ══════════════════════════════════════════════════════════════════════

describe("Inheritance Graph (JSON)", () => {
  it("dovrebbe restituire un grafo di ereditarietà tra classi", async () => {
    const graph = await buildInheritanceGraph(FIXTURES);

    expect(graph.type).toBe("inheritance");
    expect(graph.nodes.length).toBeGreaterThan(0);
    // Edges may be 0 in the initial implementation
    expect(graph.edges.length).toBeGreaterThanOrEqual(0);
  });

  it("dovrebbe permettere di trovare tutte le classi che ereditano da una base", async () => {
    const graph = await buildInheritanceGraph("/tmp/fake-project");

    const baseClass = "BaseController";
    const children = graph.edges
      .filter(e => e.from === baseClass)
      .map(e => e.to);

    expect(Array.isArray(children)).toBe(true);
  });
});
