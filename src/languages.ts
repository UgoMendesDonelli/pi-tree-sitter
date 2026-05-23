/**
 * Language definitions for Tree-sitter.
 * Each entry maps a language name to its grammar WASM file, file extensions,
 * and pre-built capture definitions for common structural queries.
 *
 * The agent can query these by name without knowing the language-specific node types.
 */



export interface CaptureGroup {
  name: string;
  description: string;
  query: string;
  capturesDoc?: boolean;
}

export interface LanguageConfig {
  id: string;
  label: string;
  extensions: string[];
  /** Path to the grammar WASM file (relative to project root) */
  wasmPath: string;
  captureGroups: CaptureGroup[];
  commentDelimiters?: {
    line?: string;
    blockStart?: string;
    blockEnd?: string;
  };
}

// ─── Ruby ───────────────────────────────────────────────────────────

const rubyCaptureGroups: CaptureGroup[] = [
  {
    name: "classes_and_modules",
    description: "Class and module definitions",
    query: `
      (class
        name: (constant) @class_name
        superclass: (superclass (constant) @superclass)?
      ) @class_def
      (module
        name: (constant) @module_name
      ) @module_def
    `,
    capturesDoc: true,
  },
  {
    name: "methods",
    description: "Method definitions (instance and singleton)",
    query: `
      (method
        name: (identifier) @method_name
        parameters: (method_parameters)? @params
      ) @method_def
      (singleton_method
        name: (identifier) @singleton_method_name
        parameters: (method_parameters)? @params
      ) @singleton_method_def
    `,
    capturesDoc: true,
  },
  {
    name: "comments",
    description: "All comments (including docstrings)",
    query: `(comment) @comment`,
  },
  {
    name: "calls",
    description: "Method calls",
    query: `
      (call
        method: (identifier) @call_method
      ) @call
    `,
  },
  {
    name: "constants",
    description: "Constant assignments",
    query: `
      (assignment
        left: (constant) @const_name
      ) @const_assign
    `,
  },
  {
    name: "requires",
    description: "require / require_relative / load statements",
    query: `
      (call
        method: (identifier) @req_method
        arguments: (argument_list (string) @req_path)
        (#match? @req_method "^(require|require_relative|load)$")
      ) @require_call
    `,
  },
];

// ─── Python ──────────────────────────────────────────────────────────

const pythonCaptureGroups: CaptureGroup[] = [
  {
    name: "classes",
    description: "Class definitions",
    query: `
      (class_definition
        name: (identifier) @class_name
        superclasses: (argument_list) @superclasses?
      ) @class_def
    `,
    capturesDoc: true,
  },
  {
    name: "functions",
    description: "Function and method definitions",
    query: `
      (function_definition
        name: (identifier) @func_name
        parameters: (parameters) @params
      ) @func_def
    `,
    capturesDoc: true,
  },
  {
    name: "comments",
    description: "All comments (including docstrings)",
    query: `(comment) @comment`,
  },
  {
    name: "imports",
    description: "Import statements",
    query: `
      (import_statement) @import
      (import_from_statement) @import_from
    `,
  },
  {
    name: "calls",
    description: "Function calls",
    query: `
      (call
        function: (identifier) @call_func
      ) @call
    `,
  },
  {
    name: "decorators",
    description: "Function/class decorators",
    query: `(decorator) @decorator`,
  },
];

// ─── JavaScript ──────────────────────────────────────────────────────

const jsCaptureGroups: CaptureGroup[] = [
  {
    name: "classes",
    description: "Class declarations",
    query: `
      (class_declaration
        name: (identifier) @class_name
      ) @class_def
    `,
    capturesDoc: true,
  },
  {
    name: "functions",
    description: "Function declarations, arrow functions, methods",
    query: `
      (function_declaration
        name: (identifier) @func_name
        parameters: (formal_parameters) @params
      ) @func_def
      (method_definition
        name: (property_identifier) @method_name
        parameters: (formal_parameters) @params
      ) @method_def
    `,
    capturesDoc: true,
  },
  {
    name: "variables",
    description: "Variable declarations (var, let, const)",
    query: `
      (variable_declaration) @var_decl
      (lexical_declaration) @lexical_decl
    `,
  },
  {
    name: "comments",
    description: "All comments (including JSDoc)",
    query: `(comment) @comment`,
  },
  {
    name: "imports",
    description: "Import and require statements",
    query: `
      (import_statement) @import
      (call_expression
        function: (identifier) @req_func
        arguments: (arguments (string) @req_path)
        (#eq? @req_func "require")
      ) @require_call
    `,
  },
  {
    name: "exports",
    description: "Export statements",
    query: `(export_statement) @export`,
  },
  {
    name: "calls",
    description: "Function/method calls",
    query: `
      (call_expression
        function: [(identifier) (member_expression)] @call_func
      ) @call
    `,
  },
];

