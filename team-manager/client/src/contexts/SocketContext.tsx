import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { tokenStorage } from '@/lib/tokenStorage';

// Socket.io event types
interface ServerToClientEvents {
  taskCreated: (task: any) => void;
  taskUpdated: (task: any) => void;
  taskMoved: (data: { taskId: number; newStatus: string; newPosition: number }) => void;
  taskDeleted: (data: { taskId: number }) => void;
  userJoined: (data: { userId: number; username: string; teamId: number }) => void;
  userLeft: (data: { userId: number; teamId: number }) => void;
  activityCreated: (activity: any) => void;
  // Yjs collaborative editing events
  'yjs:sync-response': (data: { documentId: number; state: string }) => void;
  'yjs:update': (data: { documentId: number; update: string }) => void;
  'yjs:awareness': (data: { documentId: number; userId: number; username: string; state: any }) => void;
  'yjs:awareness-states': (data: { documentId: number; states: any[] }) => void;
  'yjs:user-joined': (data: { documentId: number; userId: number; username: string }) => void;
  'yjs:user-left': (data: { documentId: number; userId: number }) => void;
}

interface ClientToServerEvents {
  joinTeam: (teamId: number) => void;
  leaveTeam: (teamId: number) => void;
  joinDocument: (documentId: string) => void;
  leaveDocument: (documentId: string) => void;
  // Yjs collaborative editing events
  'yjs:join': (data: { documentId: string }) => void;
  'yjs:leave': (data: { documentId: string }) => void;
  'yjs:sync': (data: { documentId: string }) => void;
  'yjs:update': (data: { documentId: number; update: string }) => void;
  'yjs:awareness': (data: { documentId: number; state: any }) => void;
}

type SocketInstance = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: SocketInstance | null;
  isConnected: boolean;
  joinTeam: (teamId: number) => void;
  leaveTeam: (teamId: number) => void;
  joinDocument: (documentId: string) => void;
  leaveDocument: (documentId: string) => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

/**
 * Socket.io client provider
 * Requirement 3.2, 3.4: Real-time client integration
 */
export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<SocketInstance | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  // Manual reconnection handler with exponential backoff
  const handleReconnect = useCallback((socketInstance: SocketInstance) => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('[Socket.io] Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
    reconnectAttemptsRef.current += 1;

    console.log(`[Socket.io] Attempting to reconnect in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      socketInstance.connect();
    }, delay);
  }, []);

  useEffect(() => {
    // Get authentication token from tokenStorage utility
    const token = tokenStorage.getAccessToken();
    
    if (!token) {
      console.debug('[Socket.io] No authentication token found - waiting for login');
      return;
    }

    // Create Socket.io client instance
    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket: SocketInstance = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('[Socket.io] Connected to server');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
    });

    newSocket.on('disconnect', (reason) => {
      console.log('[Socket.io] Disconnected from server:', reason);
      setIsConnected(false);

      // Handle reconnection for certain disconnect reasons
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, try to reconnect
        handleReconnect(newSocket);
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('[Socket.io] Connection error:', error);
      setIsConnected(false);
      handleReconnect(newSocket);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.close();
    };
  }, [handleReconnect]);

  // Join team room
  const joinTeam = useCallback((teamId: number) => {
    if (socket && isConnected) {
      socket.emit('joinTeam', teamId);
      console.log(`[Socket.io] Joined team room: ${teamId}`);
    }
  }, [socket, isConnected]);

  // Leave team room
  const leaveTeam = useCallback((teamId: number) => {
    if (socket && isConnected) {
      socket.emit('leaveTeam', teamId);
      console.log(`[Socket.io] Left team room: ${teamId}`);
    }
  }, [socket, isConnected]);

  // Join document room
  const joinDocument = useCallback((documentId: string) => {
    if (socket && isConnected) {
      socket.emit('joinDocument', documentId);
      console.log(`[Socket.io] Joined document room: ${documentId}`);
    }
  }, [socket, isConnected]);

  // Leave document room
  const leaveDocument = useCallback((documentId: string) => {
    if (socket && isConnected) {
      socket.emit('leaveDocument', documentId);
      console.log(`[Socket.io] Left document room: ${documentId}`);
    }
  }, [socket, isConnected]);

  const value: SocketContextValue = {
    socket,
    isConnected,
    joinTeam,
    leaveTeam,
    joinDocument,
    leaveDocument,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

/**
 * Hook to access Socket.io instance
 */
export function useSocket(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}

/**
 * Hook to listen to Socket.io events
 * Requirement 3.2, 3.4: Real-time event handling
 */
export function useSocketEvent<K extends keyof ServerToClientEvents>(
  event: K,
  handler: ServerToClientEvents[K]
) {
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on(event, handler as any);

    return () => {
      socket.off(event, handler as any);
    };
  }, [socket, event, handler]);
}

/**
 * Connection status indicator component
 */
export function ConnectionStatus() {
  const { isConnected } = useSocket();

  if (isConnected) {
    return null; // Don't show anything when connected
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
      <span className="text-sm font-medium">Reconnecting...</span>
    </div>
  );
}
