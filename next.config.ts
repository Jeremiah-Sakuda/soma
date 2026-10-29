import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  // Keep clean source exports and nested checkouts scoped to their own files.
  turbopack: { root: process.cwd() },
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore'],
  // Playwright reads its browser registry during import, including CDP-only use.
  // Vercel's traced function omitted this JSON while local node_modules masked it.
  outputFileTracingIncludes: Object.fromEntries(['/api/connectors/browser', '/api/connectors/blackboard', '/api/connectors/credentials', '/api/internal/worker'].map(route => [route, ['./node_modules/playwright-core/browsers.json']])),
  outputFileTracingExcludes: { '/*': ['.env*', '.local/**', 'tests/**', 'output/**', 'docs/**', '.git/**', '**/*firebase-adminsdk*.json', '**/*service-account*.json'] },
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ] }];
  },
};
export default config;
