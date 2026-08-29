import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  loadConfig,
  DEFAULT_CONFIG,
  DEFAULT_WEIGHTS,
  generateInitialConfigContent,
} from '../src/config';

describe('Configuration Loader & Validator', () => {
  test('returns default configuration when no config file exists', () => {
    const nonExistentDir = path.join(os.tmpdir(), 'non-existent-' + Date.now());
    const config = loadConfig(nonExistentDir);
    expect(config.loaded).toBe(false);
    expect(config.configPath).toBeNull();
    expect(config.weights).toEqual(DEFAULT_WEIGHTS);
    expect(config.ignore).toEqual([]);
  });

  test('loads valid custom ship-risk.config.js from directory', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-risk-cfg-'));
    const cfgPath = path.join(tmpDir, 'ship-risk.config.js');
    const content = `
      module.exports = {
        weights: { secrets: 30, auth: 30, validation: 10, errorHandling: 10, testing: 10, reliability: 10 },
        ignore: ['**/fixtures/**'],
        rules: { 'console-log-in-production': 'off' },
        allowlist: { files: ['src/fake.js'] },
        options: { minScore: 80 }
      };
    `;
    fs.writeFileSync(cfgPath, content, 'utf-8');

    const config = loadConfig(tmpDir);
    expect(config.loaded).toBe(true);
    expect(config.weights.secrets).toBe(30);
    expect(config.ignore).toContain('**/fixtures/**');
    expect(config.rules['console-log-in-production']).toBe('off');
    expect(config.allowlist.files).toContain('src/fake.js');
    expect(config.options.minScore).toBe(80);

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('throws descriptive error if config file is not a plain object', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-risk-cfg-'));
    const cfgPath = path.join(tmpDir, 'ship-risk.config.js');
    fs.writeFileSync(cfgPath, 'module.exports = ["invalid", "array"];', 'utf-8');

    expect(() => loadConfig(tmpDir)).toThrow(/must export a plain configuration object/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('throws descriptive error if config file contains syntax errors', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-risk-cfg-'));
    const cfgPath = path.join(tmpDir, 'ship-risk.config.js');
    fs.writeFileSync(cfgPath, 'module.exports = { broken: ;;; }', 'utf-8');

    expect(() => loadConfig(tmpDir)).toThrow(/Failed to load ship-risk configuration file/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('throws descriptive error if category weight is negative or non-number', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-risk-cfg-'));
    const cfgPath = path.join(tmpDir, 'ship-risk.config.js');
    fs.writeFileSync(
      cfgPath,
      'module.exports = { weights: { secrets: -10 } };',
      'utf-8'
    );

    expect(() => loadConfig(tmpDir)).toThrow(/Invalid weight for category "secrets"/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('throws descriptive error if ignore is not an array', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-risk-cfg-'));
    const cfgPath = path.join(tmpDir, 'ship-risk.config.js');
    fs.writeFileSync(cfgPath, 'module.exports = { ignore: "not-an-array" };', 'utf-8');

    expect(() => loadConfig(tmpDir)).toThrow(/"ignore" in config must be an array/);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('generates initial config content containing all valid category weights', () => {
    const template = generateInitialConfigContent();
    expect(template).toContain('secrets: 25');
    expect(template).toContain('auth: 25');
    expect(template).toContain('validation: 20');
    expect(template).toContain('errorHandling: 10');
    expect(template).toContain('testing: 10');
    expect(template).toContain('reliability: 10');
    expect(template).toContain('minScore: 70');
  });

  test('merges partial config weights with defaults', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-risk-cfg-'));
    const cfgPath = path.join(tmpDir, 'ship-risk.config.js');
    fs.writeFileSync(cfgPath, 'module.exports = { weights: { secrets: 50 } };', 'utf-8');

    const config = loadConfig(tmpDir);
    expect(config.weights.secrets).toBe(50);
    expect(config.weights.auth).toBe(DEFAULT_WEIGHTS.auth);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('supports alternative config filename .ship-risk.js', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-risk-cfg-'));
    const cfgPath = path.join(tmpDir, '.ship-risk.js');
    fs.writeFileSync(cfgPath, 'module.exports = { options: { minScore: 95 } };', 'utf-8');

    const config = loadConfig(tmpDir);
    expect(config.loaded).toBe(true);
    expect(config.options.minScore).toBe(95);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('default weights sum to exactly 100', () => {
    const sum = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});
