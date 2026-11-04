import { execFileSync } from 'node:child_process';

type Commit = { hash: string, subject: string };
type Entry = Commit & { type?: string, scope?: string, breaking: boolean, description: string };

const SECTIONS: [type: string, heading: string][] = [
  ['feat', 'Features'],
  ['fix', 'Fixes'],
];

const CONVENTIONAL = /^(?<type>\w+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?: (?<description>.+)$/;

const parse = ({ hash, subject }: Commit): Entry => {
  const groups = CONVENTIONAL.exec(subject)?.groups;
  if (!groups) return { hash, subject, breaking: false, description: subject };
  return { hash, subject, type: groups.type, scope: groups.scope, breaking: Boolean(groups.bang), description: groups.description! };
};

const line = ({ hash, scope, description }: Entry) => `- ${scope ? `**${scope}:** ` : ''}${description} (${hash})`;

const section = (heading: string, lines: string[]) => (lines.length ? [`## ${heading}`, '', ...lines, ''] : []);

export const releaseNotes = (commits: Commit[]) => {
  if (!commits.length) return 'No changes since the previous release.\n';
  const entries = commits.map(parse);
  const sectionTypes = SECTIONS.map(([type]) => type);
  return [
    ...section('Breaking changes', entries.filter(entry => entry.breaking).map(line)),
    ...SECTIONS.flatMap(([type, heading]) => section(heading, entries.filter(entry => entry.type === type).map(line))),
    ...section('Other changes', entries
      .filter(entry => !sectionTypes.includes(entry.type ?? ''))
      .map(({ hash, subject }) => `- ${subject} (${hash})`)),
  ].join('\n');
};

const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const previousTag = (tag: string) => {
  try {
    return git('describe', '--tags', '--abbrev=0', '--match', 'v*', `${tag}^`);
  }
  catch {
    return undefined;
  }
};

if (import.meta.main) {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? 'HEAD';
  const previous = previousTag(tag);
  const log = git('log', '--no-merges', '--format=%h%x09%s', previous ? `${previous}..${tag}` : tag);
  const commits = log.split('\n').filter(Boolean).map((row) => {
    const [hash = '', subject = ''] = row.split('\t');
    return { hash, subject };
  });
  process.stdout.write(releaseNotes(commits));
}
