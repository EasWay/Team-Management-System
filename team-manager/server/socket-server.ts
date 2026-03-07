import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { jwtVerify } from 'jose';
import { ENV } from './_core/env';

// Socket.io server instance
let io: Server | null = null;

// Redis clients for Socket.io adapter
let pubClient: Redis | null = null;
let subClient: Redis | null = null;

// Extended socket interface with user data
interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
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
      socket.userId = payload.userId as number;
      socket.username = payload.username as string;

      next();
    } catch (error) {
      console.error('[Socket.io] Authentication failed:', error);
      next(new Error('Invalid authentication token'));
    }
  });

  // Connection event handler
  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`[Socket.io] User connected: ${socket.username} (ID: ${socket.userId})`);

    // Handle team room joining
    socket.on('joinTeam', (teamId: number) => {
      const roomName = `team:${teamId}`;
      socket.join(roomName);
      console.log(`[Socket.io] User ${socket.username} joined team room: ${roomName}`);

      // Notify other team members
      socket.to(roomName).emit('userJoined', {
        userId: socket.userId,
        username: socket.username,
        teamId,
      });
    });

    // Handle team room leaving
    socket.on('leaveTeam', (teamId: number) => {
      const roomName = `team:${teamId}`;
      socket.leave(roomName);
      console.log(`[Socket.io] User ${socket.username} left team room: ${roomName}`);

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
      console.log(`[Socket.io] User ${socket.username} joined document room: ${roomName}`);
    });

    // Handle document room leaving
    socket.on('leaveDocument', (documentId: string) => {
      const roomName = `doc:${documentId}`;
      socket.leave(roomName);
      console.log(`[Socket.io] User ${socket.username} left document room: ${roomName}`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] User disconnected: ${socket.username} (Reason: ${reason})`);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`[Socket.io] Socket error for user ${socket.username}:`, error);
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
