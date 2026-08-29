import fs from 'fs';
import path from 'path';
import fg from 'fast-glob';
import pm from 'picomatch';
import { ParsedFile } from '../types';
import { parseSourceToAST } from './ast';

export const DEFAULT_IGNORE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.cache/**',
  '**/.vscode/**',
  '**/.idea/**',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
];

const CODE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

export function isCodeFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return CODE_EXTENSIONS.includes(ext);
}

export function isTestFilePath(filePath: string, customPatterns: string[] = []): boolean {
  const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
  if (customPatterns.length > 0) {
    const isMatch = pm(customPatterns);
    if (isMatch(normalized)) return true;
  }

  // If inside fixtures directory, only treat as test if explicitly test/spec
  if (normalized.includes('/fixtures/') || normalized.startsWith('fixtures/')) {
    const base = path.basename(normalized);
    return /\.(test|spec)\.[jt]sx?$/i.test(base);
  }

  // Standard test directories
  if (
    normalized.startsWith('test/') ||
    normalized.startsWith('tests/') ||
    normalized.startsWith('__tests__/') ||
    normalized.startsWith('spec/') ||
    normalized.includes('/__tests__/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/spec/')
  ) {
    return true;
  }

  const base = path.basename(normalized);
  return /\.(test|spec)\.[jt]sx?$/i.test(base);
}

export function isConfigFile(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return (
    base.includes('config') ||
    base.startsWith('.') ||
    base.endsWith('rc.js') ||
    base.endsWith('rc.ts') ||
    base === 'ship-risk.config.js' ||
    base === 'jest.config.js' ||
    base === 'tsconfig.json'
  );
}

export function isEnvFilePath(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  return base === '.env' || base.startsWith('.env.');
}

/**
 * Checks if a relative file path is matched by .gitignore rules.
 */
export function isPathGitignored(relativePath: string, gitignoreContent: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const lines = gitignoreContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));

  let isIgnored = false;

  for (const line of lines) {
    let pattern = line;
    let isNegated = false;
    if (pattern.startsWith('!')) {
      isNegated = true;
      pattern = pattern.slice(1);
    }

    if (pattern.startsWith('/')) {
      pattern = pattern.slice(1);
    }

    const matches = pm([pattern, `**/${pattern}`, `${pattern}/**`, `**/${pattern}/**`]);
    if (matches(normalized) || matches(path.basename(normalized))) {
      isIgnored = !isNegated;
    }
  }

  return isIgnored;
}

/**
 * Discovers and parses all relevant files in a project root.
 */
export async function collectProjectFiles(
  projectRoot: string,
  ignorePatterns: string[] = [],
  testPatterns: string[] = []
): Promise<ParsedFile[]> {
  const allIgnore = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];

  // Search for all code files and .env files
  const filePaths = await fg(
    ['**/*.{js,jsx,ts,tsx,mjs,cjs}', '**/.env', '**/.env.*'],
    {
      cwd: projectRoot,
      absolute: true,
      dot: true,
      ignore: allIgnore,
      onlyFiles: true,
      followSymbolicLinks: false,
    }
  );

  const parsedFiles: ParsedFile[] = [];

  for (const filePath of filePaths) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativeFilePath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
      const lines = content.split(/\r?\n/);
      const isEnv = isEnvFilePath(filePath);
      const isTest = isTestFilePath(relativeFilePath, testPatterns);
      const isConfig = isConfigFile(filePath);

      let ast = null;
      let parseError: string | undefined;

      // Only parse AST for code files (not env files or json)
      if (isCodeFile(filePath)) {
        const res = parseSourceToAST(content, filePath);
        ast = res.ast;
        parseError = res.error;
      }

      parsedFiles.push({
        filePath,
        relativeFilePath,
        content,
        lines,
        isTestFile: isTest,
        isEnvFile: isEnv,
        isConfigFile: isConfig,
        ast,
        parseError,
      });
    } catch {
      // Ignore unreadable files
    }
  }

  return parsedFiles;
}
