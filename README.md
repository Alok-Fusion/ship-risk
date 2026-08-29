# ship-risk

> **AI-Code Readiness Scanner** — Spot the exact gap between "AI says it's done" and production-ready code with NIRNAY-style explainable risk scoring.

[![npm version](https://img.shields.io/npm/v/ship-risk.svg)](https://www.npmjs.com/package/ship-risk)
[![license](https://img.shields.io/npm/l/ship-risk.svg)](./LICENSE)
[![CI](https://github.com/Alok-Fusion/ship-risk/actions/workflows/ci.yml/badge.svg)](https://github.com/Alok-Fusion/ship-risk/actions)
[![tests](https://img.shields.io/badge/tests-112%20passing-brightgreen.svg)](https://github.com/Alok-Fusion/ship-risk)

```bash
npx ship-risk scan
```

AI code generators (Cursor, Claude, Copilot, ChatGPT) write syntactically correct code that looks complete, but systematically omit production guardrails: auth checks on sensitive endpoints, input validation, try/catch around async boundaries, rate limiting, and actual assertions in generated tests.

`ship-risk` is a sibling tool to [`predeploy-check`](https://github.com/Alok-Fusion/predeploy_check), focused on **code risk and readiness** rather than deployment host configuration. It parses your JavaScript/TypeScript code using AST analysis and computes a transparent readiness score (`0–100`).

---

## Example Terminal Output

```
╔═══════════════════════════════════════════════════════════════════╗
║          ship-risk · AI-Code Readiness & Quality Scanner        ║
╚═══════════════════════════════════════════════════════════════════╝

  Target: ./my-express-api   Files: 24   Time: 0.18s

  Overall Readiness Score: 62/100  [████████████░░░░░░░░]  HUMAN REVIEW REQUIRED
  CI Threshold: ✖ Failed CI gate (min: 70, current: 62)

  ───────────────────────────────────────────────────────────────────
  EXPLAINABLE RISK BREAKDOWN (NIRNAY-Traceable SHAP Attribution)
  ───────────────────────────────────────────────────────────────────

  ● Secrets & Credentials                      90/100 [███████████░]  ⚠ 1 finding (-15 pts)
     CRITICAL  routes/billing.js:12 (-15 pts)
       Hardcoded secret assigned to variable "stripeSecret".
       ↳ Fix: Move secret into an environment variable and load it via process.env.

  ● Auth & Access Control                      40/100 [█████░░░░░░░]  ⚠ 2 findings (-35 pts)
     CRITICAL  routes/admin.js:5 (-22.5 pts)
       Sensitive Express route "GET /api/admin/users" has no auth middleware.
       ↳ Fix: Enforce authentication and session validation before processing sensitive user/billing data.

     HIGH  routes/admin.js:5 (-15 pts)
       Admin endpoint "GET /api/admin/users" does not enforce role or permission checks.
       ↳ Fix: Verify user roles (e.g., req.user.role === "admin") before executing.

  ● Input Validation & Sanitization            70/100 [████████░░░░]  ⚠ 2 findings (-23 pts)
     CRITICAL  routes/admin.js:7 (-22.5 pts)
       Raw SQL query constructed using string concatenation '+' (SQL injection risk).
       ↳ Fix: Use parameterized queries, prepared statements ($1, ?), or an ORM/query builder.

  ● Error Handling & Async Boundaries          80/100 [██████████░░]  ⚠ 1 finding (-9 pts)
     MED  routes/billing.js:14 (-4.2 pts)
       Async route handler lacks try/catch block. Unhandled rejections will crash server.
       ↳ Fix: Wrap handler logic in try/catch or wrap the route with express-async-handler.

  ● Test Suite & Assertion Coverage            30/100 [████░░░░░░░░]  ⚠ 2 findings (-10 pts)
     HIGH  test/dummy.test.js:1 (-6 pts)
       Test file has 0 assertions (expect/assert). Stubs provide false confidence in AI code.
       ↳ Fix: Add concrete expect() or assert statements verifying actual behavior.

  ● Reliability & Security Config Hygiene      85/100 [██████████░░]  ⚠ 2 findings (-10 pts)
     LOW  server.js:11 (-0.8 pts)
       Leftover `console.log()` detected in production code path.
       ↳ Fix: Replace console.log with a structured logger (pino, winston).

  ───────────────────────────────────────────────────────────────────
  Total Findings: 10   Address the fixes above before deploying to production.
```

---

## Core Detection Categories

Every point deducted is traceable to a specific rule that fired — inspired by the explainability mechanics of the [NIRNAY](https://github.com/Alok-Fusion) risk-attribution architecture.

| Category | Default Weight | Key Rules Detected |
|---|:---:|---|
| **Secrets & credentials** | 25% | • Hardcoded tokens & API keys (OpenAI, AWS, Stripe, GitHub, Slack, DB URI)<br>• Shannon entropy check for high-entropy secrets<br>• Direct `.env` imports instead of `process.env`<br>• Committed `.env` files with real keys missing from `.gitignore` |
| **Auth & access control** | 25% | • Express & Next.js API routes lacking auth middleware<br>• Unprotected sensitive endpoints (`/user`, `/admin`, `/billing`, `/payment`)<br>• Privileged mutations missing role/permission checks |
| **Input validation** | 20% | • Direct `req.body`/`req.query`/`req.params` access without Zod/Joi/Yup<br>• Raw SQL string concatenation or template literal injection<br>• Unsanitized input passed to `eval`, `exec`, or `dangerouslySetInnerHTML` |
| **Error handling** | 10% | • Async Express route handlers without `try/catch` or `asyncHandler`<br>• Floating unhandled promises without `await` or `.catch()`<br>• Empty catch blocks swallowing errors silently |
| **Testing** | 10% | • Production source files with no matching test file<br>• AI-generated stub test files with **0 assertions** (`expect()`)<br>• Overall test-to-source file ratio (< 30%) |
| **Reliability & hygiene** | 10% | • Leftover `console.log()` in production server routes<br>• Missing rate limiting middleware (`express-rate-limit`, `@upstash/ratelimit`)<br>• CORS configured with wildcard origin (`*`)<br>• Missing security headers (`helmet`) |

---

## Quick Start

### Run directly with `npx` (zero install)

```bash
# Scan the current directory
npx ship-risk scan

# Scan a specific directory
npx ship-risk scan ./apps/api

# Run machine-readable JSON output (ideal for CI)
npx ship-risk scan --json

# Filter scan to a single category
npx ship-risk scan --category=secrets
npx ship-risk scan --category=auth

# Gate a build in CI/CD (exits non-zero if readiness score < 70)
npx ship-risk scan --min-score=70
```

### Install globally or in your devDependencies

```bash
# Global
npm install -g ship-risk

# Local dev dependency
npm install --save-dev ship-risk
```

---

## Machine-Readable JSON Mode (`--json`)

Pipe directly into `jq`, Datadog, or your custom CI pipeline:

```bash
npx ship-risk scan --json
```

```json
{
  "score": 62,
  "passed": false,
  "minScoreThreshold": 70,
  "totalFindings": 10,
  "totalFilesScanned": 24,
  "targetPath": "/home/runner/work/my-app",
  "durationMs": 182,
  "timestamp": "2026-08-29T15:20:00.000Z",
  "categories": {
    "secrets": {
      "score": 90,
      "weight": 25,
      "deduction": 15,
      "findings": [
        {
          "file": "routes/billing.js",
          "line": 12,
          "rule": "hardcoded-secret",
          "category": "secrets",
          "severity": "critical",
          "deduction": 15,
          "message": "Hardcoded secret assigned to variable \"stripeSecret\".",
          "fix": "Move secret into an environment variable and load it via process.env."
        }
      ]
    },
    "auth": {
      "score": 40,
      "weight": 25,
      "deduction": 37.5,
      "findings": [
        {
          "file": "routes/admin.js",
          "line": 5,
          "rule": "unprotected-sensitive-route",
          "category": "auth",
          "severity": "critical",
          "deduction": 22.5,
          "message": "Sensitive Express route \"GET /api/admin/users\" has no auth middleware.",
          "fix": "Enforce authentication and session validation before processing sensitive user/billing data."
        }
      ]
    },
    "validation": { "score": 70, "weight": 20, "deduction": 23, "findings": [] },
    "errorHandling": { "score": 80, "weight": 10, "deduction": 9, "findings": [] },
    "testing": { "score": 30, "weight": 10, "deduction": 10, "findings": [] },
    "reliability": { "score": 85, "weight": 10, "deduction": 10, "findings": [] }
  }
}
```

---

## Configuration (`ship-risk.config.js`)

Generate a starter configuration file:

```bash
npx ship-risk config init
```

Customize weights, ignore patterns, allowlists, and rule severities:

```javascript
/**
 * @type {import('ship-risk').ShipRiskConfig}
 */
module.exports = {
  // Ignored paths
  ignore: [
    '**/fixtures/**',
    '**/*.mock.*',
    '**/vendor/**',
  ],

  // Category weight distribution (sum to 100)
  weights: {
    secrets: 25,
    auth: 25,
    validation: 20,
    errorHandling: 10,
    testing: 10,
    reliability: 10,
  },

  // Per-rule overrides ('off' | 'low' | 'medium' | 'high' | 'critical')
  rules: {
    'console-log-in-production': 'off',
    'missing-security-headers': 'low',
  },

  // Allowlist known false-positives or test tokens
  allowlist: {
    files: [
      'src/test-utils/**',
    ],
    rules: {
      'hardcoded-secret': ['fake-api-key-for-test'],
    },
  },

  options: {
    minScore: 70, // Exit code 1 if score falls below 70
  },
};
```

---

## GitHub Actions CI Workflow

Add `.github/workflows/ship-risk.yml` to gate PRs if AI-generated code introduces unreviewed risk:

```yaml
name: Ship Risk Readiness Gate

on:
  pull_request:
    branches: [main, master]

jobs:
  readiness-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: AI-Code Readiness Audit
        run: npx ship-risk scan --min-score=70
```

---

## Why Pure Static Analysis?

- ⚡ **Instant Execution**: Scans whole repositories in milliseconds using Babel AST parsing.
- 🔒 **100% Offline & Private**: Zero LLM API calls, zero code sent over the network.
- 💸 **Zero Cost in CI**: No token charges, rate limits, or API key dependencies.
- 🎯 **Deterministic**: Run it 100 times, get the exact same reproducible score and deduction report.

---

## Sibling Project

Check out [`predeploy-check`](https://github.com/Alok-Fusion/predeploy_check) — scans project deployment configurations (Render, Vercel, Railway, Python wheels, Procfiles, and package engines) before pushing to production.

---

## License

MIT © [Alok Kushwaha](https://github.com/Alok-Fusion)
