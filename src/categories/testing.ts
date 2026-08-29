import path from 'path';
import { CategoryScanner, Finding, ParsedFile, ResolvedConfig } from '../types';
import { traverse } from '../utils/ast';
import { RULES } from '../utils/rules';

function getBaseModuleName(relativeFilePath: string): string {
  const filename = path.basename(relativeFilePath);
  return filename
    .replace(/\.(test|spec)\.[jt]sx?$/i, '')
    .replace(/\.[jt]sx?$/i, '')
    .toLowerCase();
}

export const testingCategory: CategoryScanner = {
  id: 'testing',
  name: 'Test Suite & Assertion Coverage',
  description: 'Source files lacking matching tests, stub test files with 0 assertions, and low test-to-source ratio.',
  scan: (files: ParsedFile[], projectRoot: string, config: ResolvedConfig): Finding[] => {
    const findings: Finding[] = [];
    const ruleUntested = RULES['untested-source-file'];
    const ruleStub = RULES['stub-test-file'];
    const ruleRatio = RULES['low-test-ratio'];

    // Separate test files and business source files
    const testFiles = files.filter((f) => f.isTestFile);
    const sourceFiles = files.filter((f) => {
      if (f.isTestFile || f.isEnvFile || f.isConfigFile) return false;
      if (f.relativeFilePath.endsWith('.d.ts')) return false;

      // Exclude simple barrel files (just re-exports)
      const isBarrel =
        f.lines.length < 15 &&
        f.lines.every(
          (l) =>
            !l.trim() ||
            l.trim().startsWith('//') ||
            l.trim().startsWith('/*') ||
            l.trim().startsWith('export *') ||
            l.trim().startsWith('export {')
        );
      return !isBarrel;
    });

    const testModuleNames = new Set<string>();
    for (const tf of testFiles) {
      testModuleNames.add(getBaseModuleName(tf.relativeFilePath));
    }

    // 1. Check for stub test files (0 assertions)
    for (const testFile of testFiles) {
      let assertionCount = 0;
      const content = testFile.content;

      // Regex quick count for standard test assertions
      const assertionMatches = content.match(
        /\b(expect\(|assert\(|assert\.[a-zA-Z]+|should\.|t\.is\(|t\.true\(|t\.assert\()/g
      );
      if (assertionMatches) {
        assertionCount += assertionMatches.length;
      }

      // AST check for empty test functions
      if (testFile.ast) {
        try {
          traverse(testFile.ast, {
            CallExpression(pathRef) {
              const callee = pathRef.node.callee;
              let isTestCall = false;

              if (callee.type === 'Identifier' && ['test', 'it'].includes(callee.name)) {
                isTestCall = true;
              }

              if (isTestCall) {
                const args = pathRef.node.arguments;
                const callback = args[args.length - 1];
                if (
                  callback &&
                  (callback.type === 'ArrowFunctionExpression' ||
                    callback.type === 'FunctionExpression')
                ) {
                  if (
                    callback.body.type === 'BlockStatement' &&
                    callback.body.body.length === 0
                  ) {
                    const line = pathRef.node.loc?.start.line ?? 1;
                    findings.push({
                      file: testFile.relativeFilePath,
                      line,
                      rule: ruleStub.id,
                      category: 'testing',
                      severity: ruleStub.defaultSeverity,
                      message: `Stub test case found with an empty function body.`,
                      fix: ruleStub.fix,
                      snippet: testFile.lines[line - 1]?.trim(),
                    });
                  }
                }
              }
            },
          });
        } catch {
          return findings;
        }
      }

      if (assertionCount === 0 && testFile.lines.length > 3) {
        // Only report if we haven't already reported a stub test case in this file
        const alreadyFlagged = findings.some(
          (f) => f.file === testFile.relativeFilePath && f.rule === ruleStub.id
        );
        if (!alreadyFlagged) {
          findings.push({
            file: testFile.relativeFilePath,
            line: 1,
            rule: ruleStub.id,
            category: 'testing',
            severity: ruleStub.defaultSeverity,
            message: `Test file has 0 assertions (expect/assert). Stubs provide false confidence in AI code.`,
            fix: ruleStub.fix,
          });
        }
      }
    }

    // 2. Untested source files
    for (const src of sourceFiles) {
      const baseName = getBaseModuleName(src.relativeFilePath);
      // Skip CLI entry or main index if trivial
      if (baseName === 'cli' || baseName === 'index' && src.lines.length < 25) {
        continue;
      }

      if (!testModuleNames.has(baseName)) {
        findings.push({
          file: src.relativeFilePath,
          line: 1,
          rule: ruleUntested.id,
          category: 'testing',
          severity: ruleUntested.defaultSeverity,
          message: `Source file "${src.relativeFilePath}" has no corresponding unit or integration test.`,
          fix: `Create a test file covering ${path.basename(src.relativeFilePath)}.`,
        });
      }
    }

    // 3. Overall test ratio
    if (sourceFiles.length >= 3) {
      const ratio = testFiles.length / sourceFiles.length;
      if (ratio < 0.3) {
        findings.push({
          file: 'package.json',
          line: 1,
          rule: ruleRatio.id,
          category: 'testing',
          severity: ruleRatio.defaultSeverity,
          message: `Low test ratio: ${testFiles.length} test file(s) for ${sourceFiles.length} source files (${Math.round(ratio * 100)}%). Target is at least 50%.`,
          fix: ruleRatio.fix,
        });
      }
    }

    return findings;
  },
};
