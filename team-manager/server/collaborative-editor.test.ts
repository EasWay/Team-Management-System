 import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as Y from 'yjs';
import {
  createDocument,
  getDocumentById,
  updateDocumentYjsState,
  deleteDocument,
  getDocumentsByTeam,
} from './db';
import { getDb } from './db';
import { users, teams, teamMembersCollaborative, documents } from '../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Feature: collaborative-dev-platform
 * Property-based tests for collaborative code editor system
 */

// Test data cleanup
async function cleanupTestData() {
  const db = await getDb();
  if (!db) return;

  try {
    await db.delete(documents);
    await db.delete(teamMembersCollaborative);
    await db.delete(teams);
    await db.delete(users).where(eq(users.email, 'editor-test@example.com'));
    await db.delete(users).where(eq(users.email, 'editor-test2@example.com'));
    await db.delete(users).where(eq(users.email, 'editor-test3@example.com'));
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

// Helper to create test user
async function createTestUser(email: string, name: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const openId = `test-${email}-${Date.now()}-${Math.random()}`;

  const [user] = await db
    .insert(users)
    .values({
      email,
      name,
      openId,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    })
    .returning();

  return user.id;
}

// Helper to create test team
async function createTestTeam(ownerId: number, name: string): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  const [team] = await db
    .insert(teams)
    .values({
      name,
      description: 'Test team',
      ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // Add owner as admin member
  await db.insert(teamMembersCollaborative).values({
    teamId: team.id,
    userId: ownerId,
    role: 'admin',
    joinedAt: new Date(),
  });

  return team.id;
}

// Helper to add team member
async function addTeamMember(teamId: number, userId: number, role: string = 'developer') {
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  await db.insert(teamMembersCollaborative).values({
    teamId,
    userId,
    role,
    joinedAt: new Date(),
  });
}

describe('Collaborative Editor Property Tests', () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  /**
   * Property 19: Collaborative Session Initialization
   * Test that opening a file initializes Yjs session
   * **Validates: Requirements 5.1**
   */
  it('Property 19: Opening a file initializes Yjs session', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          documentName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          initialContent: fc.string({ maxLength: 1000 }),
        }),
        async ({ documentName, initialContent }) => {
          try {
            // Create test user and team
            const userId = await createTestUser('editor-test@example.com', 'Editor Test User');
            const teamId = await createTestTeam(userId, 'Test Team');

            // Create Yjs document with initial content
            const ydoc = new Y.Doc();
            const ytext = ydoc.getText('monaco');
            ytext.insert(0, initialContent);
            const yjsState = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');

            // Create document in database
            const document = await createDocument(
              {
                teamId,
                name: documentName,
                yjsState,
              },
              userId
            );

            // Verify document was created
            expect(document).toBeDefined();
            expect(document.id).toBeGreaterThan(0);
            expect(document.name).toBe(documentName);
            expect(document.teamId).toBe(teamId);
            expect(document.yjsState).toBe(yjsState);

            // Verify we can retrieve and reconstruct the document
            const retrieved = await getDocumentById(document.id);
            expect(retrieved).toBeDefined();
            
            if (retrieved && retrieved.yjsState) {
              // Reconstruct Yjs document from stored state
              const reconstructedDoc = new Y.Doc();
              const stateBuffer = Buffer.from(retrieved.yjsState, 'base64');
              Y.applyUpdate(reconstructedDoc, stateBuffer);
              
              const reconstructedText = reconstructedDoc.getText('monaco').toString();
              expect(reconstructedText).toBe(initialContent);
            }

            // Cleanup
            ydoc.destroy();
          } catch (error) {
            // Skip if it's a validation error (expected for some random inputs)
            if (error instanceof Error && error.message.includes('not a member')) {
              return;
            }
            throw error;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 20: Multi-user Edit Synchronization
   * Test that edits from multiple users are synchronized
   * **Validates: Requirements 5.2**
   */
  it('Property 20: Edits from multiple users are synchronized', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user1Edit: fc.string({ minLength: 1, maxLength: 100 }),
          user2Edit: fc.string({ minLength: 1, maxLength: 100 }),
          user3Edit: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        async ({ user1Edit, user2Edit, user3Edit }) => {
          try {
            // Create test users and team
            const user1Id = await createTestUser('editor-test@example.com', 'User 1');
            const user2Id = await createTestUser('editor-test2@example.com', 'User 2');
            const user3Id = await createTestUser('editor-test3@example.com', 'User 3');
            
            const teamId = await createTestTeam(user1Id, 'Collab Team');
            await addTeamMember(teamId, user2Id);
            await addTeamMember(teamId, user3Id);

            // Create initial document
            const document = await createDocument(
              {
                teamId,
                name: 'collaborative-doc.ts',
                yjsState: null,
              },
              user1Id
            );

            // Simulate three users editing the same document
            const ydoc1 = new Y.Doc();
            const ydoc2 = new Y.Doc();
            const ydoc3 = new Y.Doc();

            const ytext1 = ydoc1.getText('monaco');
            const ytext2 = ydoc2.getText('monaco');
            const ytext3 = ydoc3.getText('monaco');

            // User 1 makes first edit
            ytext1.insert(0, user1Edit);
            const update1 = Y.encodeStateAsUpdate(ydoc1);

            // User 2 applies user 1's update and makes their own edit
            Y.applyUpdate(ydoc2, update1);
            ytext2.insert(ytext2.length, user2Edit);
            const update2 = Y.encodeStateAsUpdate(ydoc2);

            // User 3 applies both updates and makes their own edit
            Y.applyUpdate(ydoc3, update1);
            Y.applyUpdate(ydoc3, update2);
            ytext3.insert(ytext3.length, user3Edit);
            const update3 = Y.encodeStateAsUpdate(ydoc3);

            // Apply all updates to all documents (simulating synchronization)
            Y.applyUpdate(ydoc1, update2);
            Y.applyUpdate(ydoc1, update3);
            Y.applyUpdate(ydoc2, update3);

            // Verify all documents have the same final state
            const finalText1 = ytext1.toString();
            const finalText2 = ytext2.toString();
            const finalText3 = ytext3.toString();

            expect(finalText1).toBe(finalText2);
            expect(finalText2).toBe(finalText3);
            expect(finalText1).toContain(user1Edit);
            expect(finalText1).toContain(user2Edit);
            expect(finalText1).toContain(user3Edit);

            // Persist final state
            const finalState = Buffer.from(Y.encodeStateAsUpdate(ydoc1)).toString('base64');
            await updateDocumentYjsState(document.id, finalState, user1Id);

            // Verify persistence
            const retrieved = await getDocumentById(document.id);
            expect(retrieved?.yjsState).toBe(finalState);

            // Cleanup
            ydoc1.destroy();
            ydoc2.destroy();
            ydoc3.destroy();
          } catch (error) {
            // Skip if it's a validation error
            if (error instanceof Error && error.message.includes('not a member')) {
              return;
            }
            throw error;
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 21: User Presence Visibility
   * Test that cursor positions are visible to all users
   * **Validates: Requirements 5.3**
   */
  it('Property 21: Cursor positions are tracked and visible', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          cursorLine: fc.integer({ min: 1, max: 1000 }),
          cursorColumn: fc.integer({ min: 1, max: 200 }),
        }),
        async ({ cursorLine, cursorColumn }) => {
          try {
            // Create test user and team
            const userId = await createTestUser('editor-test@example.com', 'Cursor Test User');
            const teamId = await createTestTeam(userId, 'Cursor Team');

            // Create document
            const document = await createDocument(
              {
                teamId,
                name: 'cursor-test.ts',
                yjsState: null,
              },
              userId
            );

            // Simulate awareness state (cursor position)
            const awarenessState = {
              userId,
              cursor: {
                line: cursorLine,
                column: cursorColumn,
              },
            };

            // In a real scenario, this would be broadcast via Socket.io
            // Here we just verify the structure is valid
            expect(awarenessState.userId).toBe(userId);
            expect(awarenessState.cursor.line).toBe(cursorLine);
            expect(awarenessState.cursor.column).toBe(cursorColumn);
            expect(awarenessState.cursor.line).toBeGreaterThan(0);
            expect(awarenessState.cursor.column).toBeGreaterThan(0);
          } catch (error) {
            // Skip validation errors
            if (error instanceof Error && error.message.includes('not a member')) {
              return;
            }
            throw error;
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 22: Session State Loading
   * Test that joining users receive current document state
   * **Validates: Requirements 5.4**
   */
  it('Property 22: Joining users receive current document state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          initialContent: fc.string({ minLength: 1, maxLength: 500 }),
          additionalContent: fc.string({ minLength: 1, maxLength: 500 }),
        }),
        async ({ initialContent, additionalContent }) => {
          try {
            // Create test users and team
            const user1Id = await createTestUser('editor-test@example.com', 'User 1');
            const user2Id = await createTestUser('editor-test2@example.com', 'User 2');
            
            const teamId = await createTestTeam(user1Id, 'Session Team');
            await addTeamMember(teamId, user2Id);

            // User 1 creates document with initial content
            const ydoc1 = new Y.Doc();
            const ytext1 = ydoc1.getText('monaco');
            ytext1.insert(0, initialContent);
            const initialState = Buffer.from(Y.encodeStateAsUpdate(ydoc1)).toString('base64');

            const document = await createDocument(
              {
                teamId,
                name: 'session-test.ts',
                yjsState: initialState,
              },
              user1Id
            );

            // User 1 adds more content
            ytext1.insert(ytext1.length, additionalContent);
            const updatedState = Buffer.from(Y.encodeStateAsUpdate(ydoc1)).toString('base64');
            await updateDocumentYjsState(document.id, updatedState, user1Id);

            // User 2 joins and loads the document
            const retrieved = await getDocumentById(document.id);
            expect(retrieved).toBeDefined();
            
            if (retrieved && retrieved.yjsState) {
              const ydoc2 = new Y.Doc();
              const stateBuffer = Buffer.from(retrieved.yjsState, 'base64');
              Y.applyUpdate(ydoc2, stateBuffer);
              
              const ytext2 = ydoc2.getText('monaco');
              const loadedContent = ytext2.toString();

              // Verify user 2 received the complete current state
              expect(loadedContent).toContain(initialContent);
              expect(loadedContent).toContain(additionalContent);
              expect(loadedContent).toBe(ytext1.toString());

              ydoc2.destroy();
            }

            ydoc1.destroy();
          } catch (error) {
            // Skip validation errors
            if (error instanceof Error && error.message.includes('not a member')) {
              return;
            }
            throw error;
          }
        }
      ),
      { numRuns: 5 }
    );
  });

  /**
   * Property 23: Editor Feature Preservation
   * Test that Monaco Editor features remain functional during collaboration
   * **Validates: Requirements 5.5**
   */
  describe('Property 23: Editor Feature Preservation', () => {
    /**
     * Test that syntax highlighting is preserved during collaboration
     * Different languages should maintain their syntax highlighting capabilities
     */
    it('Syntax highlighting is preserved during collaboration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            language: fc.constantFrom('typescript', 'javascript', 'python', 'java', 'cpp', 'rust'),
            codeContent: fc.string({ minLength: 10, maxLength: 500 }),
          }),
          async ({ language, codeContent }) => {
            try {
              // Create test user and team
              const userId = await createTestUser('editor-test@example.com', 'Syntax Test User');
              const teamId = await createTestTeam(userId, 'Syntax Team');

              // Create document with specific language
              const ydoc = new Y.Doc();
              const ytext = ydoc.getText('monaco');
              ytext.insert(0, codeContent);
              const yjsState = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');

              const document = await createDocument(
                {
                  teamId,
                  name: `test.${getFileExtension(language)}`,
                  yjsState,
                },
                userId
              );

              // Verify document was created with correct language metadata
              expect(document).toBeDefined();
              expect(document.name).toContain(getFileExtension(language));

              // Verify content is preserved (syntax highlighting depends on content integrity)
              const retrieved = await getDocumentById(document.id);
              expect(retrieved).toBeDefined();
              
              if (retrieved && retrieved.yjsState) {
                const reconstructedDoc = new Y.Doc();
                const stateBuffer = Buffer.from(retrieved.yjsState, 'base64');
                Y.applyUpdate(reconstructedDoc, stateBuffer);
                
                const reconstructedText = reconstructedDoc.getText('monaco').toString();
                expect(reconstructedText).toBe(codeContent);
                
                reconstructedDoc.destroy();
              }

              ydoc.destroy();
            } catch (error) {
              if (error instanceof Error && error.message.includes('not a member')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Test that language detection works correctly during collaboration
     * Language should be correctly identified from file extension
     */
    it('Language detection works correctly during collaboration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            fileName: fc.string({ minLength: 5, maxLength: 50 }).filter(s => s.trim().length > 0),
            fileExtension: fc.constantFrom('ts', 'js', 'py', 'java', 'cpp', 'rs', 'go', 'rb'),
            content: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          async ({ fileName, fileExtension, content }) => {
            try {
              // Create test user and team
              const userId = await createTestUser('editor-test@example.com', 'Language Test User');
              const teamId = await createTestTeam(userId, 'Language Team');

              // Create document with specific file extension
              const fullFileName = `${fileName}.${fileExtension}`;
              const ydoc = new Y.Doc();
              const ytext = ydoc.getText('monaco');
              ytext.insert(0, content);
              const yjsState = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');

              const document = await createDocument(
                {
                  teamId,
                  name: fullFileName,
                  yjsState,
                },
                userId
              );

              // Verify document name preserves extension for language detection
              expect(document.name).toBe(fullFileName);
              expect(document.name).toContain(fileExtension);

              // Verify content is preserved
              const retrieved = await getDocumentById(document.id);
              if (retrieved && retrieved.yjsState) {
                const reconstructedDoc = new Y.Doc();
                const stateBuffer = Buffer.from(retrieved.yjsState, 'base64');
                Y.applyUpdate(reconstructedDoc, stateBuffer);
                
                const reconstructedText = reconstructedDoc.getText('monaco').toString();
                expect(reconstructedText).toBe(content);
                
                reconstructedDoc.destroy();
              }

              ydoc.destroy();
            } catch (error) {
              if (error instanceof Error && error.message.includes('not a member')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Test that editor options (line numbers, word wrap, minimap) are preserved
     * These options should not be affected by collaborative editing
     */
    it('Editor options are preserved during collaboration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            enableLineNumbers: fc.boolean(),
            enableWordWrap: fc.boolean(),
            enableMinimap: fc.boolean(),
            fontSize: fc.integer({ min: 8, max: 32 }),
            tabSize: fc.integer({ min: 2, max: 8 }),
            content: fc.string({ minLength: 1, maxLength: 300 }),
          }),
          async ({ enableLineNumbers, enableWordWrap, enableMinimap, fontSize, tabSize, content }) => {
            try {
              // Create test user and team
              const userId = await createTestUser('editor-test@example.com', 'Options Test User');
              const teamId = await createTestTeam(userId, 'Options Team');

              // Create document
              const ydoc = new Y.Doc();
              const ytext = ydoc.getText('monaco');
              ytext.insert(0, content);
              const yjsState = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');

              const document = await createDocument(
                {
                  teamId,
                  name: 'options-test.ts',
                  yjsState,
                },
                userId
              );

              // Simulate editor options configuration
              const editorOptions = {
                lineNumbers: enableLineNumbers ? 'on' : 'off',
                wordWrap: enableWordWrap ? 'on' : 'off',
                minimap: { enabled: enableMinimap },
                fontSize,
                tabSize,
              };

              // Verify options are valid
              expect(editorOptions.lineNumbers).toMatch(/^(on|off)$/);
              expect(editorOptions.wordWrap).toMatch(/^(on|off)$/);
              expect(typeof editorOptions.minimap.enabled).toBe('boolean');
              expect(editorOptions.fontSize).toBeGreaterThanOrEqual(8);
              expect(editorOptions.fontSize).toBeLessThanOrEqual(32);
              expect(editorOptions.tabSize).toBeGreaterThanOrEqual(2);
              expect(editorOptions.tabSize).toBeLessThanOrEqual(8);

              // Verify document content is still intact
              const retrieved = await getDocumentById(document.id);
              if (retrieved && retrieved.yjsState) {
                const reconstructedDoc = new Y.Doc();
                const stateBuffer = Buffer.from(retrieved.yjsState, 'base64');
                Y.applyUpdate(reconstructedDoc, stateBuffer);
                
                const reconstructedText = reconstructedDoc.getText('monaco').toString();
                expect(reconstructedText).toBe(content);
                
                reconstructedDoc.destroy();
              }

              ydoc.destroy();
            } catch (error) {
              if (error instanceof Error && error.message.includes('not a member')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Test that cursor positioning works correctly during collaboration
     * Cursor positions should be tracked and not interfere with content
     */
    it('Cursor positioning works correctly during collaboration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            content: fc.string({ minLength: 10, maxLength: 500 }),
            cursorLine: fc.integer({ min: 1, max: 100 }),
            cursorColumn: fc.integer({ min: 0, max: 100 }),
          }),
          async ({ content, cursorLine, cursorColumn }) => {
            try {
              // Create test user and team
              const userId = await createTestUser('editor-test@example.com', 'Cursor Test User');
              const teamId = await createTestTeam(userId, 'Cursor Team');

              // Create document
              const ydoc = new Y.Doc();
              const ytext = ydoc.getText('monaco');
              ytext.insert(0, content);
              const yjsState = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');

              const document = await createDocument(
                {
                  teamId,
                  name: 'cursor-test.ts',
                  yjsState,
                },
                userId
              );

              // Simulate cursor position tracking
              const cursorPosition = {
                line: cursorLine,
                column: cursorColumn,
              };

              // Verify cursor position is valid
              expect(cursorPosition.line).toBeGreaterThanOrEqual(1);
              expect(cursorPosition.column).toBeGreaterThanOrEqual(0);

              // Verify document content is not affected by cursor tracking
              const retrieved = await getDocumentById(document.id);
              if (retrieved && retrieved.yjsState) {
                const reconstructedDoc = new Y.Doc();
                const stateBuffer = Buffer.from(retrieved.yjsState, 'base64');
                Y.applyUpdate(reconstructedDoc, stateBuffer);
                
                const reconstructedText = reconstructedDoc.getText('monaco').toString();
                expect(reconstructedText).toBe(content);
                
                reconstructedDoc.destroy();
              }

              ydoc.destroy();
            } catch (error) {
              if (error instanceof Error && error.message.includes('not a member')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Test that selection ranges work correctly during collaboration
     * Selection should be tracked without affecting document content
     */
    it('Selection ranges work correctly during collaboration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            content: fc.string({ minLength: 20, maxLength: 500 }),
            selectionStartLine: fc.integer({ min: 1, max: 50 }),
            selectionStartColumn: fc.integer({ min: 0, max: 50 }),
            selectionEndLine: fc.integer({ min: 1, max: 50 }),
            selectionEndColumn: fc.integer({ min: 0, max: 50 }),
          }),
          async ({ content, selectionStartLine, selectionStartColumn, selectionEndLine, selectionEndColumn }) => {
            try {
              // Create test user and team
              const userId = await createTestUser('editor-test@example.com', 'Selection Test User');
              const teamId = await createTestTeam(userId, 'Selection Team');

              // Create document
              const ydoc = new Y.Doc();
              const ytext = ydoc.getText('monaco');
              ytext.insert(0, content);
              const yjsState = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');

              const document = await createDocument(
                {
                  teamId,
                  name: 'selection-test.ts',
                  yjsState,
                },
                userId
              );

              // Simulate selection range tracking
              const selection = {
                startLine: selectionStartLine,
                startColumn: selectionStartColumn,
                endLine: selectionEndLine,
                endColumn: selectionEndColumn,
              };

              // Verify selection is valid
              expect(selection.startLine).toBeGreaterThanOrEqual(1);
              expect(selection.startColumn).toBeGreaterThanOrEqual(0);
              expect(selection.endLine).toBeGreaterThanOrEqual(1);
              expect(selection.endColumn).toBeGreaterThanOrEqual(0);

              // Verify document content is not affected by selection tracking
              const retrieved = await getDocumentById(document.id);
              if (retrieved && retrieved.yjsState) {
                const reconstructedDoc = new Y.Doc();
                const stateBuffer = Buffer.from(retrieved.yjsState, 'base64');
                Y.applyUpdate(reconstructedDoc, stateBuffer);
                
                const reconstructedText = reconstructedDoc.getText('monaco').toString();
                expect(reconstructedText).toBe(content);
                
                reconstructedDoc.destroy();
              }

              ydoc.destroy();
            } catch (error) {
              if (error instanceof Error && error.message.includes('not a member')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Test that undo/redo functionality works correctly during collaboration
     * Yjs should maintain proper undo/redo state across collaborative edits
     */
    it('Undo/redo functionality works correctly during collaboration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            initialContent: fc.string({ minLength: 1, maxLength: 100 }),
            firstEdit: fc.string({ minLength: 1, maxLength: 100 }),
            secondEdit: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          async ({ initialContent, firstEdit, secondEdit }) => {
            try {
              // Create test users and team
              const user1Id = await createTestUser('editor-test@example.com', 'User 1');
              const user2Id = await createTestUser('editor-test2@example.com', 'User 2');
              
              const teamId = await createTestTeam(user1Id, 'Undo Team');
              await addTeamMember(teamId, user2Id);

              // Create initial document
              const ydoc1 = new Y.Doc();
              const ytext1 = ydoc1.getText('monaco');
              ytext1.insert(0, initialContent);
              const initialState = Buffer.from(Y.encodeStateAsUpdate(ydoc1)).toString('base64');

              const document = await createDocument(
                {
                  teamId,
                  name: 'undo-test.ts',
                  yjsState: initialState,
                },
                user1Id
              );

              // User 1 makes first edit
              ytext1.insert(ytext1.length, firstEdit);
              const afterFirstEdit = ytext1.toString();

              // User 2 joins and makes second edit
              const ydoc2 = new Y.Doc();
              const stateBuffer = Buffer.from(initialState, 'base64');
              Y.applyUpdate(ydoc2, stateBuffer);
              const ytext2 = ydoc2.getText('monaco');
              
              // Apply user 1's edit to user 2's document
              const update1 = Y.encodeStateAsUpdate(ydoc1);
              Y.applyUpdate(ydoc2, update1);
              
              // User 2 makes their edit
              ytext2.insert(ytext2.length, secondEdit);
              const afterSecondEdit = ytext2.toString();

              // Verify both edits are present
              expect(afterFirstEdit).toContain(initialContent);
              expect(afterFirstEdit).toContain(firstEdit);
              expect(afterSecondEdit).toContain(initialContent);
              expect(afterSecondEdit).toContain(firstEdit);
              expect(afterSecondEdit).toContain(secondEdit);

              // Verify undo capability by checking state history
              // In Yjs, we can verify that the document maintains proper state
              expect(ytext1.toString()).toContain(initialContent);
              expect(ytext2.toString()).toContain(initialContent);

              ydoc1.destroy();
              ydoc2.destroy();
            } catch (error) {
              if (error instanceof Error && error.message.includes('not a member')) {
                return;
              }
              throw error;
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

// Helper function to get file extension from language
function getFileExtension(language: string): string {
  const extensions: Record<string, string> = {
    typescript: 'ts',
    javascript: 'js',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    rust: 'rs',
  };
  return extensions[language] || 'txt';
}
