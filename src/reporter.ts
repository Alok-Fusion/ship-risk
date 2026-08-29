import chalk from 'chalk';
import { CategoryId, Finding, ScanResult } from './types';

const CATEGORY_TITLES: Record<CategoryId, string> = {
  secrets: 'Secrets & Credentials',
  auth: 'Auth & Access Control',
  validation: 'Input Validation & Sanitization',
  errorHandling: 'Error Handling & Async Boundaries',
  testing: 'Test Suite & Assertion Coverage',
  reliability: 'Reliability & Security Config Hygiene',
};

function getScoreColor(score: number): typeof chalk.green {
  if (score >= 80) return chalk.green;
  if (score >= 60) return chalk.yellow;
  return chalk.red;
}

function getSeverityBadge(severity: string): string {
  switch (severity) {
    case 'critical':
      return chalk.bgRed.white.bold(' CRITICAL ');
    case 'high':
      return chalk.red.bold(' HIGH ');
    case 'medium':
      return chalk.yellow(' MED ');
    case 'low':
      return chalk.blue(' LOW ');
    default:
      return chalk.gray(` ${severity.toUpperCase()} `);
  }
}

function renderProgressBar(score: number, width = 20): string {
  const filled = Math.max(0, Math.min(width, Math.round((score / 100) * width)));
  const empty = width - filled;
  const color = getScoreColor(score);
  return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

export function formatJsonReport(result: ScanResult): string {
  // Format matching the exact JSON specification
  const formattedCategories: Record<string, any> = {};

  for (const [key, val] of Object.entries(result.categories)) {
    formattedCategories[key] = {
      score: val.score,
      weight: val.weight,
      deduction: val.deduction,
      findings: val.findings.map((f) => ({
        file: f.file,
        line: f.line,
        column: f.column,
        rule: f.rule,
        category: f.category,
        severity: f.severity,
        deduction: f.deduction,
        message: f.message,
        fix: f.fix,
      })),
    };
  }

  return JSON.stringify(
    {
      score: result.score,
      passed: result.passed,
      minScoreThreshold: result.minScoreThreshold,
      totalFindings: result.totalFindings,
      totalFilesScanned: result.totalFilesScanned,
      targetPath: result.targetPath,
      durationMs: result.durationMs,
      timestamp: result.timestamp,
      categories: formattedCategories,
    },
    null,
    2
  );
}

export function formatTerminalReport(result: ScanResult): string {
  const lines: string[] = [];
  const scoreColor = getScoreColor(result.score);

  // Header Banner
  lines.push('');
  lines.push(chalk.bold.cyan('╔═══════════════════════════════════════════════════════════════════╗'));
  lines.push(
    chalk.bold.cyan('║') +
      chalk.bold.white('          ship-risk ') +
      chalk.gray('· AI-Code Readiness & Quality Scanner        ') +
      chalk.bold.cyan('║')
  );
  lines.push(chalk.bold.cyan('╚═══════════════════════════════════════════════════════════════════╝'));
  lines.push('');

  // Target & summary stats
  lines.push(
    `  ${chalk.gray('Target:')} ${chalk.white.bold(result.targetPath)}   ` +
      `${chalk.gray('Files:')} ${chalk.white(result.totalFilesScanned)}   ` +
      `${chalk.gray('Time:')} ${chalk.white((result.durationMs / 1000).toFixed(2))}s`
  );
  lines.push('');

  // Overall Score Banner
  const statusVerdict =
    result.score >= 80
      ? chalk.bgGreen.black.bold(' SHIP READY ')
      : result.score >= 60
      ? chalk.bgYellow.black.bold(' HUMAN REVIEW REQUIRED ')
      : chalk.bgRed.white.bold(' CRITICAL RISK - DO NOT SHIP ');

  lines.push(
    `  ${chalk.bold('Overall Readiness Score: ')}` +
      scoreColor.bold(`${result.score}/100`) +
      `  [${renderProgressBar(result.score)}]  ${statusVerdict}`
  );

  if (result.minScoreThreshold !== undefined) {
    const gateStatus = result.passed
      ? chalk.green.bold(`✔ Passed CI gate (min: ${result.minScoreThreshold})`)
      : chalk.red.bold(`✖ Failed CI gate (min: ${result.minScoreThreshold}, current: ${result.score})`);
    lines.push(`  ${chalk.gray('CI Threshold:')} ${gateStatus}`);
  }

  lines.push('');
  lines.push(chalk.gray('  ' + '─'.repeat(67)));
  lines.push(chalk.bold.white('  EXPLAINABLE RISK BREAKDOWN (NIRNAY-Traceable SHAP Attribution)'));
  lines.push(chalk.gray('  ' + '─'.repeat(67)));
  lines.push('');

  // Category breakdown
  for (const [catId, catResult] of Object.entries(result.categories)) {
    const title = CATEGORY_TITLES[catId as CategoryId] || catId;
    const catColor = getScoreColor(catResult.score);
    const findingCount = catResult.findings.length;

    const countLabel =
      findingCount === 0
        ? chalk.green('✔ Clean')
        : chalk.yellow(`⚠ ${findingCount} finding${findingCount === 1 ? '' : 's'} (-${catResult.deduction} pts)`);

    lines.push(
      `  ${catColor.bold('●')} ${chalk.bold(title.padEnd(42))} ` +
        catColor.bold(`${String(catResult.score).padStart(3)}/100 `) +
        `[${renderProgressBar(catResult.score, 12)}]  ${countLabel}`
    );

    // List individual findings with file:line and one-line fix
    if (catResult.findings.length > 0) {
      for (const finding of catResult.findings) {
        const badge = getSeverityBadge(finding.severity);
        const deductionText = finding.deduction ? chalk.red(`(-${finding.deduction} pts)`) : '';
        const loc = chalk.cyan.underline(`${finding.file}:${finding.line}`);

        lines.push(`     ${badge} ${loc} ${deductionText}`);
        lines.push(`       ${chalk.bold.white(finding.message)}`);
        lines.push(`       ${chalk.green('↳ Fix:')} ${chalk.gray(finding.fix)}`);
        lines.push('');
      }
    }
  }

  // Summary footer
  lines.push(chalk.gray('  ' + '─'.repeat(67)));
  if (result.totalFindings === 0) {
    lines.push(chalk.green.bold('  ✔ 0 critical risks flagged. Your code looks production-ready!'));
  } else {
    lines.push(
      `  ${chalk.bold('Total Findings:')} ${chalk.yellow.bold(result.totalFindings)}   ` +
        chalk.gray('Address the fixes above before deploying to production.')
    );
  }
  lines.push('');

  return lines.join('\n');
}
