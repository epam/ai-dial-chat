/*
 * Generates the Config Studio schema artifact of the current managed-config
 * version and `index.json` from the configuration registry.
 *
 * Run with `npm run managed-config-schema` (Nx target
 * `chat-api:managed-config-schema`). It imports only the registry and the
 * managed-config modules: no Nest application starts, and no environment
 * variable, `.env` file or ConfigService value is read, so nothing from the
 * machine running it can reach the artifact. Older committed versions are
 * read back unchanged, because a released version is never regenerated.
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { CONFIG_DEFINITIONS } from './app-config/config-registry/config-registry.constants';
import {
  buildManagedConfigArtifact,
  buildManagedConfigIndex,
  managedConfigArtifactFileName,
  type ManagedConfigArtifact,
} from './app-config/managed-config/managed-config-artifact';
import { MANAGED_CONFIG_SCHEMA_VERSION } from './app-config/managed-config/managed-config.constants';

const outputDirectory = join(__dirname, '..', 'managed-config-schema');
const INDEX_FILE = 'index.json';
const ARTIFACT_FILE_PATTERN = /^chat-ui-.+\.json$/;

const toFileContent = (value: unknown): string =>
  `${JSON.stringify(value, null, 2)}\n`;

const readCommittedArtifacts = async (): Promise<ManagedConfigArtifact[]> => {
  const currentFile = managedConfigArtifactFileName(
    MANAGED_CONFIG_SCHEMA_VERSION,
  );
  const files = (await readdir(outputDirectory)).filter(
    (file) => ARTIFACT_FILE_PATTERN.test(file) && file !== currentFile,
  );
  return Promise.all(
    files.map(async (file) => {
      const artifact = JSON.parse(
        await readFile(join(outputDirectory, file), 'utf8'),
      ) as ManagedConfigArtifact;
      if (managedConfigArtifactFileName(artifact.schemaVersion) !== file) {
        throw new Error(`${file} does not hold its own schema version`);
      }
      return artifact;
    }),
  );
};

const generate = async (): Promise<void> => {
  const current = buildManagedConfigArtifact(
    CONFIG_DEFINITIONS,
    MANAGED_CONFIG_SCHEMA_VERSION,
  );
  const index = buildManagedConfigIndex([
    ...(await readCommittedArtifacts()),
    current,
  ]);
  if (index.current !== MANAGED_CONFIG_SCHEMA_VERSION) {
    throw new Error(
      `MANAGED_CONFIG_SCHEMA_VERSION ${MANAGED_CONFIG_SCHEMA_VERSION} is older than the committed ${index.current}`,
    );
  }

  await writeFile(
    join(outputDirectory, managedConfigArtifactFileName(current.schemaVersion)),
    toFileContent(current),
  );
  await writeFile(join(outputDirectory, INDEX_FILE), toFileContent(index));
};

generate().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
