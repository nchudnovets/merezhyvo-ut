import fs from 'fs';
import path from 'path';
const out = path.join(__dirname, '..', 'resources', 'legal', 'THIRD-PARTY-NOTICES.txt');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out,
  'This application bundles third-party components.\n(placeholder, will be generated)\n'
);
console.log('Wrote placeholder THIRD-PARTY-NOTICES.txt');