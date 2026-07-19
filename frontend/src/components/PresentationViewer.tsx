import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  HelpCircle,
  Edit3,
  Save,
  Plus,
  Trash2,
  Undo,
  Loader2,
  ExternalLink
} from 'lucide-react';
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
    source_type: 'file' | 'ai' | 'manual' | 'web';
    content_data: SlideData[];
    file_url?: string | null;
  } | null;
  socketData?: any; 
  onUpdateSuccess: (updatedItem: any) => void;
}

const BACKEND_URL = '';

export const PresentationViewer: React.FC<PresentationViewerProps> = ({
  presentation,
  onUpdateSuccess,
}) => {
  const token = useAuthStore((state) => state.token) || 'bypassed_token';
  const isAdmin = true; // Always admin mode

  const [isFullscreen, setIsFullscreen] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  // Local slide index controller, completely bypassing socket lag
  const [currentSlideIdx, setCurrentSlideIdx] = useState(0);

  // Editable Slide states (For Admin editor mode)
  const [isEditing, setIsEditing] = useState(false);
  const [editedSlides, setEditedSlides] = useState<SlideData[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const slides = presentation?.content_data || [];
  const currentSlide = slides[currentSlideIdx] || slides[0] || null;

  // Reset slide index when active presentation changes
  useEffect(() => {
    setCurrentSlideIdx(0);
    if (presentation) {
      setEditedSlides(presentation.content_data);
    } else {
      setEditedSlides([]);
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

  const handleNext = () => {
    if (currentSlideIdx < slides.length - 1) {
      setCurrentSlideIdx(currentSlideIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentSlideIdx > 0) {
      setCurrentSlideIdx(currentSlideIdx - 1);
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
        setCurrentSlideIdx(editedSlides.length - 1);
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

  const getAbsoluteFileUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('/uploads/')) {
      return `https://raw.githubusercontent.com/mellow211/lecture/main/frontend/public${url}`;
    }
    return url;
  };

  /**
   * Enhanced Slide Text Parser to break and format body blocks, converting mock code comments 
   * to stylized monospaced containers to guarantee absolute content legibility.
   */
  const renderSlideText = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');

    // Detect if content is mostly a code block
    const isCodeBlock = text.includes('//') || text.includes('function ') || text.includes('const ') || text.includes('class ');

    if (isCodeBlock) {
      return (
        <pre className="bg-slate-100/90 text-slate-800 p-6 rounded-2xl border border-slate-200 font-mono text-xs md:text-sm overflow-x-auto leading-relaxed shadow-inner max-w-full">
          <code>{text}</code>
        </pre>
      );
    }

    return (
      <div className="space-y-4 max-w-4xl text-left">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-2" />;
          return (
            <p key={idx} className="text-slate-700 text-sm md:text-base leading-relaxed tracking-wide font-normal">
              {line}
            </p>
          );
        })}
      </div>
    );
  };

  const renderFileView = (url: string) => {
    const absoluteUrl = getAbsoluteFileUrl(url);
    const lowerUrl = absoluteUrl.toLowerCase();

    if (isPDF(lowerUrl)) {
      return (
        <iframe 
          src={`${absoluteUrl}#toolbar=0`} 
          className="w-full h-full border-none rounded-xl bg-white shadow-inner" 
          title="PDF Viewer" 
        />
      );
    } 
    
    if (lowerUrl.endsWith('.pptx') || lowerUrl.endsWith('.ppt')) {
      const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;
      return (
        <iframe 
          src={officeViewerUrl} 
          className="w-full h-full border-none rounded-xl bg-white shadow-inner" 
          title="PPTX Office Viewer" 
        />
      );
    }

    if (isImage(lowerUrl)) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 p-2">
          <img 
            src={absoluteUrl} 
            alt="Uploaded Slide Document" 
            className="max-w-full max-h-full object-contain rounded-xl shadow-md" 
          />
        </div>
      );
    }

    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-xl border border-slate-200">
        <p className="text-sm font-semibold text-slate-800 mb-2">미리보기를 지원하지 않는 파일 형식입니다.</p>
        <a 
          href={absoluteUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs text-indigo-600 underline hover:text-indigo-500 font-semibold"
        >
          원본 파일 열기 / 다운로드
        </a>
      </div>
    );
  };

  // Webpage embed renderer with fallback new window trigger
  const renderWebView = (url: string) => {
    return (
      <div className="w-full h-full flex flex-col rounded-xl bg-white overflow-hidden border border-slate-200 shadow-inner">
        <div className="flex justify-between items-center bg-slate-50 p-2.5 px-4 border-b border-slate-200 text-[11px] text-slate-500">
          <span className="font-semibold truncate">🔗 연동 주소: {url}</span>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-250 text-indigo-600 font-bold rounded-lg transition text-[10px] shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            새 창으로 전체 사이트 열기
          </a>
        </div>
        <iframe 
          src={url} 
          className="w-full h-full border-none flex-1 bg-white" 
          title="Embedded External Webpage" 
          sandbox="allow-same-origin allow-scripts allow-popups"
        />
      </div>
    );
  };

  if (!presentation) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed p-12 shadow-sm">
        <HelpCircle className="w-12 h-12 text-slate-300 mb-3" />
        <h3 className="font-bold text-base text-slate-800">조회할 강의를 선택해 주세요.</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm text-center">
          좌측 강의 목차에서 선택하거나 [+ 새 강의 목차 만들기] 버튼을 눌러 개설하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 h-full overflow-hidden" ref={fullscreenContainerRef}>
      
      {/* Upper Control Bar (Unified Layout) */}
      {!isFullscreen && (
        <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span>{presentation.title}</span>
              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase tracking-wider font-semibold">
                {presentation.source_type}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && !isEditing && presentation.source_type !== 'web' && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition text-xs font-bold shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                자료 수정 (편집기)
              </button>
            )}

            {isEditing && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition text-xs font-bold shadow-sm"
                  disabled={isSaving}
                >
                  <Undo className="w-3.5 h-3.5" />
                  취소
                </button>
                <button
                  onClick={handleSaveSlides}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
                  disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  수정 저장
                </button>
              </div>
            )}

            {!isEditing && presentation.source_type !== 'web' && (
              <button
                onClick={enterFullscreenMode}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-sm transition"
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
          <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500">슬라이드 장별 추가/수정/삭제</span>
              <button
                onClick={handleAddSlide}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg transition border border-slate-200"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                하위 슬라이드 추가
              </button>
            </div>

            <div className="space-y-4">
              {editedSlides.map((slide, index) => (
                <div key={index} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3 relative group">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-600 font-mono">Page {index + 1}</span>
                    <button
                      onClick={() => handleRemoveSlide(index)}
                      className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition"
                      title="페이지 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">제목</label>
                        <input
                          type="text"
                          value={slide.title}
                          onChange={(e) => handleUpdateSlideValue(index, 'title', e.target.value)}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg p-2 text-xs text-slate-800 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">부제목</label>
                        <input
                          type="text"
                          value={slide.subtitle}
                          onChange={(e) => handleUpdateSlideValue(index, 'subtitle', e.target.value)}
                          className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg p-2 text-xs text-slate-800 outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">상세 내용 설명</label>
                      <textarea
                        value={slide.content}
                        onChange={(e) => handleUpdateSlideValue(index, 'content', e.target.value)}
                        rows={3}
                        className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-lg p-3 text-xs text-slate-855 outline-none resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* CORE PRESENTATION VIEWER PANEL */
          <div className="flex-1 flex flex-col relative h-full overflow-hidden">
            
            {/* Fullscreen HUD Overlay: Clean white bar */}
            {isFullscreen && (
              <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-40 bg-white/80 p-3.5 rounded-xl border border-slate-200 backdrop-blur-md shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-sm text-slate-800">{presentation.title}</span>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">LUNA View</span>
                </div>
                
                <button 
                  onClick={exitFullscreenMode} 
                  className="p-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-xs font-bold flex items-center gap-1 border border-slate-350 shadow-sm"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                  종료 (ESC)
                </button>
              </div>
            )}

            {/* Slide Container rendering source */}
            <div className={`flex-1 overflow-hidden relative flex flex-col justify-between ${isFullscreen ? 'h-screen w-screen p-0' : 'rounded-2xl border border-slate-200 bg-white shadow-sm'}`}>
              
              {presentation.source_type === 'web' && presentation.file_url ? (
                /* WEB MODE: Embedded External URL */
                renderWebView(presentation.file_url)
              ) : presentation.source_type === 'file' && presentation.file_url ? (
                /* FILE MODE: Render PDF/Image/PPTX native file embed */
                <div className="w-full h-full flex-1 overflow-hidden relative">
                  {renderFileView(presentation.file_url)}
                </div>
              ) : (
                /* CARDS MODE: Render styled slide core card (manual/ai/parsed-pptx) */
                <div 
                  className={`flex-1 p-8 md:p-12 flex flex-col justify-between transition-all duration-500 relative ${
                    currentSlide?.gradient?.startsWith('url(') 
                      ? 'bg-slate-950' 
                      : 'bg-[#fdfbf7] border-4 border-[#eae6db]'
                  }`}
                  style={
                    currentSlide?.gradient?.startsWith('url(')
                      ? {
                          backgroundImage: currentSlide.gradient,
                          backgroundSize: 'contain',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat'
                        }
                      : {}
                  }
                >
                  {/* Top slide counts (Non-fullscreen only) */}
                  {!isFullscreen && (
                    <div className="flex justify-between items-center z-10">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        currentSlide?.gradient?.startsWith('url(') 
                          ? 'bg-white/15 text-white' 
                          : 'bg-slate-150 text-slate-500 border border-slate-200'
                      }`}>
                        Slide {currentSlideIdx + 1} / {slides.length}
                      </span>
                    </div>
                  )}

                  {/* Body Slide texts: ONLY render when it's NOT an image slide */}
                  {!currentSlide?.gradient?.startsWith('url(') && (
                    <div className={`my-auto py-8 z-10 ${isFullscreen ? 'px-16' : ''}`}>
                      <h3 className={`font-black tracking-tight leading-tight text-slate-900 mb-3 ${isFullscreen ? 'text-5xl md:text-6xl mb-5' : 'text-3xl md:text-4xl'}`}>
                        {currentSlide?.title}
                      </h3>
                      <h4 className={`font-semibold text-indigo-600 mb-6 italic ${isFullscreen ? 'text-xl mb-8' : 'text-sm md:text-base'}`}>
                        {currentSlide?.subtitle}
                      </h4>
                      <div className="mt-4">
                        {renderSlideText(currentSlide?.content)}
                      </div>
                    </div>
                  )}
                  
                  {/* For image slide page markers in fullscreen */}
                  {currentSlide?.gradient?.startsWith('url(') && isFullscreen && (
                    <div className="absolute bottom-6 right-6 bg-slate-950/60 border border-white/10 text-white text-xs px-3.5 py-1.5 rounded-full font-bold">
                      Page {currentSlideIdx + 1} / {slides.length}
                    </div>
                  )}
                </div>
              )}

              {/* Bottom slide progress bar */}
              <div className="w-full h-1 bg-slate-150">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.6)]"
                  style={{ width: `${((currentSlideIdx + 1) / slides.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Viewer control footer: Light Theme Styled */}
            {!isFullscreen && presentation.source_type !== 'web' && (
              <div className="p-4 bg-white flex items-center justify-between border-t border-slate-200 mt-4 rounded-xl shadow-sm">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePrev}
                    disabled={currentSlideIdx === 0}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 shadow-sm"
                    title="이전 슬라이드"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  
                  <span className="text-xs font-bold text-slate-500 px-3 py-1 bg-slate-50 rounded-lg">
                    {currentSlideIdx + 1} / {slides.length} 페이지
                  </span>

                  <button
                    onClick={handleNext}
                    disabled={currentSlideIdx === slides.length - 1}
                    className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-30 shadow-sm"
                    title="다음 슬라이드"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={enterFullscreenMode}
                  className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 shadow-sm flex items-center gap-1 text-xs font-bold"
                  title="풀스크린 모드"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  전체화면
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
