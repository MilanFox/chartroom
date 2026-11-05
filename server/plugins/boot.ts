import { migrateStore, readMigrationState } from '../db/migrate';

const fail = (message: string): never => {
  process.stderr.write(`${message}\n`);
  process.exit(1);
};

const loadConfig = () => {
  try {
    return useDeploymentConfig();
  }
  catch (error) {
    if (error instanceof MissingVariableError) fail(error.message);
    throw error;
  }
};

const newerStoreMessage = (dataDir: string, imageIndex: string) => {
  const restorable = snapshotToRestore(dataDir, imageIndex);
  const restore = restorable
    ? `restore the pre-migrate Snapshot ${snapshotFile(dataDir, restorable.name)}, the newest taken from schema ${imageIndex} or older`
    : `no pre-migrate Snapshot from schema ${imageIndex} or older exists in ${snapshotsDir(dataDir)}`;
  return `the store at ${storeFile(dataDir)} carries migrations this image does not know; ${restore}`;
};

const boot = async (config: DeploymentConfig) => {
  const store = openStore(config.dataDir);
  process.stdout.write(`store open at ${storeFile(config.dataDir)}\n`);
  const { unknownApplied, lastAppliedIndex, imageIndex, pending } = await readMigrationState(store);
  if (unknownApplied) fail(newerStoreMessage(config.dataDir, imageIndex ?? ''));
  if (pending.length && lastAppliedIndex) {
    const snapshot = takeSnapshot(store, config.dataDir, preMigrateStem(lastAppliedIndex, useRuntimeConfig().version));
    process.stdout.write(`pre-migrate Snapshot taken: ${snapshotFile(config.dataDir, snapshot.name)}\n`);
  }
  const applied = migrateStore(store, pending);
  process.stdout.write(applied.length ? `applied migrations: ${applied.join(', ')}\n` : 'schema up to date\n');
};

export default defineNitroPlugin((nitroApp) => {
  const config = loadConfig();
  process.env.NITRO_PORT = String(config.port);
  startUpdateCheck(config);
  const ready = boot(config).catch(error => fail(`boot failed: ${error instanceof Error ? error.message : String(error)}`));
  nitroApp.hooks.hook('request', () => ready);
});
