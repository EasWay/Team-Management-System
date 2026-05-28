import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { jwtVerify } from 'jose';
import { ENV } from './_core/env';
import { sendChatMessage, markMessagesAsRead, sendNotification, getDb } from './db';
import { users } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

// Socket.io server instance
let io: Server | null = null;

// Redis clients for Socket.io adapter
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

// Extended socket interface with user data
interface AuthenticatedSocket extends Socket {
  userId?: number;
  name?: string;
}

/**
 * Initialize Socket.io server with Redis adapter and JWT authentication
 * Requirement 3.2, 3.4, 6.4: Real-time synchronization infrastructure
 */
export function initializeSocketServer(httpServer: HTTPServer): Server {
  // Create Socket.io server with CORS configuration
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'development'
        ? ['http://localhost:3000', 'http://localhost:5173']
        : process.env.ALLOWED_ORIGINS?.split(',') || [],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Initialize Redis adapter for horizontal scaling (if Redis is configured)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      pubClient = new Redis(redisUrl);
      subClient = pubClient.duplicate();

      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Socket.io] Redis adapter initialized for horizontal scaling');
    } catch (error) {
      console.warn('[Socket.io] Failed to initialize Redis adapter:', error);
      console.log('[Socket.io] Running without Redis adapter (single instance mode)');
    }
  } else {
    console.log('[Socket.io] No REDIS_URL configured, running in single instance mode');
  }

  // JWT-based authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const secret = new TextEncoder().encode(ENV.jwtSecret);
      const { payload } = await jwtVerify(token, secret);

      // Attach user data to socket
      socket.userId = Number(payload.userId);
      socket.name = payload.name as string;

      next();
    } catch (error) {
      console.error('[Socket.io] Authentication failed:', error);
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection event handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket.io] User connected: ${socket.name} (ID: ${socket.userId})`);

    // Auto-join personal room for direct messaging
    if (socket.userId) {
      socket.join(`member:${socket.userId}`);
    }

    // Handle team room joining
    socket.on('joinTeam', (teamId: number) => {
      const roomName = `team:${teamId}`;
      socket.join(roomName);
      console.log(`[Socket.io] User ${socket.name} joined team room: ${roomName}`);

      // Notify other team members (join + presence)
      socket.to(roomName).emit('userJoined', {
        userId: socket.userId,
        username: socket.name,
        teamId,
      });
      socket.to(roomName).emit('presence:online', { userId: socket.userId });
    });

    // Handle team room leaving
    socket.on('leaveTeam', (teamId: number) => {
      const roomName = `team:${teamId}`;
      socket.leave(roomName);
      console.log(`[Socket.io] User ${socket.name} left team room: ${roomName}`);

      // Notify other team members
      socket.to(roomName).emit('userLeft', {
        userId: socket.userId,
        teamId,
      });
    });

    // Handle document room joining (for collaborative editing)
    socket.on('joinDocument', (documentId: string) => {
      const roomName = `doc:${documentId}`;
      socket.join(roomName);
      console.log(`[Socket.io] User ${socket.name} joined document room: ${roomName}`);
      
      // If it's an ideation room, notify others
      if (documentId.startsWith('ideation-')) {
        socket.to(roomName).emit('ideationUserJoined', {
          userId: socket.userId,
          username: socket.name
        });
      }
    });

    // Handle document room leaving
    socket.on('leaveDocument', (documentId: string) => {
      const roomName = `doc:${documentId}`;
      socket.leave(roomName);
      console.log(`[Socket.io] User ${socket.name} left document room: ${roomName}`);
      
      // If it's an ideation room, notify others
      if (documentId.startsWith('ideation-')) {
        socket.to(roomName).emit('ideationUserLeft', {
          userId: socket.userId
        });
      }
    });

    // Handle ideation chat messages (real-time brainstorming)
    socket.on('ideationMessage', (data: {teamId: number, name: string, message: string, timestamp: string, userId: number}) => {
      const roomName = `doc:ideation-${data.teamId}`;
      // Broadcast to all users in the ideation room (including sender)
      io.to(roomName).emit('ideationMessage', data);
      console.log(`[Socket.io] Broadcast ideation message to ${roomName}`);
    });

    // Handle ideation chat clear
    socket.on('ideationClearChat', (data: {teamId: number}) => {
      const roomName = `doc:ideation-${data.teamId}`;
      // Broadcast to all users in the ideation room
      io.to(roomName).emit('ideationChatCleared');
      console.log(`[Socket.io] Broadcast chat cleared to ${roomName}`);
    });

    // Handle office room joining (for office chat)
    socket.on('joinOffice', (data: {teamId: number, officeRole: string, userName: string}) => {
      const roomName = `office:${data.teamId}:${data.officeRole}`;
      socket.join(roomName);
      console.log(`[Socket.io] User ${socket.name} joined office: ${roomName}`);
      
      // Notify others in the office
      socket.to(roomName).emit('officeVisitorJoined', {
        userId: socket.userId,
        userName: data.userName
      });
      
      // Send current visitors list to the new joiner
      io.in(roomName).allSockets().then((sockets) => {
        const visitors = Array.from(sockets).map((socketId) => {
          const s = io.sockets.sockets.get(socketId) as any;
          return { userId: s?.userId, userName: s?.name };
        }).filter(v => v.userId);
        
        socket.emit('officeVisitorsList', { visitors });
      });
    });

    // Handle office room leaving
    socket.on('leaveOffice', (data: {teamId: number, officeRole: string}) => {
      const roomName = `office:${data.teamId}:${data.officeRole}`;
      socket.leave(roomName);
      console.log(`[Socket.io] User ${socket.name} left office: ${roomName}`);
      
      // Notify others
      socket.to(roomName).emit('officeVisitorLeft', {
        userId: socket.userId
      });
    });

    // Handle office chat messages
    socket.on('officeMessage', (data: {teamId: number, officeRole: string, userId: number, userName: string, message: string, timestamp: string}) => {
      const roomName = `office:${data.teamId}:${data.officeRole}`;
      io.to(roomName).emit('officeMessage', data);
      console.log(`[Socket.io] Broadcast office message to ${roomName}`);
    });

    // ── PRESENCE ─────────────────────────────────────────────────────────────
    // Broadcast online when joining a team room (already handled in joinTeam,
    // but also emit a dedicated presence event)
    socket.on('presence:ping', (teamId: number) => {
      const roomName = `team:${teamId}`;
      socket.to(roomName).emit('presence:online', { userId: socket.userId });
    });

    // ── 1:1 CHAT ─────────────────────────────────────────────────────────────
    socket.on('chat:send', async (data: {
      toMemberId: number;
      content: string;
      messageType?: 'text' | 'image' | 'file';
      fileUrl?: string;
      fileName?: string;
      teamId: number;
    }) => {
      if (!socket.userId) return;
      try {
        const msg = await sendChatMessage(
          socket.userId,
          data.toMemberId,
          data.teamId,
          data.content,
          data.messageType ?? 'text',
          data.fileUrl,
          data.fileName
        );
        // Deliver to both parties
        io.to(`member:${data.toMemberId}`).emit('chatMessage', msg);
        io.to(`member:${socket.userId}`).emit('chatMessage', msg);

        // In-app notification to recipient
        const db = await getDb();
        if (db) {
          const [sender] = await db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, socket.userId))
            .limit(1);
          await sendNotification({
            userId: data.toMemberId,
            teamId: data.teamId,
            type: 'team_messages',
            title: `New message from ${sender?.name ?? 'Teammate'}`,
            message: data.content.length > 80 ? data.content.slice(0, 80) + '…' : data.content,
            priority: 'medium',
            actionUrl: '/messages',
            actionLabel: 'View Message',
          });
        }
      } catch (err) {
        console.error('[Socket.io] chat:send error:', err);
      }
    });

    // Typing indicators
    socket.on('chat:typing', (data: { toMemberId: number }) => {
      if (!socket.userId) return;
      io.to(`member:${data.toMemberId}`).emit('chat:typing', { fromMemberId: socket.userId });
    });

    socket.on('chat:typing_stop', (data: { toMemberId: number }) => {
      if (!socket.userId) return;
      io.to(`member:${data.toMemberId}`).emit('chat:typing_stop', { fromMemberId: socket.userId });
    });

    // Read receipts
    socket.on('chat:read', async (data: { fromMemberId: number; teamId: number }) => {
      if (!socket.userId) return;
      try {
        await markMessagesAsRead(data.fromMemberId, socket.userId, data.teamId);
        // Tell the original sender their messages were read
        io.to(`member:${data.fromMemberId}`).emit('chat:read', { byMemberId: socket.userId });
      } catch (err) {
        console.error('[Socket.io] chat:read error:', err);
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] User disconnected: ${socket.name} (Reason: ${reason})`);
      // Broadcast offline to all joined team rooms
      const teamRooms = Array.from(socket.rooms).filter((r: string) => r.startsWith('team:'));
      teamRooms.forEach((room: string) => {
        socket.to(room).emit('presence:offline', { userId: socket.userId });
      });
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`[Socket.io] Socket error for user ${socket.name}:`, error);
    });
  });

  // Global error handler
  io.on('error', (error) => {
    console.error('[Socket.io] Server error:', error);
  });

  console.log('[Socket.io] Server initialized successfully');
  return io;
}

