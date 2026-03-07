# Team Manager - Complete System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Features](#core-features)
4. [Technical Stack](#technical-stack)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Authentication & Authorization](#authentication--authorization)
8. [Real-Time Features](#real-time-features)
9. [GitHub Integration](#github-integration)
10. [Deployment & Configuration](#deployment--configuration)

---

## System Overview

Team Manager is a comprehensive collaborative project management platform designed for software development teams. It provides real-time task management, team collaboration, GitHub integration, and document editing capabilities.

### Key Capabilities
- **Multi-team Management**: Create and manage multiple development teams with role-based access control
- **Real-time Task Tracking**: Kanban-style boards with live updates across all team members
- **GitHub Integration**: Connect repositories, track PRs, commits, and issues
- **Collaborative Editing**: Real-time document collaboration with live cursors (Yjs-powered)
- **OAuth Authentication**: Secure login via GitHub OAuth or email/password
- **Audit Logging**: Complete activity tracking for compliance and debugging
- **Team Invitations**: Email-based invitation system with role assignment

---

## Architecture

### Technology Stack

#### Frontend
- **Framework**: React 19.2.1 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack Query (React Query) v5
- **UI Components**: Radix UI primitives with custom styling
- **Styling**: Tailwind CSS v4 with custom animations
- **Forms**: React Hook Form with Zod validation
- **Drag & Drop**: @dnd-kit for Kanban board interactions
- **Real-time**: Socket.io-client for WebSocket connections
- **Code Editor**: Monaco Editor (VS Code editor)

#### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **API Layer**: tRPC v11 (type-safe RPC)
- **Database ORM**: Drizzle ORM v0.44
- **Database**: PostgreSQL (configurable to SQLite)
- **Real-time**: Socket.io v4.8
- **Authentication**: JWT (Jose library)
- **Password Hashing**: bcrypt
- **File Upload**: express-fileupload

#### Real-Time Collaboration
- **Document Sync**: Yjs (CRDT-based)
- **WebSocket Provider**: y-websocket
- **Conflict Resolution**: Automatic via Yjs CRDT

#### External Integrations
- **GitHub API**: @octokit/rest for repository management
- **GitHub Webhooks**: @octokit/webhooks for event handling
- **OAuth Providers**: GitHub OAuth 2.0

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   React UI   │  │  Socket.io   │  │  Monaco      │      │
│  │   (tRPC)     │  │   Client     │  │  Editor      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          │ HTTP/tRPC        │ WebSocket        │ Yjs Sync
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼─────────────┐
│                    Express Server                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  tRPC Router │  │  Socket.io   │  │  Yjs WebSocket│     │
│  │              │  │   Server     │  │   Provider    │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                    ┌───────▼────────┐                        │
│                    │  Drizzle ORM   │                        │
│                    └───────┬────────┘                        │
└────────────────────────────┼──────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │    Database     │
                    └─────────────────┘
                             
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  GitHub API  │  │  GitHub OAuth│                         │
│  │  (Octokit)   │  │              │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Team Management

#### Team Creation & Organization
- **Create Teams**: Users can create multiple teams with names and descriptions
- **Automatic Admin Role**: Team creator automatically becomes admin
- **Member Count Tracking**: Real-time member count for each team
- **Team Settings**: Update team information, manage members

#### Role-Based Access Control (RBAC)
Four distinct roles with hierarchical permissions:

| Role | Permissions |
|------|-------------|
| **Admin** | Full control: create/delete team, manage members, change roles, manage tasks, repositories, documents |
| **Team Lead** | Update team, invite members, manage tasks, repositories, documents |
| **Developer** | Create and update tasks |
| **Viewer** | Read-only access |

#### Team Invitation System
- **Email-based Invitations**: Send invitations via email
- **Secure Tokens**: Unique, time-limited invitation tokens (7-day expiration)
- **Role Assignment**: Specify role during invitation
- **Invitation Management**: View pending invitations, accept/reject
- **Duplicate Prevention**: Prevents inviting existing members

### 2. Task Management

#### Kanban Board System
- **Four Columns**: To Do, In Progress, Review, Done
- **Drag & Drop**: Intuitive task movement between columns
- **Real-time Sync**: All team members see updates instantly
- **Optimistic Updates**: Immediate UI feedback with rollback on failure
- **Conflict Detection**: Warns when multiple users edit same task

#### Task Features
- **Rich Task Data**:
  - Title and description
  - Priority levels: Low, Medium, High, Urgent
  - Status tracking: todo, in_progress, review, done
  - Due dates
  - Assignee selection
  - GitHub PR linking
- **Task Filtering**: Filter by status, assignee, priority
- **Task Search**: Search by title and description
- **Task History**: Complete audit trail of all changes
- **Task Details Modal**: View and edit all task information

#### Real-Time Collaboration
- **Live Updates**: Tasks appear/update/move in real-time
- **User Presence**: See who's viewing the board
- **Conflict Resolution**: Automatic conflict detection and warnings
- **Optimistic UI**: Instant feedback with server confirmation

### 3. Document Collaboration

#### Real-Time Code Editor
- **Monaco Editor**: Full VS Code editing experience
- **Syntax Highlighting**: Support for multiple languages
- **Live Collaboration**: Multiple users editing simultaneously
- **Live Cursors**: See other users' cursor positions and selections
- **Automatic Sync**: Changes sync instantly via Yjs CRDT
- **Conflict-Free**: CRDT ensures no merge conflicts

#### Document Management
- **Create Documents**: Markdown, code, or plain text
- **Document Library**: Browse all team documents
- **Access Control**: Team-based permissions
- **Version History**: Track all changes
- **Active Users**: See who's currently editing

### 4. GitHub Integration

#### Repository Connection
- **OAuth-based**: Secure GitHub authentication
- **Repository Linking**: Connect GitHub repos to teams
- **Automatic Sync**: Fetch commits, PRs, issues, branches
- **Webhook Support**: Real-time updates from GitHub

#### GitHub Features
- **Pull Request Tracking**: View and link PRs to tasks
- **Commit History**: Browse repository commits
- **Issue Tracking**: View GitHub issues
- **Branch Management**: See all branches
- **PR-Task Linking**: Connect tasks to specific PRs

#### GitHub Service API
```typescript
// Available GitHub operations
- getRepository(owner, repo, token)
- getCommits(owner, repo, token, branch?)
- getPullRequests(owner, repo, token, state?)
- getIssues(owner, repo, token, state?)
- getBranches(owner, repo, token)
- createWebhook(owner, repo, token, webhookUrl)
```

### 5. Authentication & Security

#### Authentication Methods
1. **GitHub OAuth**:
   - One-click GitHub login
   - Automatic account creation
   - OAuth token storage (encrypted)
   - Token refresh handling

2. **Email/Password**:
   - Secure registration with validation
   - bcrypt password hashing
   - Email format validation
   - Password strength requirements

#### Security Features
- **JWT Tokens**: 
  - Access tokens (7-day expiration)
  - Refresh tokens (30-day expiration)
  - Secure token generation (Jose library)
- **Password Security**:
  - bcrypt hashing (10 rounds)
  - No plaintext storage
  - Secure password validation
- **OAuth Token Encryption**: Encrypted storage of OAuth tokens
- **CSRF Protection**: Token-based authentication
- **Session Management**: Automatic token refresh

### 6. Activity & Audit Logging

#### Audit System
- **Complete Tracking**: All CRUD operations logged
- **User Attribution**: Track who made each change
- **IP & User Agent**: Record request metadata
- **Timestamp Precision**: Exact time of each operation
- **Entity Tracking**: Link logs to specific entities

#### Logged Operations
- Team creation/updates/deletion
- Member additions/removals/role changes
- Task creation/updates/moves/deletion
- Document creation/updates/deletion
- Repository connections/syncs
- Invitation sends/accepts/rejects

---

## Database Schema

### Core Tables

#### users
Primary authentication table
```sql
- id: serial PRIMARY KEY
- openId: text UNIQUE (for OAuth)
- email: text UNIQUE
- passwordHash: text (for email/password auth)
- name: text
- loginMethod: text (email|github)
- role: text (user|admin)
- lastSignedIn: timestamp
- createdAt: timestamp
- updatedAt: timestamp
```

#### teams
Team organization
```sql
- id: serial PRIMARY KEY
- name: text NOT NULL
- description: text
- createdBy: integer REFERENCES teamMembers(id)
- createdAt: timestamp
- updatedAt: timestamp
```

#### teamMembers
User profiles within teams
```sql
- id: serial PRIMARY KEY
- name: text NOT NULL
- email: text
- phone: text
- position: text
- createdAt: timestamp
- updatedAt: timestamp
```

#### teamMembersCollaborative
Team membership with roles
```sql
- id: serial PRIMARY KEY
- teamId: integer REFERENCES teams(id) CASCADE
- memberId: integer REFERENCES teamMembers(id) CASCADE
- role: text (admin|team_lead|developer|viewer)
- joinedAt: timestamp
```

#### teamInvitations
Invitation management
```sql
- id: serial PRIMARY KEY
- teamId: integer REFERENCES teams(id) CASCADE
- email: text NOT NULL
- invitedBy: integer REFERENCES teamMembers(id)
- token: text UNIQUE NOT NULL
- status: text (pending|accepted|expired)
- expiresAt: timestamp NOT NULL
- createdAt: timestamp
```

#### tasks
Task tracking
```sql
- id: serial PRIMARY KEY
- title: text NOT NULL
- description: text
- status: text (todo|in_progress|review|done)
- priority: text (low|medium|high|urgent)
- assignedTo: integer REFERENCES teamMembers(id)
- teamId: integer REFERENCES teams(id) CASCADE
- createdBy: integer REFERENCES teamMembers(id)
- dueDate: timestamp
- githubPrUrl: text
- position: integer
- createdAt: timestamp
- updatedAt: timestamp
```

#### documents
Collaborative documents
```sql
- id: serial PRIMARY KEY
- title: text NOT NULL
- content: text
- type: text (markdown|text)
- teamId: integer REFERENCES teams(id) CASCADE
- createdBy: integer REFERENCES teamMembers(id)
- lastEditedBy: integer REFERENCES teamMembers(id)
- isPublic: boolean
- createdAt: timestamp
- updatedAt: timestamp
```

#### repositories
GitHub repository connections
```sql
- id: serial PRIMARY KEY
- name: text NOT NULL
- url: text NOT NULL
- description: text
- teamId: integer REFERENCES teams(id) CASCADE
- githubId: text UNIQUE
- isPrivate: boolean
- defaultBranch: text
- createdBy: integer REFERENCES teamMembers(id)
- createdAt: timestamp
- updatedAt: timestamp
```

#### oauthTokens
OAuth token storage (encrypted)
```sql
- id: serial PRIMARY KEY
- userId: integer REFERENCES users(id) CASCADE
- provider: text (github|google)
- accessToken: text NOT NULL (encrypted)
- refreshToken: text (encrypted)
- expiresAt: timestamp
- createdAt: timestamp
- updatedAt: timestamp
- UNIQUE(userId, provider)
```

#### activities
Activity feed
```sql
- id: serial PRIMARY KEY
- type: text NOT NULL
- description: text NOT NULL
- entityType: text (task|document|team)
- entityId: integer
- userId: integer REFERENCES teamMembers(id)
- teamId: integer REFERENCES teams(id)
- metadata: jsonb
- createdAt: timestamp
```

#### auditLogs
Comprehensive audit trail
```sql
- id: serial PRIMARY KEY
- operation: text NOT NULL (CREATE|UPDATE|DELETE)
- entityType: text NOT NULL
- entityId: integer NOT NULL
- userId: integer REFERENCES teamMembers(id)
- details: text (JSON string)
- timestamp: timestamp
- ipAddress: text
- userAgent: text
```

---

## API Endpoints

### tRPC Router Structure

All API endpoints are type-safe tRPC procedures:

#### Authentication Router (`auth`)
```typescript
auth.me                    // GET current user
auth.register              // POST register new user
auth.login                 // POST login with email/password
auth.logout                // POST logout
auth.refreshToken          // POST refresh access token
```

#### Team Members Router (`team`)
```typescript
team.list                  // GET all team members
team.getById              // GET team member by ID
team.create               // POST create team member
team.update               // PUT update team member
team.delete               // DELETE team member
```

#### Teams Router (`teams`)
```typescript
teams.create              // POST create team
teams.list                // GET user's teams
teams.getById             // GET team by ID
teams.update              // PUT update team
teams.delete              // DELETE team
teams.getMembers          // GET team members with roles
teams.createInvitation    // POST create invitation
teams.getInvitations      // GET pending invitations
teams.acceptInvitation    // POST accept invitation
teams.rejectInvitation    // POST reject invitation
teams.changeMemberRole    // PUT change member role
teams.removeMember        // DELETE remove member
teams.checkPermission     // GET check user permission
```

#### Tasks Router (`tasks`)
```typescript
tasks.create              // POST create task
tasks.list                // GET tasks (with filters)
tasks.getById             // GET task by ID
tasks.update              // PUT update task
tasks.delete              // DELETE task
tasks.move                // PUT move task to new status
tasks.getHistory          // GET task change history
```

#### Documents Router (`documents`)
```typescript
documents.create          // POST create document
documents.list            // GET team documents
documents.getById         // GET document by ID
documents.update          // PUT update document
documents.delete          // DELETE document
documents.getActiveUsers  // GET users editing document
```

#### Repositories Router (`repositories`)
```typescript
repositories.connect      // POST connect GitHub repo
repositories.list         // GET team repositories
repositories.getById      // GET repository by ID
repositories.getData      // GET repo data (commits, PRs, issues)
repositories.sync         // POST manual sync
repositories.linkToPR     // POST link task to PR
repositories.delete       // DELETE repository connection
```

### OAuth Endpoints (Express Routes)
```
GET  /api/oauth/github/login          // Initiate GitHub OAuth
GET  /api/oauth/github/callback       // GitHub OAuth callback
POST /api/oauth/github/refresh        // Refresh GitHub token
```

### WebSocket Events (Socket.io)

#### Client → Server
```typescript
'joinTeam'        // Join team room
'leaveTeam'       // Leave team room
'joinDocument'    // Join document editing session
'leaveDocument'   // Leave document editing session
```

#### Server → Client
```typescript
'userJoined'      // User joined team/document
'userLeft'        // User left team/document
'taskCreated'     // New task created
'taskUpdated'     // Task updated
'taskMoved'       // Task moved to new status
'taskDeleted'     // Task deleted
'documentUpdated' // Document content changed
```

---

## Authentication & Authorization

### Authentication Flow

#### GitHub OAuth Flow
```
1. User clicks "Sign in with GitHub"
2. Redirect to GitHub OAuth page
3. User authorizes application
4. GitHub redirects to callback with code
5. Server exchanges code for access token
6. Server fetches user info from GitHub
7. Server creates/updates user in database
8. Server generates JWT tokens
9. Client stores tokens in localStorage
10. Client includes token in all requests
```

#### Email/Password Flow
```
1. User submits registration form
2. Server validates email and password
3. Server hashes password with bcrypt
4. Server creates user in database
5. Server generates JWT tokens
6. Client stores tokens
7. For login: verify password hash
8. Generate new tokens on successful login
```

### Authorization System

#### Permission Checking
```typescript
// Check if user has permission for action
const hasPermission = await checkTeamPermission(
  teamId,
  userId,
  'create_task'
);

// Permission matrix
TEAM_PERMISSIONS = {
  admin: [
    'create_team', 'delete_team', 'update_team',
    'invite_member', 'remove_member', 'change_role',
    'create_task', 'update_task', 'delete_task',
    'manage_repositories', 'delete_document'
  ],
  team_lead: [
    'update_team', 'invite_member',
    'create_task', 'update_task', 'delete_task',
    'manage_repositories', 'delete_document'
  ],
  developer: ['create_task', 'update_task'],
  viewer: []
}
```

#### Protected Routes
All tRPC procedures use middleware:
- `publicProcedure`: No authentication required
- `protectedProcedure`: Requires valid JWT token

```typescript
// Middleware checks JWT token
const protectedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

---

## Real-Time Features

### Socket.io Implementation

#### Connection Management
```typescript
// Client connects with JWT token
const socket = io('http://localhost:3000', {
  auth: { token: accessToken },
  transports: ['websocket', 'polling']
});

// Server validates token on connection
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  const user = await verifyToken(token);
  if (!user) return next(new Error('Authentication failed'));
  socket.data.user = user;
  next();
});
```

#### Room-Based Broadcasting
```typescript
// User joins team room
socket.join(`team:${teamId}`);

// Broadcast to all team members
io.to(`team:${teamId}`).emit('taskCreated', task);

// Broadcast to all except sender
socket.to(`team:${teamId}`).emit('taskUpdated', task);
```

### Yjs Collaborative Editing

#### Document Synchronization
```typescript
// Server: Yjs WebSocket provider
const yjsServer = new WebSocketServer({ noServer: true });
setupWSConnection(yjsServer, conn, req, { docName });

// Client: Connect to Yjs provider
const provider = new WebsocketProvider(
  'ws://localhost:3000/yjs',
  documentId,
  ydoc
);

// Automatic CRDT synchronization
const ytext = ydoc.getText('content');
ytext.observe((event) => {
  // Handle changes
});
```

#### Conflict Resolution
- **CRDT-based**: Yjs uses Conflict-free Replicated Data Types
- **Automatic Merging**: No manual conflict resolution needed
- **Eventual Consistency**: All clients converge to same state
- **Offline Support**: Changes sync when reconnected

### Real-Time Task Updates

#### Optimistic Updates
```typescript
// 1. Immediately update UI
setOptimisticUpdates(prev => new Map(prev).set(taskId, newTask));

// 2. Send to server
await moveMutation.mutateAsync({ id: taskId, status: newStatus });

// 3. Clear optimistic update on success
setOptimisticUpdates(prev => {
  const next = new Map(prev);
  next.delete(taskId);
  return next;
});

// 4. Rollback on error
catch (error) {
  setOptimisticUpdates(prev => {
    const next = new Map(prev);
    next.delete(taskId);
    return next;
  });
  utils.tasks.list.invalidate({ teamId });
}
```

#### Conflict Detection
```typescript
// Track last update timestamp
lastUpdateTimestampRef.current.set(taskId, Date.now());

// Detect conflicts (updates within 2 seconds)
const timeSinceLastUpdate = Date.now() - lastUpdate;
if (timeSinceLastUpdate < 2000 && lastUpdate > 0) {
  setConflictingTasks(prev => new Set(prev).add(taskId));
  toast.warning('Task was updated by another user');
}
```

---

## GitHub Integration

### OAuth Setup

#### GitHub App Configuration
```env
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/oauth/github/callback
```

#### Required Scopes
- `user:email`: Read user email addresses
- `repo`: Full repository access (for private repos)
- `read:org`: Read organization membership

### GitHub Service Functions

#### Repository Operations
```typescript
// Get repository information
const repo = await GitHubService.getRepository(owner, repo, token);

// Get commits
const commits = await GitHubService.getCommits(owner, repo, token, branch);

// Get pull requests
const prs = await GitHubService.getPullRequests(owner, repo, token, 'open');

// Get issues
const issues = await GitHubService.getIssues(owner, repo, token, 'open');

// Get branches
const branches = await GitHubService.getBranches(owner, repo, token);
```

#### Webhook Setup
```typescript
// Create webhook for repository events
await GitHubService.createWebhook(
  owner,
  repo,
  token,
  'https://your-domain.com/api/webhooks/github'
);

// Webhook events:
- push: New commits
- pull_request: PR opened/closed/merged
- issues: Issue created/updated
- pull_request_review: PR reviewed
```

### Repository Synchronization

#### Manual Sync
```typescript
// Triggered by user or scheduled job
await syncRepository(repositoryId, userId);

// Fetches:
1. Latest commits
2. Open pull requests
3. Open issues
4. Branch list
5. Repository metadata
```

#### Automatic Sync
- Webhook-triggered updates
- Real-time event processing
- Incremental updates only

---

## Deployment & Configuration

### Environment Variables

#### Required Variables
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# JWT Secret (generate random string)
JWT_SECRET=your_secret_key_here

# OAuth Server
OAUTH_SERVER_URL=http://localhost:3000

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/oauth/github/callback

# Server
PORT=3000
NODE_ENV=development|production
```

#### Optional Variables
```env
# Redis (for Socket.io scaling)
REDIS_URL=redis://localhost:6379

# AWS S3 (for file uploads)
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket

# Email (for invitations)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASSWORD=your_password
```

### Database Setup

#### PostgreSQL Setup
```bash
# Install PostgreSQL
# Create database
createdb team_manager_db

# Run migrations
npm run db:push

# Verify tables created
psql team_manager_db -c "\dt"
```

#### SQLite Setup (Development)
```env
# Change DATABASE_URL
DATABASE_URL=file:./local.db

# Run migrations
npm run db:push
```

### Build & Deployment

#### Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Server runs on http://localhost:3000
# Frontend runs on http://localhost:5173
```

#### Production Build
```bash
# Build frontend and backend
npm run build

# Start production server
npm start

# Or use PM2
pm2 start dist/index.js --name team-manager
```

#### Docker Deployment
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Scaling Considerations

#### Horizontal Scaling
- Use Redis adapter for Socket.io
- Load balancer with sticky sessions
- Shared PostgreSQL database
- Centralized file storage (S3)

#### Performance Optimization
- Database indexing on foreign keys
- Query result caching
- CDN for static assets
- WebSocket connection pooling
- Lazy loading for large datasets

---

## Testing

### Test Coverage

#### Unit Tests
- Authentication service
- Password hashing/validation
- Token generation/verification
- Permission checking
- Database operations

#### Integration Tests
- Auth flow (register, login, refresh)
- Team CRUD operations
- Task management
- Real-time synchronization
- GitHub integration

#### Property-Based Tests
- Real-time sync consistency
- Concurrent task updates
- Conflict resolution
- Data integrity

### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test -- auth.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

---

## Security Best Practices

### Implemented Security Measures

1. **Authentication**
   - JWT with short expiration (7 days)
   - Refresh token rotation
   - Secure password hashing (bcrypt)
   - OAuth token encryption

2. **Authorization**
   - Role-based access control
   - Permission checking on all operations
   - Team-scoped data access

3. **Data Protection**
   - SQL injection prevention (Drizzle ORM)
   - XSS protection (React escaping)
   - CSRF protection (token-based auth)
   - Encrypted OAuth tokens

4. **API Security**
   - Rate limiting (recommended)
   - Input validation (Zod schemas)
   - Error message sanitization
   - Audit logging

5. **Network Security**
   - HTTPS in production (recommended)
   - Secure WebSocket connections
   - CORS configuration
   - Helmet.js headers (recommended)

---

## Troubleshooting

### Common Issues

#### Database Connection Failed
```
Error: ECONNREFUSED
Solution: Ensure PostgreSQL is running on correct port
Check: DATABASE_URL in .env file
```

#### OAuth Callback 404
```
Error: Cannot GET /api/oauth/github/callback
Solution: Verify GITHUB_CALLBACK_URL matches GitHub App settings
Check: OAuth routes are registered in Express
```

#### Socket.io Not Connecting
```
Error: WebSocket connection failed
Solution: Check CORS settings, verify token is valid
Check: Socket.io server is running, firewall allows WebSocket
```

#### Task Updates Not Syncing
```
Error: Tasks not updating in real-time
Solution: Verify Socket.io connection, check room joining
Check: User is authenticated, team room is joined
```

---

## Future Enhancements

### Planned Features
- [ ] Email notifications for invitations
- [ ] Slack/Discord integration
- [ ] Advanced analytics dashboard
- [ ] Time tracking per task
- [ ] Sprint planning tools
- [ ] Custom task fields
- [ ] File attachments to tasks
- [ ] Mobile app (React Native)
- [ ] API rate limiting
- [ ] Two-factor authentication
- [ ] SSO integration (SAML, OIDC)
- [ ] Advanced search with filters
- [ ] Export reports (PDF, CSV)
- [ ] Gantt chart view
- [ ] Calendar view for tasks

---

## Support & Resources

### Documentation
- [Quick Start Guide](QUICK_START.md)
- [Setup Checklist](SETUP_CHECKLIST.md)
- [PostgreSQL Migration](POSTGRESQL_MIGRATION.md)
- [OAuth Setup](GITHUB_OAUTH_SETUP.md)

### Development
- **Repository**: [GitHub Repository URL]
- **Issue Tracker**: [GitHub Issues URL]
- **API Documentation**: Auto-generated from tRPC types

### License
MIT License - See LICENSE file for details

---

**Last Updated**: March 5, 2026
**Version**: 1.0.0
**Maintainer**: Development Team
