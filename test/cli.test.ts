import path from 'path';
import fs from 'fs';
import os from 'os';
import { createCli } from '../src/cli';
import { scanProject } from '../src/scanner';

describe('CLI Commands & Options', () => {
  const sampleProjDir = path.resolve(__dirname, 'fixtures/sample-project');

  test('scanProject scans sample project and returns risk score below 100', async () => {
    const result = await scanProject(sampleProjDir);
    expect(result.score).toBeLessThan(100);
    expect(result.totalFindings).toBeGreaterThan(0);
    expect(result.categories.secrets.findings.length).toBeGreaterThan(0);
    expect(result.categories.auth.findings.length).toBeGreaterThan(0);
  });

  test('scanProject supports category filter', async () => {
    const result = await scanProject(sampleProjDir, { category: 'secrets' });
    expect(Object.keys(result.categories)).toEqual(['secrets']);
    expect(result.categories.secrets.findings.length).toBeGreaterThan(0);
  });

  test('scanProject supports security alias for secrets category', async () => {
    const result = await scanProject(sampleProjDir, { category: 'security' });
    expect(Object.keys(result.categories)).toEqual(['secrets']);
  });

  test('scanProject throws error on non-existent directory', async () => {
    await expect(scanProject('/invalid/path/that/does/not/exist')).rejects.toThrow(
      /Target path does not exist/
    );
  });

  test('scanProject throws error on invalid category name', async () => {
    await expect(
      scanProject(sampleProjDir, { category: 'non-existent-category' as any })
    ).rejects.toThrow(/Unknown category/);
  });

  test('CLI definition has scan and config commands', () => {
    const cli = createCli();
    const commandNames = cli.commands.map((c) => c.name());
    expect(commandNames).toContain('scan');
    expect(commandNames).toContain('config');
  });

  test('config init generates ship-risk.config.js in working directory', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-risk-init-'));
    const prevCwd = process.cwd();
    process.chdir(tmpDir);

    const cli = createCli();
    await cli.parseAsync(['node', 'ship-risk', 'config', 'init']);

    const generatedFile = path.join(tmpDir, 'ship-risk.config.js');
    expect(fs.existsSync(generatedFile)).toBe(true);

    const content = fs.readFileSync(generatedFile, 'utf-8');
    expect(content).toContain('weights:');
    expect(content).toContain('secrets: 25');

    process.chdir(prevCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('scanProject calculates CI gate pass/fail against minScore', async () => {
    const passedResult = await scanProject(sampleProjDir, { minScore: 10 });
    expect(passedResult.passed).toBe(true);

    const failedResult = await scanProject(sampleProjDir, { minScore: 99 });
    expect(failedResult.passed).toBe(false);
  });
});