/**
 * Get the Socket.io server instance
 */
export function getSocketServer(): Server | null {
  return io;
}

/**
 * Broadcast task created event to team members
 * Requirement 3.2: Real-time task updates
 */
export function broadcastTaskCreated(teamId: number, task: any) {
  if (!io) return;

  const roomName = `team:${teamId}`;
  io.to(roomName).emit('taskCreated', task);
  console.log(`[Socket.io] Broadcast taskCreated to ${roomName}`);
}

/**
 * Broadcast task updated event to team members
 * Requirement 3.2: Real-time task updates
 */
export function broadcastTaskUpdated(teamId: number, task: any) {
  if (!io) return;

  const roomName = `team:${teamId}`;
  io.to(roomName).emit('taskUpdated', task);
  console.log(`[Socket.io] Broadcast taskUpdated to ${roomName}`);
}

/**
 * Broadcast task moved event to team members
 * Requirement 3.2: Real-time task updates
 */
export function broadcastTaskMoved(teamId: number, taskId: number, newStatus: string, newPosition: number) {
  if (!io) return;

  const roomName = `team:${teamId}`;
  io.to(roomName).emit('taskMoved', { taskId, newStatus, newPosition });
  console.log(`[Socket.io] Broadcast taskMoved to ${roomName}`);
}

