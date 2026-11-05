import { readFileSync, writeFileSync } from 'node:fs';

import { injectTrackingScript } from './tracking/injectTrackingScript.ts';

const [file = 'dist/index.html'] = process.argv.slice(2);
const html = readFileSync(file, 'utf8');
writeFileSync(file, injectTrackingScript(html, process.env.TRACKING_SCRIPT));
