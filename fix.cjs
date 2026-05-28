const fs = require('fs');
let s = fs.readFileSync('src/data.csv.ts', 'utf8');
const lines = s.split('\n');
// Find it
const idx = lines.findIndex(l => l.includes(';工影响'));
if (idx !== -1) {
  lines.splice(idx, 1);
} else {
  // Also check for the specific malformed text
  const altIdx = lines.findIndex(l => l.includes('工影响'));
  if (altIdx !== -1) lines.splice(altIdx, 1);
}
// Delete the first \`; if it's in the middle of the file
const badTick = lines.findIndex(l => l.startsWith('`;'));
if(badTick !== -1) lines.splice(badTick, 1);

s = lines.join('\n');
if (!s.trim().endsWith('\`') && !s.trim().endsWith('\`;')) {
  s += '\n\`;';
}
fs.writeFileSync('src/data.csv.ts', s);
