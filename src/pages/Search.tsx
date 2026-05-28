import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Filter,
  Search as SearchIcon,
  Sparkles,
} from 'lucide-react';
import { BusData, getBusData } from '../lib/dataParser';

const STOP_WORDS = [
  '我想', '想去', '我要', '请问', '有没有', '是否', '影响吗', '有影响吗', '有影响', '影响',
  '公交', '线路', '怎么走', '怎么', '吗', '呢', '啊', '的', '了', '去', '到', '在', '有'
];

const AI_HINTS: Record<string, string[]> = {
  '五一': ['五一', '五一节日', '五一假期', '五一期间'],
  '改道': ['改道', '绕行', '导改', '甩站', '临时调整', '调整', '线路调整'],
  '停运': ['停运', '暂停运营', '停驶'],
  '天坛': ['天坛', '天坛公园', '天坛东门', '前门', '崇文门', '天桥'],
};

function normalize(value: string) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function cleanContent(content: string) {
  return String(content || '')
    .replace(/上一篇：.*$/g, '')
    .replace(/下一篇：.*$/g, '')
    .replace(/关闭$/g, '');
}

function tokenize(query: string) {
  let text = normalize(query);
  STOP_WORDS.forEach(word => {
    text = text.replaceAll(word, ' ');
  });

  const tokens = text
    .split(/[，。！？、,.!?;；:：\s]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .filter(t => t.length >= 2);

  const hints = Object.entries(AI_HINTS)
    .filter(([key, values]) => normalize(query).includes(key) || values.some(v => normalize(query).includes(normalize(v))))
    .flatMap(([key, values]) => [key, ...values]);

  return Array.from(new Set([...tokens, ...hints]));
}

function scoreItem(item: BusData, query: string) {
  const terms = tokenize(query);
  if (terms.length === 0) return 1;

  const title = normalize(item.title);
  const category = normalize(item.category);
  const content = normalize(cleanContent(item.content));
  const combined = `${title} ${category} ${content}`;

  let score = 0;
  for (const term of terms) {
    const t = normalize(term);
    if (!t) continue;
    if (title.includes(t)) score += 6;
    if (category.includes(t)) score += 4;
    if (content.includes(t)) score += 2;
    if (combined.includes(t)) score += 1;
  }

  return score;
}

function buildAnswer(query: string, results: BusData[]) {
  if (results.length === 0) {
    return `没有在现有公告中找到和“${query}”直接匹配的记录。你可以换成更具体的地点、线路号或站名再试。`;
  }

  const lines = results.slice(0, 3).map(item => {
    const preview = cleanContent(item.content).slice(0, 260);
    return `ID:${item.id} ${item.title}（${item.date}，${item.category}）\n${preview}`;
  });

  return [`根据现有公告，和“${query}”最相关的是：`, '', ...lines].join('\n');
}

export const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const data = useMemo(() => getBusData(), []);

  const [searchMode, setSearchMode] = useState<'traditional' | 'ai'>(searchParams.get('mode') === 'ai' ? 'ai' : 'traditional');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiResults, setAiResults] = useState<BusData[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const currentQuery = searchParams.get('q') || '';
  const currentCategory = searchParams.get('category') || '';

  const categories = useMemo(() => {
    return Array.from(new Set(data.map(item => item.category).filter(Boolean)));
  }, [data]);

  const traditionalResults = useMemo(() => {
    return data
      .map(item => ({ item, score: currentQuery ? scoreItem(item, currentQuery) : 1 }))
      .filter(({ item, score }) => {
        if (currentCategory && item.category !== currentCategory) return false;
        if (startDate || endDate) {
          const dateValue = new Date(String(item.date).replace(/\./g, '-')).getTime();
          if (startDate && dateValue < new Date(startDate).getTime()) return false;
          if (endDate && dateValue > new Date(endDate).getTime()) return false;
        }
        return currentQuery ? score > 0 : true;
      })
      .sort((a, b) => {
        const dateA = new Date(String(a.item.date).replace(/\./g, '-')).getTime() || 0;
        const dateB = new Date(String(b.item.date).replace(/\./g, '-')).getTime() || 0;
        return b.score - a.score || dateB - dateA;
      })
      .map(({ item }) => item);
  }, [data, currentQuery, currentCategory, startDate, endDate]);

  const displayResults = searchMode === 'ai'
    ? (aiResults.length > 0 ? aiResults : traditionalResults)
    : traditionalResults;

  const fetchAiSearch = async (q: string) => {
    setIsAiLoading(true);
    setAiAnswer('');
    setAiResults([]);

    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'AI 搜索失败');

      const nextResults: BusData[] = Array.isArray(payload.results) ? payload.results : traditionalResults;
      setAiResults(nextResults);
      setAiAnswer(typeof payload.text === 'string' && payload.text.trim() ? payload.text : buildAnswer(q, nextResults));
    } catch (error) {
      console.error(error);
      setAiResults(traditionalResults);
      setAiAnswer(buildAnswer(q, traditionalResults));
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    const mode = searchParams.get('mode') === 'ai' ? 'ai' : 'traditional';
    setSearchMode(mode);
    setQuery(searchParams.get('q') || '');
    setCategory(searchParams.get('category') || '');
  }, [searchParams]);

  useEffect(() => {
    if (searchMode === 'ai' && currentQuery) {
      fetchAiSearch(currentQuery);
    }
  }, [searchMode, currentQuery]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category && searchMode === 'traditional') params.set('category', category);
    if (searchMode === 'ai') params.set('mode', 'ai');
    setSearchParams(params);
    setShowFilters(false);
  };

  const resetFilters = () => {
    setQuery('');
    setCategory('');
    setStartDate('');
    setEndDate('');
    setAiAnswer('');
    setAiResults([]);
    setSearchParams({});
  };

  return (
    <div translate="no" className="min-h-screen bg-[#F5F8FC] font-sans text-[#1A2C3E] selection:bg-[#1D6F8F] selection:text-white">
      <header className="bg-white border-b border-[#E8EEF4] sticky top-0 z-30 shadow-[0_2px_8px_rgba(29,111,143,0.06)] h-[60px] flex items-center">
        <div className="max-w-[1280px] mx-auto px-4 w-full flex items-center">
          <button onClick={() => navigate('/')} className="mr-4 text-[#6C8EA0] hover:text-[#1D6F8F] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-[#1A2C3E] flex items-center">
            <span className="w-1.5 h-4 bg-[#1D6F8F] rounded mr-2.5" />
            搜索结果
          </h1>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 mt-6 mb-16 flex flex-col md:flex-row gap-6">
        <div className="md:hidden">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between p-3 bg-white border border-[#E8EEF4] rounded-xl font-medium text-[13px] text-[#1A2C3E] shadow-[0_2px_8px_rgba(29,111,143,0.04)]"
          >
            <span className="flex items-center">
              <Filter className="w-4 h-4 mr-2 text-[#1D6F8F]" />
              筛选和搜索
            </span>
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        <aside className={`md:w-72 flex-shrink-0 ${showFilters ? 'block' : 'hidden'} md:block`}>
          <div className="bg-white p-5 md:p-6 rounded-2xl border border-[#E8EEF4] shadow-[0_2px_12px_rgba(29,111,143,0.03)] sticky top-[84px]">
            <h2 className="text-[15px] font-bold text-[#1A2C3E] mb-5 flex items-center">
              <Filter className="w-4 h-4 mr-2 text-[#1D6F8F]" />
              检索条件
            </h2>

            <form onSubmit={handleSearch} className="space-y-5">
              <div className="bg-[#F5F8FC] p-1 rounded-xl flex items-center">
                <button
                  type="button"
                  onClick={() => setSearchMode('traditional')}
                  className={`flex-1 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${searchMode === 'traditional' ? 'text-[#1D6F8F] shadow-sm bg-white' : 'text-[#6C8EA0] hover:text-[#1A2C3E]'}`}
                >
                  关键词
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('ai')}
                  className={`flex-1 py-1.5 text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center ${searchMode === 'ai' ? 'text-[#1D6F8F] shadow-sm bg-white' : 'text-[#6C8EA0] hover:text-[#1A2C3E]'}`}
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  自然语言
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-2 text-[#6C8EA0] uppercase tracking-wider">
                  {searchMode === 'ai' ? '自然语言提问' : '检索词'}
                </label>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6C8EA0]" />
                  <input
                    type="text"
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    placeholder={searchMode === 'ai' ? '例如：五一期间 哪些公交改道了' : '输入地点、线路或关键词'}
                    className="w-full pl-9 pr-3 py-2.5 border border-[#E8EEF4] rounded-xl focus:ring-2 focus:ring-[#1D6F8F]/20 focus:border-[#1D6F8F] transition-colors text-[13px] bg-[#F5F8FC] outline-none"
                  />
                </div>
              </div>

              {searchMode === 'traditional' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold mb-2 text-[#6C8EA0] uppercase tracking-wider">公告分类</label>
                    <select
                      value={category}
                      onChange={event => setCategory(event.target.value)}
                      className="w-full px-3 py-2.5 border border-[#E8EEF4] rounded-xl focus:ring-2 focus:ring-[#1D6F8F]/20 focus:border-[#1D6F8F] transition-colors text-[13px] appearance-none bg-[#F5F8FC] outline-none"
                    >
                      <option value="">全部类别</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(!showAdvanced)}
                      className="text-[13px] text-[#1D6F8F] hover:underline font-medium flex items-center"
                    >
                      {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
                      日期筛选
                    </button>
                  </div>

                  {showAdvanced && (
                    <div className="space-y-4 pt-4 border-t border-[#E8EEF4]">
                      <label className="block text-xs font-semibold mb-2 text-[#6C8EA0] uppercase tracking-wider">发布时间范围</label>
                      <div className="flex items-center space-x-2">
                        <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="w-full px-2 py-2 border border-[#E8EEF4] rounded-xl text-xs bg-[#F5F8FC] outline-none" />
                        <span className="text-[#6C8EA0]">-</span>
                        <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="w-full px-2 py-2 border border-[#E8EEF4] rounded-xl text-xs bg-[#F5F8FC] outline-none" />
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className="flex flex-col gap-3 pt-3 mt-2 border-t border-[#E8EEF4]">
                <button type="submit" className="w-full py-2.5 bg-[#1D6F8F] hover:bg-[#155A75] text-white rounded-xl text-[13px] font-semibold transition-colors shadow-sm">
                  {searchMode === 'ai' ? '提问' : '应用筛选'}
                </button>
                <button type="button" onClick={resetFilters} className="w-full py-2.5 bg-[#F5F8FC] hover:bg-[#E8EEF4] text-[#1A2C3E] rounded-xl text-[13px] font-medium transition-colors">
                  清除条件
                </button>
              </div>
            </form>
          </div>
        </aside>

        <div className="flex-1 w-full space-y-6">
          {searchMode === 'ai' && currentQuery ? (
            <div className="bg-gradient-to-r from-[#1D6F8F] to-[#2B92BA] p-[1px] rounded-2xl shadow-[0_4px_24px_rgba(29,111,143,0.1)]">
              <div className="bg-white p-6 rounded-2xl">
                <h2 className="flex items-center text-[#1D6F8F] font-bold text-[16px] mb-4">
                  <Sparkles className="w-5 h-5 mr-2" />
                  智能解答
                </h2>
                <div className="text-[15px] text-[#1A2C3E] leading-[1.8] whitespace-pre-wrap">
                  {isAiLoading ? (
                    <div className="flex items-center text-[#6C8EA0]">
                      <div className="w-4 h-4 border-2 border-[#1D6F8F] border-t-transparent rounded-full animate-spin mr-3" />
                      正在分析自然语言并生成检索式...
                    </div>
                  ) : (
                    aiAnswer || buildAnswer(currentQuery, displayResults)
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
            <h2 className="text-[14px] text-[#6C8EA0]">
              相关记录：
              <strong className="text-[#1A2C3E] font-bold mx-1 text-[16px]">{displayResults.length}</strong>
              条
              {currentCategory && searchMode === 'traditional' && <span className="ml-1 text-[13px] bg-[#E8EEF4] px-2 py-0.5 rounded text-[#1D6F8F]">{currentCategory}</span>}
              {currentQuery && searchMode === 'traditional' && <span className="ml-1 text-[13px]">包含“{currentQuery}”</span>}
            </h2>
          </div>

          <div className="space-y-4">
            {displayResults.length > 0 ? (
              displayResults.map(item => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/detail/${item.id}`)}
                  className="flex flex-col p-5 md:p-6 border border-[#E8EEF4] bg-white hover:border-[#1D6F8F]/30 hover:bg-[#F8FAFC] hover:shadow-[0_4px_16px_rgba(29,111,143,0.06)] cursor-pointer rounded-2xl transition-all group"
                >
                  <div className="flex justify-between items-center w-full gap-3">
                    <span className="bg-[#1D6F8F]/10 text-[#1D6F8F] text-[11px] px-2.5 py-0.5 rounded-md font-medium flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1D6F8F] mr-1.5" />
                      {item.category || '未分类'}
                    </span>
                    <span className="text-xs text-[#6C8EA0] font-mono flex items-center">
                      <CalendarDays className="w-3.5 h-3.5 mr-1" />
                      {item.date}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-[#1A2C3E] mt-3.5 group-hover:text-[#1D6F8F] transition-colors leading-[1.6]">
                    {item.title}
                  </h3>

                  <p className="text-[13px] text-[#6C8EA0] line-clamp-2 leading-[1.6] mt-2">
                    {cleanContent(item.content).slice(0, 220) || '暂无正文描述，请点击查看原文。'}
                  </p>
                </div>
              ))
            ) : (
              <div className="bg-white p-12 md:p-16 rounded-2xl border border-[#E8EEF4] text-center flex flex-col items-center shadow-[0_2px_12px_rgba(29,111,143,0.03)] mt-8">
                <div className="w-16 h-16 bg-[#F5F8FC] rounded-2xl flex items-center justify-center mb-5 text-[#1D6F8F]">
                  <SearchIcon className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-[#1A2C3E] mb-2">没有找到匹配结果</h3>
                <p className="text-[14px] text-[#6C8EA0]">试试更具体的地点、线路号、站名或公告类型。</p>
                <button onClick={resetFilters} className="mt-6 px-6 py-2.5 bg-[#1D6F8F] hover:bg-[#155A75] text-white rounded-xl text-[13px] font-semibold transition-colors shadow-sm">
                  清除搜索条件
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
