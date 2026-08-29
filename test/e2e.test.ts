import path from 'path';
import { scanProject } from '../src/scanner';
import { formatJsonReport, formatTerminalReport } from '../src/reporter';

describe('End-to-End Codebase Readiness Scan', () => {
  const sampleProj = path.resolve(__dirname, 'fixtures/sample-project');

  test('scans sample AI project and generates complete 6-category breakdown', async () => {
    const result = await scanProject(sampleProj);

    expect(result).toHaveProperty('score');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);

    const categories = Object.keys(result.categories);
    expect(categories).toEqual([
      'secrets',
      'auth',
      'validation',
      'errorHandling',
      'testing',
      'reliability',
    ]);

    expect(result.categories.secrets.findings.length).toBeGreaterThan(0);
    expect(result.categories.auth.findings.length).toBeGreaterThan(0);
    expect(result.categories.validation.findings.length).toBeGreaterThan(0);
    expect(result.categories.errorHandling.findings.length).toBeGreaterThan(0);
    expect(result.categories.testing.findings.length).toBeGreaterThan(0);
    expect(result.categories.reliability.findings.length).toBeGreaterThan(0);

    expect(result.totalFindings).toBeGreaterThanOrEqual(6);
  });

  test('JSON output accurately reflects findings and matches user specification schema', async () => {
    const result = await scanProject(sampleProj);
    const jsonStr = formatJsonReport(result);
    const parsed = JSON.parse(jsonStr);

    expect(typeof parsed.score).toBe('number');
    expect(typeof parsed.totalFindings).toBe('number');
    expect(parsed.categories.secrets).toHaveProperty('score');
    expect(parsed.categories.secrets).toHaveProperty('findings');
    expect(parsed.categories.auth).toHaveProperty('score');
    expect(parsed.categories.auth).toHaveProperty('findings');
    expect(parsed.categories.validation).toHaveProperty('score');
    expect(parsed.categories.errorHandling).toHaveProperty('score');
    expect(parsed.categories.testing).toHaveProperty('score');
    expect(parsed.categories.reliability).toHaveProperty('score');
  });

  test('Terminal output contains all essential human report sections', async () => {
    const result = await scanProject(sampleProj);
    const terminalOutput = formatTerminalReport(result);

    expect(terminalOutput).toContain('ship-risk');
    expect(terminalOutput).toContain('Overall Readiness Score:');
    expect(terminalOutput).toContain('EXPLAINABLE RISK BREAKDOWN');
    expect(terminalOutput).toContain('Secrets & Credentials');
    expect(terminalOutput).toContain('Auth & Access Control');
    expect(terminalOutput).toContain('Input Validation & Sanitization');
    expect(terminalOutput).toContain('Error Handling & Async Boundaries');
    expect(terminalOutput).toContain('Test Suite & Assertion Coverage');
    expect(terminalOutput).toContain('Reliability & Security Config Hygiene');
    expect(terminalOutput).toContain('↳ Fix:');
  });

  test('Every single deduction is attributed to a specific rule and positive deduction value', async () => {
    const result = await scanProject(sampleProj);

    for (const [catName, catData] of Object.entries(result.categories)) {
      for (const finding of catData.findings) {
        expect(finding.deduction).toBeDefined();
        expect(finding.deduction).toBeGreaterThan(0);
        expect(finding.rule).toBeDefined();
        expect(finding.file).toBeDefined();
        expect(finding.line).toBeGreaterThan(0);
        expect(finding.fix).toBeDefined();
      }
    }
  });
});