/**
 * Broadcast task deleted event to team members
 * Requirement 3.2: Real-time task updates
 */
export function broadcastTaskDeleted(teamId: number, taskId: number) {
  if (!io) return;

  const roomName = `team:${teamId}`;
  io.to(roomName).emit('taskDeleted', { taskId });
  console.log(`[Socket.io] Broadcast taskDeleted to ${roomName}`);
}

/**
 * Broadcast activity created event to team members
 * Requirement 6.4: Real-time activity updates
 */
export function broadcastActivityCreated(teamId: number, activity: any) {
  if (!io) return;

  const roomName = `team:${teamId}`;
  io.to(roomName).emit('activityCreated', activity);
  console.log(`[Socket.io] Broadcast activityCreated to ${roomName}`);
}

/**
 * Broadcast an event to a specific member's personal room
 */
export function broadcastToMember(userId: number, event: string, data: unknown) {
  if (!io) return;
  io.to(`member:${userId}`).emit(event, data);
}

/**
 * Cleanup function to close Redis connections
 */
export async function closeSocketServer() {
  if (io) {
    io.close();
    console.log('[Socket.io] Server closed');
  }

  if (pubClient) {
    await pubClient.quit();
    console.log('[Socket.io] Redis pub client closed');
  }

  if (subClient) {
    await subClient.quit();
    console.log('[Socket.io] Redis sub client closed');
  }
}
