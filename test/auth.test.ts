import path from 'path';
import { authCategory } from '../src/categories/auth';
import { collectProjectFiles } from '../src/utils/files';
import { DEFAULT_CONFIG } from '../src/config';

describe('Category 2: Auth & Access Control Scanner', () => {
  const fixturesDir = path.resolve(__dirname, 'fixtures/auth');

  test('detects unprotected sensitive Express route /admin/users', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-routes.js'));
    const findings = authCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const adminFinding = findings.find(
      (f) => f.rule === 'unprotected-sensitive-route' && f.message.includes('/admin/users')
    );
    expect(adminFinding).toBeDefined();
    expect(adminFinding?.category).toBe('auth');
    expect(adminFinding?.severity).toBe('critical');
  });

  test('detects unprotected sensitive Express route /billing/charge', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-routes.js'));
    const findings = authCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const billingFinding = findings.find(
      (f) => f.rule === 'unprotected-sensitive-route' && f.message.includes('/billing/charge')
    );
    expect(billingFinding).toBeDefined();
  });

  test('detects missing role check on privileged admin action', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-routes.js'));
    const findings = authCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const roleFinding = findings.find((f) => f.rule === 'missing-role-check');
    expect(roleFinding).toBeDefined();
    expect(roleFinding?.message).toContain('role or permission');
  });

  test('detects missing auth middleware on generic /api routes', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-routes.js'));
    const findings = authCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    const apiFinding = findings.find((f) => f.rule === 'no-auth-middleware');
    expect(apiFinding).toBeDefined();
  });

  test('does not flag routes that include proper requireAuth middleware and role check', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const safeFile = files.filter((f) => f.relativeFilePath.includes('safe-routes.js'));
    const findings = authCategory.scan(safeFile, fixturesDir, DEFAULT_CONFIG);

    expect(findings.length).toBe(0);
  });

  test('detects sensitive Next.js API route without auth check', () => {
    const mockNextApiFile: any = {
      relativeFilePath: 'pages/api/admin/delete-account.ts',
      content: `
        export default async function handler(req, res) {
          res.status(200).json({ ok: true });
        }
      `,
      lines: ['export default async function handler(req, res) {', '  res.status(200).json({ ok: true });', '}'],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };

    const findings = authCategory.scan([mockNextApiFile], fixturesDir, DEFAULT_CONFIG);
    const sensitiveFinding = findings.find((f) => f.rule === 'unprotected-sensitive-route');
    expect(sensitiveFinding).toBeDefined();
  });

  test('passes Next.js API route using getServerSession or auth()', () => {
    const mockNextApiFile: any = {
      relativeFilePath: 'app/api/billing/route.ts',
      content: `
        import { getServerSession } from "next-auth";
        import { authOptions } from "@/lib/auth";

        export async function POST(req) {
          const session = await getServerSession(authOptions);
          if (!session) return new Response("Unauthorized", { status: 401 });
          return Response.json({ success: true });
        }
      `,
      lines: ['import { getServerSession } from "next-auth";'],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };

    const findings = authCategory.scan([mockNextApiFile], fixturesDir, DEFAULT_CONFIG);
    expect(findings.length).toBe(0);
  });

  test('ignores test files in auth check', () => {
    const mockTestFile: any = {
      relativeFilePath: 'test/auth.test.ts',
      content: 'app.get("/api/admin/users", (req, res) => res.send());',
      lines: ['app.get("/api/admin/users", (req, res) => res.send());'],
      isTestFile: true,
      isEnvFile: false,
      isConfigFile: false,
    };

    const findings = authCategory.scan([mockTestFile], fixturesDir, DEFAULT_CONFIG);
    expect(findings.length).toBe(0);
  });

  test('flags Next.js admin route with session but missing admin role check', () => {
    const mockAdminApiFile: any = {
      relativeFilePath: 'pages/api/admin/settings.ts',
      content: `
        import { getServerSession } from "next-auth";
        export default async function handler(req, res) {
          const session = await getServerSession();
          // Authenticated but no role check!
          res.json({ config: 123 });
        }
      `,
      lines: ['export default async function handler(req, res) {'],
      isTestFile: false,
      isEnvFile: false,
      isConfigFile: false,
    };

    const findings = authCategory.scan([mockAdminApiFile], fixturesDir, DEFAULT_CONFIG);
    const roleFinding = findings.find((f) => f.rule === 'missing-role-check');
    expect(roleFinding).toBeDefined();
  });

  test('provides actionable one-line fix suggestions for auth findings', async () => {
    const files = await collectProjectFiles(fixturesDir);
    const riskyFile = files.filter((f) => f.relativeFilePath.includes('risky-routes.js'));
    const findings = authCategory.scan(riskyFile, fixturesDir, DEFAULT_CONFIG);

    for (const f of findings) {
      expect(f.fix).toBeDefined();
      expect(f.fix.length).toBeGreaterThan(15);
    }
  });
});
