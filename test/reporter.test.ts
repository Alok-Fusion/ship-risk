import { formatJsonReport, formatTerminalReport } from '../src/reporter';
import { ScanResult } from '../src/types';

describe('Reporter Output Formatter', () => {
  const sampleResult: ScanResult = {
    score: 62,
    passed: false,
    minScoreThreshold: 70,
    totalFindings: 2,
    totalFilesScanned: 15,
    targetPath: '/test/project',
    durationMs: 120,
    timestamp: '2026-08-29T15:00:00.000Z',
    categories: {
      secrets: {
        score: 90,
        weight: 25,
        deduction: 10,
        findings: [
          {
            file: 'src/api.js',
            line: 4,
            rule: 'hardcoded-secret',
            category: 'secrets',
            severity: 'critical',
            deduction: 10,
            message: 'Hardcoded secret detected',
            fix: 'Use process.env',
          },
        ],
      },
      auth: {
        score: 40,
        weight: 25,
        deduction: 25,
        findings: [
          {
            file: 'routes/billing.js',
            line: 12,
            rule: 'no-auth-middleware',
            category: 'auth',
            severity: 'high',
            deduction: 10,
            message: 'Express API endpoint has no auth middleware',
            fix: 'Add auth middleware',
          },
        ],
      },
      validation: { score: 70, weight: 20, deduction: 0, findings: [] },
      errorHandling: { score: 80, weight: 10, deduction: 0, findings: [] },
      testing: { score: 30, weight: 10, deduction: 0, findings: [] },
      reliability: { score: 85, weight: 10, deduction: 0, findings: [] },
    },
  };

  test('formatJsonReport produces valid JSON matching the exact schema', () => {
    const jsonStr = formatJsonReport(sampleResult);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.score).toBe(62);
    expect(parsed.totalFindings).toBe(2);
    expect(parsed.categories.secrets.score).toBe(90);
    expect(parsed.categories.auth.score).toBe(40);
    expect(parsed.categories.auth.findings[0]).toEqual({
      file: 'routes/billing.js',
      line: 12,
      column: undefined,
      rule: 'no-auth-middleware',
      category: 'auth',
      severity: 'high',
      deduction: 10,
      message: 'Express API endpoint has no auth middleware',
      fix: 'Add auth middleware',
    });
  });

  test('formatTerminalReport includes ship-risk header banner', () => {
    const term = formatTerminalReport(sampleResult);
    expect(term).toContain('ship-risk');
    expect(term).toContain('AI-Code Readiness & Quality Scanner');
  });

  test('formatTerminalReport displays overall readiness score', () => {
    const term = formatTerminalReport(sampleResult);
    expect(term).toContain('62/100');
  });

  test('formatTerminalReport includes explainable risk breakdown section', () => {
    const term = formatTerminalReport(sampleResult);
    expect(term).toContain('EXPLAINABLE RISK BREAKDOWN');
    expect(term).toContain('routes/billing.js:12');
    expect(term).toContain('Add auth middleware');
  });

  test('formatTerminalReport displays CI threshold failure status', () => {
    const term = formatTerminalReport(sampleResult);
    expect(term).toContain('Failed CI gate');
  });

  test('formatTerminalReport shows clean status when 0 findings exist', () => {
    const cleanResult: ScanResult = {
      ...sampleResult,
      score: 100,
      passed: true,
      totalFindings: 0,
      categories: {
        ...sampleResult.categories,
        secrets: { score: 100, weight: 25, deduction: 0, findings: [] },
        auth: { score: 100, weight: 25, deduction: 0, findings: [] },
      },
    };

    const term = formatTerminalReport(cleanResult);
    expect(term).toContain('SHIP READY');
    expect(term).toContain('0 critical risks flagged');
  });
});
