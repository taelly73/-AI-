import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Page render error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F5F8FC] flex items-center justify-center px-4 text-[#1A2C3E]">
        <div className="max-w-md w-full bg-white border border-[#E8EEF4] rounded-2xl p-8 text-center shadow-[0_8px_28px_rgba(29,111,143,0.08)]">
          <h1 className="text-lg font-bold mb-3">页面遇到一点问题</h1>
          <p className="text-sm text-[#6C8EA0] leading-6 mb-6">
            当前页面没有崩掉整个应用。请刷新页面，或返回首页重新搜索。
          </p>
          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="px-5 py-2.5 bg-[#1D6F8F] text-white rounded-xl text-sm font-semibold"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }
}
