import path from 'path';
import { errorHandlingCategory } from '../src/categories/error-handling';
import { collectProjectFiles } from '../src/utils/files';
import { DEFAULT_CONFIG } from '../src/config';

describe('Category 4: Error Handling Scanner', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures/error-handling');

  test('detects async Express route handlers lacking try/catch', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-errors.js'));
    const findings = errorHandlingCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const asyncRouteFinding = findings.find((f) => f.rule === 'unhandled-async-route');
    expect(asyncRouteFinding).toBeDefined();
    expect(asyncRouteFinding?.category).toBe('errorHandling');
    expect(asyncRouteFinding?.fix).toContain('try/catch');
  });

  test('detects swallowed errors in empty catch blocks', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-errors.js'));
    const findings = errorHandlingCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const emptyCatchFinding = findings.find((f) => f.rule === 'empty-catch-block');
    expect(emptyCatchFinding).toBeDefined();
    expect(emptyCatchFinding?.message).toContain('Empty catch block');
  });

  test('detects unhandled floating promise without await or .catch()', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-errors.js'));
    const findings = errorHandlingCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const promiseFinding = findings.find((f) => f.rule === 'unhandled-promise');
    expect(promiseFinding).toBeDefined();
    expect(promiseFinding?.message).toContain('fetch()');
  });

  test('passes properly wrapped async route handlers and caught promises', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const safeFile = files.filter((f) => f.relativeFilePath.includes('safe-errors.js'));
    const findings = errorHandlingCategory.scan(safeFile, fixturesDir, DEFAULT_CONFIG);

    expect(findings.length).toBe(0);
  });

  test('does not flag catch blocks that contain logging statements', () => {
    const mockFile: any = {
      relativeFilePath: 'src/handler.js',
      content: `
        try {
          doSomething();
        } catch (err) {
          console.error(err);
        }
      `,
      lines: ['try {', '  doSomething();', '} catch (err) {', '  console.error(err);', '}'],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };
    const { parseSourceToAST } = require('../src/utils/ast');
    mockFile.ast = parseSourceToAST(mockFile.content, mockFile.relativeFilePath).ast;

    const findings = errorHandlingCategory.scan([mockFile], fixturesDir, DEFAULT_CONFIG);
    const emptyCatch = findings.find((f) => f.rule === 'empty-catch-block');
    expect(emptyCatch).toBeUndefined();
  });

  test('passes promises that are chained with .catch()', () => {
    const mockFile: any = {
      relativeFilePath: 'src/webhook.js',
      content: `
        fetch('https://api.example.com/webhook')
          .catch((err) => console.error(err));
      `,
      lines: ["fetch('https://api.example.com/webhook').catch();"],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };
    const { parseSourceToAST } = require('../src/utils/ast');
    mockFile.ast = parseSourceToAST(mockFile.content, mockFile.relativeFilePath).ast;

    const findings = errorHandlingCategory.scan([mockFile], fixturesDir, DEFAULT_CONFIG);
    const promiseFinding = findings.find((f) => f.rule === 'unhandled-promise');
    expect(promiseFinding).toBeUndefined();
  });

  test('ignores test files during error handling inspection', () => {
    const mockTest: any = {
      relativeFilePath: 'test/error.test.js',
      content: 'try { fn(); } catch (e) {}',
      lines: ['try { fn(); } catch (e) {}'],
      isTestFile: true,
      isEnvFile: false,
      isConfigFile: false,
    };

    const findings = errorHandlingCategory.scan([mockTest], fixturesDir, DEFAULT_CONFIG);
    expect(findings.length).toBe(0);
  });

  test('provides actionable one-line fix for unhandled async route', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-errors.js'));
    const findings = errorHandlingCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const asyncFinding = findings.find((f) => f.rule === 'unhandled-async-route');
    expect(asyncFinding?.fix).toBeDefined();
    expect(asyncFinding?.fix).toContain('express-async-handler');
  });
});
