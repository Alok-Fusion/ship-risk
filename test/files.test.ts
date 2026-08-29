import path from 'path';
import {
  isCodeFile,
  isTestFilePath,
  isConfigFile,
  isEnvFilePath,
  isPathGitignored,
  collectProjectFiles,
} from '../src/utils/files';

describe('File Discovery & Classification Utilities', () => {
  test('isCodeFile correctly identifies JavaScript and TypeScript files', () => {
    expect(isCodeFile('server.js')).toBe(true);
    expect(isCodeFile('app.ts')).toBe(true);
    expect(isCodeFile('Component.tsx')).toBe(true);
    expect(isCodeFile('util.mjs')).toBe(true);
    expect(isCodeFile('config.cjs')).toBe(true);
    expect(isCodeFile('styles.css')).toBe(false);
    expect(isCodeFile('data.json')).toBe(false);
    expect(isCodeFile('README.md')).toBe(false);
  });

  test('isTestFilePath identifies unit and integration test files', () => {
    expect(isTestFilePath('src/app.test.ts')).toBe(true);
    expect(isTestFilePath('src/app.spec.js')).toBe(true);
    expect(isTestFilePath('test/integration/api.js')).toBe(true);
    expect(isTestFilePath('src/__tests__/service.ts')).toBe(true);
    expect(isTestFilePath('src/app.ts')).toBe(false);
    expect(isTestFilePath('src/testing-utility.ts')).toBe(false);
  });

  test('isTestFilePath respects custom test file pattern overrides', () => {
    expect(isTestFilePath('custom/qa/check.js', ['custom/qa/**'])).toBe(true);
    expect(isTestFilePath('src/regular.ts', ['custom/qa/**'])).toBe(false);
  });

  test('isConfigFile detects config files', () => {
    expect(isConfigFile('ship-risk.config.js')).toBe(true);
    expect(isConfigFile('jest.config.js')).toBe(true);
    expect(isConfigFile('tsconfig.json')).toBe(true);
    expect(isConfigFile('.eslintrc.js')).toBe(true);
    expect(isConfigFile('src/user.service.ts')).toBe(false);
  });

  test('isEnvFilePath identifies environment files', () => {
    expect(isEnvFilePath('.env')).toBe(true);
    expect(isEnvFilePath('.env.local')).toBe(true);
    expect(isEnvFilePath('.env.production')).toBe(true);
    expect(isEnvFilePath('.env.example')).toBe(true);
    expect(isEnvFilePath('environment.ts')).toBe(false);
  });

  test('isPathGitignored handles exact filenames in gitignore', () => {
    const gitignore = '.env\nnode_modules/\ndist/';
    expect(isPathGitignored('.env', gitignore)).toBe(true);
    expect(isPathGitignored('src/app.ts', gitignore)).toBe(false);
  });

  test('isPathGitignored handles glob patterns and subdirectories', () => {
    const gitignore = '*.log\n.env.*\nsecrets/**';
    expect(isPathGitignored('.env.local', gitignore)).toBe(true);
    expect(isPathGitignored('.env.production', gitignore)).toBe(true);
    expect(isPathGitignored('error.log', gitignore)).toBe(true);
    expect(isPathGitignored('secrets/keys.json', gitignore)).toBe(true);
    expect(isPathGitignored('src/index.ts', gitignore)).toBe(false);
  });

  test('isPathGitignored handles comments and empty lines in gitignore', () => {
    const gitignore = '# Ignore env files\n\n.env\n\n# Ignore logs\n*.log';
    expect(isPathGitignored('.env', gitignore)).toBe(true);
    expect(isPathGitignored('app.log', gitignore)).toBe(true);
  });

  test('isPathGitignored handles negation rules with exclamation mark', () => {
    const gitignore = '.env*\n!.env.example';
    expect(isPathGitignored('.env', gitignore)).toBe(true);
    expect(isPathGitignored('.env.local', gitignore)).toBe(true);
    expect(isPathGitignored('.env.example', gitignore)).toBe(false);
  });

  test('collectProjectFiles collects and parses project files from directory', async () => {
    const fixturesDir = path.resolve(__dirname, 'fixtures/sample-project');
    const files = await collectProjectFiles(fixturesDir);
    expect(files.length).toBeGreaterThan(0);

    const serverFile = files.find((f) => f.relativeFilePath.includes('server.js'));
    expect(serverFile).toBeDefined();
    expect(serverFile?.lines.length).toBeGreaterThan(0);
    expect(serverFile?.ast).toBeDefined();
  });
});
