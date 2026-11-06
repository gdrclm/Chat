import './build.js';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';

const output = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });
await copyFile(new URL('../play.html', import.meta.url), new URL('index.html', output));
await copyFile(new URL('../play.html', import.meta.url), new URL('play.html', output));
await writeFile(new URL('.nojekyll', output), '');
console.log('GitHub Pages files prepared in dist/');
