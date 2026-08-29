import path from 'path';
import fs from 'fs';
import { CategoryId, CategoryScanner, Finding, ScanResult } from './types';
import { loadConfig } from './config';
import { collectProjectFiles } from './utils/files';
import { calculateReadinessScore } from './scorer';
import { secretsCategory } from './categories/secrets';
import { authCategory } from './categories/auth';
import { validationCategory } from './categories/validation';
import { errorHandlingCategory } from './categories/error-handling';
import { testingCategory } from './categories/testing';
import { reliabilityCategory } from './categories/reliability';

export const ALL_CATEGORY_SCANNERS: Record<CategoryId, CategoryScanner> = {
  secrets: secretsCategory,
  auth: authCategory,
  validation: validationCategory,
  errorHandling: errorHandlingCategory,
  testing: testingCategory,
  reliability: reliabilityCategory,
};

export interface ScanOptions {
  category?: CategoryId | 'security';
  minScore?: number;
  configPath?: string;
}

export async function scanProject(
  targetDir: string = process.cwd(),
  options: ScanOptions = {}
): Promise<ScanResult> {
  const startTime = Date.now();
  const projectRoot = path.resolve(targetDir);

  if (!fs.existsSync(projectRoot)) {
    throw new Error(`Target path does not exist: ${projectRoot}`);
  }

  // Load config
  const config = loadConfig(projectRoot);

  // Allow CLI option overrides
  if (typeof options.minScore === 'number') {
    config.options.minScore = options.minScore;
  }

  // Handle category alias (e.g. 'security' -> 'secrets')
  let selectedCategory: CategoryId | undefined = undefined;
  if (options.category) {
    const rawCat = options.category.toLowerCase();
    if (rawCat === 'security' || rawCat === 'secret') {
      selectedCategory = 'secrets';
    } else if (ALL_CATEGORY_SCANNERS[rawCat as CategoryId]) {
      selectedCategory = rawCat as CategoryId;
    } else if (rawCat === 'error-handling' || rawCat === 'errorhandling' || rawCat === 'errors') {
      selectedCategory = 'errorHandling';
    } else {
      throw new Error(
        `Unknown category: "${options.category}". Valid categories are: ${Object.keys(
          ALL_CATEGORY_SCANNERS
        ).join(', ')}, security`
      );
    }
  }

  // Collect project files
  const files = await collectProjectFiles(
    projectRoot,
    config.ignore,
    config.options.testFilePatterns
  );

  // Run category scanners
  const rawFindings: Finding[] = [];
  const scannersToRun = selectedCategory
    ? [ALL_CATEGORY_SCANNERS[selectedCategory]]
    : Object.values(ALL_CATEGORY_SCANNERS);

  for (const scanner of scannersToRun) {
    const findings = await scanner.scan(files, projectRoot, config);
    rawFindings.push(...findings);
  }

  const durationMs = Date.now() - startTime;

  // Calculate score and explainable attribution
  return calculateReadinessScore(
    rawFindings,
    config,
    files.length,
    projectRoot,
    durationMs,
    selectedCategory
  );
}
