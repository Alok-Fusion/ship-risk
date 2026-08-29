import { calculateReadinessScore } from '../src/scorer';
import { DEFAULT_CONFIG } from '../src/config';
import { Finding, ResolvedConfig } from '../src/types';

describe('Scorer & SHAP-Attribution Engine', () => {
  const dummyFindings: Finding[] = [
    {
      file: 'routes/billing.js',
      line: 12,
      rule: 'no-auth-middleware',
      category: 'auth',
      message: 'Route handler has no auth middleware',
      severity: 'high',
      fix: 'Add auth middleware',
    },
    {
      file: 'routes/admin.js',
      line: 5,
      rule: 'hardcoded-secret',
      category: 'secrets',
      message: 'Hardcoded secret detected',
      severity: 'critical',
      fix: 'Use process.env',
    },
  ];

  test('calculates 100 score when 0 findings exist', () => {
    const result = calculateReadinessScore([], DEFAULT_CONFIG, 10, '.', 50);
    expect(result.score).toBe(100);
    expect(result.totalFindings).toBe(0);
    expect(result.passed).toBe(true);
  });

  test('deducts traceable points per finding with severity multiplier', () => {
    const result = calculateReadinessScore(dummyFindings, DEFAULT_CONFIG, 10, '.', 50);
    expect(result.score).toBeLessThan(100);
    expect(result.totalFindings).toBe(2);

    const authFinding = result.categories.auth.findings[0];
    expect(authFinding.deduction).toBeDefined();
    expect(authFinding.deduction).toBeGreaterThan(0);

    const secretFinding = result.categories.secrets.findings[0];
    expect(secretFinding.deduction).toBeDefined();
    expect(secretFinding.deduction).toBeGreaterThan(authFinding.deduction!);
  });

  test('respects rule disable "off" in config', () => {
    const configWithOff: ResolvedConfig = {
      ...DEFAULT_CONFIG,
      rules: {
        'no-auth-middleware': 'off',
      },
    };

    const result = calculateReadinessScore(dummyFindings, configWithOff, 10, '.', 50);
    expect(result.categories.auth.findings.length).toBe(0);
    expect(result.categories.auth.score).toBe(100);
  });

  test('respects rule severity override in config', () => {
    const configWithOverride: ResolvedConfig = {
      ...DEFAULT_CONFIG,
      rules: {
        'no-auth-middleware': 'critical',
      },
    };

    const result = calculateReadinessScore(dummyFindings, configWithOverride, 10, '.', 50);
    const authFinding = result.categories.auth.findings[0];
    expect(authFinding.severity).toBe('critical');
  });

  test('respects file allowlist in config', () => {
    const configWithAllowlist: ResolvedConfig = {
      ...DEFAULT_CONFIG,
      allowlist: {
        files: ['routes/billing.js'],
        rules: {},
        patterns: [],
      },
    };

    const result = calculateReadinessScore(dummyFindings, configWithAllowlist, 10, '.', 50);
    expect(result.categories.auth.findings.length).toBe(0);
  });

  test('respects rule pattern allowlist in config', () => {
    const configWithRuleAllow: ResolvedConfig = {
      ...DEFAULT_CONFIG,
      allowlist: {
        files: [],
        rules: {
          'hardcoded-secret': ['routes/admin.js'],
        },
        patterns: [],
      },
    };

    const result = calculateReadinessScore(dummyFindings, configWithRuleAllow, 10, '.', 50);
    expect(result.categories.secrets.findings.length).toBe(0);
  });

  test('supports category filtering and returns single category score', () => {
    const result = calculateReadinessScore(dummyFindings, DEFAULT_CONFIG, 10, '.', 50, 'secrets');
    expect(Object.keys(result.categories)).toEqual(['secrets']);
    expect(result.score).toBe(result.categories.secrets.score);
  });

  test('evaluates CI minScore threshold correctly', () => {
    const configWithGate: ResolvedConfig = {
      ...DEFAULT_CONFIG,
      options: {
        minScore: 95,
        testFilePatterns: [],
        sourceFilePatterns: [],
      },
    };

    const result = calculateReadinessScore(dummyFindings, configWithGate, 10, '.', 50);
    expect(result.minScoreThreshold).toBe(95);
    expect(result.passed).toBe(false); // score will be ~90-92, below 95
  });
});
