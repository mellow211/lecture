import React, { useEffect, useState } from 'react';
import { StatusIndicator } from './StatusIndicator';
import { ActiveUser, ConnectionStatus } from '../hooks/useSocket';
import { Users, BookOpen, LogOut, Check, Copy, Loader2, HelpCircle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface StudentViewerProps {
  roomId: string;
  roomName: string;
  presenterName: string;
  socketData: {
    connectionStatus: ConnectionStatus;
    latency: number;
    activeUsers: ActiveUser[];
    userCount: number;
    currentSlide: number;
  };
}

export const StudentViewer: React.FC<StudentViewerProps> = ({
  roomId,
  roomName,
  presenterName,
  socketData,
}) => {
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const [copied, setCopied] = useState(false);

  // Database presentations state
  const [presentations, setPresentations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real presentation database entries for student syncing
  useEffect(() => {
    const fetchPresentations = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/presentations', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setPresentations(data);
        }
      } catch (err) {
        console.error('Failed fetching presentations for student view:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPresentations();
  }, [token]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Resolve active presentation matching the current active lecture roomName
  const activePresentation = presentations.find(p => p.title === roomName) || presentations[0] || null;
  const slides = activePresentation?.content_data || [];
  const currentSlideData = slides[socketData.currentSlide] || slides[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-600/20 text-emerald-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{roomName}</h1>
            <p className="text-xs text-slate-400">
              강사: <span className="text-emerald-400 font-semibold">{presenterName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <StatusIndicator status={socketData.connectionStatus} latency={socketData.latency} />
          
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-rose-950/20 hover:border-rose-500/50 hover:text-rose-400 transition-all duration-200 text-xs"
          >
            <LogOut className="w-4 h-4" />
            퇴장하기
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Slide Display (Takes 3 columns) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Room ID and Sync Status */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-xs text-slate-400">강의실 입장 코드</p>
                <h2 className="text-xl font-bold tracking-wider text-emerald-400">{roomId}</h2>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="룸 코드 복사"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold border border-emerald-500/20 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                강사 화면과 실시간 동기화됨
              </span>
            </div>
          </div>

          {/* Presentation Slide View (Styled Card) */}
          <div className="flex-1 min-h-[450px] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl relative">
            {isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                <span className="text-xs">실시간 강의 데이터를 불러오는 중입니다...</span>
              </div>
            ) : !currentSlideData ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <HelpCircle className="w-12 h-12 text-slate-700 mb-3" />
                <h3 className="font-bold text-slate-400">등록된 슬라이드 내용이 없습니다.</h3>
                <p className="text-xs text-slate-500 mt-1">강사가 교안 설정을 마칠 때까지 기다려 주세요.</p>
              </div>
            ) : (
              <div 
                className={`flex-1 p-8 md:p-12 flex flex-col justify-between transition-all duration-500 relative ${
                  currentSlideData.gradient?.startsWith('url(') 
                    ? 'bg-slate-950' 
                    : `bg-gradient-to-tr ${currentSlideData.gradient || 'from-indigo-600 to-violet-600'}`
                }`}
                style={
                  currentSlideData.gradient?.startsWith('url(')
                    ? {
                        backgroundImage: currentSlideData.gradient,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat'
                      }
                    : {}
                }
              >
                {/* Slide top badge */}
                <div className="flex justify-between items-center z-10">
                  <span className="bg-white/10 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                    Slide {socketData.currentSlide + 1} / {slides.length}
                  </span>
                  <span className="text-white/60 text-xs font-medium uppercase tracking-widest text-[10px]">
                    {activePresentation?.source_type} Mode
                  </span>
                </div>

                {/* Slide Body - Render only when it's NOT an image url slide */}
                {!currentSlideData.gradient?.startsWith('url(') && (
                  <div className="my-auto py-8 z-10">
                    <h3 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white mb-2 drop-shadow-md">
                      {currentSlideData.title}
                    </h3>
                    <h4 className="text-lg md:text-xl font-medium text-white/80 mb-6 italic">
                      {currentSlideData.subtitle}
                    </h4>
                    <p className="text-base md:text-lg text-white/90 font-light leading-relaxed max-w-3xl bg-black/10 p-4 md:p-6 rounded-xl backdrop-blur-sm border border-white/5 shadow-md">
                      {currentSlideData.content}
                    </p>
                  </div>
                )}

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20 z-10">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-300 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    style={{ width: `${((socketData.currentSlide + 1) / slides.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Slide Navigation Bar (Read-only for Students) */}
            <div className="p-4 bg-slate-950 flex items-center justify-center border-t border-slate-800">
              <span className="text-sm font-medium text-slate-400">
                현재 페이지: {socketData.currentSlide + 1} / {slides.length} (강사의 슬라이드 조작에 따라 실시간 전환됩니다)
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Room User Count and List (Takes 1 column) */}
        <div className="flex flex-col gap-6">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Users className="w-4 h-4 text-emerald-400" />
                참여 중인 수강생
              </span>
              <span className="bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full text-xs">
                {socketData.userCount} 명
              </span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[450px] space-y-2 pr-1 custom-scrollbar">
              {socketData.activeUsers.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  현재 접속 중인 수강생이 없습니다.
                </div>
              ) : (
                socketData.activeUsers.map((activeUser, index) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-3 rounded-lg border text-sm transition-all duration-200 ${
                      activeUser.role === 'presenter' 
                        ? 'bg-indigo-950/20 border-indigo-500/30 text-indigo-300' 
                        : 'bg-slate-850/60 border-slate-800 text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        activeUser.role === 'presenter' ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-400'
                      }`} />
                      <span className="font-medium truncate max-w-[120px]">{activeUser.username}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                      {activeUser.role === 'presenter' ? 'Presenter' : 'Student'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </main>
    </div>
  );
};
