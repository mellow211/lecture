import React, { useState } from 'react';
import { 
  X, 
  FileUp, 
  Sparkles, 
  FileText, 
  Loader2, 
  Upload, 
  Plus, 
  Trash2, 
  AlertCircle 
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CreatePresentationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newItem: any) => void;
  token: string;
}

const BACKEND_URL = '';

/**
 * Global CDN Script Loader for PDF.js to completely prevent Turbopack bundle compiler failures.
 */
const loadPdfJs = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      resolve(pdfjsLib);
    };
    script.onerror = (err) => reject(new Error('Failed loading PDF.js engine from CDN.'));
    document.head.appendChild(script);
  });
};

export const CreatePresentationModal: React.FC<CreatePresentationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  token,
}) => {
  const [activeTab, setActiveTab] = useState<'file' | 'ai' | 'manual'>('file');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. File Upload States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 2. AI Generator States
  const [aiTopic, setAiTopic] = useState('');

  // 3. Manual Writing States
  const [manualTitle, setManualTitle] = useState('');
  const [manualSlides, setManualSlides] = useState([
    { title: '슬라이드 제목 1', subtitle: '소제목', content: '여기에 강의 본문 내용을 상세히 작성하세요.', gradient: 'from-blue-600 via-indigo-600 to-violet-600' }
  ]);

  if (!isOpen) return null;

  // Handle manual slide editing helper
  const addManualSlide = () => {
    const gradients = [
      'from-blue-600 via-indigo-600 to-violet-600',
      'from-purple-600 via-pink-600 to-rose-600',
      'from-rose-600 via-orange-600 to-amber-600',
      'from-teal-600 via-emerald-600 to-green-600',
      'from-indigo-600 via-cyan-600 to-teal-600'
    ];
    const randGradient = gradients[manualSlides.length % gradients.length];
    setManualSlides([
      ...manualSlides,
      { title: `슬라이드 제목 ${manualSlides.length + 1}`, subtitle: '부제목', content: '', gradient: randGradient }
    ]);
  };

  const removeManualSlide = (index: number) => {
    if (manualSlides.length <= 1) return;
    setManualSlides(manualSlides.filter((_, i) => i !== index));
  };

  const updateManualSlide = (index: number, key: string, value: string) => {
    const updated = manualSlides.map((slide, i) => {
      if (i === index) {
        return { ...slide, [key]: value };
      }
      return slide;
    });
    setManualSlides(updated);
  };

  // Convert PDF pages to images and upload to Supabase, returning public URLs list
  const processPdfToImages = async (file: File, onProgress: (progress: number) => void): Promise<string[]> => {
    const pdfjsLib = await loadPdfJs();
    const fileReader = new FileReader();

    return new Promise((resolve, reject) => {
      fileReader.onload = async (ev) => {
        try {
          const typedarray = new Uint8Array(ev.target?.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: typedarray }).promise;
          const pageUrls: string[] = [];
          const totalPages = pdf.numPages;

          for (let i = 1; i <= totalPages; i++) {
            // Processing progress (10% to 80%)
            onProgress(Math.round(10 + (i / totalPages) * 70));

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // High-res scale factor
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            if (context) {
              await page.render({ canvasContext: context, viewport: viewport }).promise;
              const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
              const blob = await (await fetch(dataUrl)).blob();

              const cleanBase = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "");
              const uniquePageName = `${cleanBase}-page-${i}-${Date.now()}-${Math.round(Math.random() * 1e6)}.jpg`;

              const { data: uploadData, error: uploadErr } = await supabase!.storage
                .from('presentations')
                .upload(uniquePageName, blob, {
                  contentType: 'image/jpeg',
                  cacheControl: '3600',
                  upsert: false
                });

              if (uploadErr) {
                throw new Error(`페이지 ${i} 업로드 실패: ${uploadErr.message}`);
              }

              const { data: urlData } = supabase!.storage
                .from('presentations')
                .getPublicUrl(uniquePageName);

              pageUrls.push(urlData.publicUrl);
            }
          }
          resolve(pageUrls);
        } catch (err) {
          reject(err);
        }
      };
      fileReader.onerror = (err) => reject(new Error('파일 읽기 실패.'));
      fileReader.readAsArrayBuffer(file);
    });
  };

  // Submission Flow
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (activeTab === 'file') {
        if (!selectedFile) throw new Error('업로드할 파일을 선택해 주세요.');

        if (!supabase) {
          throw new Error('Supabase Storage 클라이언트가 연동되지 않았습니다. .env.local 설정을 완료해 주세요.');
        }

        // Upload progress simulation
        setUploadProgress(10);

        // 1. Auto-create 'presentations' Bucket if not exists in Supabase
        try {
          const { data: buckets, error: listError } = await supabase.storage.listBuckets();
          if (!listError) {
            const hasBucket = buckets.some(b => b.name === 'presentations');
            if (!hasBucket) {
              await supabase.storage.createBucket('presentations', {
                public: true,
                allowedMimeTypes: [
                  'application/pdf',
                  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                  'application/vnd.ms-powerpoint',
                  'image/*'
                ]
              });
            }
          }
        } catch (bucketErr: any) {
          console.warn('Bucket setup warning:', bucketErr.message);
        }

        const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
        const isPdfFile = fileExt === 'pdf';
        
        let slideDataList: any[] = [];
        let finalFileUrl = '';

        if (isPdfFile) {
          // --- PDF Pipeline: Convert pages to high-res JPG files and store as separate slide cards ---
          setError('PDF 문서를 슬라이드 쇼 용 이미지 카드로 변환 중입니다. 잠시만 기다려주세요...');
          const pageImageUrls = await processPdfToImages(selectedFile, (progress) => {
            setUploadProgress(progress);
          });
          setError('');

          slideDataList = pageImageUrls.map((url, idx) => ({
            title: `${idx + 1} 페이지`,
            subtitle: selectedFile.name,
            content: '',
            // Embed URL in gradient field so Viewer can extract and render as full-slide background images
            gradient: `url(${url})`
          }));
          
          finalFileUrl = pageImageUrls[0] || ''; // Reference starting URL
        } else {
          // --- PPTX/Image Pipeline: Single upload to storage bucket ---
          const cleanBaseName = selectedFile.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "");
          const safeBase = cleanBaseName || 'file';
          const uniqueFileName = `${safeBase}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${fileExt}`;

          try {
            const { error: uploadErr } = await supabase.storage
              .from('presentations')
              .upload(uniqueFileName, selectedFile, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadErr) {
              throw new Error(`업로드 실패: ${uploadErr.message}`);
            }

            const { data: urlData } = supabase.storage
              .from('presentations')
              .getPublicUrl(uniqueFileName);

            finalFileUrl = urlData.publicUrl;
            setUploadProgress(85);

          } catch (supabaseErr: any) {
            throw supabaseErr;
          }

          // Invoke Next.js API /api/upload to parse PPTX files for text backups
          let uploadData;
          try {
            const uploadRes = await fetch(`${BACKEND_URL}/api/upload`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                fileUrl: finalFileUrl,
                originalName: selectedFile.name,
                mimeType: selectedFile.type
              })
            });

            if (!uploadRes.ok) {
              throw new Error(`파싱 처리 실패 (서버 응답 코드: ${uploadRes.status})`);
            }

            uploadData = await uploadRes.json();
            setUploadProgress(100);

          } catch (uploadErr: any) {
            throw uploadErr;
          }

          const hasParsedSlides = uploadData.slides && uploadData.slides.length > 0;
          slideDataList = hasParsedSlides
            ? uploadData.slides
            : [
                {
                  title: uploadData.fileUrl,
                  subtitle: uploadData.originalName,
                  content: uploadData.mimeType,
                  gradient: ''
                }
              ];
        }

        // 4. Create Presentation entry in database
        const fileBaseName = selectedFile.name.replace(/\.[^/.]+$/, "");
        const response = await fetch(`${BACKEND_URL}/api/presentations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: fileBaseName,
            source_type: isPdfFile ? 'manual' : 'file', // Treat image slices as manual slideshows
            content_data: slideDataList,
            file_url: finalFileUrl
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '저장에 실패했습니다.');
        
        onSuccess(data);
        handleClose();

      } else if (activeTab === 'ai') {
        if (!aiTopic.trim()) throw new Error('AI 강의 기획 주제를 기입해 주세요.');

        const response = await fetch(`${BACKEND_URL}/api/ai/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ topic: aiTopic })
        });

        const aiResult = await response.json();
        if (!response.ok) throw new Error(aiResult.error || 'AI 연동에 실패했습니다.');

        // Save generated slides list to database
        const saveResponse = await fetch(`${BACKEND_URL}/api/presentations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: aiResult.title,
            source_type: 'ai',
            content_data: aiResult.content_data
          })
        });

        const savedData = await saveResponse.json();
        if (!saveResponse.ok) throw new Error(savedData.error || 'AI 슬라이드 저장에 실패했습니다.');

        onSuccess(savedData);
        handleClose();

      } else if (activeTab === 'manual') {
        if (!manualTitle.trim()) throw new Error('강의 목차 명칭을 기입해 주세요.');
        if (manualSlides.some(s => !s.title.trim() || !s.content.trim())) {
          throw new Error('슬라이드 제목과 내용을 빠짐없이 작성해 주세요.');
        }

        const response = await fetch(`${BACKEND_URL}/api/presentations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: manualTitle,
            source_type: 'manual',
            content_data: manualSlides
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '저장에 실패했습니다.');

        onSuccess(data);
        handleClose();
      }
    } catch (err: any) {
      setError(err.message || '작업 수행 중 요류가 발생했습니다.');
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setAiTopic('');
    setManualTitle('');
    setManualSlides([
      { title: '슬라이드 제목 1', subtitle: '소제목', content: '여기에 강의 본문 내용을 상세히 작성하세요.', gradient: 'from-blue-600 via-indigo-600 to-violet-600' }
    ]);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Dialog box */}
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <span>새 프레젠테이션 추가</span>
          </h2>
          <button onClick={handleClose} className="p-1 rounded bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white transition" disabled={isLoading}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selectors */}
        <div className="grid grid-cols-3 border-b border-slate-850 p-2 bg-slate-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('file')}
            className={`py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'file' 
                ? 'bg-slate-800 text-indigo-400 border border-indigo-500/30 shadow-inner' 
                : 'text-slate-400 hover:text-white'
            }`}
            disabled={isLoading}
          >
            <FileUp className="w-4 h-4" />
            기존 파일 불러오기
          </button>
          
          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'ai' 
                ? 'bg-slate-800 text-indigo-400 border border-indigo-500/30 shadow-inner' 
                : 'text-slate-400 hover:text-white'
            }`}
            disabled={isLoading}
          >
            <Sparkles className="w-4 h-4" />
            AI 이용하여 만들기
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-2 text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              activeTab === 'manual' 
                ? 'bg-slate-800 text-indigo-400 border border-indigo-500/30 shadow-inner' 
                : 'text-slate-400 hover:text-white'
            }`}
            disabled={isLoading}
          >
            <FileText className="w-4 h-4" />
            직접 작성하기
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: REAL FILE UPLOAD */}
          {activeTab === 'file' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed text-center">
                💡 **팁: 파워포인트(PPTX) 파일을 업로드하실 때는 PDF 파일로 저장하여 올려보세요!**<br />
                PDF 파일로 업로드하시면 각 슬라이드가 선명한 고해상도 이미지 카드로 즉석 변환되어,<br />
                LUNA 고유의 동적 발표 화면 및 좌우 화살표 페이지 전환과 100% 연동됩니다.
              </p>
              
              <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-8 flex flex-col items-center justify-center bg-slate-950/40 cursor-pointer transition relative">
                <input
                  type="file"
                  accept=".pdf,.pptx,.ppt,image/*"
                  onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={isLoading}
                />
                <Upload className="w-10 h-10 text-indigo-400 mb-3" />
                <span className="text-sm font-medium text-white mb-1">
                  {selectedFile ? selectedFile.name : '마우스로 파일을 끌어오거나 클릭하여 선택'}
                </span>
                <span className="text-xs text-slate-500">
                  지원 규격: PDF, PPTX, PPT, 이미지 (최대 50MB)
                </span>
              </div>

              {isLoading && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-indigo-400 font-semibold">
                    <span>PDF 이미지 슬라이드 변환 및 업로드 중...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-500 h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MAPPED GEMINI AI */}
          {activeTab === 'ai' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                구글 Gemini AI에게 작성할 강의 테마와 내용을 프롬프트로 전달하여 구조화된 교재 슬라이드를 즉석으로 빌드합니다.
              </p>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">강의 기획안 주제</label>
                <input
                  type="text"
                  required={activeTab === 'ai'}
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="예: 객체지향 설계 5대 원칙(SOLID) 해설"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-700 outline-none transition"
                  disabled={isLoading}
                />
              </div>

              {isLoading && (
                <div className="flex flex-col items-center justify-center py-6 text-indigo-400 text-sm gap-2">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="font-semibold animate-pulse">구글 Gemini AI가 3장 분량의 슬라이드를 집필하고 있습니다...</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MANUAL WRITING */}
          {activeTab === 'manual' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">강의 목차 대제목</label>
                <input
                  type="text"
                  required={activeTab === 'manual'}
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="예: 제 2강 - API 라우팅 엔드포인트 기획"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl py-2.5 px-4 text-sm text-white placeholder-slate-700 outline-none transition"
                  disabled={isLoading}
                />
              </div>

              <div className="border-t border-slate-800/60 pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-400">슬라이드 장별 원고 ({manualSlides.length}장)</span>
                  <button
                    type="button"
                    onClick={addManualSlide}
                    className="flex items-center gap-1 text-[11px] font-bold text-white bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded-lg transition"
                    disabled={isLoading}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    새 슬라이드 추가
                  </button>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {manualSlides.map((slide, index) => (
                    <div key={index} className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 relative space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400"># Slide Page {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeManualSlide(index)}
                          className="text-slate-500 hover:text-rose-400 transition"
                          disabled={manualSlides.length <= 1 || isLoading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          required
                          value={slide.title}
                          onChange={(e) => updateManualSlide(index, 'title', e.target.value)}
                          placeholder="슬라이드 제목"
                          className="bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none"
                          disabled={isLoading}
                        />
                        <input
                          type="text"
                          value={slide.subtitle}
                          onChange={(e) => updateManualSlide(index, 'subtitle', e.target.value)}
                          placeholder="부제목 (선택)"
                          className="bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none"
                          disabled={isLoading}
                        />
                      </div>

                      <textarea
                        required
                        value={slide.content}
                        onChange={(e) => updateManualSlide(index, 'content', e.target.value)}
                        placeholder="슬라이드 상세 교재 설명 작성..."
                        rows={3}
                        className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg p-2 text-xs text-white outline-none resize-none"
                        disabled={isLoading}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl transition"
            disabled={isLoading}
          >
            취소
          </button>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs shadow-[0_0_15px_rgba(79,70,229,0.3)] transition"
          >
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                작성 중...
              </span>
            ) : (
              '저장 완료'
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
