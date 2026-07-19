import React from 'react';
import { StatusIndicator } from './StatusIndicator';
import { ActiveUser, ConnectionStatus } from '../hooks/useSocket';
import { ArrowLeft, ArrowRight, Users, Presentation, LogOut, Copy, Check } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

// Dynamic slide data styled natively with rich typography and gradients
export const SLIDES = [
  {
    title: "1. 실시간 웹 아키텍처 개요",
    subtitle: "WebSockets vs HTTP Polling",
    content: "전통적인 HTTP 요청-응답 모델은 실시간성을 보장하기 어렵습니다. WebSocket 프로토콜은 단일 TCP 연결을 통해 양방향 풀 듀플렉스(Full-Duplex) 통신을 가능하게 하여, 데이터 전송 지연을 극도로 줄여줍니다.",
    gradient: "from-blue-600 via-indigo-600 to-violet-600"
  },
  {
    title: "2. 탭 단위 독립 세션 인증",
    subtitle: "sessionStorage & JWT 통합",
    content: "전역 쿠키나 localStorage는 동일 도메인의 모든 브라우저 탭에서 세션을 공유합니다. 본 시스템은 sessionStorage에 JWT 토큰을 개별 보관하여, 한 화면에서 여러 명의 사용자가 독립적인 세션으로 강사 및 수강생으로 로그인할 수 있도록 구현되었습니다.",
    gradient: "from-purple-600 via-pink-600 to-rose-600"
  },
  {
    title: "3. Socket.io Room 브로드캐스트",
    subtitle: "다중 강의 세션 격리 기법",
    content: "서버는 Socket.io의 Room 기능을 활용하여 특정 강의실 ID에 조인된 클라이언트들만 묶어 관리합니다. 강사가 슬라이드를 넘기면, 서버는 해당 Room의 모든 수강생(Student) 소켓에게만 변경 이벤트를 실시간으로 브로드캐스트(Broadcasting)합니다.",
    gradient: "from-rose-600 via-orange-600 to-amber-600"
  },
  {
    title: "4. 수동 Ping/Pong 지연시간 검출",
    subtitle: "네트워크 상태 모니터링",
    content: "클라이언트 훅이 3초 간격으로 서버에 수동 ping을 전송하고, 서버가 즉각 pong을 반환합니다. 이 시간차를 계산하여 네트워크 지연(Latency, ms)을 측정하며, 2.5초간 응답이 없을 경우 상태를 '연결 확인 중'으로 낮추어 사용자에게 네트워크 경고를 띄웁니다.",
    gradient: "from-teal-600 via-emerald-600 to-green-600"
  },
  {
    title: "5. 종합 요약 및 질의응답",
    subtitle: "Q&A Session",
    content: "본 실시간 프레젠테이션 시스템은 Node.js 백엔드와 Next.js 프론트엔드가 Socket.io와 SQLite DB를 매개로 연결되어 유기적으로 동작합니다. 실시간 질의나 화면 제어 등 자유로운 토론을 시작해 주세요.",
    gradient: "from-indigo-600 via-cyan-600 to-teal-600"
  }
];

interface PresenterDashboardProps {
  roomId: string;
  roomName: string;
  socketData: {
    connectionStatus: ConnectionStatus;
    latency: number;
    activeUsers: ActiveUser[];
    userCount: number;
    currentSlide: number;
    changeSlide: (newSlide: number) => void;
  };
}

export const PresenterDashboard: React.FC<PresenterDashboardProps> = ({
  roomId,
  roomName,
  socketData,
}) => {
  const logout = useAuthStore((state) => state.logout);
  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = () => {
    if (socketData.currentSlide < SLIDES.length - 1) {
      socketData.changeSlide(socketData.currentSlide + 1);
    }
  };

  const handlePrev = () => {
    if (socketData.currentSlide > 0) {
      socketData.changeSlide(socketData.currentSlide - 1);
    }
  };

  const currentSlideData = SLIDES[socketData.currentSlide] || SLIDES[0];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header bar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
            <Presentation className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">{roomName}</h1>
            <p className="text-xs text-slate-400">강사 대시보드</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <StatusIndicator status={socketData.connectionStatus} latency={socketData.latency} />
          
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-rose-950/20 hover:border-rose-500/50 hover:text-rose-400 transition-all duration-200 text-xs"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Side: Controls & Slide Display (Takes 3 columns) */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          {/* Room ID and Invite Info */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">수강생 접속용 룸 코드</p>
              <h2 className="text-2xl font-bold tracking-wider text-indigo-400">{roomId}</h2>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:shadow-[0_0_20px_rgba(79,70,229,0.5)]"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  복사 완료
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  코드 복사
                </>
              )}
            </button>
          </div>

          {/* Presentation Slide View (Styled Card) */}
          <div className="flex-1 min-h-[400px] flex flex-col rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl relative">
            <div className={`flex-1 p-8 md:p-12 bg-gradient-to-tr ${currentSlideData.gradient} flex flex-col justify-between transition-all duration-500 relative group`}>
              
              {/* Slide top badge */}
              <div className="flex justify-between items-center">
                <span className="bg-white/10 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                  Slide {socketData.currentSlide + 1} / {SLIDES.length}
                </span>
                <span className="text-white/60 text-xs font-medium">LUNA Presentation Tech</span>
              </div>

              {/* Slide Body */}
              <div className="my-auto py-8">
                <h3 className="text-3xl md:text-5xl font-black tracking-tight leading-tight text-white mb-2 drop-shadow-md">
                  {currentSlideData.title}
                </h3>
                <h4 className="text-lg md:text-xl font-medium text-white/80 mb-6 italic">
                  {currentSlideData.subtitle}
                </h4>
                <p className="text-base md:text-lg text-white/90 font-light leading-relaxed max-w-3xl bg-black/10 p-4 md:p-6 rounded-xl backdrop-blur-sm border border-white/5">
                  {currentSlideData.content}
                </p>
              </div>

              {/* Progress bar */}
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
                <div 
                  className="h-full bg-white transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  style={{ width: `${((socketData.currentSlide + 1) / SLIDES.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Slide Navigation Bar */}
            <div className="p-4 bg-slate-950 flex items-center justify-between border-t border-slate-800">
              <button
                onClick={handlePrev}
                disabled={socketData.currentSlide === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:hover:bg-slate-850 disabled:hover:border-slate-800 text-sm font-medium transition"
              >
                <ArrowLeft className="w-4 h-4" />
                이전 슬라이드
              </button>

              <span className="text-sm font-medium text-slate-400">
                슬라이드 페이지 {socketData.currentSlide + 1}
              </span>

              <button
                onClick={handleNext}
                disabled={socketData.currentSlide === SLIDES.length - 1}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-850 hover:bg-indigo-600 border border-slate-850 hover:border-indigo-500 disabled:opacity-40 disabled:hover:bg-slate-850 disabled:hover:border-slate-850 text-sm font-medium transition"
              >
                다음 슬라이드
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Student Connection list (Takes 1 column) */}
        <div className="flex flex-col gap-6">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur flex flex-col gap-4 flex-1">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="flex items-center gap-2 font-semibold text-sm">
                <Users className="w-4 h-4 text-indigo-400" />
                참여 중인 수강생
              </span>
              <span className="bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded-full text-xs">
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
                        activeUser.role === 'presenter' ? 'bg-indigo-400' : 'bg-emerald-400'
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
