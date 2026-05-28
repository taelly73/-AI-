import fullData from '../full_data.json';

export interface BusData {
  id: string;
  title: string;
  date: string;
  url: string;
  category: string;
  content: string;
}

const getFirstValue = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

const normalizeDate = (value: string): string => {
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

export const getBusData = (): BusData[] => {
  return fullData.map((row: any, index: number) => ({
    id: getFirstValue(row, ['id', 'ID', '\u7f16\u53f7']) || `${index}`,
    title: getFirstValue(row, ['title', 'Title', '\u6807\u9898', '\u9898\u540d', '\u6587\u7ae0\u6807\u9898', '\u65b0\u95fb\u6807\u9898']),
    date: normalizeDate(getFirstValue(row, ['date', 'Date', '\u65e5\u671f', '\u53d1\u5e03\u65f6\u95f4', '\u53d1\u5e03\u65e5', '\u65f6\u95f4', 'publishTime', 'published_at'])),
    url: getFirstValue(row, ['url', 'URL', '\u94fe\u63a5', '\u539f\u6587\u94fe\u63a5', '\u7f51\u5740', 'link', 'href']),
    category: getFirstValue(row, ['category', 'Category', '\u5206\u7c7b', '\u7c7b\u522b', '\u7c7b\u578b', '\u680f\u76ee', '\u6765\u6e90', 'source', 'Source']),
    content: getFirstValue(row, ['content', 'Content', '\u6b63\u6587', '\u5185\u5bb9', '\u6458\u8981', '\u8be6\u60c5', '\u6587\u672c', 'text', 'body'])
  }));
};
