import type { FullConfig } from '@playwright/test';
import { rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, resolve } from 'node:path';

/** Remove only the isolated synthetic database directory owned by this run. */
export default function cleanup(config: FullConfig) {
  const database = config.webServer?.env?.SOMA_LOCAL_DATABASE_PATH;
  if (!database || config.webServer?.env?.SOMA_PERSISTENCE !== 'local-synthetic') return;
  const directory = resolve(dirname(database));
  if (!basename(directory).startsWith('soma-e2e-') || realpathSync(dirname(directory)) !== realpathSync(tmpdir())) throw new Error('Refusing cleanup outside the synthetic test directory.');
  rmSync(directory, { recursive: true, force: true });
}
