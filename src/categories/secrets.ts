import path from 'path';
import fs from 'fs';
import { CategoryScanner, Finding, ParsedFile, ResolvedConfig } from '../types';
import { isHighEntropyString } from '../utils/entropy';
import { isPathGitignored } from '../utils/files';
import { traverse } from '../utils/ast';
import { RULES } from '../utils/rules';

const KNOWN_SECRET_PATTERNS: Array<{ regex: RegExp; name: string; severity: 'high' | 'critical' }> = [
  // AWS Access Key ID
  { regex: /\b(AKIA[0-9A-Z]{16})\b/, name: 'AWS Access Key', severity: 'critical' },
  // AWS Secret Access Key
  { regex: /\b([a-zA-Z0-9/+=]{40})\b(?=.*(?:aws|secret|key))/i, name: 'AWS Secret Key', severity: 'critical' },
  // OpenAI API Key
  { regex: /\b(sk-[a-zA-Z0-9]{20,48}|sk-proj-[a-zA-Z0-9_\-]{40,})\b/, name: 'OpenAI API Key', severity: 'critical' },
  // GitHub Personal Access Token
  { regex: /\b(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{50,})\b/, name: 'GitHub Token', severity: 'critical' },
  // Slack Token
  { regex: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/, name: 'Slack Token', severity: 'critical' },
  // Stripe API Secret
  { regex: /\b(sk_(?:live|test)_[0-9a-zA-Z]{20,34})\b/, name: 'Stripe API Secret Key', severity: 'critical' },
  // Generic Private Key
  { regex: /-----BEGIN\s+(?:RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE KEY-----/, name: 'Private Key Block', severity: 'critical' },
  // Generic JSON Web Token
  { regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/, name: 'Hardcoded JWT Token', severity: 'high' },
  // Database connection string with password
  { regex: /(?:postgres|postgresql|mysql|mongodb(?:\+srv)?):\/\/[^:\s]+:[^@\s]+@[^\s/]+/i, name: 'Database Connection String With Password', severity: 'critical' },
];

const DIRECT_ENV_IMPORT_REGEX = /(?:import\s+.*\s+from\s+['"][^'"]*\.env['"]|require\(['"][^'"]*\.env['"]\))/;

export const secretsCategory: CategoryScanner = {
  id: 'secrets',
  name: 'Secrets & Credentials',
  description: 'Hardcoded secrets, API keys, tokens, direct env references, and committed .env files.',
  scan: (files: ParsedFile[], projectRoot: string, config: ResolvedConfig): Finding[] => {
    const findings: Finding[] = [];
    const ruleHardcoded = RULES['hardcoded-secret'];
    const ruleDirectEnv = RULES['direct-env-access'];
    const ruleUncommitted = RULES['uncommitted-env-secret'];

    // Read .gitignore content if present
    let gitignoreContent = '';
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      try {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
      } catch {
        gitignoreContent = '';
      }
    }

    for (const file of files) {
      // 1. Check for uncommitted .env files containing real secrets not in .gitignore
      if (file.isEnvFile) {
        // .env.example, .env.sample, .env.template are fine
        const lower = file.relativeFilePath.toLowerCase();
        const isTemplate = lower.endsWith('.example') || lower.endsWith('.sample') || lower.endsWith('.template');

        if (!isTemplate) {
          const isIgnored = isPathGitignored(file.relativeFilePath, gitignoreContent);
          if (!isIgnored) {
            // Check if file contains non-empty assignments
            const hasRealSecrets = file.lines.some((line) => {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith('#')) return false;
              const eq = trimmed.indexOf('=');
              if (eq > 0) {
                const val = trimmed.slice(eq + 1).trim();
                return val.length > 0 && !val.includes('your_') && !val.includes('placeholder');
              }
              return false;
            });

            if (hasRealSecrets) {
              findings.push({
                file: file.relativeFilePath,
                line: 1,
                rule: ruleUncommitted.id,
                category: 'secrets',
                severity: ruleUncommitted.defaultSeverity,
                message: `.env file containing secrets is committed or not ignored in .gitignore`,
                fix: ruleUncommitted.fix,
              });
            }
          }
        }
      }

      // If it's a test file or test fixture and not an env file, we can be more forgiving with test dummy keys
      // unless it matches live tokens
      if (file.isTestFile) {
        // Still check for critical live tokens in tests
      }

      // Check code files
      if (!file.isEnvFile && file.lines.length > 0) {
        // 2. Direct env import or referencing bare `env.XYZ` instead of `process.env.XYZ`
        // e.g. import env from '.env' or const env = require('.env')
        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i];
          const lineNum = i + 1;

          // Skip comment lines
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) {
            continue;
          }

          // Check direct import from '.env'
          if (
            !line.includes('DIRECT_ENV_IMPORT_REGEX') &&
            !line.includes('RegExp') &&
            DIRECT_ENV_IMPORT_REGEX.test(line) &&
            !/dotenv/i.test(line)
          ) {
            findings.push({
              file: file.relativeFilePath,
              line: lineNum,
              rule: ruleDirectEnv.id,
              category: 'secrets',
              severity: ruleDirectEnv.defaultSeverity,
              message: `Direct import from .env file detected instead of using process.env or dotenv/config.`,
              fix: ruleDirectEnv.fix,
              snippet: line.trim(),
            });
          }

          // Check bare `env.VAR` access without `process.` or local definition
          if (/\b(?<!process\.)(?<![a-zA-Z0-9_])env\.[A-Z0-9_]{3,}\b/.test(line)) {
            // Check if local env was defined in this file
            if (!file.content.includes('const env') && !file.content.includes('let env') && !file.content.includes('import env')) {
              findings.push({
                file: file.relativeFilePath,
                line: lineNum,
                rule: ruleDirectEnv.id,
                category: 'secrets',
                severity: 'medium',
                message: `Referencing bare \`env.${line.match(/env\.([A-Z0-9_]+)/)?.[1] || ''}\` instead of \`process.env\`.`,
                fix: ruleDirectEnv.fix,
                snippet: line.trim(),
              });
            }
          }

          // 3. Known secret regex patterns
          for (const pattern of KNOWN_SECRET_PATTERNS) {
            if (pattern.regex.test(line)) {
              // Avoid test files having dummy placeholders unless live key
              if (file.isTestFile && !line.includes('sk_live_') && !line.includes('AKIA')) {
                continue;
              }
              findings.push({
                file: file.relativeFilePath,
                line: lineNum,
                rule: ruleHardcoded.id,
                category: 'secrets',
                severity: pattern.severity,
                message: `Hardcoded ${pattern.name} detected in source code.`,
                fix: ruleHardcoded.fix,
                snippet: line.trim(),
              });
              break;
            }
          }
        }

        // 4. AST-based check for hardcoded secret variables and high entropy string literals
        if (file.ast && !file.isTestFile) {
          try {
            traverse(file.ast, {
              VariableDeclarator(pathRef) {
                const idNode = pathRef.node.id;
                const initNode = pathRef.node.init;

                if (
                  idNode &&
                  idNode.type === 'Identifier' &&
                  initNode &&
                  initNode.type === 'StringLiteral'
                ) {
                  const varName = idNode.name.toLowerCase();
                  const val = initNode.value;

                  const isSecretVar =
                    varName.includes('apikey') ||
                    varName.includes('api_key') ||
                    varName.includes('secret') ||
                    varName.includes('password') ||
                    varName.includes('auth_token') ||
                    varName.includes('private_key') ||
                    varName.includes('client_secret');

                  if (isSecretVar && val.length >= 8) {
                    // Check if dummy value
                    const isDummy =
                      /^(your[_-]|test|fake|dummy|sample|placeholder|xxxx|change_me)/i.test(val);

                    if (!isDummy) {
                      const line = initNode.loc?.start.line ?? 1;
                      findings.push({
                        file: file.relativeFilePath,
                        line,
                        rule: ruleHardcoded.id,
                        category: 'secrets',
                        severity: 'critical',
                        message: `Hardcoded secret assigned to variable "${idNode.name}".`,
                        fix: ruleHardcoded.fix,
                      });
                    }
                  }
                }
              },

              ObjectProperty(pathRef) {
                const keyNode = pathRef.node.key;
                const valNode = pathRef.node.value;

                let propName = '';
                if (keyNode.type === 'Identifier') {
                  propName = keyNode.name.toLowerCase();
                } else if (keyNode.type === 'StringLiteral') {
                  propName = keyNode.value.toLowerCase();
                }

                if (
                  propName &&
                  valNode &&
                  valNode.type === 'StringLiteral' &&
                  valNode.value.length >= 8
                ) {
                  const isSecretProp =
                    propName === 'password' ||
                    propName === 'secret' ||
                    propName === 'apikey' ||
                    propName === 'api_key' ||
                    propName === 'token' ||
                    propName === 'secretkey';

                  const isDummy = /^(your[_-]|test|fake|dummy|sample|xxxx)/i.test(valNode.value);

                  if (isSecretProp && !isDummy) {
                    const line = valNode.loc?.start.line ?? 1;
                    findings.push({
                      file: file.relativeFilePath,
                      line,
                      rule: ruleHardcoded.id,
                      category: 'secrets',
                      severity: 'high',
                      message: `Hardcoded secret assigned to object property "${propName}".`,
                      fix: ruleHardcoded.fix,
                    });
                  }
                }
              },

              StringLiteral(pathRef) {
                const val = pathRef.node.value;
                // Check for high Shannon entropy in strings that are not imports or file paths
                if (val && val.length >= 24 && isHighEntropyString(val)) {
                  // Ensure parent is not import/require
                  const parentType = pathRef.parent?.type;
                  if (
                    parentType !== 'ImportDeclaration' &&
                    parentType !== 'ImportSpecifier' &&
                    parentType !== 'ExportNamedDeclaration'
                  ) {
                    const line = pathRef.node.loc?.start.line ?? 1;
                    // Deduplicate with previous findings on same line
                    const alreadyFound = findings.some(
                      (f) => f.file === file.relativeFilePath && f.line === line
                    );
                    if (!alreadyFound) {
                      findings.push({
                        file: file.relativeFilePath,
                        line,
                        rule: ruleHardcoded.id,
                        category: 'secrets',
                        severity: 'high',
                        message: `High-entropy credential or token detected in string literal (length: ${val.length}).`,
                        fix: ruleHardcoded.fix,
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
      }
    }

    return findings;
  },
};
