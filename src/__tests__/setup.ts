/**
 * Global test setup for pi-tree-sitter.
 *
 * Initializes web-tree-sitter once before all tests.
 * All test files should import from here to get a pre-initialized parser.
 */

import { initParser } from "../parser";

/**
 * Initialize web-tree-sitter once before all tests.
 */
export async function setup(): Promise<void> {
  await initParser();
}
