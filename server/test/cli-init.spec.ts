import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { runCli } from '../../cli/src/chartroom';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

const CLI_ROOT = join(REPO_ROOT, 'cli');

const execFileAsync = promisify(execFile);

const PASSWORDS = ['admin-pw', 'admin-pw', 'viewer-pw', 'viewer-pw'];

const freshDir = () => mkdtempSync(join(tmpdir(), 'chartroom-init-'));

interface Terminal {
  answers: (string | null)[]
  startExitCode?: number
  isTTY?: boolean
  columns?: number
  env?: Record<string, string>
}

const chartroom = async (argv: string[], version = '7.3.1', terminal?: Terminal) => {
  const { isTTY, columns, env = {} } = terminal ?? {};
  let stdout = '';
  let stderr = '';
  const questions: { question: string, hidden: boolean }[] = [];
  const startedIn: string[] = [];
  const code = await runCli({
    argv,
    env,
    stdin: Readable.from(['']),
    stdout: { write: (chunk: string) => (stdout += chunk, true), isTTY, columns },
    stderr: { write: (chunk: string) => (stderr += chunk, true), isTTY, columns },
    version,
    ...terminal && {
      ask: async (question: string, options?: { hidden?: boolean }) => {
        questions.push({ question, hidden: options?.hidden ?? false });
        const answer = terminal.answers.shift();
        return answer === undefined ? null : answer;
      },
      startInstance: async (dir: string) => (startedIn.push(dir), terminal.startExitCode ?? 0),
    },
  });
  return { code, stdout, stderr, questions, startedIn };
};

// eslint-disable-next-line no-control-regex -- matches the escape sequences the CLI writes
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, '');

const GENERATED_PASSWORD = /^[A-Za-z0-9_-]{24,}$/;

const passwordOf = (envText: string, name: string) => envText.match(new RegExp(`^${name}=(.*)$`, 'm'))![1]!;

const asExample = (envText: string) => envText
  .replace(/^(CHARTROOM_(ADMIN|VIEWER)_PASSWORD=).*$/gm, '$1')
  .replace(/^CHARTROOM_PROJECT_NAME=.*$/m, '# CHARTROOM_PROJECT_NAME=');

