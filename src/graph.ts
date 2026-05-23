/**
 * Graph generation module for pi-tree-sitter.
 *
 * Provides three types of structured JSON graphs:
 * - Import/Export dependency graph
 * - Call graph
 * - Inheritance graph
 *
 * All outputs are designed to be consumed by AI agents (pure JSON, no visualization).
 */

import { analyzeDirectory, type AnalysisResult, type ClassInfo, type FunctionInfo, type ImportInfo } from "./analyzer.ts";
import { queryFile, type QueryFileResult } from "./queryService.ts";

// ─── Types ───────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  type: "file" | "class" | "function" | "module";
  name: string;
  file?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: "imports" | "exports" | "calls" | "inherits";
}

export interface ImportGraph {
  type: "imports";
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalFiles: number;
    totalImports: number;
  };
}

export interface CallGraph {
  type: "calls";
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalFunctions: number;
    totalCalls: number;
  };
}

export interface InheritanceGraph {
  type: "inheritance";
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    totalClasses: number;
    totalInheritanceRelations: number;
  };
}

// ─── 1. Import / Export Dependency Graph ─────────────────────────────

export async function buildImportGraph(directory: string): Promise<ImportGraph> {
  const result: AnalysisResult = await analyzeDirectory({
    directory,
    groups: ["imports", "requires"],
  });

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  // Use imports collected by analyzeDirectory
  for (const imp of result.imports) {
    const fromFile = imp.location.file;
    const toModule = imp.path.replace(/['"]/g, ""); // clean quotes

    if (!nodes.has(fromFile)) {
      nodes.set(fromFile, {
        id: fromFile,
        type: "file",
        name: fromFile.split("/").pop() || fromFile,
        file: fromFile,
      });
    }

    if (!nodes.has(toModule)) {
      nodes.set(toModule, {
        id: toModule,
        type: "module",
        name: toModule,
      });
    }

    edges.push({
      from: fromFile,
      to: toModule,
      type: "imports",
    });
  }

  return {
    type: "imports",
    nodes: Array.from(nodes.values()),
    edges,
    metadata: {
      totalFiles: nodes.size,
      totalImports: edges.length,
    },
  };
}

// ─── 2. Call Graph ───────────────────────────────────────────────────

export async function buildCallGraph(directory: string): Promise<CallGraph> {
  const result: AnalysisResult = await analyzeDirectory({
    directory,
    groups: ["functions", "methods", "calls"],
  });

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  // Collect all function/method definitions with their row ranges
  const funcDefs: Array<{
    id: string;
    name: string;
    file: string;
    startRow: number;
    endRow: number;
  }> = [];

  // Index functions for fast lookup by call position
  const funcIndex = new Map<string, Array<{
    id: string;
    name: string;
    startRow: number;
    endRow: number;
  }>>();

  for (const func of result.functions) {
    const id = `${func.location.file}:${func.name}`;
    const def = { id, name: func.name, file: func.location.file, startRow: func.location.startRow, endRow: func.location.endRow };
    funcDefs.push(def);
    nodes.set(id, { id, type: "function", name: func.name, file: func.location.file });

    const fileDefs = funcIndex.get(func.location.file) || [];
    fileDefs.push(def);
    funcIndex.set(func.location.file, fileDefs);
  }

  for (const cls of result.classes) {
    for (const method of cls.methods) {
      const id = `${method.location.file}:${cls.name}.${method.name}`;
      const def = { id, name: `${cls.name}.${method.name}`, file: method.location.file, startRow: method.location.startRow, endRow: method.location.endRow };
      funcDefs.push(def);
      nodes.set(id, { id, type: "function", name: `${cls.name}.${method.name}`, file: method.location.file });

      const fileDefs = funcIndex.get(method.location.file) || [];
      fileDefs.push(def);
      funcIndex.set(method.location.file, fileDefs);
    }
  }

  // Parse calls from raw captures to build edges
  const calls = result.captures?.["calls"] || [];
  const processedCallers = new Set<string>();

  for (const capture of calls) {
    const captureRecord = capture as Record<string, unknown>;
    const callFuncInfo = (captureRecord["call_func"] || captureRecord["call_method"] || captureRecord["call"]) as Record<string, unknown> | undefined;
    const locationInfo = captureRecord["_location"] as Record<string, unknown> | undefined;

    if (!callFuncInfo || !locationInfo) continue;

    const calledName = String(callFuncInfo["text"] ?? "");
    const file = String(locationInfo["file"] ?? "");
    const row = Number(callFuncInfo["startRow"] ?? -1);

    if (!calledName || !file || row < 0) continue;

    // Resolve the called name to a known function node
    const calleeKey = `${file}:${calledName}`;
    
    // Only add edge if the called function exists in our known functions
    if (nodes.has(calleeKey)) {
      // Find the calling function by checking which definition contains this row
      const fileDefs = funcIndex.get(file) || [];
      let callerId: string | undefined;

      for (const def of fileDefs) {
        if (row >= def.startRow && row <= def.endRow) {
          callerId = def.id;
          break;
        }
      }

      if (callerId && callerId !== calleeKey) {
        const edgeKey = `${callerId}->${calleeKey}`;
        if (!processedCallers.has(edgeKey)) {
          processedCallers.add(edgeKey);
          edges.push({ from: callerId, to: calleeKey, type: "calls" });
        }
      }
    }
  }

  return {
    type: "calls",
    nodes: Array.from(nodes.values()),
    edges,
    metadata: {
      totalFunctions: nodes.size,
      totalCalls: edges.length,
    },
  };
}

// ─── 3. Inheritance Graph ────────────────────────────────────────────

export async function buildInheritanceGraph(directory: string): Promise<InheritanceGraph> {
  const result: AnalysisResult = await analyzeDirectory({
    directory,
    groups: ["classes", "classes_and_modules"],
  });

  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const cls of result.classes) {
    const id = `${cls.location.file}:${cls.name}`;
    nodes.set(id, {
      id,
      type: "class",
      name: cls.name,
      file: cls.location.file,
    });

    if (cls.superclass) {
      const superId = `${cls.location.file}:${cls.superclass}`;
      if (!nodes.has(superId)) {
        nodes.set(superId, {
          id: superId,
          type: "class",
          name: cls.superclass,
          file: cls.location.file,
        });
      }

      edges.push({
        from: id,
        to: superId,
        type: "inherits",
      });
    }
  }

  return {
    type: "inheritance",
    nodes: Array.from(nodes.values()),
    edges,
    metadata: {
      totalClasses: nodes.size,
      totalInheritanceRelations: edges.length,
    },
  };
}
