import { describe, expect, it } from 'vitest';
import { insertUnderSection } from './markdown-sections';

const body = ['# Title', '', '## Notes', 'first', '', '### Deep', 'nested', '', '## Next', 'last'].join('\n');

describe('insertUnderSection', () => {
  it('appends after the last non-blank line of the section', () => {
    expect(insertUnderSection(body, 'Next', 'more')).toBe([...body.split('\n'), 'more'].join('\n'));
  });

  it('keeps nested subsections inside their parent section', () => {
    const lines = insertUnderSection(body, 'Notes', 'added').split('\n');
    expect(lines.indexOf('added')).toBe(lines.indexOf('nested') + 1);
  });

  it('stops a subsection at the next heading of the same or higher level', () => {
    const lines = insertUnderSection(body, 'Deep', 'added').split('\n');
    expect(lines.slice(lines.indexOf('### Deep'), lines.indexOf('## Next'))).toEqual(['### Deep', 'nested', 'added', '']);
  });

  it('inserts straight under an empty section heading', () => {
    expect(insertUnderSection('## A\n\n## B', 'A', 'x')).toBe('## A\nx\n\n## B');
  });

  it('trims the section name and the trailing whitespace of the text', () => {
    expect(insertUnderSection('## A\nbody', '  A ', 'x\n\n')).toBe('## A\nbody\nx');
  });

  it('inserts multi-line text as separate lines', () => {
    expect(insertUnderSection('## A\nbody', 'A', 'x\ny')).toBe('## A\nbody\nx\ny');
  });

  it('refuses a section that does not exist, naming the field', () => {
    expect(() => insertUnderSection(body, 'Missing', 'x')).toThrowError(expect.objectContaining({ code: 'invalid', field: 'section' }));
  });
});
