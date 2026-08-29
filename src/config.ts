import path from 'path';
import fs from 'fs';
import { CategoryId, ResolvedConfig, ShipRiskConfig } from './types';

export const VALID_CATEGORIES: CategoryId[] = [
  'secrets',
  'auth',
  'validation',
  'errorHandling',
  'testing',
  'reliability',
];

export const DEFAULT_WEIGHTS: Record<CategoryId, number> = {
  secrets: 25,
  auth: 25,
  validation: 20,
  errorHandling: 10,
  testing: 10,
  reliability: 10,
};

export const DEFAULT_CONFIG: ResolvedConfig = {
  configPath: null,
  loaded: false,
  ignore: [],
  weights: { ...DEFAULT_WEIGHTS },
  rules: {},
  allowlist: {
    files: [],
    rules: {},
    patterns: [],
  },
  options: {
    minScore: 0,
    testFilePatterns: [],
    sourceFilePatterns: [],
  },
};

export const CONFIG_FILE_NAMES = [
  'ship-risk.config.js',
  'ship-risk.config.cjs',
  '.ship-risk.js',
  '.ship-risk.cjs',
];

export function resolveConfigPath(projectRoot: string): string | null {
  for (const name of CONFIG_FILE_NAMES) {
    const p = path.join(projectRoot, name);
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

export function loadConfig(projectRoot: string): ResolvedConfig {
  const configPath = resolveConfigPath(projectRoot);

  if (!configPath) {
    return {
      ...DEFAULT_CONFIG,
      weights: { ...DEFAULT_WEIGHTS },
      allowlist: { files: [], rules: {}, patterns: [] },
      options: { minScore: 0, testFilePatterns: [], sourceFilePatterns: [] },
    };
  }

  let userConfig: ShipRiskConfig;
  try {
    // Delete require cache so repeated programmatic calls re-read
    delete require.cache[require.resolve(configPath)];
    userConfig = require(configPath);
  } catch (err: any) {
    throw new Error(
      `Failed to load ship-risk configuration file from ${configPath}:\n  ${err.message}\n` +
      `  Check that the file is valid JavaScript exporting a configuration object.`
    );
  }

  if (typeof userConfig !== 'object' || userConfig === null || Array.isArray(userConfig)) {
    throw new Error(
      `${path.basename(configPath)} must export a plain configuration object.\n` +
      `  Got: ${Array.isArray(userConfig) ? 'Array' : typeof userConfig}`
    );
  }

  // Merge weights
  const resolvedWeights = { ...DEFAULT_WEIGHTS };
  if (userConfig.weights && typeof userConfig.weights === 'object') {
    for (const [key, value] of Object.entries(userConfig.weights)) {
      if (VALID_CATEGORIES.includes(key as CategoryId)) {
        if (typeof value === 'number' && value >= 0) {
          resolvedWeights[key as CategoryId] = value;
        } else {
          throw new Error(
            `Invalid weight for category "${key}" in config. Expected non-negative number, got: ${value}`
          );
        }
      }
    }
  }

  // Merge ignore
  const resolvedIgnore: string[] = [];
  if (userConfig.ignore) {
    if (!Array.isArray(userConfig.ignore)) {
      throw new Error(`"ignore" in config must be an array of glob strings.`);
    }
    resolvedIgnore.push(...userConfig.ignore.filter((i) => typeof i === 'string'));
  }

  // Merge rules
  const resolvedRules: Record<string, any> = {};
  if (userConfig.rules && typeof userConfig.rules === 'object') {
    Object.assign(resolvedRules, userConfig.rules);
  }

  // Merge allowlist
  const resolvedAllowlist = {
    files: Array.isArray(userConfig.allowlist?.files) ? userConfig.allowlist.files : [],
    rules: userConfig.allowlist?.rules && typeof userConfig.allowlist.rules === 'object'
      ? userConfig.allowlist.rules
      : {},
    patterns: Array.isArray(userConfig.allowlist?.patterns) ? userConfig.allowlist.patterns : [],
  };

  // Merge options
  const resolvedOptions = {
    minScore: typeof userConfig.options?.minScore === 'number' ? userConfig.options.minScore : 0,
    testFilePatterns: Array.isArray(userConfig.options?.testFilePatterns)
      ? userConfig.options.testFilePatterns
      : [],
    sourceFilePatterns: Array.isArray(userConfig.options?.sourceFilePatterns)
      ? userConfig.options.sourceFilePatterns
      : [],
  };

  return {
    configPath,
    loaded: true,
    ignore: resolvedIgnore,
    weights: resolvedWeights,
    rules: resolvedRules,
    allowlist: resolvedAllowlist,
    options: resolvedOptions,
  };
}

export function generateInitialConfigContent(): string {
  return `/**
 * ship-risk configuration
 * @type {import('ship-risk').ShipRiskConfig}
 */
module.exports = {
  // Paths or globs to ignore during scanning
  ignore: [
    '**/fixtures/**',
    '**/*.mock.*',
    '**/vendor/**',
  ],

  // Category weight distribution (must sum to 100 for intuitive 0-100 scoring)
  weights: {
    secrets: 25,
    auth: 25,
    validation: 20,
    errorHandling: 10,
    testing: 10,
    reliability: 10,
  },

  // Per-rule severity overrides ('off' | 'low' | 'medium' | 'high' | 'critical')
  rules: {
    // 'console-log-in-production': 'off',
    // 'missing-security-headers': 'low',
  },

  // Allowlist known-safe files or false-positive patterns
  allowlist: {
    files: [
      // 'src/test-fixtures/**',
    ],
    rules: {
      // 'hardcoded-secret': ['fake-api-key-for-test', 'test-token'],
    },
    patterns: [
      // 'sk_test_.*',
    ],
  },

  // Additional options
  options: {
    minScore: 70, // CI gating threshold
  },
};
`;
}
