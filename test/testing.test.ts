import path from 'path';
import { testingCategory } from '../src/categories/testing';
import { collectProjectFiles } from '../src/utils/files';
import { DEFAULT_CONFIG } from '../src/config';

describe('Category 5: Testing & Test Ratio Scanner', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures/testing');

  test('detects stub test files with 0 assertions', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const stubFile = files.filter((f) => f.relativeFilePath.includes('stub.test.js'));
    const findings = testingCategory.scan(stubFile, fixturesDir, DEFAULT_CONFIG);

    const stubFinding = findings.find((f) => f.rule === 'stub-test-file');
    expect(stubFinding).toBeDefined();
    expect(stubFinding?.category).toBe('testing');
    expect(stubFinding?.message).toMatch(/0 assertions|empty function body|stub/i);
  });

  test('passes well-formed test file with assertions', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const goodFile = files.filter((f) => f.relativeFilePath.includes('good.test.js'));
    const findings = testingCategory.scan(goodFile, fixturesDir, DEFAULT_CONFIG);

    const stubFinding = findings.find(
      (f) => f.rule === 'stub-test-file' && f.file.includes('good.test.js')
    );
    expect(stubFinding).toBeUndefined();
  });

  test('detects untested source files when no matching test file exists', () => {
    const mockFiles: any[] = [
      {
        relativeFilePath: 'src/services/billing.service.ts',
        lines: new Array(30).fill('const x = 1;'),
        isTestFile: false,
        isEnvFile: false,
        isConfigFile: false,
      },
    ];

    const findings = testingCategory.scan(mockFiles, fixturesDir, DEFAULT_CONFIG);
    const untestedFinding = findings.find((f) => f.rule === 'untested-source-file');
    expect(untestedFinding).toBeDefined();
    expect(untestedFinding?.message).toContain('billing.service.ts');
  });

  test('matches source files with corresponding test files correctly', () => {
    const mockFiles: any[] = [
      {
        relativeFilePath: 'src/services/user.service.ts',
        lines: new Array(30).fill('const x = 1;'),
        isTestFile: false,
        isEnvFile: false,
        isConfigFile: false,
      },
      {
        relativeFilePath: 'test/user.service.test.ts',
        content: 'test("ok", () => { expect(true).toBe(true); });',
        lines: ['test("ok", () => { expect(true).toBe(true); });'],
        isTestFile: true,
        isEnvFile: false,
        isConfigFile: false,
      },
    ];

    const findings = testingCategory.scan(mockFiles, fixturesDir, DEFAULT_CONFIG);
    const untestedFinding = findings.find((f) => f.rule === 'untested-source-file');
    expect(untestedFinding).toBeUndefined();
  });

  test('flags low test ratio when test file count is under 30% of source files', () => {
    const mockFiles: any[] = [
      {
        relativeFilePath: 'src/a.ts',
        lines: new Array(30).fill('line'),
        isTestFile: false,
        isEnvFile: false,
        isConfigFile: false,
      },
      {
        relativeFilePath: 'src/b.ts',
        lines: new Array(30).fill('line'),
        isTestFile: false,
        isEnvFile: false,
        isConfigFile: false,
      },
      {
        relativeFilePath: 'src/c.ts',
        lines: new Array(30).fill('line'),
        isTestFile: false,
        isEnvFile: false,
        isConfigFile: false,
      },
      {
        relativeFilePath: 'src/d.ts',
        lines: new Array(30).fill('line'),
        isTestFile: false,
        isEnvFile: false,
        isConfigFile: false,
      },
    ]; // 0 test files for 4 source files

    const findings = testingCategory.scan(mockFiles, fixturesDir, DEFAULT_CONFIG);
    const ratioFinding = findings.find((f) => f.rule === 'low-test-ratio');
    expect(ratioFinding).toBeDefined();
    expect(ratioFinding?.message).toContain('Low test ratio');
  });

  test('ignores barrel re-export files from untested file checks', () => {
    const mockBarrel: any = {
      relativeFilePath: 'src/index.ts',
      lines: ["export * from './user';", "export * from './auth';"],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };

    const findings = testingCategory.scan([mockBarrel], fixturesDir, DEFAULT_CONFIG);
    const untestedFinding = findings.find((f) => f.rule === 'untested-source-file');
    expect(untestedFinding).toBeUndefined();
  });

  test('flags empty test callback functions inside test blocks via AST', () => {
    const mockStub: any = {
      relativeFilePath: 'test/empty.test.js',
      content: 'test("stub test", () => {});',
      lines: ['test("stub test", () => {});'],
      isTestFile: true,
      isEnvFile: false,
      isConfigFile: false,
    };
    const { parseSourceToAST } = require('../src/utils/ast');
    mockStub.ast = parseSourceToAST(mockStub.content, mockStub.relativeFilePath).ast;

    const findings = testingCategory.scan([mockStub], fixturesDir, DEFAULT_CONFIG);
    const emptyStub = findings.find((f) => f.rule === 'stub-test-file');
    expect(emptyStub).toBeDefined();
  });

  test('provides actionable one-line fix recommendation for stub tests', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const stubFile = files.filter((f) => f.relativeFilePath.includes('stub.test.js'));
    const findings = testingCategory.scan(stubFile, fixturesDir, DEFAULT_CONFIG);

    const stubFinding = findings.find((f) => f.rule === 'stub-test-file');
    expect(stubFinding?.fix).toContain('expect()');
  });
});
