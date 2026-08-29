export type CategoryId =
  | 'secrets'
  | 'auth'
  | 'validation'
  | 'errorHandling'
  | 'testing'
  | 'reliability';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface Finding {
  file: string;
  line: number;
  column?: number;
  rule: string;
  category: CategoryId;
  message: string;
  severity: Severity;
  fix: string;
  snippet?: string;
  deduction?: number;
}

export interface RuleDefinition {
  id: string;
  category: CategoryId;
  title: string;
  defaultSeverity: Severity;
  baseDeduction: number;
  description: string;
  fix: string;
}

export interface CategoryResult {
  score: number;
  weight: number;
  findings: Finding[];
  deduction: number;
}

export interface ScanResult {
  score: number;
  categories: Record<CategoryId, CategoryResult>;
  totalFindings: number;
  totalFilesScanned: number;
  passed: boolean;
  minScoreThreshold?: number;
  targetPath: string;
  durationMs: number;
  timestamp: string;
}

export interface ShipRiskConfig {
  ignore?: string[];
  weights?: Partial<Record<CategoryId, number>>;
  rules?: Record<string, 'off' | 'warn' | 'error' | Severity>;
  allowlist?: {
    files?: string[];
    rules?: Record<string, string[]>; // ruleId -> allowed patterns or files
    patterns?: string[];
  };
  options?: {
    minScore?: number;
    testFilePatterns?: string[];
    sourceFilePatterns?: string[];
  };
}

export interface ResolvedConfig extends Required<Omit<ShipRiskConfig, 'allowlist' | 'options'>> {
  configPath: string | null;
  loaded: boolean;
  weights: Record<CategoryId, number>;
  allowlist: {
    files: string[];
    rules: Record<string, string[]>;
    patterns: string[];
  };
  options: {
    minScore: number;
    testFilePatterns: string[];
    sourceFilePatterns: string[];
  };
}

export interface ParsedFile {
  filePath: string;
  relativeFilePath: string;
  content: string;
  lines: string[];
  isTestFile: boolean;
  isEnvFile: boolean;
  isConfigFile: boolean;
  ast?: any; // Babel AST
  parseError?: string;
}

export interface CategoryScanner {
  id: CategoryId;
  name: string;
  description: string;
  scan: (files: ParsedFile[], projectRoot: string, config: ResolvedConfig) => Finding[];
}