// ─── TypeScript ──────────────────────────────────────────────────────

const tsCaptureGroups: CaptureGroup[] = [
  {
    name: "classes",
    description: "Class declarations",
    query: `
      (class_declaration
        name: (type_identifier) @class_name
      ) @class_def
    `,
    capturesDoc: true,
  },
  {
    name: "functions",
    description: "Function declarations, arrow functions, methods",
    query: `
      (function_declaration
        name: (identifier) @func_name
        parameters: (formal_parameters) @params
      ) @func_def
      (method_definition
        name: (property_identifier) @method_name
        parameters: (formal_parameters) @params
      ) @method_def
    `,
    capturesDoc: true,
  },
  {
    name: "interfaces",
    description: "Interface declarations",
    query: `
      (interface_declaration
        name: (type_identifier) @interface_name
      ) @interface_def
    `,
    capturesDoc: true,
  },
  {
    name: "types",
    description: "Type alias declarations",
    query: `
      (type_alias_declaration
        name: (type_identifier) @type_name
      ) @type_alias
    `,
    capturesDoc: true,
  },
  {
    name: "comments",
    description: "All comments (including JSDoc)",
    query: `(comment) @comment`,
  },
  {
    name: "imports",
    description: "Import statements",
    query: `(import_statement) @import`,
  },
  {
    name: "exports",
    description: "Export statements",
    query: `(export_statement) @export`,
  },
];

// ─── HTML ────────────────────────────────────────────────────────────

const htmlCaptureGroups: CaptureGroup[] = [
  {
    name: "elements",
    description: "HTML elements with their tag names",
    query: `
      (element
        (start_tag (tag_name) @tag_name)
      ) @element
    `,
  },
  {
    name: "comments",
    description: "HTML comments",
    query: `(comment) @comment`,
  },
];

// ─── CSS ─────────────────────────────────────────────────────────────

const cssCaptureGroups: CaptureGroup[] = [
  {
    name: "rules",
    description: "CSS rule sets with selectors",
    query: `
      (rule_set
        (selectors) @selectors
      ) @rule_set
    `,
  },
  {
    name: "comments",
    description: "CSS comments",
    query: `(comment) @comment`,
  },
];

// ─── C / C++ ─────────────────────────────────────────────────────────

const cCaptureGroups: CaptureGroup[] = [
  {
    name: "functions",
    description: "Function definitions",
    query: `
      (function_definition
        declarator: (function_declarator
          declarator: (identifier) @func_name
          parameters: (parameter_list) @params
        )
      ) @func_def
    `,
    capturesDoc: true,
  },
  {
    name: "classes",
    description: "Class/struct definitions (C++)",
    query: `
      (class_specifier
        name: (type_identifier) @class_name
      ) @class_def
    `,
    capturesDoc: true,
  },
  {
    name: "comments",
    description: "All comments",
    query: `(comment) @comment`,
  },
  {
    name: "includes",
    description: "#include directives",
    query: `(preproc_include) @include`,
  },
];

// ─── Go ───────────────────────────────────────────────────────────────

const goCaptureGroups: CaptureGroup[] = [
  {
    name: "functions",
    description: "Function and method declarations",
    query: `
      (function_declaration
        name: (identifier) @func_name
        parameters: (parameter_list) @params
      ) @func_def
      (method_declaration
        name: (field_identifier) @method_name
        parameters: (parameter_list) @params
      ) @method_def
    `,
    capturesDoc: true,
  },
  {
    name: "structs",
    description: "Struct type declarations",
    query: `
      (type_spec
        name: (type_identifier) @struct_name
        type: (struct_type)
      ) @struct_def
    `,
  },
  {
    name: "interfaces",
    description: "Interface type declarations",
    query: `
      (type_spec
        name: (type_identifier) @interface_name
        type: (interface_type)
      ) @interface_def
    `,
  },
  {
    name: "imports",
    description: "Import declarations",
    query: `(import_declaration) @import`,
  },
  {
    name: "comments",
    description: "All comments",
    query: `(comment) @comment`,
  },
];

// ─── Rust ──────────────────────────────────────────────────────────────

