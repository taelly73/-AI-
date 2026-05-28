import fs from 'fs';
import Papa from 'papaparse';

const getFirstValue = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const normalizeDate = (value: string) => {
  if (!value) return '';

  const normalized = value
    .replace(/[\u5e74\u6708]/g, '.')
    .replace(/[\u65e5\u53f7]/g, '')
    .replace(/[/-]/g, '.')
    .trim();

  const match = normalized.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!match) return normalized;

  return `${match[1]}.${Number(match[2])}.${Number(match[3])}`;
};

const normalizeRow = (item: Record<string, unknown>, index: number) => ({
  id: getFirstValue(item, ['id', 'ID', '\u7f16\u53f7']) || String(index + 1),
  title: getFirstValue(item, ['title', 'Title', '\u6807\u9898', '\u9898\u540d', '\u6587\u7ae0\u6807\u9898', '\u65b0\u95fb\u6807\u9898']),
  date: normalizeDate(getFirstValue(item, ['date', 'Date', '\u65e5\u671f', '\u53d1\u5e03\u65f6\u95f4', '\u53d1\u5e03\u65e5', '\u65f6\u95f4', 'publishTime', 'published_at'])),
  url: getFirstValue(item, ['url', 'URL', '\u94fe\u63a5', '\u539f\u6587\u94fe\u63a5', '\u7f51\u5740', 'link', 'href']),
  category: getFirstValue(item, ['category', 'Category', '\u5206\u7c7b', '\u7c7b\u522b', '\u7c7b\u578b', '\u680f\u76ee', '\u6765\u6e90', 'source', 'Source']),
  content: getFirstValue(item, ['content', 'Content', '\u6b63\u6587', '\u5185\u5bb9', '\u6458\u8981', '\u8be6\u60c5', '\u6587\u672c', 'text', 'body'])
});

const extractContent = (raw: string) => {
  const startIdx = raw.indexOf('`');
  const endIdx = raw.lastIndexOf('`');
  return startIdx !== -1 && endIdx !== -1 && endIdx > startIdx ? raw.substring(startIdx + 1, endIdx) : raw;
};

const readInputRows = () => {
  const inputPath = process.argv[2];

  if (inputPath) {
    const raw = fs.readFileSync(inputPath, 'utf-8');
    if (inputPath.toLowerCase().endsWith('.json')) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('JSON dataset must be an array of records.');
      return parsed;
    }

    const csvContent = extractContent(raw);
    return Papa.parse(csvContent, { header: true, skipEmptyLines: true }).data;
  }

  const rawStr1 = fs.readFileSync('src/data.csv.ts', 'utf-8');
  const rawStr2 = fs.readFileSync('src/data_part2.ts', 'utf-8');
  const combinedCsv = `${extractContent(rawStr1).trim()}\n${extractContent(rawStr2).trim()}`;
  return Papa.parse(combinedCsv, { header: true, skipEmptyLines: true }).data;
};

try {
  const data = readInputRows()
    .map((item: any, index: number) => normalizeRow(item, index))
    .filter((item: any) => item.title || item.content);

  fs.writeFileSync('src/full_data.json', JSON.stringify(data, null, 2));

  const grouped: Record<string, any[]> = data.reduce((acc: any, curr: any) => {
    const cat = curr.category || '\u672a\u5206\u7c7b';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(curr);
    return acc;
  }, {});

  let md = '# \u5317\u4eac\u516c\u4ea4\u516c\u544a\u5206\u7c7b\u6c47\u603b\n\n';
  for (const [cat, items] of Object.entries(grouped)) {
    md += `## ${cat} (${items.length}\u6761)\n\n`;
    for (const item of items) {
      md += `- **${item.title}** (${item.date})\n  [\u67e5\u770b\u8be6\u60c5](${item.url})\n\n`;
    }
  }

  const dsContent = `export const rawMarkdown = \`\n${md.replace(/`/g, '\\`')}\`;\n`;
  fs.writeFileSync('src/data.ts', dsContent);
  console.log('Successfully updated full_data.json and data.ts. Parsed ' + data.length + ' items.');
} catch (err) {
  console.error('Error updating dataset:', err);
}
