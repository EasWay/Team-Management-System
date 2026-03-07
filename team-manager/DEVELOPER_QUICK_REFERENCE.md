# Developer Quick Reference

## Quick Commands

```bash
# Development
npm run dev              # Start dev server (frontend + backend)
npm run build            # Build for production
npm start                # Start production server
npm test                 # Run tests
npm run check            # TypeScript type checking
npm run format           # Format code with Prettier

# Database
npm run db:push          # Generate and run migrations
```

## Project Structure

```
team-manager/
├── client/              # Frontend React app
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── contexts/    # React contexts
│   │   ├── hooks/       # Custom hooks
│   │   └── lib/         # Utilities (tRPC, utils)
│   └── public/          # Static assets
├── server/              # Backend Express app
│   ├── _core/           # Core server functionality
│   ├── routers.ts       # tRPC API routes
│   ├── db.ts            # Database operations
│   ├── oauth-*.ts       # OAuth implementation
│   ├── github-*.ts      # GitHub integration
│   └── socket-server.ts # Socket.io server
├── shared/              # Shared types
├── drizzle/             # Database schema & migrations
└── .env                 # Environment variables
```

## Common Tasks

### Add a New API Endpoint

1. **Define in `server/routers.ts`**:
```typescript
export const appRouter = router({
  myFeature: router({
    create: protectedProcedure
      .input(z.object({ name: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // Implementation
      }),
  }),
});
```

2. **Use in Frontend**:
```typescript
const mutation = trpc.myFeature.create.useMutation();
await mutation.mutateAsync({ name: 'test' });
```

### Add a Database Table

1. **Define in `drizzle/schema.ts`**:
```typescript
export const myTable = pgTable("my_table", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

2. **Run migration**:
```bash
npm run db:push
```

3. **Add database functions in `server/db.ts`**:
```typescript
export async function createMyEntity(data: InsertMyTable) {
  const db = await getDb();
  return db.insert(myTable).values(data).returning();
}
```

### Add Real-Time Feature

1. **Server: Broadcast event in `server/socket-server.ts`**:
```typescript
export function broadcastMyEvent(teamId: number, data: any) {
  io.to(`team:${teamId}`).emit('myEvent', data);
}
```

2. **Client: Listen for event**:
```typescript
useSocketEvent('myEvent', (data) => {
  console.log('Event received:', data);
  // Update UI
});
```

### Add a New Page

1. **Create page in `client/src/pages/MyPage.tsx`**:
```typescript
import DashboardLayout from "@/components/DashboardLayout";

export default function MyPage() {
  return (
    <DashboardLayout>
      <h1>My Page</h1>
    </DashboardLayout>
  );
}
```

2. **Add route in `client/src/App.tsx`**:
```typescript
<Route path="/my-page" component={MyPage} />
```

## API Quick Reference

### Authentication
```typescript
// Register
trpc.auth.register.useMutation()
// Input: { email, password }

// Login
trpc.auth.login.useMutation()
// Input: { email, password }

// Get current user
trpc.auth.me.useQuery()

// Refresh token
trpc.auth.refreshToken.useMutation()
// Input: { refreshToken }
```

### Teams
```typescript
// Create team
trpc.teams.create.useMutation()
// Input: { name, description? }

// List user's teams
trpc.teams.list.useQuery()

// Get team by ID
trpc.teams.getById.useQuery({ id })

// Update team
trpc.teams.update.useMutation()
// Input: { id, name?, description? }

// Delete team
trpc.teams.delete.useMutation()
// Input: { id }

// Get team members
trpc.teams.getMembers.useQuery({ teamId })

// Invite member
trpc.teams.createInvitation.useMutation()
// Input: { teamId, email, role }

// Change member role
trpc.teams.changeMemberRole.useMutation()
// Input: { teamId, userId, role }

// Remove member
trpc.teams.removeMember.useMutation()
// Input: { teamId, userId }
```

### Tasks
```typescript
// Create task
trpc.tasks.create.useMutation()
// Input: { teamId, title, description?, assigneeId?, priority, status, dueDate? }

// List tasks
trpc.tasks.list.useQuery({ teamId, status?, assigneeId?, priority? })

// Get task by ID
trpc.tasks.getById.useQuery({ id })

// Update task
trpc.tasks.update.useMutation()
// Input: { id, title?, description?, assigneeId?, priority?, status?, dueDate? }

// Move task
trpc.tasks.move.useMutation()
// Input: { id, status }

// Delete task
trpc.tasks.delete.useMutation()
// Input: { id }

// Get task history
trpc.tasks.getHistory.useQuery({ id })
```

### Documents
```typescript
// Create document
trpc.documents.create.useMutation()
// Input: { teamId, title, content? }

// List documents
trpc.documents.list.useQuery({ teamId })

// Get document
trpc.documents.getById.useQuery({ id })

// Update document
trpc.documents.update.useMutation()
// Input: { id, title?, content? }

// Delete document
trpc.documents.delete.useMutation()
// Input: { id }
```

### Repositories
```typescript
// Connect repository
trpc.repositories.connect.useMutation()
// Input: { teamId, repoUrl, accessToken }

// List repositories
trpc.repositories.list.useQuery({ teamId })

// Get repository
trpc.repositories.getById.useQuery({ id })

// Sync repository
trpc.repositories.sync.useMutation()
// Input: { id }

