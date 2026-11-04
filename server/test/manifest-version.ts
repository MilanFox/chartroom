import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const MANIFEST_VERSION: string = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../package.json'), 'utf8')).version;

const [major, minor] = MANIFEST_VERSION.split('.').map(Number) as [number, number];

export const MANIFEST_MAJOR = major;
export const NEXT_MINOR_VERSION = `${major}.${minor + 1}.0`;
export const NEXT_MAJOR_VERSION = `${major + 1}.0.0`;

export const asRegExpSource = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