describe('chartroom init', () => {
  it('writes compose.yaml as compose.example.yaml pinned to the CLI version, without CHARTROOM_URL or a token', async () => {
    const dir = freshDir();

    const result = await chartroom(['init', dir]);

    const example = readFileSync(join(REPO_ROOT, 'compose.example.yaml'), 'utf8');
    expect(result.code).toBe(0);
    expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toBe(example
      .replace(/ghcr\.io\/milanfox\/chartroom:\d+\.\d+\.\d+/, 'ghcr.io/milanfox/chartroom:7.3.1')
      .replace(/^ {4}container_name: .*$/m, `    container_name: ${basename(dir)}`));
  });

  it('writes .env as .env.example with two fresh random passwords, readable by the owner only', async () => {
    const dir = freshDir();
    const other = freshDir();

    await chartroom(['init', dir]);
    await chartroom(['init', other]);

    const env = readFileSync(join(dir, '.env'), 'utf8');
    const passwords = [dir, other].flatMap(target => ['CHARTROOM_ADMIN_PASSWORD', 'CHARTROOM_VIEWER_PASSWORD'].map(name => passwordOf(readFileSync(join(target, '.env'), 'utf8'), name)));
    expect(asExample(env)).toBe(readFileSync(join(REPO_ROOT, '.env.example'), 'utf8'));
    for (const password of passwords) expect(password).toMatch(GENERATED_PASSWORD);
    expect(new Set(passwords).size).toBe(4);
    expect(statSync(join(dir, '.env')).mode & 0o777).toBe(0o600);
  });

  it('refuses with exit 1 and a one-line error naming the file when either file exists, and writes nothing', async () => {
    for (const existing of ['compose.yaml', '.env']) {
      const dir = freshDir();
      writeFileSync(join(dir, existing), 'kept');

      const result = await chartroom(['init', dir]);

      expect(result, existing).toMatchObject({ code: 1, stdout: '', stderr: expect.stringMatching(new RegExp(`^chartroom: [^\\n]*${existing.replace('.', '\\.')} already exists\\n$`)) });
      expect(readdirSync(dir), existing).toEqual([existing]);
      expect(readFileSync(join(dir, existing), 'utf8'), existing).toBe('kept');
    }
  });

  it('creates a missing directory and prints the first-start checklist with the local URL and the CLI major', async () => {
    const dir = join(freshDir(), 'nested', 'chartroom');

    const result = await chartroom(['init', dir]);

    expect(result).toMatchObject({
      code: 0, stderr: '', stdout: [
        `✔ Wrote compose.yaml and .env to ${dir}`,
        '',
        'First start:',
        `1. cd ${dir} && docker compose up -d`,
        `2. Open http://localhost:3000 and sign in with the viewer password (in ${dir}/.env)`,
        `3. Admin → "Enter admin password…" → elevate with the admin password (in ${dir}/.env)`,
        '4. Token holders → create one and copy its secret, it is shown once',
        '5. In your project repo, run:',
        '  export CHARTROOM_URL=http://localhost:3000',
        '  export CHARTROOM_TOKEN=<the secret>',
        '  npx -y chartroom-cli@7 adapter --write docs/agents',
        '',
        'Project name, Effort word and Environments are optional; change them any time on the admin page.',
        'More: https://github.com/MilanFox/chartroom/blob/main/docs/operating.md',
        '',
      ].join('\n')
    });
    expect(readdirSync(dir).sort()).toEqual(['.env', 'compose.yaml']);
  });

  it('the built bin writes into the current directory by default, pinned to the package version', async () => {
    const dir = freshDir();
    const { version } = JSON.parse(readFileSync(join(CLI_ROOT, 'package.json'), 'utf8'));

    const { stdout } = await execFileAsync(process.execPath, [join(CLI_ROOT, 'dist', 'chartroom.js'), 'init'], { cwd: dir, env: {} });

    expect(stdout).toContain('1. docker compose up -d\n');
    expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain(`image: ghcr.io/milanfox/chartroom:${version}\n`);
    expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain(`    container_name: ${basename(dir)}\n`);
    expect(readdirSync(dir).sort()).toEqual(['.env', 'compose.yaml']);
  });

  it('names the container after the directory, reduced to the characters Docker allows and prefixed unless it says chartroom', async () => {
    const parent = freshDir();
    const named = [
      ['my-chartroom', 'my-chartroom'],
      ['chartroom', 'chartroom'],
      ['acme-shop', 'chartroom-acme-shop'],
      ['MyChartroom', 'MyChartroom'],
      ['My Chartroom!', 'My-Chartroom-'],
      ['.hidden', 'chartroom-hidden'],
      ['team_room.v2', 'chartroom-team_room.v2'],
      ['___', 'chartroom'],
    ];

    for (const [directory, container] of named) {
      await chartroom(['init', join(parent, directory!)]);

      expect(readFileSync(join(parent, directory!, 'compose.yaml'), 'utf8'), directory).toContain(`\n  chartroom:\n    container_name: ${container}\n`);
    }
  });

  it('writes the raw folder name as the project name, single-quoted when it needs quoting', async () => {
    const parent = freshDir();
    const named = [
      ['acme-shop', 'acme-shop'],
      ['team_room.v2', 'team_room.v2'],
      ['My Chartroom!', '\'My Chartroom!\''],
      ['a#b$c "d', '\'a#b$c "d\''],
      ['it\'s', '\'its\''],
    ];

    for (const [directory, written] of named) {
      await chartroom(['init', join(parent, directory!)]);

      expect(readFileSync(join(parent, directory!, '.env'), 'utf8'), directory).toContain(`\nCHARTROOM_PROJECT_NAME=${written}\n`);
    }
  });

  it('is listed in the usage', async () => {
    expect((await chartroom(['frobnicate'])).stderr).toContain('\n  init [dir]\n');
  });

  it('a flag or a second directory is a usage error with exit 2 and writes nothing', async () => {
    for (const extra of [['--force'], ['a', 'b']]) {
      const cwdBefore = readdirSync('.');

      const result = await chartroom(['init', ...extra.map(arg => arg.startsWith('-') ? arg : join(freshDir(), arg))]);

      expect(result, extra.join(' ')).toMatchObject({ code: 2, stdout: '' });
      expect(result.stderr, extra.join(' ')).toContain('usage: chartroom');
      expect(readdirSync('.'), extra.join(' ')).toEqual(cwdBefore);
    }
  });

  describe('on a terminal screen', () => {
    const LONG_URL = 'https://chartroom.example.com/a/rather/long/path/that/cannot/fit/on/one/row';

    it('boxes the checklist no wider than the terminal, capped at 80, with the commands unframed below it', async () => {
      for (const columns of [40, 60, 80, 200, undefined]) {
        const dir = freshDir();

        const result = await chartroom(['init', dir], '7.3.1', { answers: [...PASSWORDS, LONG_URL, '', '', '', ''], isTTY: true, columns });

        const lines = stripAnsi(result.stdout).split('\n');
        const top = lines.findIndex(line => line.startsWith('╭─ First start '));
        const bottom = lines.findIndex(line => line.startsWith('╰'));
        const box = lines.slice(top, bottom + 1);
        const width = Math.min(columns ?? 80, 80);
        expect(top, String(columns)).toBeGreaterThan(0);
        for (const line of box) expect([...line].length, `${columns}: ${line}`).toBe(width);
        expect(box[0]!.endsWith('╮')).toBe(true);
        for (const line of box.slice(1, -1)) expect(line, String(columns)).toMatch(/^│ .* │$/);
        const boxText = box.slice(1, -1).map(line => line.slice(2, -2).trim()).join(' ');
        expect(boxText.replaceAll(' ', ''), String(columns)).toContain(LONG_URL);
        expect(boxText, String(columns)).toContain('5. In your project repo, run:');
        expect(boxText, String(columns)).not.toContain('export');
        expect(lines.slice(bottom + 1).filter(line => line.startsWith('  ')), String(columns)).toEqual([
          `  export CHARTROOM_URL=${LONG_URL}`,
          '  export CHARTROOM_TOKEN=<the secret>',
          '  npx -y chartroom-cli@7 adapter --write docs/agents',
        ]);
      }
    });

    it('colours the step headers, the ready line and the commands', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: [...PASSWORDS, '', '', '', '', 'y'], isTTY: true, columns: 80 });

      expect(result.stderr).toContain('\n\u001b[36m◆\u001b[0m \u001b[1mAdmin password\u001b[0m \u001b[2m(1/7)\u001b[0m\n');
      expect(result.stdout.split('\n')[0]).toBe(`\u001b[32m✔\u001b[0m \u001b[1mChartroom is running in ${dir}\u001b[0m`);
      expect(result.stdout).toContain('\n  \u001b[36mexport CHARTROOM_URL=http://localhost:3000\u001b[0m\n');
    });

    it('writes plain text without a box when NO_COLOR is set or the stream is not a terminal', async () => {
      const dir = freshDir();
      const answers = () => [...PASSWORDS, '', '', '', '', ''];

      const plain = await chartroom(['init', dir], '7.3.1', { answers: answers() });
      const noColor = await chartroom(['init', freshDir()], '7.3.1', { answers: answers(), isTTY: true, columns: 80, env: { NO_COLOR: '1' } });

      for (const result of [plain, noColor]) {
        expect(`${result.stdout}${result.stderr}`).not.toContain('\u001b');
        expect(result.stdout).not.toContain('╭');
        expect(result.stdout).toContain('\nFirst start:\n1. cd ');
      }
    });
  });

  describe('in a terminal', () => {
    it('walks seven steps and writes the chosen passwords, public URL, port and update choice', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['typed-admin', 'typed-admin', 'typed-viewer', 'typed-viewer', 'https://chart.example.com', '8080', 'n', 'y', 'n'] });

      const example = readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');
      expect(result.code).toBe(0);
      expect(readFileSync(join(dir, '.env'), 'utf8')).toBe(example
        .replace('CHARTROOM_ADMIN_PASSWORD=', 'CHARTROOM_ADMIN_PASSWORD=\'typed-admin\'')
        .replace('CHARTROOM_VIEWER_PASSWORD=', 'CHARTROOM_VIEWER_PASSWORD=\'typed-viewer\'')
        .replace('# CHARTROOM_PROJECT_NAME=', `CHARTROOM_PROJECT_NAME=${basename(dir)}`)
        .replace('# CHARTROOM_BASE_URL=', 'CHARTROOM_BASE_URL=https://chart.example.com')
        .replace('# CHARTROOM_UPDATE_CHECK=true', 'CHARTROOM_UPDATE_CHECK=false'));
      expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain('      - "127.0.0.1:8080:3000"\n');
      expect(result.questions.map(({ hidden }) => hidden)).toEqual([true, true, true, true, false, false, false, false, false]);
      expect(result.questions.map(({ question }) => question).filter((_, index) => index < 4)).toEqual(['Admin password: ', 'Repeat: ', 'Viewer password: ', 'Repeat: ']);
      expect([...result.stderr.matchAll(/^◆ [A-Z][A-Za-z ]+ \((\d)\/7\)$/gm)].map(([, step]) => step)).toEqual(['1', '2', '3', '4', '5', '6', '7']);
      expect(result.stderr).not.toContain('typed-admin');
      expect(result.stderr).not.toContain('typed-viewer');
      expect(result.stderr).toContain('Admin password: set\nViewer password: set\n');
      expect(result.stdout).toContain('2. Open https://chart.example.com and sign in with your viewer password\n   Put a TLS reverse proxy in front: https://github.com/MilanFox/chartroom/blob/main/docs/operating.md#tls-at-the-reverse-proxy\n');
      expect(result.stdout).toContain('\n  export CHARTROOM_URL=https://chart.example.com\n');
      expect(result.stdout).not.toContain('typed-');
      expect(result.stdout).toMatch(new RegExp(`^✔ Wrote compose\\.yaml and \\.env to ${dir}\\n\\nFirst start:\\n`));
      expect(result.stdout).not.toContain(join(dir, '.env'));
      expect(result.startedIn).toEqual([]);
    });

    it('never offers to generate a password', async () => {
      const result = await chartroom(['init', freshDir()], '7.3.1', { answers: [...PASSWORDS, '', '', '', '', ''] });

      expect(result.code).toBe(0);
      expect(`${result.questions.map(({ question }) => question).join('\n')}\n${result.stderr}`).not.toMatch(/generat/i);
    });

    it('re-asks an empty password and a repeat that does not match, with a one-line reason each', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['', 'first', 'typo', 'first', 'first', 'viewer', 'viewer', '', '', '', '', ''] });

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(result.questions.map(({ question }) => question).filter((_, index) => index < 7)).toEqual(['Admin password: ', 'Admin password: ', 'Repeat: ', 'Admin password: ', 'Repeat: ', 'Viewer password: ', 'Repeat: ']);
      expect(result.stderr.match(/^A password is required\.$/gm)).toHaveLength(1);
      expect(result.stderr.match(/^The passwords do not match\.$/gm)).toHaveLength(1);
      expect(passwordOf(env, 'CHARTROOM_ADMIN_PASSWORD')).toBe('\'first\'');
      expect(passwordOf(env, 'CHARTROOM_VIEWER_PASSWORD')).toBe('\'viewer\'');
    });

    it('takes every default on Enter after the passwords: no public URL, port 3000, update check on, not started', async () => {
      const dir = freshDir();
      const plain = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: [...PASSWORDS, '', '', '', '', ''] });
      const nonInteractive = await chartroom(['init', plain]);

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(asExample(env)).toBe(readFileSync(join(REPO_ROOT, '.env.example'), 'utf8'));
      expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toBe(readFileSync(join(plain, 'compose.yaml'), 'utf8').replace(`container_name: ${basename(plain)}`, `container_name: ${basename(dir)}`));
      expect(result.stdout).toBe(nonInteractive.stdout
        .replaceAll(plain, dir)
        .replace(`sign in with the viewer password (in ${dir}/.env)`, 'sign in with your viewer password')
        .replace(` with the admin password (in ${dir}/.env)`, ''));
      expect(result.stdout).toContain('\n3. Admin → "Enter admin password…" → elevate\n');
      expect(result.startedIn).toEqual([]);
    });

    it('re-asks on a viewer password equal to the admin one, a non-http URL, an out-of-range port and an unclear yes/no', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['same', 'same', 'same', 'other', 'other', 'ftp://example.com', 'not a url', '', '0', '70000', 'abc', '3001', 'maybe', '', '', ''] });

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(result.questions).toHaveLength(16);
      expect(result.stderr).toContain('Must differ from the admin password.\n');
      expect(passwordOf(env, 'CHARTROOM_ADMIN_PASSWORD')).toBe('\'same\'');
      expect(passwordOf(env, 'CHARTROOM_VIEWER_PASSWORD')).toBe('\'other\'');
      expect(env).toContain('\n# CHARTROOM_BASE_URL=\n');
      expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain('"127.0.0.1:3001:3000"');
      expect(result.stdout).toContain('2. Open http://localhost:3001 and sign in');
    });

    it('single-quotes chosen passwords and re-asks one holding a single quote or a control character', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['it\'s', 'tab\there', 'a#b$c "d', 'a#b$c "d', 'x\u001bz', 'viewer', 'viewer', '', '', '', '', ''] });

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(result.questions).toHaveLength(12);
      expect(result.stderr.match(/^Must not contain ' or control characters\.$/gm)).toHaveLength(3);
      expect(env).toContain('\nCHARTROOM_ADMIN_PASSWORD=\'a#b$c "d\'\n');
      expect(env).toContain('\nCHARTROOM_VIEWER_PASSWORD=\'viewer\'\n');
    });

    it('keeps the surrounding spaces of a chosen password but trims the other answers', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['  admin pw ', '  admin pw ', ' viewer ', ' viewer ', '  https://chart.example.com ', ' 8080 ', ' n ', ' y ', ' n '] });

      const env = readFileSync(join(dir, '.env'), 'utf8');
      expect(result.code).toBe(0);
      expect(passwordOf(env, 'CHARTROOM_ADMIN_PASSWORD')).toBe('\'  admin pw \'');
      expect(passwordOf(env, 'CHARTROOM_VIEWER_PASSWORD')).toBe('\' viewer \'');
      expect(env).toContain('\nCHARTROOM_BASE_URL=https://chart.example.com\n');
      expect(env).toContain('\nCHARTROOM_UPDATE_CHECK=false\n');
      expect(readFileSync(join(dir, 'compose.yaml'), 'utf8')).toContain('"127.0.0.1:8080:3000"');
    });

    it('declining the review exits 1 and writes nothing, not even the directory', async () => {
      const dir = join(freshDir(), 'chartroom');

      const result = await chartroom(['init', dir], '7.3.1', { answers: [...PASSWORDS, '', '', '', 'n'] });

      expect(result).toMatchObject({ code: 1, stdout: '', stderr: expect.stringMatching(/chartroom: aborted, nothing written\n$/) });
      expect(existsSync(dir)).toBe(false);
    });

    it('input ending mid-wizard exits 1 and writes nothing', async () => {
      const dir = join(freshDir(), 'chartroom');

      const result = await chartroom(['init', dir], '7.3.1', { answers: ['admin-pw', null] });

      expect(result).toMatchObject({ code: 1, stdout: '' });
      expect(existsSync(dir)).toBe(false);
    });

    it('refuses an existing file before asking anything', async () => {
      const dir = freshDir();
      writeFileSync(join(dir, '.env'), 'kept');

      const result = await chartroom(['init', dir], '7.3.1', { answers: [...PASSWORDS, '', '', '', '', ''] });

      expect(result).toMatchObject({ code: 1, questions: [] });
    });

    it('starting now runs the instance in the directory and drops the docker step from the checklist', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: [...PASSWORDS, '', '', '', '', 'y'] });

      expect(result).toMatchObject({ code: 0, startedIn: [dir] });
      expect(result.stdout).not.toContain('docker compose up -d');
      expect(result.stdout).toMatch(new RegExp(`^✔ Chartroom is running in ${dir}\\n`));
      expect(result.stdout).toContain('\n1. Open http://localhost:3000 and sign in with your viewer password\n2. Admin');
      expect(result.stdout).toContain('\n4. In your project repo, run:\n');
    });

    it('a failed start exits with its code and keeps the docker step in the checklist', async () => {
      const dir = freshDir();

      const result = await chartroom(['init', dir], '7.3.1', { answers: [...PASSWORDS, '', '', '', '', 'y'], startExitCode: 3 });

      expect(result.code).toBe(3);
      expect(result.stdout).toContain(`\n1. cd ${dir} && docker compose up -d\n`);
      expect(result.stdout).toMatch(/^✔ Wrote compose\.yaml/);
    });
  });
});
