import path from 'path';
import { validationCategory } from '../src/categories/validation';
import { collectProjectFiles } from '../src/utils/files';
import { DEFAULT_CONFIG } from '../src/config';

describe('Category 3: Input Validation Scanner', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures/validation');

  test('detects raw SQL string concatenation with + operator', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-input.js'));
    const findings = validationCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const concatSql = findings.find(
      (f) => f.rule === 'raw-sql-injection' && f.message.includes('concatenation')
    );
    expect(concatSql).toBeDefined();
    expect(concatSql?.category).toBe('validation');
    expect(concatSql?.severity).toBe('critical');
  });

  test('detects raw SQL interpolation inside template literals', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-input.js'));
    const findings = validationCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const templateSql = findings.find(
      (f) => f.rule === 'raw-sql-injection' && f.message.includes('template literal')
    );
    expect(templateSql).toBeDefined();
  });

  test('detects dangerous eval execution', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-input.js'));
    const findings = validationCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const evalFinding = findings.find(
      (f) => f.rule === 'unsafe-input-execution' && f.message.includes('eval()')
    );
    expect(evalFinding).toBeDefined();
    expect(evalFinding?.severity).toBe('critical');
  });

  test('detects unvalidated access to req.body and req.query without schema validator', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-input.js'));
    const findings = validationCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const unvalidated = findings.find((f) => f.rule === 'unvalidated-request-input');
    expect(unvalidated).toBeDefined();
  });

  test('passes file using Zod schema validation and parameterized SQL', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const safeFile = files.filter((f) => f.relativeFilePath.includes('safe-input.js'));
    const findings = validationCategory.scan(safeFile, fixturesDir, DEFAULT_CONFIG);

    expect(findings.length).toBe(0);
  });

  test('detects dangerouslySetInnerHTML in React/JSX without sanitization', () => {
    const mockJsxFile: any = {
      relativeFilePath: 'src/components/UserBio.tsx',
      content: `
        import React from 'react';
        export function UserBio({ rawHtml }) {
          return <div dangerouslySetInnerHTML={{ __html: rawHtml }} />;
        }
      `,
      lines: [
        "import React from 'react';",
        'export function UserBio({ rawHtml }) {',
        '  return <div dangerouslySetInnerHTML={{ __html: rawHtml }} />;',
        '}',
      ],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
      ast: null,
    };
    // Parse AST
    const { parseSourceToAST } = require('../src/utils/ast');
    mockJsxFile.ast = parseSourceToAST(mockJsxFile.content, mockJsxFile.relativeFilePath).ast;

    const findings = validationCategory.scan([mockJsxFile], fixturesDir, DEFAULT_CONFIG);
    const xssFinding = findings.find(
      (f) => f.rule === 'unsafe-input-execution' && f.message.includes('dangerouslySetInnerHTML')
    );
    expect(xssFinding).toBeDefined();
  });

  test('passes dangerouslySetInnerHTML if DOMPurify sanitization is detected', () => {
    const mockJsxFile: any = {
      relativeFilePath: 'src/components/UserBioSafe.tsx',
      content: `
        import React from 'react';
        import DOMPurify from 'dompurify';
        export function UserBio({ rawHtml }) {
          return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml) }} />;
        }
      `,
      lines: ['export function UserBio({ rawHtml }) {'],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };
    const { parseSourceToAST } = require('../src/utils/ast');
    mockJsxFile.ast = parseSourceToAST(mockJsxFile.content, mockJsxFile.relativeFilePath).ast;

    const findings = validationCategory.scan([mockJsxFile], fixturesDir, DEFAULT_CONFIG);
    expect(findings.length).toBe(0);
  });

  test('detects child_process exec invocation', () => {
    const mockExecFile: any = {
      relativeFilePath: 'src/services/command.js',
      content: `
        const { exec } = require('child_process');
        function runCommand(cmd) {
          exec(cmd);
        }
      `,
      lines: ['exec(cmd);'],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };
    const { parseSourceToAST } = require('../src/utils/ast');
    mockExecFile.ast = parseSourceToAST(mockExecFile.content, mockExecFile.relativeFilePath).ast;

    const findings = validationCategory.scan([mockExecFile], fixturesDir, DEFAULT_CONFIG);
    const execFinding = findings.find(
      (f) => f.rule === 'unsafe-input-execution' && f.message.includes('exec()')
    );
    expect(execFinding).toBeDefined();
  });

  test('ignores test fixtures and test files during validation scan', () => {
    const mockTest: any = {
      relativeFilePath: 'test/input.test.js',
      content: 'db.query("SELECT * FROM test WHERE " + id);',
      lines: ['db.query("SELECT * FROM test WHERE " + id);'],
      isTestFile: true,
      isEnvFile: false,
      isConfigFile: false,
    };

    const findings = validationCategory.scan([mockTest], fixturesDir, DEFAULT_CONFIG);
    expect(findings.length).toBe(0);
  });

  test('provides actionable one-line fix for SQL injection', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-input.js'));
    const findings = validationCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const sqlFinding = findings.find((f) => f.rule === 'raw-sql-injection');
    expect(sqlFinding?.fix).toContain('parameterized queries');
  });
});
