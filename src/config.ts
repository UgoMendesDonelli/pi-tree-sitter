/**
 * Configuration loader for pi-tree-sitter.
 *
 * Reads `.tree-sitter.json` from the project root directory being analyzed.
 * Supports: custom excludeDirs, maxFileSize, maxDepth.
 *
 * Merging priority (highest to lowest):
 * 1. Explicit parameters passed to the tool call
 * 2. `.tree-sitter.json` file in the analyzed directory
 * 3. Built-in defaults
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────

export interface TreeSitterConfig {
  /** Directories to exclude from analysis (merged with built-in defaults) */
  excludeDirs?: string[];
  /** Maximum file size in bytes (default: 1_000_000) */
  maxFileSize?: number;
  /** Maximum directory recursion depth (default: unlimited) */
  maxDepth?: number;
}

export interface ResolvedConfig {
  excludeDirs: string[];
  maxFileSize: number;
  maxDepth: number;
}

const CONFIG_FILENAME = ".tree-sitter.json";

/**
 * Built-in directories that are always excluded.
 */
const DEFAULT_EXCLUDE_DIRS = [
  "node_modules",
  "vendor",
  "dist",
  "build",
  "__pycache__",
  "target",
  ".git",
  ".svn",
  ".hg",
];

/**
 * Built-in defaults.
 */
export const DEFAULTS: ResolvedConfig = {
  excludeDirs: [...DEFAULT_EXCLUDE_DIRS],
  maxFileSize: 1_000_000,
  maxDepth: 0, // 0 = unlimited
};

/**
 * Load the `.tree-sitter.json` config file from a directory.
 * Returns null if no config file exists.
 */
function loadConfigFile(directory: string): TreeSitterConfig | null {
  const configPath = resolve(directory, CONFIG_FILENAME);
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as TreeSitterConfig;
    return parsed;
  } catch {
    // Invalid JSON or read error — silently use defaults
    return null;
  }
}

/**
 * Resolve configuration for a given directory.
 *
 * Merges: built-in defaults ← config file ← explicit overrides.
 *
 * @param directory — root directory being analyzed
 * @param overrides — explicit overrides from tool parameters (optional)
 * @returns resolved configuration with all fields populated
 */
export function resolveConfig(
  directory: string,
  overrides?: Partial<TreeSitterConfig>,
): ResolvedConfig {
  // Start with built-in defaults
  const config: ResolvedConfig = {
    excludeDirs: [...DEFAULT_EXCLUDE_DIRS],
    maxFileSize: DEFAULTS.maxFileSize,
    maxDepth: DEFAULTS.maxDepth,
  };

  // Merge config file
  const fileConfig = loadConfigFile(directory);
  if (fileConfig) {
    if (fileConfig.excludeDirs) {
      // Merge: defaults + custom exclude dirs (no duplicates)
      const merged = new Set([...config.excludeDirs, ...fileConfig.excludeDirs]);
      config.excludeDirs = [...merged];
    }
    if (fileConfig.maxFileSize !== undefined) {
      config.maxFileSize = fileConfig.maxFileSize;
    }
    if (fileConfig.maxDepth !== undefined) {
      config.maxDepth = fileConfig.maxDepth;
    }
  }

  // Merge explicit overrides (highest priority)
  if (overrides) {
    if (overrides.excludeDirs) {
      const merged = new Set([...config.excludeDirs, ...overrides.excludeDirs]);
      config.excludeDirs = [...merged];
    }
    if (overrides.maxFileSize !== undefined) {
      config.maxFileSize = overrides.maxFileSize;
    }
    if (overrides.maxDepth !== undefined) {
      config.maxDepth = overrides.maxDepth;
    }
  }

  return config;
}
