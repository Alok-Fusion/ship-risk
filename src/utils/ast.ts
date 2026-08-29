import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';

// Handle CommonJS / ES module default export variation
const traverse = (typeof _traverse === 'function' ? _traverse : (_traverse as any).default) as typeof _traverse;

export interface ASTParseResult {
  ast: any | null;
  error?: string;
}

/**
 * Parse JS, TS, JSX, TSX source code into Babel AST.
 */
export function parseSourceToAST(source: string, filename: string): ASTParseResult {
  const isTypeScript = /\.tsx?$/i.test(filename);
  const isJsx = /\.[jt]sx$/i.test(filename);

  const plugins: parser.ParserPlugin[] = [
    'asyncGenerators',
    'bigInt',
    'classProperties',
    'classPrivateProperties',
    'classPrivateMethods',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'nullishCoalescingOperator',
    'numericSeparator',
    'objectRestSpread',
    'optionalCatchBinding',
    'optionalChaining',
    'topLevelAwait',
  ];

  if (isTypeScript) {
    plugins.push('typescript');
  }
  if (isJsx) {
    plugins.push('jsx');
  }

  try {
    const ast = parser.parse(source, {
      sourceType: 'unambiguous',
      plugins,
      tokens: true,
      errorRecovery: true,
    });
    return { ast };
  } catch (err: any) {
    // If ambiguous parsing failed, try once more with module sourceType
    try {
      const ast = parser.parse(source, {
        sourceType: 'module',
        plugins: [...plugins, 'jsx', 'typescript'],
        tokens: true,
        errorRecovery: true,
      });
      return { ast };
    } catch (secondErr: any) {
      return { ast: null, error: secondErr?.message || String(secondErr) };
    }
  }
}

export { traverse };
