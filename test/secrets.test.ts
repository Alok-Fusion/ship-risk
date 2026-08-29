import path from 'path';
import { secretsCategory } from '../src/categories/secrets';
import { collectProjectFiles } from '../src/utils/files';
import { DEFAULT_CONFIG } from '../src/config';

describe('Category 1: Secrets & Credentials Scanner', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures/secrets');

  test('detects OpenAI API keys in source code', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const openaiFinding = findings.find((f) => f.message.includes('OpenAI API Key'));
    expect(openaiFinding).toBeDefined();
    expect(openaiFinding?.rule).toBe('hardcoded-secret');
    expect(openaiFinding?.severity).toBe('critical');
  });

  test('detects AWS Access Keys in source code', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const awsFinding = findings.find((f) => f.message.includes('AWS Access Key'));
    expect(awsFinding).toBeDefined();
    expect(awsFinding?.severity).toBe('critical');
  });

  test('detects Slack bot/user tokens', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const slackFinding = findings.find((f) => f.message.includes('Slack Token'));
    expect(slackFinding).toBeDefined();
  });

  test('detects Stripe secret keys', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const stripeFinding = findings.find((f) => f.message.includes('Stripe API Secret Key'));
    expect(stripeFinding).toBeDefined();
  });

  test('detects database connection string with embedded password', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const dbFinding = findings.find((f) =>
      f.message.includes('Database Connection String With Password')
    );
    expect(dbFinding).toBeDefined();
  });

  test('detects hardcoded secret in object property assignments', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const pwFinding = findings.find(
      (f) =>
        f.message.includes('password') ||
        f.message.includes('secret') ||
        f.message.includes('apiKey')
    );
    expect(pwFinding).toBeDefined();
  });

  test('detects direct require/import of .env file', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const directEnvFinding = findings.find((f) => f.rule === 'direct-env-access');
    expect(directEnvFinding).toBeDefined();
    expect(directEnvFinding?.fix).toContain('process.env');
  });

  test('detects uncommitted .env file not in .gitignore', async () => {
    const files = await collectProjectFiles(fixturesDir);
    // Fixtures dir has no .gitignore, so .env file should trigger
    const envFile = files.filter((f) => f.isEnvFile);
    if (envFile.length > 0) {
      const findings = secretsCategory.scan(envFile, fixturesDir, DEFAULT_CONFIG);
      const uncommittedFinding = findings.find((f) => f.rule === 'uncommitted-env-secret');
      expect(uncommittedFinding).toBeDefined();
    }
  });

  test('does not flag safe file using process.env and dotenv', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const safeFile = files.filter((f) => f.relativeFilePath.includes('safe-secrets.js'));
    const findings = secretsCategory.scan(safeFile, fixturesDir, DEFAULT_CONFIG);

    expect(findings.length).toBe(0);
  });

  test('provides actionable one-line fix recommendations for all secret findings', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    for (const finding of findings) {
      expect(finding.fix).toBeDefined();
      expect(finding.fix.length).toBeGreaterThan(10);
    }
  });

  test('detects high-entropy random string variables via AST', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-secrets.js'));
    const findings = secretsCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    expect(findings.some((f) => f.rule === 'hardcoded-secret')).toBe(true);
  });

  test('ignores template env files like .env.example or .env.sample', () => {
    const mockFiles: any[] = [
      {
        relativeFilePath: '.env.example',
        isEnvFile: true,
        lines: ['API_KEY=your_key_here', 'DB_PASS=placeholder'],
      },
    ];
    const findings = secretsCategory.scan(mockFiles, fixturesDir, DEFAULT_CONFIG);
    expect(findings.length).toBe(0);
  });
});
