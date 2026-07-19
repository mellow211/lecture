import React from 'react';
import { ConnectionStatus } from '../hooks/useSocket';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface StatusIndicatorProps {
  status: ConnectionStatus;
  latency: number;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, latency }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]',
          label: `온라인 (${latency}ms)`,
          icon: <Wifi className="w-4 h-4 text-emerald-400" />,
        };
      case 'checking':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.6)]',
          label: '연결 확인 중...',
          icon: <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />,
        };
      case 'offline':
      default:
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
          dot: 'bg-rose-500 animate-ping shadow-[0_0_8px_rgba(244,63,94,0.6)]',
          label: '오프라인 (연결 끊김)',
          icon: <WifiOff className="w-4 h-4 text-rose-400" />,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-md transition-all duration-300 ${config.bg}`}>
      <span className="flex items-center gap-1.5">
        {config.icon}
        <span>{config.label}</span>
      </span>
      <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
    </div>
  );
};