// Link task to PR
trpc.repositories.linkToPR.useMutation()
// Input: { taskId, prUrl }

// Delete repository
trpc.repositories.delete.useMutation()
// Input: { id }
```

## Socket.io Events

### Client → Server
```typescript
socket.emit('joinTeam', teamId);
socket.emit('leaveTeam', teamId);
socket.emit('joinDocument', documentId);
socket.emit('leaveDocument', documentId);
```

### Server → Client
```typescript
socket.on('userJoined', (data) => {
  // { userId, username, teamId }
});

socket.on('userLeft', (data) => {
  // { userId, teamId }
});

socket.on('taskCreated', (task) => {
  // Full task object
});

socket.on('taskUpdated', (task) => {
  // Full task object
});

socket.on('taskMoved', (data) => {
  // { taskId, newStatus, newPosition }
});

socket.on('taskDeleted', (data) => {
  // { taskId }
});
```

## Database Helpers

### Common Patterns

```typescript
// Get database instance
const db = await getDb();

// Transaction wrapper
await withTransaction(async (db) => {
  // All operations in transaction
  await db.insert(table).values(data);
  await db.update(table).set(updates);
});

// Check permission
const hasPermission = await checkTeamPermission(
  teamId,
  userId,
  'create_task'
);

// Create audit log
await createAuditLog({
  operation: 'CREATE',
  entityType: 'TASK',
  entityId: taskId,
  userId: userId,
  details: { taskTitle: 'New Task' },
});
```

## UI Components

### Common Components

```typescript
// Button
<Button variant="default|destructive|outline|secondary|ghost|link">
  Click me
</Button>

// Dialog
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>

// Card
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

// Form
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="fieldName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Label</FormLabel>
          <FormControl>
            <Input {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  </form>
</Form>

// Toast notifications
import { toast } from "sonner";
toast.success("Success message");
toast.error("Error message");
toast.info("Info message");
toast.warning("Warning message");
```

## Styling

### Tailwind Classes

```typescript
// Layout
"flex flex-col gap-4"
"grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
"container mx-auto px-4"

// Spacing
"p-4"    // padding
"m-4"    // margin
"space-y-4"  // vertical spacing between children
"gap-4"  // gap in flex/grid

// Colors
"bg-white text-gray-900"
"bg-primary text-primary-foreground"
"border border-gray-200"

// Typography
"text-3xl font-bold"
"text-sm text-gray-600"

// Responsive
"hidden md:block"  // hidden on mobile, visible on desktop
"w-full md:w-1/2"  // full width on mobile, half on desktop
```

## Environment Variables

### Required
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your_secret_key
OAUTH_SERVER_URL=http://localhost:3000
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/oauth/github/callback
PORT=3000
NODE_ENV=development
```

### Frontend (.env.local)
```env
VITE_GITHUB_CLIENT_ID=your_client_id
```

## Debugging

### Enable Debug Logs

```typescript
// Server
console.log('[Module] Message', data);

// Client
console.log('[Component] Message', data);

// Socket.io
socket.on('connect', () => {
  console.log('[Socket] Connected:', socket.id);
});
```

### Common Debug Points

```typescript
// Check authentication
console.log('User:', ctx.user);

// Check database connection
const db = await getDb();
console.log('DB connected:', !!db);

// Check Socket.io connection
console.log('Socket connected:', socket.connected);

// Check tRPC query status
const { data, isLoading, error } = trpc.teams.list.useQuery();
console.log({ data, isLoading, error });
```

## Testing

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('MyFunction', () => {
  it('should do something', () => {
    const result = myFunction(input);
    expect(result).toBe(expected);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './routers';

describe('API Integration', () => {
  beforeEach(async () => {
    // Setup test database
  });

  it('should create team', async () => {
    const caller = appRouter.createCaller(mockContext);
    const team = await caller.teams.create({
      name: 'Test Team',
    });
    expect(team.name).toBe('Test Team');
  });
});
```

## Performance Tips

1. **Use React Query caching**:
```typescript
// Data is cached automatically
const { data } = trpc.teams.list.useQuery();
```

2. **Invalidate queries after mutations**:
```typescript
const utils = trpc.useUtils();
await mutation.mutateAsync(data);
utils.teams.list.invalidate();
```

3. **Optimistic updates**:
```typescript
utils.teams.list.setData(undefined, (old) => {
  return [...old, newTeam];
});
```

4. **Debounce search inputs**:
```typescript
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);
```

5. **Lazy load components**:
```typescript
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

## Security Checklist

- [ ] All API endpoints use `protectedProcedure` when needed
- [ ] Input validation with Zod schemas
- [ ] Permission checks before operations
- [ ] Passwords hashed with bcrypt
- [ ] JWT tokens have expiration
- [ ] OAuth tokens encrypted in database
- [ ] SQL injection prevented (using Drizzle ORM)
- [ ] XSS prevented (React escaping)
- [ ] Audit logs for sensitive operations

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Build completes without errors
- [ ] Tests pass
- [ ] HTTPS enabled in production
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Error monitoring setup
- [ ] Backup strategy in place
- [ ] Health check endpoint working

---

**Quick Links**:
- [Full Documentation](SYSTEM_DOCUMENTATION.md)
- [Setup Guide](QUICK_START.md)
- [Database Schema](drizzle/schema.ts)
- [API Routes](server/routers.ts)
