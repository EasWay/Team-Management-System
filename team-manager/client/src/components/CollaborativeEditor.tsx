import { useEffect, useRef, useState } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import * as Y from 'yjs';
import { useSocket, useSocketEvent } from '../contexts/SocketContext';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, Users } from 'lucide-react';
import { cn } from '../lib/utils';

interface CollaborativeEditorProps {
  documentId: number;
  initialContent?: string;
  language?: string;
  onContentChange?: (content: string) => void;
}

interface AwarenessState {
  userId: number;
  username: string;
  cursor?: {
    line: number;
    column: number;
  };
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

interface ActiveUser {
  userId: number;
  username: string;
  state: AwarenessState;
  color: string;
}

// Generate a consistent color for a user based on their ID
function getUserColor(userId: number): string {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52B788',
  ];
  return colors[userId % colors.length];
}

// Convert Base64 back to Uint8Array for Y.applyUpdate
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Convert Uint8Array to Base64 to safely emit
function uint8ArrayToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

export function CollaborativeEditor({
  documentId,
  initialContent = '',
  language = 'typescript',
  onContentChange,
}: CollaborativeEditorProps) {
  const { socket } = useSocket();
  const [isConnected, setIsConnected] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [content, setContent] = useState(initialContent);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const isRemoteChangeRef = useRef(false);

  // Initialize Yjs document
  useEffect(() => {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('monaco');

    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    return () => {
      ydoc.destroy();
    };
  }, []);

  // Connect to Socket.io and sync document
  useEffect(() => {
    if (!socket) return;

    setIsConnected(true);

    // Join document room
    socket.emit('yjs:join', { documentId });

    // Request initial sync
    socket.emit('yjs:sync', { documentId });

    return () => {
      // Leave document room
      socket.emit('yjs:leave', { documentId });
      setIsConnected(false);
    };
  }, [socket, documentId]);

  // Handle sync response
  useSocketEvent('yjs:sync-response', ({ documentId: docId, state }: { documentId: number; state: string }) => {
    if (docId !== documentId || !ydocRef.current || !ytextRef.current) return;

    try {
      // Apply the state from server
      const stateBuffer = base64ToUint8Array(state);
      Y.applyUpdate(ydocRef.current, stateBuffer);

      // Update editor content
      const text = ytextRef.current.toString();
      setContent(text);
      setIsSynced(true);

      console.log('[CollaborativeEditor] Synced document', documentId);
    } catch (error) {
      console.error('[CollaborativeEditor] Failed to apply sync:', error);
    }
  });

  // Handle updates from other users
  useSocketEvent('yjs:update', ({ documentId: docId, update }: { documentId: number; update: string }) => {
    if (docId !== documentId || !ydocRef.current) return;

    try {
      isRemoteChangeRef.current = true;
      const updateBuffer = base64ToUint8Array(update);
      Y.applyUpdate(ydocRef.current, updateBuffer);

      // Update editor content
      if (ytextRef.current && editorRef.current) {
        const text = ytextRef.current.toString();
        const model = editorRef.current.getModel();
        if (model && model.getValue() !== text) {
          model.setValue(text);
        }
      }

      isRemoteChangeRef.current = false;
    } catch (error) {
      console.error('[CollaborativeEditor] Failed to apply update:', error);
    }
  });

  // Handle awareness updates (cursor positions)
  useSocketEvent('yjs:awareness', ({ documentId: docId, userId, username, state }: any) => {
    if (docId !== documentId) return;

    setActiveUsers(prev => {
      const filtered = prev.filter(u => u.userId !== userId);
      return [
        ...filtered,
        {
          userId,
          username,
          state,
          color: getUserColor(userId),
        },
      ];
    });
  });

  // Handle awareness states (initial load)
  useSocketEvent('yjs:awareness-states', ({ documentId: docId, states }: { documentId: number; states: any[] }) => {
    if (docId !== documentId) return;

    const users = states.map(({ userId, state }) => ({
      userId,
      username: state.username || 'Unknown',
      state,
      color: getUserColor(userId),
    }));

    setActiveUsers(users);
  });

  // Handle user joined
  useSocketEvent('yjs:user-joined', ({ documentId: docId, userId, username }: any) => {
    if (docId !== documentId) return;

    console.log('[CollaborativeEditor] User joined:', username);
  });

  // Handle user left
  useSocketEvent('yjs:user-left', ({ documentId: docId, userId }: any) => {
    if (docId !== documentId) return;

    setActiveUsers(prev => prev.filter(u => u.userId !== userId));
  });

  // Handle editor mount
  function handleEditorDidMount(editor: any, monaco: Monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Set initial content
    if (initialContent) {
      editor.setValue(initialContent);
    }
  }

  // Handle editor content change
  function handleEditorChange(value: string | undefined) {
    if (!value || isRemoteChangeRef.current || !ydocRef.current || !ytextRef.current || !socket) return;

    try {
      // Update Yjs document
      ydocRef.current.transact(() => {
        if (!ytextRef.current) return;

        const currentText = ytextRef.current.toString();
        if (currentText !== value) {
          ytextRef.current.delete(0, currentText.length);
          ytextRef.current.insert(0, value);
        }
      });

      // Get the update and send to server
      const update = Y.encodeStateAsUpdate(ydocRef.current);
      const base64Update = uint8ArrayToBase64(update);

      socket.emit('yjs:update', {
        documentId,
        update: base64Update,
      });

      // Notify parent component
      if (onContentChange) {
        onContentChange(value);
      }

      setContent(value);
    } catch (error) {
      console.error('[CollaborativeEditor] Failed to handle change:', error);
    }
  }

  // Handle cursor position change
  useEffect(() => {
    if (!editorRef.current || !socket) return;

    const editor = editorRef.current;

    const disposable = editor.onDidChangeCursorPosition((e: any) => {
      const position = e.position;

      socket.emit('yjs:awareness', {
        documentId,
        state: {
          cursor: {
            line: position.lineNumber,
            column: position.column,
          },
        },
      });
    });

    return () => {
      disposable.dispose();
    };
  }, [socket, documentId]);

  return (
    <div className="flex flex-col h-full">
      {/* Header with connection status and active users */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="outline" className="gap-1">
              <Wifi className="h-3 w-3 text-green-500" />
              {isSynced ? 'Synced' : 'Connecting...'}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <WifiOff className="h-3 w-3 text-red-500" />
              Offline
            </Badge>
          )}
        </div>

        {/* Active users */}
        <div className="flex items-center gap-2">
          {activeUsers.length > 0 && (
            <>
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="flex -space-x-2">
                {activeUsers.map(user => (
                  <Avatar
                    key={user.userId}
                    className={cn(
                      'h-8 w-8 border-2',
                      'hover:z-10 transition-transform hover:scale-110'
                    )}
                    style={{ borderColor: user.color }}
                  >
                    <AvatarFallback style={{ backgroundColor: user.color + '20' }}>
                      {user.username.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={language}
          value={content}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: !isSynced,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
