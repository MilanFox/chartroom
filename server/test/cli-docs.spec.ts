import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VERB_ROUTES, VERBS } from '../../cli/src/chartroom';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

const flagsByCommand = new Map(VERB_ROUTES.map(route => [route.command, route.flags]));

const commands = [...flagsByCommand.keys()];

const commandOf = (words: string[]) => commands
  .filter(command => command.split(' ').every((word, index) => words[index] === word))
  .reduce<string | undefined>((longest, command) => command.length > (longest?.length ?? 0) ? command : longest, undefined);

const examplesIn = (path: string, binary: string) => [...read(path).matchAll(new RegExp(`\`${binary} ([^\`]+)\``, 'g'))].map(match => match[1]!);

const flagsUsedIn = (example: string) => [
  ...[...example.matchAll(/(?<![\w-])--([a-z][\w-]*)/g)].map(match => match[1]!),
  ...[...example.matchAll(/(?<=\s)-([a-z])(?=\s)/g)].map(match => match[1]!),
];

const unknownFlagsIn = (examples: string[]) => examples.flatMap((example) => {
  const words = example.split(' ');
  if (words[0] === 'init') return [];
  const command = commandOf(words);
  if (!command) return [`${example}: no such verb`];
  return flagsUsedIn(example).filter(flag => !flagsByCommand.get(command)!.includes(flag)).map(flag => `${example}: --${flag} is not a flag of ${command}`);
});

describe('the CLI README', () => {
  const readmeExamples = examplesIn('cli/README.md', 'chart');

  it('has a chart example for every CLI verb', () => {
    const documented = new Set(readmeExamples.map(example => commandOf(example.split(' '))).filter(Boolean));

    expect(commands.filter(command => !documented.has(command))).toEqual([]);
  });

  it('uses only flags the verb has', () => {
    expect(unknownFlagsIn(readmeExamples)).toEqual([]);
  });
});

describe.each(['issue-tracker.md', 'triage-labels.md'])('the Adapter template %s', (file) => {
  it('names only verbs and flags the CLI has', () => {
    expect(unknownFlagsIn(examplesIn(`server/adapter/${file}`, 'chartroom'))).toEqual([]);
  });
});

describe('the global flags', () => {
  it('are never redeclared by a verb except --url on issue link add', () => {
    const redeclared = VERBS.flatMap(verb => Object.keys(verb.flags ?? {}).filter(name => name === 'url' || name === 'token').map(name => `${verb.words.join(' ')} --${name}`));

    expect(redeclared).toEqual(['issue link add --url']);
  });
});
