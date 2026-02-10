import * as Y from 'yjs';
import { Server, Socket } from 'socket.io';
import { getDocumentById, updateDocumentYjsState } from './db';

// Store active Yjs documents in memory
const documents = new Map<number, Y.Doc>();

// Store awareness states for each document
const awarenessStates = new Map<number, Map<number, any>>();

// Extended socket interface with user data
interface AuthenticatedSocket extends Socket {
  userId?: number;
  username?: string;
}

/**
 * Initialize Yjs provider with Socket.io integration
 * Requirement 5.2, 5.3, 5.4: Collaborative editing with Yjs and awareness protocol
 */
export function initializeYjsProvider(io: Server) {
  console.log('[Yjs] Provider initialized');

  io.on('connection', (socket: AuthenticatedSocket) => {
    // Handle document synchronization request
    socket.on('yjs:sync', async ({ documentId }: { documentId: number }) => {
      try {
        console.log(`[Yjs] Sync request for document ${documentId} from user ${socket.userId}`);

        // Get or create Yjs document
        let ydoc = documents.get(documentId);
        
        if (!ydoc) {
          // Load document from database
          const dbDoc = await getDocumentById(documentId);
          
          if (!dbDoc) {
            socket.emit('yjs:error', { message: 'Document not found' });
            return;
          }

          // Create new Yjs document
          ydoc = new Y.Doc();
          
          // Apply stored state if exists
          if (dbDoc.yjsState) {
            try {
              const stateVector = Buffer.from(dbDoc.yjsState, 'base64');
              Y.applyUpdate(ydoc, stateVector);
            } catch (error) {
              console.error('[Yjs] Failed to apply stored state:', error);
            }
          }

          // Store in memory
          documents.set(documentId, ydoc);
          
          // Set up update handler to persist changes
          ydoc.on('update', async (update: Uint8Array) => {
            try {
              const currentDoc = documents.get(documentId);
              if (!currentDoc) return;
              
              // Encode the full document state
              const state = Y.encodeStateAsUpdate(currentDoc);
              const base64State = Buffer.from(state).toString('base64');
              
              // Persist to database (fire and forget to avoid blocking)
              if (socket.userId) {
                updateDocumentYjsState(documentId, base64State, socket.userId).catch(error => {
                  console.error('[Yjs] Failed to persist document state:', error);
                });
              }
            } catch (error) {
              console.error('[Yjs] Failed to encode document state:', error);
            }
          });
        }

        // Send current state to the client
        const stateVector = Y.encodeStateAsUpdate(ydoc);
        socket.emit('yjs:sync-response', {
          documentId,
          state: Buffer.from(stateVector).toString('base64'),
        });

        console.log(`[Yjs] Sent state for document ${documentId} to user ${socket.userId}`);
      } catch (error) {
        console.error('[Yjs] Sync error:', error);
        socket.emit('yjs:error', { message: 'Failed to sync document' });
      }
    });

    // Handle Yjs updates from clients
    socket.on('yjs:update', async ({ documentId, update }: { documentId: number; update: string }) => {
      try {
        const ydoc = documents.get(documentId);
        
        if (!ydoc) {
          socket.emit('yjs:error', { message: 'Document not loaded' });
          return;
        }

        // Apply the update to the document
        const updateBuffer = Buffer.from(update, 'base64');
        Y.applyUpdate(ydoc, updateBuffer);

        // Broadcast update to other clients in the document room
        const roomName = `doc:${documentId}`;
        socket.to(roomName).emit('yjs:update', { documentId, update });

        console.log(`[Yjs] Applied and broadcast update for document ${documentId}`);
      } catch (error) {
        console.error('[Yjs] Update error:', error);
        socket.emit('yjs:error', { message: 'Failed to apply update' });
      }
    });

    // Handle awareness updates (cursor positions, selections)
    socket.on('yjs:awareness', ({ documentId, state }: { documentId: number; state: any }) => {
      try {
        // Get or create awareness state map for this document
        let docAwareness = awarenessStates.get(documentId);
        if (!docAwareness) {
          docAwareness = new Map();
          awarenessStates.set(documentId, docAwareness);
        }

        // Store user's awareness state
        if (socket.userId) {
          docAwareness.set(socket.userId, {
            ...state,
            userId: socket.userId,
            username: socket.username,
          });
        }

        // Broadcast awareness update to other clients in the document room
        const roomName = `doc:${documentId}`;
        socket.to(roomName).emit('yjs:awareness', {
          documentId,
          userId: socket.userId,
          username: socket.username,
          state,
        });

        console.log(`[Yjs] Broadcast awareness update for document ${documentId} from user ${socket.userId}`);
      } catch (error) {
        console.error('[Yjs] Awareness error:', error);
      }
    });

    // Handle document room joining
    socket.on('yjs:join', async ({ documentId }: { documentId: number }) => {
      try {
        const roomName = `doc:${documentId}`;
        socket.join(roomName);
        
        console.log(`[Yjs] User ${socket.userId} joined document ${documentId}`);

        // Send current awareness states to the joining user
        const docAwareness = awarenessStates.get(documentId);
        if (docAwareness) {
          const states = Array.from(docAwareness.entries()).map(([userId, state]) => ({
            userId,
            state,
          }));
          socket.emit('yjs:awareness-states', { documentId, states });
        }

        // Notify other users that someone joined
        socket.to(roomName).emit('yjs:user-joined', {
          documentId,
          userId: socket.userId,
          username: socket.username,
        });
      } catch (error) {
        console.error('[Yjs] Join error:', error);
      }
    });

    // Handle document room leaving
    socket.on('yjs:leave', ({ documentId }: { documentId: number }) => {
      try {
        const roomName = `doc:${documentId}`;
        socket.leave(roomName);

        // Remove user's awareness state
        const docAwareness = awarenessStates.get(documentId);
        if (docAwareness && socket.userId) {
          docAwareness.delete(socket.userId);
        }

        // Notify other users that someone left
        socket.to(roomName).emit('yjs:user-left', {
          documentId,
          userId: socket.userId,
        });

        console.log(`[Yjs] User ${socket.userId} left document ${documentId}`);
      } catch (error) {
        console.error('[Yjs] Leave error:', error);
      }
    });

    // Clean up awareness state on disconnect
    socket.on('disconnect', () => {
      // Remove user from all awareness states
      awarenessStates.forEach((docAwareness, documentId) => {
        if (socket.userId && docAwareness.has(socket.userId)) {
          docAwareness.delete(socket.userId);
          
          // Notify other users
          const roomName = `doc:${documentId}`;
          socket.to(roomName).emit('yjs:user-left', {
            documentId,
            userId: socket.userId,
          });
        }
      });
    });
  });
}

/**
 * Get active users for a document from awareness states
 * Requirement 5.3: User presence tracking
 */
export function getDocumentActiveUsers(documentId: number): Array<{ userId: number; username: string; state: any }> {
  const docAwareness = awarenessStates.get(documentId);
  if (!docAwareness) {
    return [];
  }

  return Array.from(docAwareness.entries()).map(([userId, state]) => ({
    userId,
    username: state.username || 'Unknown',
    state,
  }));
}

/**
 * Clean up a document from memory (e.g., when no users are connected)
 */
export function cleanupDocument(documentId: number) {
  documents.delete(documentId);
  awarenessStates.delete(documentId);
  console.log(`[Yjs] Cleaned up document ${documentId} from memory`);
}

/**
 * Get all active document IDs
 */
export function getActiveDocuments(): number[] {
  return Array.from(documents.keys());
}
