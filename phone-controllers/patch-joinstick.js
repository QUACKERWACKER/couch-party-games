import {readFile, writeFile} from 'node:fs/promises';
import {maxPhoneConnections} from './room-capacity.js';

// Joinstick 0.2.0 hard-codes its room cap and one-digit stock invite paths.
const root = new URL('./', import.meta.resolve('joinstick'));
const patches = [
  ['server.js', 'const MAX_SLOTS = 8;', `const MAX_SLOTS = ${maxPhoneConnections};`],
  ['server.js', String.raw`\d)`, String.raw`\d{1,2})`],
  ['../public/pad.js', String.raw`(\d)`, String.raw`(\d{1,2})`],
  ['../public/pad.html', 'max="8"', `max="${maxPhoneConnections}"`],
];

const files = new Map();
for (const [path, before, after] of patches) {
  const contents = files.get(path) ?? await readFile(new URL(path, root), 'utf8');
  if (contents.includes(after)) continue;
  if (contents.split(before).length !== 2) {
    throw new Error(`Joinstick capacity patch no longer matches ${path}. Review the installed version.`);
  }
  files.set(path, contents.replace(before, after));
}
for (const [path, contents] of files) {
  await writeFile(new URL(path, root), contents);
}
