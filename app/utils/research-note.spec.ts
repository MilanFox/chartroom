import { describe, expect, it } from 'vitest';
import { bodyBelowTitle } from './research-note';

describe('bodyBelowTitle', () => {
  it('drops the first # heading the title was read from, keeping later ones', () => {
    expect(bodyBelowTitle('Intro\n# Local transcription\n\n## Findings\n\n# Appendix\n')).toBe('Intro\n\n## Findings\n\n# Appendix\n');
  });

  it('leaves a body without a # heading as it is', () => {
    expect(bodyBelowTitle('## Findings\n\nText')).toBe('## Findings\n\nText');
  });
});
