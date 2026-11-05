import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { basename, join, resolve as resolvePath } from 'node:path';
import type { AskOptions, CliContext, Handler } from './shared.js';
import { CliExit, majorOf, ownVersion, strictArgs, UsageError } from './shared.js';
import { boxWidth, checklistBox, stylesFor, visibleLength, wrap } from './terminal.js';

interface InitSettings {
  dir: string
  version: string
  adminPassword: string
  viewerPassword: string
  passwordsChosen: boolean
  baseUrl?: string
  port: number
  updateCheck: boolean
}

const OPERATING_DOC = 'https://github.com/MilanFox/chartroom/blob/main/docs/operating.md';

const containerNameOf = (dir: string) => {
  const sanitised = basename(resolvePath(dir)).replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^[^a-zA-Z0-9]+/, '');
  if (!sanitised) return 'chartroom';
  return /chartroom/i.test(sanitised) ? sanitised : `chartroom-${sanitised}`;
};

const COMPOSE_TEMPLATE = ({ dir, version, port }: InitSettings) => `services:
  chartroom:
    container_name: ${containerNameOf(dir)}
    image: ghcr.io/milanfox/chartroom:${version}
    env_file: .env
    environment:
      # Published on loopback only, so every request arrives through the reverse proxy; trust its forwarded headers.
      CHARTROOM_TRUST_PROXY: "true"
    ports:
      - "127.0.0.1:${port}:3000"
    volumes:
      - chartroom-data:/data
    init: true
    restart: unless-stopped

volumes:
  chartroom-data:
`;

