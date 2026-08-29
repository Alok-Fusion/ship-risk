import path from 'path';
import { reliabilityCategory } from '../src/categories/reliability';
import { collectProjectFiles } from '../src/utils/files';
import { DEFAULT_CONFIG } from '../src/config';

describe('Category 6: Reliability & Config Hygiene Scanner', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures/reliability');

  test('detects leftover console.log in production code paths', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-hygiene.js'));
    const findings = reliabilityCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const consoleFinding = findings.find((f) => f.rule === 'console-log-in-production');
    expect(consoleFinding).toBeDefined();
    expect(consoleFinding?.category).toBe('reliability');
    expect(consoleFinding?.message).toContain('console.log');
  });

  test('detects CORS configured with wildcard (*)', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-hygiene.js'));
    const findings = reliabilityCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const corsFinding = findings.find((f) => f.rule === 'cors-wildcard');
    expect(corsFinding).toBeDefined();
    expect(corsFinding?.message).toContain('wildcard origin');
  });

  test('detects missing rate limiting in Express application', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-hygiene.js'));
    const findings = reliabilityCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const rateLimitFinding = findings.find((f) => f.rule === 'missing-rate-limiting');
    expect(rateLimitFinding).toBeDefined();
    expect(rateLimitFinding?.message).toContain('rate limiting');
  });

  test('detects missing helmet / security headers in Express application', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-hygiene.js'));
    const findings = reliabilityCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const helmetFinding = findings.find((f) => f.rule === 'missing-security-headers');
    expect(helmetFinding).toBeDefined();
    expect(helmetFinding?.message).toContain('Helmet');
  });

  test('passes Express app with helmet, rate-limiting, and restricted CORS', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const safeFile = files.filter((f) => f.relativeFilePath.includes('safe-hygiene.js'));
    const findings = reliabilityCategory.scan(safeFile, fixturesDir, DEFAULT_CONFIG);

    expect(findings.length).toBe(0);
  });

  test('ignores console.log in CLI scripts and bin files', () => {
    const mockCliFile: any = {
      relativeFilePath: 'bin/ship-risk.js',
      content: 'console.log("Welcome to CLI");',
      lines: ['console.log("Welcome to CLI");'],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };
    const { parseSourceToAST } = require('../src/utils/ast');
    mockCliFile.ast = parseSourceToAST(mockCliFile.content, mockCliFile.relativeFilePath).ast;

    const findings = reliabilityCategory.scan([mockCliFile], fixturesDir, DEFAULT_CONFIG);
    const consoleFinding = findings.find((f) => f.rule === 'console-log-in-production');
    expect(consoleFinding).toBeUndefined();
  });

  test('ignores test files during reliability scan', () => {
    const mockTestFile: any = {
      relativeFilePath: 'test/api.test.js',
      content: 'console.log("Testing runner output");',
      lines: ['console.log("Testing runner output");'],
      isTestFile: true,
      isEnvFile: false,
      isConfigFile: false,
    };

    const findings = reliabilityCategory.scan([mockTestFile], fixturesDir, DEFAULT_CONFIG);
    expect(findings.length).toBe(0);
  });

  test('provides actionable one-line fix for rate limiting and CORS', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-hygiene.js'));
    const findings = reliabilityCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const rateLimit = findings.find((f) => f.rule === 'missing-rate-limiting');
    expect(rateLimit?.fix).toContain('express-rate-limit');

    const cors = findings.find((f) => f.rule === 'cors-wildcard');
    expect(cors?.fix).toContain('specific trusted frontend domains');
  });
});
