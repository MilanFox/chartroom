const TITLE_HEADING = /^# +.+$\n?/m;

export const bodyBelowTitle = (body: string) => body.replace(TITLE_HEADING, '');