const rustCaptureGroups: CaptureGroup[] = [
  {
    name: "functions",
    description: "Function definitions",
    query: `
      (function_item
        name: (identifier) @func_name
        parameters: (parameters) @params
      ) @func_def
    `,
    capturesDoc: true,
  },
  {
    name: "structs",
    description: "Struct definitions",
    query: `
      (struct_item
        name: (type_identifier) @struct_name
      ) @struct_def
    `,
    capturesDoc: true,
  },
  {
    name: "enums",
    description: "Enum definitions",
    query: `
      (enum_item
        name: (type_identifier) @enum_name
      ) @enum_def
    `,
    capturesDoc: true,
  },
  {
    name: "traits",
    description: "Trait definitions",
    query: `
      (trait_item
        name: (type_identifier) @trait_name
      ) @trait_def
    `,
    capturesDoc: true,
  },
  {
    name: "imports",
    description: "Use declarations",
    query: `(use_declaration) @use`,
  },
  {
    name: "macros",
    description: "Macro invocations",
    query: `(macro_invocation) @macro`,
  },
  {
    name: "comments",
    description: "All comments",
    query: `(comment) @comment`,
  },
];

// ─── Registry ────────────────────────────────────────────────────────

export const LANGUAGES: Record<string, LanguageConfig> = {
  ruby: {
    id: "ruby",
    label: "Ruby",
    extensions: ["rb", "rake", "gemspec", "ru"],
    wasmPath: "node_modules/tree-sitter-ruby/tree-sitter-ruby.wasm",
    captureGroups: rubyCaptureGroups,
    commentDelimiters: { line: "#", blockStart: "=begin", blockEnd: "=end" },
  },
  python: {
    id: "python",
    label: "Python",
    extensions: ["py", "pyw", "pyi"],
    wasmPath: "node_modules/tree-sitter-python/tree-sitter-python.wasm",
    captureGroups: pythonCaptureGroups,
    commentDelimiters: { line: "#", blockStart: '"""', blockEnd: '"""' },
  },
  javascript: {
    id: "javascript",
    label: "JavaScript",
    extensions: ["js", "jsx", "mjs", "cjs"],
    wasmPath: "node_modules/tree-sitter-javascript/tree-sitter-javascript.wasm",
    captureGroups: jsCaptureGroups,
    commentDelimiters: { line: "//", blockStart: "/*", blockEnd: "*/" },
  },
  typescript: {
    id: "typescript",
    label: "TypeScript",
    extensions: ["ts", "tsx", "mts", "cts"],
    wasmPath: "node_modules/tree-sitter-typescript/tree-sitter-tsx.wasm",
    captureGroups: tsCaptureGroups,
    commentDelimiters: { line: "//", blockStart: "/*", blockEnd: "*/" },
  },
  html: {
    id: "html",
    label: "HTML",
    extensions: ["html", "htm", "shtml", "xhtml"],
    wasmPath: "node_modules/tree-sitter-html/tree-sitter-html.wasm",
    captureGroups: htmlCaptureGroups,
    commentDelimiters: { blockStart: "<!--", blockEnd: "-->" },
  },
  css: {
    id: "css",
    label: "CSS",
    extensions: ["css", "scss", "less"],
    wasmPath: "node_modules/tree-sitter-css/tree-sitter-css.wasm",
    captureGroups: cssCaptureGroups,
    commentDelimiters: { blockStart: "/*", blockEnd: "*/" },
  },
  c: {
    id: "c",
    label: "C / C++",
    extensions: ["c", "h", "cpp", "hpp", "cc", "hh", "cxx", "hxx"],
    wasmPath: "node_modules/tree-sitter-c/tree-sitter-c.wasm",
    captureGroups: cCaptureGroups,
    commentDelimiters: { line: "//", blockStart: "/*", blockEnd: "*/" },
  },
  go: {
    id: "go",
    label: "Go",
    extensions: ["go"],
    wasmPath: "node_modules/tree-sitter-go/tree-sitter-go.wasm",
    captureGroups: goCaptureGroups,
    commentDelimiters: { line: "//", blockStart: "/*", blockEnd: "*/" },
  },
  rust: {
    id: "rust",
    label: "Rust",
    extensions: ["rs"],
    wasmPath: "node_modules/tree-sitter-rust/tree-sitter-rust.wasm",
    captureGroups: rustCaptureGroups,
    commentDelimiters: { line: "//", blockStart: "/*", blockEnd: "*/" },
  },
};

/**
 * Map file extension to language config.
 */
export function getLanguageForFile(filePath: string): LanguageConfig | undefined {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  for (const lang of Object.values(LANGUAGES)) {
    if (lang.extensions.includes(ext)) return lang;
  }
  return undefined;
}

/**
 * Get all supported extensions for filtering files during directory walk.
 */
export function getAllExtensions(): string[] {
  return Object.values(LANGUAGES).flatMap((l) => l.extensions);
}