// eslint-disable-next-line no-control-regex -- control characters are exactly what is rejected
const UNQUOTABLE = /['\u0000-\u001f\u007f]/;

const UNQUOTABLE_REASON = 'Must not contain \' or control characters.';

const titleOf = (folderName: string) => folderName
  .replace(/[-_\s]+/g, ' ')
  .trim()
  .replace(/(^| )(\S)/g, (_, gap: string, initial: string) => gap + initial.toUpperCase());

const projectNameOf = (dir: string) => {
  const folderName = basename(resolvePath(dir));
  const name = titleOf(folderName) || folderName;
  return /^[\w.-]+$/.test(name) ? name : `'${name.replace(new RegExp(UNQUOTABLE, 'g'), '')}'`;
};

const ENV_TEMPLATE = ({ dir, adminPassword, viewerPassword, passwordsChosen, baseUrl, updateCheck }: InitSettings) => `# Chartroom environment, see ${OPERATING_DOC}

# Required. Elevates any session to Admin.
CHARTROOM_ADMIN_PASSWORD=${passwordsChosen ? `'${adminPassword}'` : adminPassword}
# Required. Shared read-only login for the UI.
CHARTROOM_VIEWER_PASSWORD=${passwordsChosen ? `'${viewerPassword}'` : viewerPassword}

# Optional, default none. Project name shown until one is saved in Settings; init writes the folder name formatted as a title.
CHARTROOM_PROJECT_NAME=${projectNameOf(dir)}
# Optional, default derived from the request. Public URL used in absolute links, e.g. https://chartroom.example.com
${baseUrl ? `CHARTROOM_BASE_URL=${baseUrl}` : '# CHARTROOM_BASE_URL='}
# Optional, default false. true reads X-Forwarded-For and X-Forwarded-Proto from the reverse proxy.
# CHARTROOM_TRUST_PROXY=false
# Optional, default 3000. Port the server listens on inside the container.
# CHARTROOM_PORT=3000
# Optional, default true. false stops the daily check for a newer release.
${updateCheck ? '# CHARTROOM_UPDATE_CHECK=true' : 'CHARTROOM_UPDATE_CHECK=false'}
`;

const freshPassword = () => randomBytes(24).toString('base64url');

const firstStartChecklist = ({ dir, version, baseUrl, port, passwordsChosen }: InitSettings, started: boolean, { stdout, env }: CliContext) => {
  const styles = stylesFor(stdout, env);
  const { bold, dim, green, boldYellow, chip } = styles;
  const copyable = (text: string) => `     ${chip(text)}`;
  const url = baseUrl ?? `http://localhost:${port}`;
  const envFile = join(dir, '.env');
  const viewerPassword = passwordsChosen ? 'your viewer password' : `the viewer password (in ${envFile})`;
  const steps = [
    ...started ? [] : [dir === '.' ? 'docker compose up -d' : `cd ${dir} && docker compose up -d`],
    `Open ${url} and sign in with ${viewerPassword}${url.startsWith('https:') ? `\nPut a TLS reverse proxy in front: ${OPERATING_DOC}#tls-at-the-reverse-proxy` : ''}`,
    `Admin → "Enter admin password…" → elevate${passwordsChosen ? '' : ` with the admin password (in ${envFile})`}`,
    'Token holders → create one and copy its secret, it is shown once',
  ];
  const connectTitle = `${steps.length + 1}. Connect your agents`;
  const connectSubsteps = [
    '  a. Install the CLI',
    copyable(`npm install -g chartroom-cli@${majorOf(version)}`),
    ...wrap(`Rather not install it? Prefix commands with npx -y chartroom-cli@${majorOf(version)}. For scripts without the CLI: ${url}/api/v1/openapi.json (bearer = the Token holder's secret).`, boxWidth(stdout.columns) - 5).map(line => `     ${dim(line)}`),
    '',
    '  b. Add to the repo\'s untracked .env',
    copyable(`CHARTROOM_URL=${url}`),
    copyable('CHARTROOM_TOKEN=<the secret>'),
    '',
    '  c. Run /setup-matt-pocock-skills and pick Other at "Issue tracker"',
    `     ${boldYellow('Paste this to your agent:')}`,
    copyable(`Chartroom at ${url}. Run \`chartroom adapter\` and write each file it prints, verbatim, to the path in its marker line.`),
  ];
  return [
    `${green('✔')} ${bold(started ? `Chartroom is running in ${dir}` : `Wrote compose.yaml and .env to ${dir}`)}`,
    '',
    ...styles.styled
      ? [
          ...checklistBox([...steps, 'In your project repo, connect your agents (continue below)'], stdout.columns, styles),
          `${dim('──')} ${bold(connectTitle)} ${dim('─'.repeat(boxWidth(stdout.columns) - visibleLength(connectTitle) - 4))}`,
        ]
      : ['First start:', ...steps.flatMap((step, index) => step.split('\n').map((line, lineIndex) => `${lineIndex ? '  ' : `${index + 1}.`} ${line}`)), `${steps.length + 1}. In your project repo, connect your agents:`],
    ...connectSubsteps,
    '',
    dim('Project name, Effort Display label and Environments are optional; change them any time on the admin page.'),
    dim(`More: ${OPERATING_DOC}`),
    '',
  ].join('\n');
};

const yesOrNo = (typed: string, byDefault: boolean) => typed === '' ? byDefault : /^y(es)?$/i.test(typed) ? true : /^no?$/i.test(typed) ? false : undefined;

const isHttpUrl = (typed: string) => URL.canParse(typed) && ['http:', 'https:'].includes(new URL(typed).protocol);

const runWizard = async (context: CliContext, ask: NonNullable<CliContext['ask']>, defaults: InitSettings) => {
  const { bold, dim, cyan } = stylesFor(context.stderr, context.env);
  const say = (line: string) => context.stderr.write(`${line}\n`);
  const step = (number: number, name: string) => say(`\n${cyan('◆')} ${bold(name)} ${dim(`(${number}/7)`)}`);
  const answer = async <Accepted>({ question, ...options }: AskOptions & { question: string }, accept: Handler<[string], Accepted | undefined>, invalid: string | Handler<[string], string>) => {
    for (;;) {
      const typed = await ask(question, options);
      if (typed === null) throw new CliExit('input ended, nothing written', 1);
      const kept = options.hidden ? typed : typed.trim();
      const accepted = accept(kept);
      if (accepted !== undefined) return accepted;
      say(typeof invalid === 'string' ? invalid : invalid(kept));
    }
  };
  const confirm = (question: string, byDefault: boolean) => answer({ question }, typed => yesOrNo(typed, byDefault), 'Answer y or n.');

  const choosePassword = async (name: string, mustDifferFrom?: string) => {
    for (;;) {
      const chosen = await answer(
        { question: `${name} password: `, hidden: true },
        typed => typed === '' || UNQUOTABLE.test(typed) || typed === mustDifferFrom ? undefined : typed,
        typed => typed === '' ? 'A password is required.' : UNQUOTABLE.test(typed) ? UNQUOTABLE_REASON : 'Must differ from the admin password.',
      );
      if (await answer({ question: 'Repeat: ', hidden: true }, typed => typed, '') === chosen) return chosen;
      say('The passwords do not match.');
    }
  };

  step(1, 'Admin password');
  const adminPassword = await choosePassword('Admin');
  step(2, 'Viewer password');
  const viewerPassword = await choosePassword('Viewer', adminPassword);
  step(3, 'Public URL');
  const baseUrl = await answer({ question: 'Public URL, e.g. https://chartroom.example.com (Enter to skip): ' }, typed => typed === '' || isHttpUrl(typed) ? typed : undefined, 'Enter an http or https URL, or nothing to skip.');
  step(4, 'Host port');
  say(dim('3000 is the default port of common dev servers (Nuxt, Next, Express, Hono) and may collide with what you are building.'));
  const port = await answer({ question: `Host port (Enter for ${defaults.port}): ` }, typed => typed === '' ? defaults.port : /^\d+$/.test(typed) && Number(typed) >= 1 && Number(typed) <= 65535 ? Number(typed) : undefined, 'Enter a port from 1 to 65535.');
  step(5, 'Update check');
  const updateCheck = await confirm('Check daily for a newer release? [Y/n] ', true);
  const settings: InitSettings = {
    ...defaults,
    adminPassword,
    viewerPassword,
    passwordsChosen: true,
    baseUrl: baseUrl || undefined,
    port,
    updateCheck,
  };
  step(6, 'Review');
  say(`Directory: ${settings.dir}`);
  say('Admin password: set');
  say('Viewer password: set');
  say(`Public URL: ${settings.baseUrl ?? 'not set'}`);
  say(`Host port: ${settings.port}`);
  say(`Update check: ${settings.updateCheck ? 'on' : 'off'}`);
  if (!await confirm('Write compose.yaml and .env? [Y/n] ', true)) throw new CliExit('aborted, nothing written', 1);
  step(7, 'Start now');
  const start = await confirm('Run docker compose up -d now? [y/N] ', false);
  return { settings, start };
};

const dockerComposeUp = (context: CliContext) => (dir: string) => new Promise<number>((resolve) => {
  spawn('docker', ['compose', 'up', '-d'], { cwd: dir, stdio: 'inherit' })
    .on('error', (error) => {
      context.stderr.write(`chartroom: cannot run docker: ${error.message}\n`);
      resolve(127);
    })
    .on('close', code => resolve(code ?? 1));
});

const dockerProblem = () => {
  const daemon = spawnSync('docker', ['info'], { stdio: 'ignore' });
  if (daemon.error) return `cannot run docker: ${daemon.error.message}`;
  if (daemon.status !== 0) return 'the Docker daemon is not reachable, start it and try again';
  return spawnSync('docker', ['compose', 'version'], { stdio: 'ignore' }).status === 0 ? undefined : '`docker compose` is not available, install the Docker Compose plugin';
};

export const initInstance = async (context: CliContext) => {
  const { positionals } = strictArgs(context.argv.slice(1), {});
  if (positionals.length > 1) throw new UsageError('expected init [dir]');
  const dir = positionals[0] ?? '.';
  const taken = ['compose.yaml', '.env'].map(file => join(dir, file)).find(existsSync);
  if (taken) {
    context.stderr.write(`chartroom: ${taken} already exists\n`);
    return 1;
  }
  const problem = await (context.checkDocker ?? dockerProblem)();
  if (problem) throw new CliExit(`${problem}, nothing written`, 1);
  const defaults: InitSettings = { dir, version: context.version ?? ownVersion(), adminPassword: freshPassword(), viewerPassword: freshPassword(), passwordsChosen: false, port: 3000, updateCheck: true };
  const { settings, start } = context.ask ? await runWizard(context, context.ask, defaults) : { settings: defaults, start: false };
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'compose.yaml'), COMPOSE_TEMPLATE(settings));
  await writeFile(join(dir, '.env'), ENV_TEMPLATE(settings), { mode: 0o600 });
  const exitCode = start ? await (context.startInstance ?? dockerComposeUp(context))(dir) : 0;
  context.stdout.write(firstStartChecklist(settings, start && exitCode === 0, context));
  return exitCode;
};
