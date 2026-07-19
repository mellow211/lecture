"use client";

import React, { useState, useEffect } from 'react';
import { PresentationViewer, SlideData } from '../components/PresentationViewer';
import { CreatePresentationModal } from '../components/CreatePresentationModal';
import { 
  Presentation as PresentationIcon, 
  Plus, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  Loader2, 
  FileUp, 
  Sparkles, 
  FileText,
  BookOpen
} from 'lucide-react';

const BACKEND_URL = '';

interface PresentationItem {
  id: number;
  title: string;
  source_type: 'file' | 'ai' | 'manual';
  content_data: SlideData[];
  order_index: number;
  created_at: string;
}

export default function DirectDashboardPage() {
  const token = 'bypassed_token';

  // Selected Presentation
  const [presentations, setPresentations] = useState<PresentationItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Creation modal toggle
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Presentations
  const fetchPresentations = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`${BACKEND_URL}/api/presentations`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '목록을 불러오는 데 실패했습니다.');
      
      setPresentations(data);
      // Automatically select the first presentation if none is active
      if (data.length > 0 && activeId === null) {
        setActiveId(data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPresentations();
  }, []);

  // Handle Delete
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent select event
    if (!confirm('정말로 이 강의 목차를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/presentations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '삭제하지 못했습니다.');
      }

      // Refresh list
      setPresentations(prev => prev.filter(item => item.id !== id));
      if (activeId === id) {
        setActiveId(null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Swap order in Database
  const swapOrder = async (index1: number, index2: number) => {
    const item1 = presentations[index1];
    const item2 = presentations[index2];

    try {
      // Optimistic UI update
      const updatedList = [...presentations];
      const tempIdx = item1.order_index;
      item1.order_index = item2.order_index;
      item2.order_index = tempIdx;
      
      updatedList[index1] = item2;
      updatedList[index2] = item1;
      
      setPresentations(updatedList.sort((a, b) => a.order_index - b.order_index));

      // Put request to server
      await fetch(`${BACKEND_URL}/api/presentations/${item1.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ order_index: item1.order_index })
      });

      await fetch(`${BACKEND_URL}/api/presentations/${item2.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ order_index: item2.order_index })
      });
    } catch (err) {
      console.error('Order swap error:', err);
      fetchPresentations(); // Rollback on error
    }
  };

  const handleMoveUp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index > 0) swapOrder(index, index - 1);
  };

  const handleMoveDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (index < presentations.length - 1) swapOrder(index, index + 1);
  };

  // Get active item
  const activePresentation = presentations.find(p => p.id === activeId) || null;

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileUp className="w-4 h-4 text-sky-500" />;
      case 'ai':
        return <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />;
      case 'manual':
      default:
        return <FileText className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col h-screen overflow-hidden">
      
      {/* Header bar: Light Skin with elegant shadows */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <PresentationIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-extrabold text-base text-slate-800 leading-tight">LUNA 강의 자료 기획/저작 도구</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
              Workspace Mode: <span className="text-indigo-600 font-extrabold">Admin (Bypassed)</span>
            </p>
          </div>
        </div>
      </header>

      {/* Main Grid: Left Curriculum Sidebar & Right Viewer Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR: CURRICULUMS (Light Skin styled) */}
        <aside className="w-80 border-r border-slate-200 bg-white flex flex-col overflow-hidden shadow-sm">
          
          {/* Action button: Create */}
          <div className="p-4 border-b border-slate-100">
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-[0_4px_12px_rgba(79,70,229,0.25)] hover:shadow-[0_6px_16px_rgba(79,70,229,0.35)] flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              새 강의 목차 만들기
            </button>
          </div>

          {/* Curriculum List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5" />
                강의 목차 ({presentations.length})
              </span>
              <span>정렬순</span>
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            ) : presentations.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                개설된 강의 목차가 없습니다. [+ 새 강의 목차 만들기] 버튼을 눌러보세요.
              </div>
            ) : (
              presentations.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => {
                    setActiveId(item.id);
                  }}
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between group transition-all duration-200 ${
                    activeId === item.id 
                      ? 'bg-indigo-50 border-indigo-200 text-slate-800 shadow-sm shadow-indigo-100' 
                      : 'bg-white border-slate-100 text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-2.5 max-w-[160px]">
                    <div className="mt-0.5">{getSourceIcon(item.source_type)}</div>
                    <div>
                      <h4 className={`font-semibold text-xs truncate leading-normal ${activeId === item.id ? 'text-indigo-900 font-bold' : 'text-slate-800'}`} title={item.title}>
                        {item.title}
                      </h4>
                      <p className="text-[9px] text-slate-400 mt-0.5">{item.content_data.length}개 슬라이드</p>
                    </div>
                  </div>

                  {/* Ordering and deleting controls */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleMoveUp(index, e)}
                      disabled={index === 0}
                      className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 disabled:opacity-20 border border-slate-200"
                      title="위로 이동"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    
                    <button
                      onClick={(e) => handleMoveDown(index, e)}
                      disabled={index === presentations.length - 1}
                      className="p-1 rounded bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 disabled:opacity-20 border border-slate-200"
                      title="아래로 이동"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    <button
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1 rounded bg-slate-50 hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200"
                      title="삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* RIGHT AREA: PRESENTATION SLIDE VIEWER (Elegant light skin layout) */}
        <main className="flex-1 bg-slate-50 p-6 flex flex-col overflow-hidden justify-center relative">
          <PresentationViewer
            presentation={activePresentation}
            onUpdateSuccess={fetchPresentations}
          />
        </main>

      </div>

      {/* CREATION MODAL */}
      <CreatePresentationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        token={token}
        onSuccess={(newItem) => {
          setPresentations(prev => [...prev, newItem].sort((a, b) => a.order_index - b.order_index));
          setActiveId(newItem.id);
        }}
      />
    </div>
  );
}
