const fs = require('fs');
let s = fs.readFileSync('src/data.csv.ts', 'utf8');
const lines = s.split('\n');
// We have an invalid line starting with "\`;工影响" around index 7. Find it and delete it.
const idx = lines.findIndex(l => l.includes('\`;'));
if (idx !== -1 && idx < lines.length - 1) { // It's not the last line
  lines.splice(idx, 1);
}
// Add closing backtick
s = lines.join('\n');
if (!s.trim().endsWith('\`')) {
  s += '\n\`';
}
fs.writeFileSync('src/data.csv.ts', s);
