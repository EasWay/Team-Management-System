import { io, Socket } from 'socket.io-client';
import { WS_URL, STORAGE_KEYS } from './constants';
import { SecureStorage } from './secureStorage';

let socketInstance: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socketInstance?.connected) return socketInstance;

  const token = await SecureStorage.get(STORAGE_KEYS.ACCESS_TOKEN);

  socketInstance = io(WS_URL, {
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    reconnectionAttempts: 5,
  });

  socketInstance.on('connect', () => {
    console.log('[Socket] Connected:', socketInstance?.id);
  });

  socketInstance.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socketInstance.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socketInstance;
}

export function disconnectSocket() {
  socketInstance?.disconnect();
  socketInstance = null;
}

export function joinTeamRoom(teamId: number) {
  socketInstance?.emit('joinTeam', teamId);
}

export function leaveTeamRoom(teamId: number) {
  socketInstance?.emit('leaveTeam', teamId);
}

export function onTaskCreated(cb: (data: unknown) => void) {
  socketInstance?.on('taskCreated', cb);
  return () => socketInstance?.off('taskCreated', cb);
}

export function onTaskUpdated(cb: (data: unknown) => void) {
  socketInstance?.on('taskUpdated', cb);
  return () => socketInstance?.off('taskUpdated', cb);
}

export function onTaskMoved(cb: (data: unknown) => void) {
  socketInstance?.on('taskMoved', cb);
  return () => socketInstance?.off('taskMoved', cb);
}

export function onTaskDeleted(cb: (data: unknown) => void) {
  socketInstance?.on('taskDeleted', cb);
  return () => socketInstance?.off('taskDeleted', cb);
}

export function onActivityCreated(cb: (data: unknown) => void) {
  socketInstance?.on('activityCreated', cb);
  return () => socketInstance?.off('activityCreated', cb);
}

export function onChatMessage(cb: (data: unknown) => void) {
  socketInstance?.on('chatMessage', cb);
  return () => socketInstance?.off('chatMessage', cb);
}

export function joinMemberRoom(memberId: number) {
  socketInstance?.emit('joinMember', memberId);
}
