import { config as loadDotenv } from 'dotenv';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Local runs read API_URL and the CI accounts from .env; a variable the shell
// or Jenkins already set wins, since dotenv never overrides one.
loadDotenv({ quiet: true });

// The suites that talk to the deployed API share one throttle budget and one
// session per role, so they run one file at a time in a single process.
const againstDeployedApi = {
  globalSetup: ['test/support/global-setup.ts'],
  fileParallelism: false,
  isolate: false,
  testTimeout: 120_000,
  hookTimeout: 300_000,
};

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    projects: [
      { extends: true, test: { name: 'unit', include: ['test/*.test.ts'] } },
      {
        extends: true,
        test: { name: 'funcional', include: ['test/regression/funcional/**/*.test.ts'] },
      },
      {
        extends: true,
        test: { name: 'api', include: ['test/regression/api/**/*.test.ts'], ...againstDeployedApi },
      },
      {
        extends: true,
        test: {
          name: 'seguridad',
          include: ['test/regression/seguridad/**/*.test.ts'],
          ...againstDeployedApi,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // Whitelist, not discovery: SWC erases `import type`, so a module a test
      // only imports as a type never loads and would be missing from the report.
      // Mirrored by sonar.coverage.exclusions in sonar-project.properties.
      include: [
        'src/common/filters/all-exceptions.filter.ts',
        'src/modules/audit/audit.service.ts',
        'src/modules/audit/repositories/audit.repository.ts',
        'src/modules/auth/credentials.service.ts',
        'src/modules/auth/user.mapper.ts',
        'src/modules/catalog/products-admin.service.ts',
        'src/modules/catalog/products.service.ts',
        'src/modules/inventory/movements.service.ts',
        'src/modules/inventory/repositories/stock.mapper.ts',
        'src/modules/inventory/stock.service.ts',
        'src/modules/invitations/invitations.service.ts',
        'src/modules/reports/report-range.ts',
        'src/modules/users/profile.service.ts',
        'src/modules/users/users.service.ts',
      ],
    },
  },
});
