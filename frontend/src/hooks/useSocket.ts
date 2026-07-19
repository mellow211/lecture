import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/useAuthStore';

export type ConnectionStatus = 'checking' | 'online' | 'offline';

export interface ActiveUser {
  userId: number;
  username: string;
  role: 'presenter' | 'student';
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export const useSocket = (roomId: string | null) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

  const socketRef = useRef<Socket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('checking');
  const [latency, setLatency] = useState<number>(0);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [userCount, setUserCount] = useState<number>(0);
  const [currentSlide, setCurrentSlide] = useState<number>(0);

  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingTimeRef = useRef<number>(0);
  const pongTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Send slide change event (presenter only)
  const changeSlide = useCallback((newSlide: number) => {
    if (socketRef.current && socketRef.current.connected && user?.role === 'presenter') {
      socketRef.current.emit('slide:change', { currentSlide: newSlide });
    }
  }, [user]);

  useEffect(() => {
    if (!token || !roomId) {
      setConnectionStatus('offline');
      return;
    }

    // Initialize Socket.io Client
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'], // Use WebSocket transport for stability and speed
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;
    setConnectionStatus('checking');

    // Socket built-in event listeners
    socket.on('connect', () => {
      console.log('Socket.io connected successfully');
      setConnectionStatus('online');
      
      // Join Room immediately upon connection
      socket.emit('room:join', { roomId });

      // Start custom Ping/Pong Heartbeat loop
      startPingPongLoop();
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket.io disconnected:', reason);
      setConnectionStatus('offline');
      stopPingPongLoop();
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
      setConnectionStatus('offline');
      stopPingPongLoop();
    });

    // Custom presentation events
    socket.on('slide:changed', ({ currentSlide }: { currentSlide: number }) => {
      setCurrentSlide(currentSlide);
    });

    socket.on('room:users_update', ({ users, count }: { users: ActiveUser[]; count: number }) => {
      setActiveUsers(users);
      setUserCount(count);
    });

    // Custom Pong response
    socket.on('pong', () => {
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = null;
      }
      
      const responseTime = Date.now() - lastPingTimeRef.current;
      setLatency(responseTime);
      setConnectionStatus('online');
    });

    socket.on('error', (err: { message: string }) => {
      console.error('Socket room/auth error:', err.message);
    });

    // --- Ping/Pong Heartbeat functions ---
    function startPingPongLoop() {
      // Clear any existing intervals
      stopPingPongLoop();

      // Trigger immediately and then every 3 seconds
      sendPing();
      pingIntervalRef.current = setInterval(() => {
        sendPing();
      }, 3000);
    }

    function sendPing() {
      if (socket && socket.connected) {
        lastPingTimeRef.current = Date.now();
        socket.emit('ping');

        // Set a timeout. If pong doesn't arrive in 2.5 seconds, mark as checking or offline
        if (pongTimeoutRef.current) clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = setTimeout(() => {
          console.warn('Ping timeout: No pong received from server.');
          setConnectionStatus('checking');
        }, 2500);
      }
    }

    function stopPingPongLoop() {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (pongTimeoutRef.current) {
        clearTimeout(pongTimeoutRef.current);
        pongTimeoutRef.current = null;
      }
    }

    // Cleanup on unmount or roomId/token change
    return () => {
      stopPingPongLoop();
      socket.disconnect();
      socketRef.current = null;
      console.log('Socket.io connection cleaned up');
    };
  }, [roomId, token]);

  return {
    connectionStatus,
    latency,
    activeUsers,
    userCount,
    currentSlide,
    changeSlide,
  };
};
