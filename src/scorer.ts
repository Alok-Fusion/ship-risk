import { CategoryId, CategoryResult, Finding, ResolvedConfig, ScanResult } from './types';
import { RULES } from './utils/rules';

const SEVERITY_MULTIPLIERS: Record<string, number> = {
  critical: 1.5,
  high: 1.0,
  medium: 0.7,
  low: 0.4,
};

/**
 * Calculates category scores and total readiness score with traceable deductions.
 */
export function calculateReadinessScore(
  rawFindings: Finding[],
  config: ResolvedConfig,
  totalFilesScanned: number,
  targetPath: string,
  durationMs: number,
  categoryFilter?: CategoryId
): ScanResult {
  const categoryIds: CategoryId[] = categoryFilter
    ? [categoryFilter]
    : (['secrets', 'auth', 'validation', 'errorHandling', 'testing', 'reliability'] as CategoryId[]);

  // Filter out findings disabled in config or allowlisted
  const activeFindings = rawFindings.filter((finding) => {
    const ruleConfig = config.rules[finding.rule];
    if (ruleConfig === 'off') {
      return false;
    }

    // Check allowlisted files
    if (config.allowlist.files.some((f) => finding.file.includes(f))) {
      return false;
    }

    // Check rule-specific allowlist
    const ruleAllowed = config.allowlist.rules[finding.rule];
    if (ruleAllowed) {
      if (ruleAllowed.some((pattern) => finding.file.includes(pattern) || finding.message.includes(pattern))) {
        return false;
      }
    }

    return true;
  });

  const categories: Record<CategoryId, CategoryResult> = {} as any;

  // Initialize categories
  for (const cat of categoryIds) {
    categories[cat] = {
      score: 100,
      weight: config.weights[cat] ?? 10,
      findings: [],
      deduction: 0,
    };
  }

  // Assign findings to categories and compute deductions
  for (const finding of activeFindings) {
    if (!categories[finding.category]) continue;

    const ruleDef = RULES[finding.rule];
    const userOverride = config.rules[finding.rule];

    let effectiveSeverity = finding.severity;
    if (userOverride && ['low', 'medium', 'high', 'critical'].includes(userOverride)) {
      effectiveSeverity = userOverride as any;
    }

    const baseDeduction = ruleDef?.baseDeduction ?? 8;
    const multiplier = SEVERITY_MULTIPLIERS[effectiveSeverity] ?? 1.0;
    const deduction = Math.round(baseDeduction * multiplier * 10) / 10;

    finding.severity = effectiveSeverity;
    finding.deduction = deduction;

    categories[finding.category].findings.push(finding);
    categories[finding.category].deduction += deduction;
  }

  // Calculate score per category (clamped 0 - 100)
  for (const cat of categoryIds) {
    categories[cat].deduction = Math.round(categories[cat].deduction * 10) / 10;
    const rawScore = 100 - categories[cat].deduction;
    categories[cat].score = Math.max(0, Math.min(100, Math.round(rawScore)));
  }

  // Calculate weighted overall score
  let totalWeight = 0;
  let weightedScoreSum = 0;

  for (const cat of categoryIds) {
    const weight = categories[cat].weight;
    totalWeight += weight;
    weightedScoreSum += categories[cat].score * weight;
  }

  const finalScore = totalWeight > 0 ? Math.round(weightedScoreSum / totalWeight) : 100;
  const minScoreThreshold = config.options.minScore;
  const passed = finalScore >= minScoreThreshold;

  const totalFindings = Object.values(categories).reduce(
    (acc, cat) => acc + cat.findings.length,
    0
  );

  return {
    score: finalScore,
    categories,
    totalFindings,
    totalFilesScanned,
    passed,
    minScoreThreshold: minScoreThreshold > 0 ? minScoreThreshold : undefined,
    targetPath,
    durationMs,
    timestamp: new Date().toISOString(),
  };
}
