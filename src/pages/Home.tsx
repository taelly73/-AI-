import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bus, Bell, RefreshCw, Calendar, ChevronRight, CalendarDays, Activity, Info, PlusCircle, ArrowRight, XCircle } from 'lucide-react';
import { getBusData } from '../lib/dataParser';

export function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const data = useMemo(() => getBusData(), []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleAiSearch = () => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;
    navigate(`/search?q=${encodeURIComponent(trimmedQuery)}&mode=ai`);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case '临时运营': return <Bus size={16} />;
      case '出行提示': return <Bell size={16} />;
      case '线路调整': return <RefreshCw size={16} />;
      case '站点变更': return <Activity size={16} />;
      case '线路增加': return <PlusCircle size={16} />;
      case '节假日调整': return <Calendar size={16} />;
      case '接驳专线': return <ArrowRight size={16} />;
      case '线路撤销': return <XCircle size={16} />;
      case '其他': return <Info size={16} />;
      default: return <Info size={16} />;
    }
  };

  const categories = useMemo(() => {
    const counts = data.reduce((acc, curr) => {
      acc[curr.category] = (acc[curr.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([name, count]) => ({ name, count }));
  }, [data]);

  const counts = useMemo(() => {
    return categories.reduce((acc, cat) => {
      acc[cat.name] = cat.count;
      return acc;
    }, {} as Record<string, number>);
  }, [categories]);

  const rightCategories = ['线路调整', '站点变更', '线路增加', '线路导改', '线路撤销'];
  const rightColumnData = data.filter(d => rightCategories.includes(d.category));
  const leftColumnData = data.filter(d => !rightCategories.includes(d.category));

  // Determine standard date
  const today = new Date();
  const month = today.getMonth() + 1;
  const date = today.getDate();
  const dateStr = `${month}月${date}日`;
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  const dayStr = `周${weekDays[today.getDay()]}`;

  return (
    <div className="min-h-screen bg-[#F5F8FC] flex flex-col font-sans text-[#1A2C3E] selection:bg-[#1D6F8F] selection:text-white pb-16">
      {/* Top Brand Area */}
      <header className="w-full max-w-[1280px] mx-auto px-4 lg:px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
           <h1 className="text-2xl font-bold bg-gradient-to-r from-[#1D6F8F] to-[#2B92BA] bg-clip-text text-transparent flex items-center tracking-wide">
             AI 智能公交检索系统
           </h1>
           <span className="text-[10px] text-[#6C8EA0] tracking-[0.2em] uppercase mt-0.5">AI-Based Transit Information Retrieval</span>
        </div>
        <div className="self-start md:self-auto flex items-center text-xs font-medium text-[#6C8EA0] bg-white px-4 py-2 rounded-full shadow-[0_2px_8px_rgba(29,111,143,0.06)] border border-[#E8EEF4]">
          <span className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-[#1D6F8F] mr-2"></span>
            {dateStr} · {dayStr} · 宜出行
          </span>
        </div>
      </header>

      {/* Hero & Search Area */}
      <section className="w-full max-w-[1280px] mx-auto px-4 lg:px-8 mb-8 mt-2">
        <div className="relative w-full h-[240px] md:h-[300px] rounded-[32px] overflow-hidden flex flex-col items-center justify-center p-6 bg-[#1A2C3E] shadow-[0_8px_32px_rgba(29,111,143,0.15)]">
          <div 
            className="absolute inset-0 z-0 bg-cover bg-[center_35%] bg-no-repeat opacity-60 mix-blend-luminosity"
            style={{ backgroundImage: 'url(/tiantan.jpg)' }}
          />
          <div className="absolute inset-0 z-0 bg-gradient-to-t from-[#0F1C2A]/90 via-[#1D6F8F]/40 to-transparent"></div>
          
          <div className="relative z-10 w-full max-w-[800px] flex flex-col items-center pt-8">
            <h2 className="text-white text-2xl md:text-3xl font-bold mb-6 tracking-wide drop-shadow-md">
              AI智能信息检索，让出行更智慧
            </h2>
            <form onSubmit={handleSearch} className="relative flex items-center w-full h-[56px] md:h-[60px] bg-white/95 backdrop-blur-md rounded-[24px] shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white/20 focus-within:bg-white focus-within:shadow-[0_8px_32px_rgba(29,111,143,0.2)] transition-all duration-300">
              <Search className="absolute left-6 w-[20px] h-[20px] text-[#1D6F8F]" />
              <input 
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="你可以问我：“五一期间哪些公交改道了” 或 “我想去天坛，有影响吗”..."
                className="w-full h-full pl-[56px] pr-[120px] bg-transparent text-[#1A2C3E] placeholder:text-[#6C8EA0]/80 text-[15px] outline-none rounded-[24px]"
              />
              <button 
                type="button"
                onClick={handleAiSearch}
                className="absolute right-2 px-5 h-11 bg-gradient-to-r from-[#1D6F8F] to-[#2B92BA] text-white text-[14px] font-medium rounded-[18px] flex items-center transition-transform hover:scale-[1.02] shadow-sm"
              >
                AI 查询
              </button>
            </form>
            
            <div className="mt-5 flex gap-3">
              <button 
                onClick={() => navigate('/realtime')}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-full text-[13px] font-medium transition flex items-center shadow-sm"
              >
                <Bus className="w-4 h-4 mr-1.5" />
                实时公交查询
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Cards (Core Data Dashboard) */}
      <section className="w-full max-w-[1280px] mx-auto px-4 lg:px-8 mb-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {/* Card 1 */}
          <div 
            onClick={() => navigate('/search?category=临时运营')}
            className="bg-white p-5 md:p-6 rounded-2xl shadow-[0_2px_12px_rgba(29,111,143,0.03)] hover:-translate-y-1 transition-transform border border-white hover:border-[#1D6F8F]/10 flex items-center space-x-4 group cursor-pointer"
          >
            <div className="w-12 h-12 bg-[#1D6F8F]/10 group-hover:bg-[#1D6F8F] rounded-xl flex items-center justify-center text-[#1D6F8F] group-hover:text-white transition-colors">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1A2C3E] tracking-tight">{counts['临时运营'] || 0}</div>
              <div className="text-xs text-[#6C8EA0] mt-1 font-medium">影响线路</div>
            </div>
          </div>
          {/* Card 2 */}
          <div 
            onClick={() => navigate('/search?category=出行提示')}
            className="bg-white p-5 md:p-6 rounded-2xl shadow-[0_2px_12px_rgba(29,111,143,0.03)] hover:-translate-y-1 transition-transform border border-white hover:border-[#F0A36A]/20 flex items-center space-x-4 group cursor-pointer"
          >
            <div className="w-12 h-12 bg-[#F0A36A]/10 group-hover:bg-[#F0A36A] rounded-xl flex items-center justify-center text-[#F0A36A] group-hover:text-white transition-colors">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1A2C3E] tracking-tight">{counts['出行提示'] || 0}</div>
              <div className="text-xs text-[#6C8EA0] mt-1 font-medium">最新提醒</div>
            </div>
          </div>
          {/* Card 3 */}
          <div 
            onClick={() => navigate('/search?category=线路调整')}
            className="bg-white p-5 md:p-6 rounded-2xl shadow-[0_2px_12px_rgba(29,111,143,0.03)] hover:-translate-y-1 transition-transform border border-white hover:border-[#1D6F8F]/10 flex items-center space-x-4 group cursor-pointer"
          >
            <div className="w-12 h-12 bg-[#1D6F8F]/10 group-hover:bg-[#1D6F8F] rounded-xl flex items-center justify-center text-[#1D6F8F] group-hover:text-white transition-colors">
              <RefreshCw className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1A2C3E] tracking-tight">{counts['线路调整'] || 0}</div>
              <div className="text-xs text-[#6C8EA0] mt-1 font-medium">进行中</div>
            </div>
          </div>
          {/* Card 4 */}
          <div 
            onClick={() => navigate('/search?category=节假日调整')}
            className="bg-white p-5 md:p-6 rounded-2xl shadow-[0_2px_12px_rgba(29,111,143,0.03)] hover:-translate-y-1 transition-transform border border-white hover:border-[#F0A36A]/20 flex items-center space-x-4 group cursor-pointer"
          >
            <div className="w-12 h-12 bg-[#F0A36A]/10 group-hover:bg-[#F0A36A] rounded-xl flex items-center justify-center text-[#F0A36A] group-hover:text-white transition-colors">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="text-2xl font-bold text-[#1A2C3E] tracking-tight">{counts['节假日调整'] || 0}</div>
              <div className="text-xs text-[#6C8EA0] mt-1 font-medium">特殊方案</div>
            </div>
          </div>
        </div>
      </section>

      {/* Explore Services */}
      <section className="w-full max-w-[1280px] mx-auto px-4 lg:px-8 mb-12">
         <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-base font-bold text-[#1A2C3E]">
               探索服务
            </h2>
            <button onClick={() => navigate('/search')} className="text-[#6C8EA0] hover:text-[#1D6F8F] text-[13px] font-medium flex items-center transition-colors">
              全部服务 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
         </div>
         <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            {categories.map((cat, idx) => (
               <button 
                 key={idx}
                 onClick={() => navigate(`/search?category=${encodeURIComponent(cat.name)}`)}
                 className="flex items-center justify-between p-3.5 md:p-4 bg-white rounded-xl shadow-[0_2px_8px_rgba(29,111,143,0.02)] border border-[#E8EEF4] hover:border-[#1D6F8F]/20 hover:bg-[#F8FAFC] hover:-translate-y-0.5 transition-all group"
               >
                 <div className="flex items-center space-x-2.5 text-[#1A2C3E]">
                   <div className="p-2 bg-[#F5F8FC] group-hover:bg-[#E8EEF4] rounded-lg text-[#1D6F8F] transition-colors">
                     {getCategoryIcon(cat.name)}
                   </div>
                   <span className="text-[13px] font-medium">{cat.name}</span>
                 </div>
                 <span className="text-[11px] font-bold text-[#1D6F8F] bg-[#1D6F8F]/5 px-2 py-0.5 rounded-full">
                   {cat.count}
                 </span>
               </button>
            ))}
         </div>
      </section>

      {/* Main Content: Two Columns */}
      <section className="w-full max-w-[1280px] mx-auto px-4 lg:px-8 mb-16 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Left Column */}
        <div className="lg:w-2/3 flex flex-col">
           <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-base font-bold text-[#1A2C3E]">最新公示通告</h2>
              <button onClick={() => navigate('/search')} className="text-[#6C8EA0] hover:text-[#1D6F8F] text-[13px] font-medium flex items-center transition-colors">
                查看全部 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
           </div>
           
           <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(29,111,143,0.03)] border border-[#E8EEF4] flex flex-col overflow-hidden">
              {leftColumnData.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => navigate(`/detail/${item.id}`)} 
                  className="p-5 md:p-6 border-b border-[#F5F8FC] last:border-b-0 hover:bg-[#F8FAFC] cursor-pointer group transition-colors flex flex-col relative"
                >
                   <div className="flex items-center space-x-3 mb-2.5">
                     <span className="text-[11px] px-2 py-0.5 rounded-md font-medium text-[#1D6F8F] bg-[#1D6F8F]/10 flex items-center">
                       <span className="w-1.5 h-1.5 rounded-full bg-[#1D6F8F] mr-1.5"></span>
                       {item.category || '未分类'}
                     </span>
                     <div className="flex items-center text-xs text-[#6C8EA0] font-mono">
                        <CalendarDays className="w-3.5 h-3.5 mr-1.5 opacity-60" />
                        {item.date}
                     </div>
                   </div>
                   <h3 className="text-[14px] md:text-[15px] font-medium text-[#1A2C3E] group-hover:text-[#1D6F8F] leading-[1.6] line-clamp-2 transition-colors">
                     {item.title}
                   </h3>
                </div>
              ))}
           </div>
        </div>

        {/* Right Column */}
        <div className="lg:w-1/3 flex flex-col">
           <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-base font-bold text-[#1A2C3E]">线路调整·动态</h2>
              <button 
                onClick={() => navigate('/search?category=线路调整')} 
                className="text-[#6C8EA0] hover:text-[#1D6F8F] text-[13px] font-medium flex items-center transition-colors"
              >
                更多 <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
           </div>

           <div className="bg-white rounded-2xl shadow-[0_2px_16px_rgba(29,111,143,0.03)] border border-[#E8EEF4] flex flex-col px-5 py-6">
              <div className="flex items-center justify-between text-xs font-medium text-[#1A2C3E] mb-6 p-4 bg-[#F5F8FC] rounded-xl border border-[#E8EEF4]/50">
                 <div className="flex items-center space-x-2">
                   <RefreshCw className="w-4 h-4 text-[#1D6F8F]" />
                   <span>线路调整总数 <span className="text-[#F0A36A] ml-1 text-[15px] font-bold">{counts['线路调整'] || 0}</span></span>
                 </div>
                 <div className="w-[1px] h-4 bg-[#6C8EA0]/30 mx-2"></div>
                 <div className="flex items-center space-x-2">
                   <span>节假日 <span className="text-[#F0A36A] ml-1 text-[15px] font-bold">{counts['节假日调整'] || 0}</span></span>
                 </div>
              </div>

              <div className="flex flex-col space-y-6">
                {rightColumnData.map((item, idx) => (
                  <div key={item.id} onClick={() => navigate(`/detail/${item.id}`)} className="flex items-start space-x-4 cursor-pointer group relative">
                     {idx !== rightColumnData.length - 1 && (
                       <div className="absolute left-[3.5px] top-[14px] bottom-[-24px] w-[2px] bg-[#F5F8FC]"></div>
                     )}
                     <div className="w-[9px] h-[9px] rounded-full bg-[#1D6F8F] mt-[6px] flex-shrink-0 relative z-10 ring-4 ring-white shadow-sm"></div>
                     <div className="flex flex-col bg-white w-full">
                        <span className="text-[11px] text-[#6C8EA0] mb-[2px] font-mono">{item.date}</span>
                        <h4 className="text-[13px] md:text-[14px] font-medium text-[#1A2C3E] group-hover:text-[#1D6F8F] transition-colors leading-[1.6] line-clamp-2">
                          {item.title}
                        </h4>
                     </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </section>
    </div>
  );
}
