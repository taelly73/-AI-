import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Bus, Clock, MapPin, AlertCircle } from 'lucide-react';

export const Realtime = () => {
  const navigate = useNavigate();
  const [line, setLine] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);

  const fetchRealtime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!line.trim()) {
      setError('请输入公交线路');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const resp = await fetch(`/api/bus/realtime?line=${encodeURIComponent(line.trim())}`);
      const result = await resp.json();

      if (!resp.ok) {
        throw new Error(result.error || '获取实时公交数据失败');
      }

      setData(result);
    } catch (err: any) {
      setError(err.message || '系统内部错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F8FC] font-sans text-[#1A2C3E]">
      <header className="bg-white border-b border-[#E8EEF4] sticky top-0 z-30 shadow-[0_2px_8px_rgba(29,111,143,0.06)] h-[60px] flex items-center">
        <div className="max-w-[1280px] mx-auto px-4 w-full flex items-center">
          <button onClick={() => navigate(-1)} className="mr-4 text-[#6C8EA0] hover:text-[#1D6F8F] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-[#1A2C3E] flex items-center">
            <span className="w-1.5 h-4 bg-[#1D6F8F] rounded mr-2.5"></span>
            实时公交查询
          </h1>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 mt-8 mb-16 flex flex-col items-center">
        <div className="w-full bg-white p-6 md:p-8 rounded-[24px] shadow-[0_4px_24px_rgba(29,111,143,0.06)] border border-[#E8EEF4]">
          <h2 className="text-xl font-bold text-center mb-6 text-[#1A2C3E] flex items-center justify-center">
            <Bus className="w-6 h-6 mr-2 text-[#1D6F8F]" />
            北京实时公交查询
          </h2>
          
          <form onSubmit={fetchRealtime} className="w-full relative flex items-center h-[56px] focus-within:ring-2 ring-[#1D6F8F]/30 rounded-xl transition-all">
            <input 
              type="text"
              value={line}
              onChange={e => setLine(e.target.value)}
              placeholder="请输入线路名称，如：1路、特8"
              className="w-full h-full pl-5 pr-[100px] bg-[#F5F8FC] border border-[#E8EEF4] rounded-xl text-[#1A2C3E] text-[15px] outline-none"
            />
            <button 
              type="submit"
              disabled={loading}
              className="absolute right-2 px-5 h-[40px] bg-[#1D6F8F] hover:bg-[#155A75] disabled:bg-[#A9C5D0] text-white text-[14px] font-medium rounded-lg flex items-center transition-colors shadow-sm"
            >
              {loading ? '查询中...' : '查询'}
            </button>
          </form>

          {error && (
            <div className="mt-6 p-4 bg-[#FFF5F5] border border-[#FFE0E0] rounded-xl flex items-start text-[#D32F2F]">
               <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
               <div className="text-[13px] leading-relaxed">
                 <p className="font-bold mb-1">查询失败</p>
                 <p>{error}</p>
                 {error.includes('TRANSIT_API_KEY') && (
                   <p className="mt-2 text-[#6C8EA0] text-xs">
                     由于平台限制，开发者需要在预览环境中配置真实有效的 TRANSIT_API_KEY 环境变量以下发请求给外部接口平台，方能获取真实数据。
                   </p>
                 )}
               </div>
            </div>
          )}

          {data && !error && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-bold text-[#1A2C3E] border-b border-[#E8EEF4] pb-3 mb-4">
                查询结果：{line}
              </h3>
              
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E8EEF4]">
                <pre className="text-xs text-[#6C8EA0] overflow-auto">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
