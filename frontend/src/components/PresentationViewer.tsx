import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  Clock, 
  HelpCircle,
  Edit3,
  Save,
  Plus,
  Trash2,
  Undo,
  Loader2
} from 'lucide-react';
import { StatusIndicator } from './StatusIndicator';
import { ConnectionStatus } from '../hooks/useSocket';
import { useAuthStore } from '../store/useAuthStore';

export interface SlideData {
  title: string;
  subtitle: string;
  content: string;
  gradient: string;
}

interface PresentationViewerProps {
  presentation: {
    id: number;
    title: string;
    source_type: 'file' | 'ai' | 'manual';
    content_data: SlideData[];
    file_url?: string | null;
  } | null;
  socketData: {
    connectionStatus: ConnectionStatus;
    latency: number;
    currentSlide: number;
    changeSlide: (newSlide: number) => void;
  };
  onUpdateSuccess: (updatedItem: any) => void; // Callback to refresh sidebar list in parent
}

const BACKEND_URL = '';

export const PresentationViewer: React.FC<PresentationViewerProps> = ({
  presentation,
  socketData,
  onUpdateSuccess,
}) => {
  const { user, token } = useAuthStore();
  const isAdmin = user?.role === 'presenter';

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  // Toggle ViewMode: 'cards' (designed gradient slides) vs 'file' (direct PDF/MS Word/Image viewer)
  const [viewMode, setViewMode] = useState<'cards' | 'file'>('cards');

  // Editable Slide states (For Admin editor mode)
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlides, setEditedSlides] = useState<SlideData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const slides = presentation?.content_data || [];
  const currentSlideIdx = socketData.currentSlide;
  const currentSlide = slides[currentSlideIdx] || slides[0] || null;

  // Initialize view mode and editor state when active presentation changes
  useEffect(() => {
    if (presentation) {
      setEditedSlides(presentation.content_data);
      // Auto toggle to 'file' view if source_type is file (PDF/Image)
      if (presentation.source_type === 'file') {
        setViewMode('file');
      } else {
        setViewMode('cards');
      }
    } else {
      setEditedSlides([]);
      setViewMode('cards');
    }
    setIsEditing(false);
  }, [presentation]);

  // Fullscreen Key Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        exitFullscreenMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, currentSlideIdx, slides]);

  // Fullscreen presentation timer
  useEffect(() => {
    if (isFullscreen) {
      setTimerSeconds(0);
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isFullscreen]);

  const handleNext = () => {
    if (currentSlideIdx < slides.length - 1) {
      socketData.changeSlide(currentSlideIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIdx > 0) {
      socketData.changeSlide(currentSlideIdx - 1);
    }
  };

  const enterFullscreenMode = () => {
    const element = fullscreenContainerRef.current;
    if (element) {
      if (element.requestFullscreen) {
        element.requestFullscreen();
      }
      setIsFullscreen(true);
    }
  };

  const exitFullscreenMode = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // --- Slide Editor Functions (Admin only) ---
  const handleAddSlide = () => {
    const gradients = [
      'from-blue-600 via-indigo-600 to-violet-600',
      'from-purple-600 via-pink-600 to-rose-600',
      'from-rose-600 via-orange-600 to-amber-600',
      'from-teal-600 via-emerald-600 to-green-600'
    ];
    const randGradient = gradients[editedSlides.length % gradients.length];
    setEditedSlides([
      ...editedSlides,
      {
        title: `새 슬라이드 제목 ${editedSlides.length + 1}`,
        subtitle: '부제목',
        content: '여기에 강의 내용을 작성하세요.',
        gradient: randGradient
      }
    ]);
  };

  const handleRemoveSlide = (index: number) => {
    if (editedSlides.length <= 1) {
      alert('최소한 1개 이상의 슬라이드 장이 존재해야 합니다.');
      return;
    }
    setEditedSlides(editedSlides.filter((_, i) => i !== index));
  };

  const handleUpdateSlideValue = (index: number, key: keyof SlideData, value: string) => {
    setEditedSlides(editedSlides.map((slide, i) => {
      if (i === index) {
        return { ...slide, [key]: value };
      }
      return slide;
    }));
  };

  const handleSaveSlides = async () => {
    if (!presentation || !token) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/presentations/${presentation.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content_data: editedSlides
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '편집 내용 저장에 실패했습니다.');

      onUpdateSuccess(data);
      setIsEditing(false);
      
      if (currentSlideIdx >= editedSlides.length) {
        socketData.changeSlide(editedSlides.length - 1);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Rendering Helpers ---
  const isPDF = (url: string) => url.toLowerCase().endsWith('.pdf');
  const isImage = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase();
    return ext && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);
  };

  const renderFileView = (url: string) => {
    const lowerUrl = url.toLowerCase();
    if (isPDF(lowerUrl)) {
      return (
        <iframe 
          src={`${url}#toolbar=0`} 
          className="w-full h-full border-none rounded-xl bg-slate-900 shadow-inner" 
          title="PDF Viewer" 
        />
      );
    } 
    
    if (lowerUrl.endsWith('.pptx') || lowerUrl.endsWith('.ppt')) {
      let targetUrl = url;
      if (url.startsWith('/')) {
        // If relative URL, map current location origin to make it absolute for Office Viewer API
        targetUrl = window.location.origin + url;
      }

      const isLocal = targetUrl.includes('localhost') || targetUrl.includes('127.0.0.1');
      if (isLocal) {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-slate-900/60 rounded-xl border border-slate-800">
            <p className="text-sm font-bold text-amber-400 mb-2">⚠️ 로컬 파일 접근 제한 안내</p>
            <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
              마이크로소프트 오피스 온라인 뷰어 API는 인터넷상에 공개 배포된 파일 URL만 렌더링할 수 있습니다. 
              최종 깃허브 배포 및 Vercel(웹) 연동 시에는 원본 파워포인트 그림 형태 그대로 깔끔히 출력됩니다!
            </p>
            <button
              onClick={() => setViewMode('cards')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition"
            >
              로컬용 카드 뷰로 교안 확인
            </button>
          </div>
        );
      }
      
      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(targetUrl)}`;
      return (
        <iframe 
          src={officeViewerUrl} 
          className="w-full h-full border-none rounded-xl bg-slate-900 shadow-inner" 
          title="PPTX Office Viewer" 
        />
      );
    }

    if (isImage(lowerUrl)) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-950/20 p-2">
          <img 
            src={url} 
            alt="Uploaded Slide Document" 
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
          />
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900 rounded-xl">
        <p className="text-sm font-semibold text-white mb-2">미리보기를 지원하지 않는 파일 형식입니다.</p>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-indigo-400 underline hover:text-indigo-300"
        >
          원본 파일 열기 / 다운로드
        </a>
      </div>
    );
  };

  if (!presentation) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/10 rounded-2xl border border-slate-800 border-dashed p-12">
        <HelpCircle className="w-12 h-12 text-slate-700 mb-3" />
        <h3 className="font-bold text-base text-slate-400">조회할 강의를 선택해 주세요.</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
          {isAdmin 
            ? '좌측 강의 목차에서 선택하거나 [+ 새 강의 목차 만들기] 버튼을 눌러 개설하세요.'
            : '좌측 강의 목차를 선택해 프레젠테이션 교재를 관람하세요.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 h-full overflow-hidden" ref={fullscreenContainerRef}>
      
      {/* Upper Control Bar (Viewer header) */}
      {!isFullscreen && (
        <div className="flex justify-between items-center bg-slate-900/40 p-4 rounded-xl border border-slate-850">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
              <span>{presentation.title}</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wider font-semibold">
                {presentation.source_type}
              </span>
            </h2>

            {/* View Mode Switch Toggle: Only shown when file_url is present */}
            {presentation.file_url && (
              <div className="flex bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`px-2.5 py-1 rounded-md transition ${viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  카드 뷰
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('file')}
                  className={`px-2.5 py-1 rounded-md transition ${viewMode === 'file' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  실물 파일 뷰
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Show controls only for Presenter (Admin) */}
            {isAdmin && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white transition text-xs font-bold"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                자료 수정 (편집기)
              </button>
            )}

            {isEditing && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/30 text-slate-400 hover:text-white transition text-xs font-bold"
                  disabled={isSaving}
                >
                  <Undo className="w-3.5 h-3.5" />
                  취소
                </button>
                <button
                  onClick={handleSaveSlides}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  수정 저장
                </button>
              </div>
            )}

            {!isEditing && (
              <button
                onClick={enterFullscreenMode}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition"
              >
                <Play className="w-3.5 h-3.5" />
                발표 실행
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEW OR EDIT AREA SPLIT */}
      <div className="flex-1 flex overflow-hidden">
        {isEditing ? (
          /* ADMIN SLIDE EDIT VIEW */
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-400">슬라이드 장별 추가/수정/삭제</span>
              <button
                onClick={handleAddSlide}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-white font-semibold text-xs rounded-lg transition border border-slate-700"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                하위 슬라이드 추가
              </button>
            </div>

            <div className="space-y-4">
              {editedSlides.map((slide, index) => (
                <div key={index} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-3 relative group">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-400">Page {index + 1}</span>
                    <button
                      onClick={() => handleRemoveSlide(index)}
                      className="p-1 rounded hover:bg-rose-950/20 text-slate-500 hover:text-rose-400 transition"
                      title="페이지 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {presentation.source_type === 'file' && viewMode === 'file' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">파일 렌더링 경로 (URL)</label>
                        <input
                          type="text"
                          value={slide.title}
                          onChange={(e) => handleUpdateSlideValue(index, 'title', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs text-white outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">파일명</label>
                          <input
                            type="text"
                            value={slide.subtitle}
                            onChange={(e) => handleUpdateSlideValue(index, 'subtitle', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">MIME Type</label>
                          <input
                            type="text"
                            value={slide.content}
                            onChange={(e) => handleUpdateSlideValue(index, 'content', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">제목</label>
                          <input
                            type="text"
                            value={slide.title}
                            onChange={(e) => handleUpdateSlideValue(index, 'title', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">부제목</label>
                          <input
                            type="text"
                            value={slide.subtitle}
                            onChange={(e) => handleUpdateSlideValue(index, 'subtitle', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">설명 및 본문 내용</label>
                        <textarea
                          value={slide.content}
                          onChange={(e) => handleUpdateSlideValue(index, 'content', e.target.value)}
                          rows={3}
                          className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2.5 text-xs text-white outline-none resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* CORE PRESENTATION VIEWER PANEL */
          <div className="flex-1 flex flex-col relative h-full overflow-hidden">
            
            {/* Fullscreen HUD Overlay */}
            {isFullscreen && (
              <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-40 bg-slate-950/40 p-3 rounded-xl border border-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-sm text-white">{presentation.title}</span>
                  <span className="text-xs text-white/60">발표 중</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/60 border border-slate-800 text-xs font-semibold text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTimer(timerSeconds)}</span>
                  </div>
                  <StatusIndicator status={socketData.connectionStatus} latency={socketData.latency} />
                  <button 
                    onClick={exitFullscreenMode} 
                    className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white transition text-xs flex items-center gap-1 border border-slate-700/50"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    종료 (ESC)
                  </button>
                </div>
              </div>
            )}

            {/* Slide Container rendering source */}
            <div className={`flex-1 overflow-hidden relative flex flex-col justify-between ${isFullscreen ? 'h-screen w-screen p-0' : 'rounded-2xl border border-slate-900 bg-slate-950 shadow-2xl'}`}>
              
              {viewMode === 'file' && presentation.file_url ? (
                /* FILE MODE: Render PDF/Image/PPTX native file embed */
                <div className="w-full h-full flex-1 overflow-hidden relative">
                  {renderFileView(presentation.file_url)}
                </div>
              ) : (
                /* CARDS MODE: Render styled slide core card (manual/ai/parsed-pptx) */
                <div className={`flex-1 p-8 md:p-12 bg-gradient-to-tr ${currentSlide?.gradient || 'from-indigo-600 to-violet-600'} flex flex-col justify-between transition-all duration-500 relative`}>
                  
                  {/* Top slide counts (Non-fullscreen only) */}
                  {!isFullscreen && (
                    <div className="flex justify-between items-center z-10">
                      <span className="bg-white/10 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider">
                        Slide {currentSlideIdx + 1} / {slides.length}
                      </span>
                      <span className="text-white/60 text-xs font-semibold uppercase tracking-widest">
                        {presentation.source_type}
                      </span>
                    </div>
                  )}

                  {/* Body Slide texts */}
                  <div className={`my-auto py-8 z-10 ${isFullscreen ? 'px-16' : ''}`}>
                    <h3 className={`font-black tracking-tight leading-tight text-white mb-2 drop-shadow-md ${isFullscreen ? 'text-5xl md:text-7xl mb-4' : 'text-3xl md:text-5xl'}`}>
                      {currentSlide?.title}
                    </h3>
                    <h4 className={`font-medium text-white/80 italic ${isFullscreen ? 'text-2xl mb-8' : 'text-lg md:text-xl mb-6'}`}>
                      {currentSlide?.subtitle}
                    </h4>
                    <p className={`font-light leading-relaxed max-w-4xl bg-black/10 p-5 md:p-8 rounded-2xl backdrop-blur-sm border border-white/5 shadow-lg ${isFullscreen ? 'text-xl md:text-2xl' : 'text-sm md:text-base'}`}>
                      {currentSlide?.content}
                    </p>
                  </div>
                </div>
              )}

              {/* Bottom slide progress bar */}
              <div className="w-full h-1.5 bg-slate-900">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.8)]"
                  style={{ width: `${((currentSlideIdx + 1) / slides.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Viewer control footer */}
            {!isFullscreen && (
              <div className="p-4 bg-slate-950 flex items-center justify-between border-t border-slate-900 mt-4">
                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrev}
                      disabled={currentSlideIdx === 0}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-850 disabled:opacity-30 text-white transition"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <span className="text-xs font-medium text-slate-400 px-1">
                      페이지 {currentSlideIdx + 1} / {slides.length}
                    </span>

                    <button
                      onClick={handleNext}
                      disabled={currentSlideIdx === slides.length - 1}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-850 disabled:opacity-30 text-white transition"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs font-medium text-emerald-400 animate-pulse flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    강사 화면 실시간 동기화 중 (페이지 {currentSlideIdx + 1} / {slides.length})
                  </div>
                )}

                <div className="text-[10px] text-slate-500 font-semibold">
                  {presentation.source_type === 'file' ? '원본 문서가 슬라이드로 렌더링 중입니다.' : 'LUNA 발표 카드 교안'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
