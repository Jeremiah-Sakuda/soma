import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ['firebase-admin', '@google-cloud/firestore'],
  outputFileTracingExcludes: { '*': ['.env*', '.local/**', 'tests/**', 'output/**', 'docs/**', '.git/**', '**/*firebase-adminsdk*.json', '**/*service-account*.json'] },
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
