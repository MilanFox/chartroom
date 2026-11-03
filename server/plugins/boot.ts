import { migrateStore } from '../db/migrate';

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

const boot = async (config: DeploymentConfig) => {
  const store = openStore(config.dataDir);
  process.stdout.write(`store open at ${storeFile(config.dataDir)}\n`);
  const applied = await migrateStore(store);
  process.stdout.write(applied.length ? `applied migrations: ${applied.join(', ')}\n` : 'schema up to date\n');
};

export default defineNitroPlugin((nitroApp) => {
  const config = loadConfig();
  process.env.NITRO_PORT = String(config.port);
  const ready = boot(config).catch(error => fail(`boot failed: ${error instanceof Error ? error.message : String(error)}`));
  nitroApp.hooks.hook('request', () => ready);
});
