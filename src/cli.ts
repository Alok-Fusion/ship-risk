import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { scanProject } from './scanner';
import { formatJsonReport, formatTerminalReport } from './reporter';
import { generateInitialConfigContent } from './config';
import { CategoryId } from './types';

export function createCli(): Command {
  const program = new Command();
  const pkgPath = path.resolve(__dirname, '../package.json');
  let version = '1.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    version = pkg.version;
  } catch {
    version = '1.0.0';
  }

  program
    .name('ship-risk')
    .description('AI-Code Readiness Scanner - Spot the gap between "AI says it\'s done" and production-ready code.')
    .version(version, '-v, --version', 'Output the current version number');

  // Command: scan
  program
    .command('scan [path]', { isDefault: true })
    .description('Scan a JS/TS project and generate an explainable AI readiness risk score.')
    .option('--json', 'Output machine-readable JSON format for CI/CD')
    .option('--category <name>', 'Filter scanning to a specific category (secrets, auth, validation, errorHandling, testing, reliability)')
    .option('--min-score <number>', 'Minimum readiness score threshold required to pass (exits non-zero if below)', (val) => parseInt(val, 10))
    .action(async (targetPath = '.', options) => {
      try {
        const resolvedPath = path.resolve(targetPath);
        const result = await scanProject(resolvedPath, {
          category: options.category as CategoryId,
          minScore: options.minScore,
        });

        if (options.json) {
          console.log(formatJsonReport(result));
        } else {
          console.log(formatTerminalReport(result));
        }

        // CI gate threshold check
        if (options.minScore !== undefined && !isNaN(options.minScore)) {
          if (result.score < options.minScore) {
            process.exit(1);
          }
        }
      } catch (err: any) {
        if (options.json) {
          console.error(JSON.stringify({ error: err.message || String(err) }));
        } else {
          console.error(`\n✖ Error: ${err.message || String(err)}\n`);
        }
        process.exit(1);
      }
    });

  // Command: config init
  const configCmd = program
    .command('config')
    .description('Manage ship-risk configuration file');

  configCmd
    .command('init')
    .description('Generate an initial ship-risk.config.js in the current working directory')
    .action(() => {
      const configFilePath = path.join(process.cwd(), 'ship-risk.config.js');
      if (fs.existsSync(configFilePath)) {
        console.log(`\n⚠  ship-risk.config.js already exists at: ${configFilePath}\n`);
        return;
      }

      fs.writeFileSync(configFilePath, generateInitialConfigContent(), 'utf-8');
      console.log(`\n✔ Created ship-risk.config.js successfully!\n`);
    });

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const cli = createCli();
  await cli.parseAsync(argv);
}
