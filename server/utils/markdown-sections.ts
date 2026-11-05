import { invalid } from './errors';

const HEADING = /^(#{1,6})\s+(.*)$/;

const headingOf = (line: string) => {
  const match = HEADING.exec(line);
  return match ? { level: match[1]!.length, text: match[2]!.trim() } : null;
};

const findSection = (lines: string[], section: string) => {
  const wanted = section.trim();
  const start = lines.findIndex(line => headingOf(line)?.text === wanted);
  if (start === -1) throw invalid(`section ${section} does not exist`, 'section');
  const { level } = headingOf(lines[start]!)!;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const heading = headingOf(lines[index]!);
    if (heading && heading.level <= level) {
      end = index;
      break;
    }
  }
  let last = start;
  for (let index = end - 1; index > start; index -= 1) {
    if (lines[index]!.trim() !== '') {
      last = index;
      break;
    }
  }
  return { start, last };
};

export const insertUnderSection = (body: string, section: string, text: string) => {
  const lines = body.split('\n');
  const { last } = findSection(lines, section);
  return [...lines.slice(0, last + 1), ...text.trimEnd().split('\n'), ...lines.slice(last + 1)].join('\n');
};

export const replaceSectionContent = (body: string, section: string, text: string) => {
  const lines = body.split('\n');
  const { start, last } = findSection(lines, section);
  return [...lines.slice(0, start + 1), ...text.trimEnd().split('\n'), ...lines.slice(last + 1)].join('\n');
};

export const bodyExcerpt = (body: string) =>
  body.split(/\n\s*\n/).map(paragraph => paragraph.trim()).find(paragraph => paragraph && !paragraph.startsWith('#') && !paragraph.startsWith('<!--'))?.replace(/\s+/g, ' ') ?? '';
