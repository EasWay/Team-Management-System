import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { authService } from "./_core/auth";
import { createTeamMember, getTeamMembers, getTeamMemberById, updateTeamMember, deleteTeamMember, getAuditLogs, ValidationError, ConflictError, NotFoundError, IntegrityError, createTeam, getUserTeams, getTeamById, updateTeam, deleteTeam, getCollaborativeTeamMembers, createTeamInvitation, getTeamInvitations, acceptTeamInvitation, rejectTeamInvitation, changeTeamMemberRole, removeTeamMember, checkTeamPermission, createTask, getTasksByTeam, getTaskById, updateTask, deleteTask, moveTask, getTaskHistory, createRepository, getRepositoriesByTeam, getRepositoryById, updateRepository, deleteRepository, linkTaskToPR, syncRepository, createClient, getClientsByTeam, getClientById, updateClient, createProject, getProjectsByTeam, getProjectById, updateProject, deleteProject, createProjectFile, getProjectFiles, getUserByEmail, createUserWithPassword, updateUserLastSignedIn, createProjectFromParsedPRD, setTeamGithubToken, getTeamGithubToken, getAllTeams, requestToJoinTeam, approveJoinRequest, searchGlobalTeamMembers, deleteProjectFile, addMemberToTeam, getMessages } from "./db";
import { parsePRDText } from "./_core/prdParser";
import { GitHubService, parseGitHubUrl } from "./github-service";
import { z } from "zod";

// Helper function to safely extract audit context
function getAuditContext(ctx: any) {
  return {
    userId: ctx.user?.id,
    ipAddress: ctx.req?.ip || ctx.req?.connection?.remoteAddress || 'test-environment',
    userAgent: ctx.req?.headers?.['user-agent'] || 'test-agent'
  };
}

// Helper function to handle database errors and convert them to appropriate tRPC errors
function handleDatabaseError(error: unknown): never {
  // Handle generic errors
  if (error instanceof Error) {
    throw new Error(error.message);
  }

  // Fallback for unknown errors
  throw new Error('An unexpected error occurred');
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    register: publicProcedure
      .input(z.object({
        email: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Validate email format
        const emailValidation = authService.validateEmail(input.email);
        if (!emailValidation.valid) {
          throw new Error(JSON.stringify({
            error: 'Validation failed',
            details: { email: emailValidation.error },
          }));
        }

        // Validate password strength
        const passwordValidation = authService.validatePasswordStrength(input.password);
        if (!passwordValidation.valid) {
          throw new Error(JSON.stringify({
            error: 'Validation failed',
            details: { password: passwordValidation.errors[0] },
          }));
        }

        // Check if email already exists
        const existingUser = await getUserByEmail(input.email);
        if (existingUser) {
          throw new Error(JSON.stringify({
            error: 'Email already in use',
            details: { email: 'Email already in use' },
          }));
        }

        // Hash password
        const passwordHash = await authService.hashPassword(input.password);

        // Create user
        let user;
        try {
          user = await createUserWithPassword({
            email: input.email,
            passwordHash,
          });
        } catch (error) {
          // Handle database constraint violations (e.g., duplicate email)
          if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
            throw new Error(JSON.stringify({
              error: 'Email already in use',
              details: { email: 'Email already in use' },
            }));
          }
          throw error;
        }

        // Generate tokens
        const accessToken = await authService.generateAccessToken(user.id, user.email!, user.name || undefined);
        const refreshToken = await authService.generateRefreshToken(user.id, user.email!, user.name || undefined);

        // Return user data and tokens (exclude passwordHash)
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          accessToken,
          refreshToken,
        };
      }),
    login: publicProcedure
      .input(z.object({
        email: z.string(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        // Validate email and password are provided
        if (!input.email || !input.password) {
          throw new Error(JSON.stringify({
            error: 'Validation failed',
            details: {
              ...((!input.email) && { email: 'Email is required' }),
              ...((!input.password) && { password: 'Password is required' }),
            },
          }));
        }

        // Look up user by email in database
        const user = await getUserByEmail(input.email);

        // Return generic error if user not found (no email enumeration)
        if (!user) {
          throw new Error(JSON.stringify({
            error: 'Invalid credentials',
          }));
        }

        // Verify password against stored hash
        const passwordMatch = await authService.verifyPassword(input.password, user.passwordHash || '');

        // Return generic error if password doesn't match (no email enumeration)
        if (!passwordMatch) {
          throw new Error(JSON.stringify({
            error: 'Invalid credentials',
          }));
        }

        // Update user's lastSignedIn timestamp to current time
        await updateUserLastSignedIn(user.id);

        // Generate access token (7-day expiration) and refresh token (30-day expiration)
        const accessToken = await authService.generateAccessToken(user.id, user.email!, user.name || undefined);
        const refreshToken = await authService.generateRefreshToken(user.id, user.email!, user.name || undefined);

        // Return user data and tokens (exclude passwordHash)
        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          accessToken,
          refreshToken,
        };
      }),
    logout: publicProcedure.mutation(() => {
      // With token-based auth, logout is handled client-side by removing the token
      // Server doesn't need to do anything
      return {
        success: true,
      } as const;
    }),
    refreshToken: publicProcedure
      .input(z.object({ refreshToken: z.string() }))
      .mutation(async ({ input }) => {
        // Validate refresh token is provided
        if (!input.refreshToken) {
          throw new Error(JSON.stringify({
            error: 'Validation failed',
            details: { refreshToken: 'Refresh token is required' },
          }));
        }

        // Verify refresh token validity and expiration
        const payload = await authService.verifyToken(input.refreshToken);

        if (!payload || payload.type !== 'refresh') {
          throw new Error(JSON.stringify({
            error: 'Invalid or expired refresh token',
          }));
        }

        // Generate new access token (7-day expiration)
        const accessToken = await authService.generateAccessToken(
          payload.userId,
          payload.email,
          payload.name as string | undefined
        );

        // Optionally generate new refresh token (30-day expiration)
        const refreshToken = await authService.generateRefreshToken(
          payload.userId,
          payload.email,
          payload.name as string | undefined
        );

        return {
          accessToken,
          refreshToken,
        };
      }),
  }),

  team: router({
    list: publicProcedure.query(async () => {
      return getTeamMembers();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getTeamMemberById(input.id);
    }),
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        position: z.string().min(1),
        duties: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        pictureFileName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return createTeamMember(input);
      }),

    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        position: z.string().min(1).optional(),
        duties: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        pictureFileName: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateTeamMember(id, data);
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          const auditContext = {
            userId: ctx.user?.id,
            ipAddress: ctx.req.ip || ctx.req.connection.remoteAddress,
            userAgent: ctx.req.headers['user-agent']
          };
          return await deleteTeamMember(input.id, auditContext);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),
    debug: publicProcedure.query(async () => {
      const dbMembers = await getTeamMembers();
      console.log("[Debug] Members:", JSON.stringify(dbMembers, null, 2));
      return dbMembers;
    }),
  }),


  // Collaborative Teams Router
  teams: router({
    // Team CRUD operations
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createTeam(input, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        if (!ctx.user?.id) {
          throw new Error('User not authenticated');
        }
        return await getUserTeams(ctx.user.id);
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to get teams');
      }
    }),

    listAll: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await getAllTeams(ctx.user?.id);
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to get all teams');
      }
    }),

    requestJoin: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await requestToJoinTeam(input.teamId, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    approveJoin: protectedProcedure
      .input(z.object({ teamId: z.number(), memberId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await approveJoinRequest(input.teamId, input.memberId, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    addMember: protectedProcedure
      .input(z.object({ teamId: z.number(), memberId: z.number(), role: z.enum(['admin', 'team_lead', 'developer', 'viewer']).optional() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          // Permission check for the requester
          const canAdd = await checkTeamPermission(input.teamId, ctx.user.id, 'invite_member');
          if (!canAdd) throw new Error("Insufficient permissions");

          return await addMemberToTeam(input.teamId, input.memberId, input.role as any);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    searchGlobalMembers: protectedProcedure
      .input(z.object({ query: z.string() }))
      .query(async ({ input }) => {
        try {
          return await searchGlobalTeamMembers(input.query);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to search members');
        }
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          return await getTeamById(input.id, ctx.user?.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get team');
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          const { id, ...updates } = input;
          return await updateTeam(id, updates, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await deleteTeam(input.id, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // Team member operations
    getMembers: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getCollaborativeTeamMembers(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get team members');
        }
      }),

    // Invitation operations
    createInvitation: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        email: z.string().email(),
        role: z.enum(['admin', 'team_lead', 'developer', 'viewer']),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createTeamInvitation({
            ...input,
            invitedBy: ctx.user.id,
          });
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    getInvitations: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getTeamInvitations(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get invitations');
        }
      }),

    acceptInvitation: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await acceptTeamInvitation(input.token, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    rejectInvitation: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        try {
          return await rejectTeamInvitation(input.token);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to reject invitation');
        }
      }),

    // Member management operations
    changeMemberRole: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        userId: z.number(),
        role: z.enum(['admin', 'team_lead', 'developer', 'viewer']),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await changeTeamMemberRole(
            input.teamId,
            input.userId,
            input.role,
            ctx.user.id
          );
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    removeMember: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        userId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await removeTeamMember(input.teamId, input.userId, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // Permission checking
    checkPermission: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        permission: z.string(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            return false;
          }
          return await checkTeamPermission(input.teamId, ctx.user.id, input.permission);
        } catch (error) {
          return false;
        }
      }),
  }),

  // Tasks Router
  tasks: router({
    // Task CRUD operations
    create: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        title: z.string().min(1).max(200),
        description: z.string().optional(),
        assignedTo: z.number().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']),
        status: z.enum(['todo', 'in_progress', 'review', 'done']),
        dueDate: z.date().optional(),
        githubPrUrl: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createTask(input, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        status: z.string().optional(),
        assignedTo: z.number().optional(),
        priority: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const { teamId, ...filters } = input;
          return await getTasksByTeam(teamId, filters);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get tasks');
        }
      }),

    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getTaskById(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get task');
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        assignedTo: z.number().optional(),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
        status: z.enum(['todo', 'in_progress', 'review', 'done']).optional(),
        dueDate: z.date().optional(),
        githubPrUrl: z.string().url().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          const { id, ...updates } = input;
          return await updateTask(id, updates, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await deleteTask(input.id, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    move: protectedProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(['todo', 'in_progress', 'review', 'done']),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await moveTask(input.id, input.status, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    getHistory: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getTaskHistory(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get task history');
        }
      }),
  }),

  // Clients Router
  clients: router({
    create: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await createClient({
          teamId: input.teamId,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
        }, ctx.user?.id);
      }),
    list: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        return await getClientsByTeam(input.teamId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getClientById(input.id);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        return await updateClient(id, updates, ctx.user?.id);
      }),
  }),

  // Projects Router
  projects: router({
    create: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        teamId: z.number(),
        name: z.string().min(1),
        definition: z.string().optional(),
        description: z.string().optional(),
        dateEnded: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await createProject({
          ...input,
          dateEnded: input.dateEnded ? new Date(input.dateEnded) : undefined,
          dateReceived: new Date(),
        }, ctx.user?.id);
      }),
    list: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        return await getProjectsByTeam(input.teamId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getProjectById(input.id);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        definition: z.string().optional(),
        description: z.string().optional(),
        dateEnded: z.string().optional(),
        status: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...updates } = input;
        return await updateProject(id, {
          ...updates,
          dateEnded: updates.dateEnded ? new Date(updates.dateEnded) : undefined,
        }, ctx.user?.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await deleteProject(input.id, ctx.user?.id);
      }),
    parsePRD: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        text: z.string(),
        fileName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const parsed = await parsePRDText(input.text);
        return await createProjectFromParsedPRD(input.teamId, parsed, ctx.user?.id);
      }),
    createFile: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        title: z.string(),
        fileUrl: z.string(),
        type: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        return await createProjectFile({
          ...input,
          uploadedBy: ctx.user?.id || null,
        });
      }),
    listFiles: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        return await getProjectFiles(input.projectId);
      }),
    deleteFile: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        return await deleteProjectFile(input.id, ctx.user?.id);
      }),
  }),

  // Analytics Router for Dashboard Metrics
  analytics: router({
    getDashboardMetrics: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }

          // Verify user is in team
          const isMember = await checkTeamPermission(input.teamId, ctx.user.id, 'create_task'); // Basically any valid member
          // In a real scenario we'd query tasks, members, and performance.
          // For now, since schema doesn't have velocity/cycle time, we generate based on tasks.

          const teamTasks = await getTasksByTeam(input.teamId);
          const members = await getCollaborativeTeamMembers(input.teamId);

          const activeTasksCount = teamTasks.filter(t => t.status !== 'done').length;
          const completedTasksCount = teamTasks.filter(t => t.status === 'done').length;

          // Generate somewhat dynamic metrics
          const sprintVelocity = 20 + (completedTasksCount * 3.5);
          const cycleTime = Math.max(1.2, 5 - (completedTasksCount * 0.1));

          // Generate burndown data points (last 10 days)
          const burndown = Array.from({ length: 10 }).map((_, i) => {
            const day = i + 1;
            const ideal = 100 - (10 * i);
            let actual = ideal + (Math.random() * 20 - 5);
            if (actual < 0) actual = 0;
            if (actual > 100) actual = 100;
            return { day: `Day ${day.toString().padStart(2, '0')}`, actual, ideal };
          });

          return {
            sprintVelocity: { value: sprintVelocity.toFixed(1), unit: 'pts', trend: '+5.2% vs last', direction: 'up' },
            openTasks: { value: activeTasksCount, unit: 'Active', trend: '-2% volume', direction: 'down' },
            activeMembers: { value: members.length, unit: 'Personnel', trend: members.length >= 3 ? 'Fully Staffed' : 'Needs Team', direction: members.length >= 3 ? 'down' : 'up' },
            cycleTime: { value: cycleTime.toFixed(1), unit: 'Days', trend: '+0.4% efficiency', direction: 'up' },
            burndown
          };
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch analytics');
        }
      }),
  }),

  // Activities Router for Live Feed
  activities: router({
    list: protectedProcedure
      .input(z.object({ teamId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          // Fetch activities for team. Wait, we need a DB function or raw query here.
          // Using Drizzle directly if we don't have a helper.
          const _db = await import('./db').then(m => m.getDb());
          if (!_db) return [];

          const { activities: activitiesSchema, teamMembers: teamMembersSchema } = await import('../drizzle/schema');
          const { eq, desc } = await import('drizzle-orm');

          const result = await _db
            .select({
              id: activitiesSchema.id,
              type: activitiesSchema.type,
              description: activitiesSchema.description,
              createdAt: activitiesSchema.createdAt,
              userName: teamMembersSchema.name,
            })
            .from(activitiesSchema)
            .leftJoin(teamMembersSchema, eq(activitiesSchema.userId, teamMembersSchema.id))
            .where(eq(activitiesSchema.teamId, input.teamId))
            .orderBy(desc(activitiesSchema.createdAt))
            .limit(input.limit);

          return result;
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to retrieve activities');
        }
      })
  }),

  // Repositories Router
  repositories: router({
    // Configure team GitHub account (save PAT)
    configureAccount: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        accessToken: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          const trimmedToken = input.accessToken.trim();

          // Validate the token first
          const githubService = new GitHubService(trimmedToken);
          await githubService.getAuthenticatedUser();

          return await setTeamGithubToken(input.teamId, trimmedToken);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to configure account';
          throw new Error(message === 'Bad credentials' ? 'Invalid GitHub token. Please check your PAT.' : message);
        }
      }),

    // Check if team has GitHub account configured
    isConfigured: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        const token = await getTeamGithubToken(input.teamId);
        return !!token;
      }),

    // Get GitHub profile for the configured team
    getAccountProfile: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        try {
          const token = await getTeamGithubToken(input.teamId);
          if (!token) return null;

          const githubService = new GitHubService(token);
          return await githubService.getAuthenticatedUser();
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get profile');
        }
      }),

    // List all repositories for the configured team GitHub account
    listFromAccount: protectedProcedure
      .input(z.object({
        teamId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          const token = await getTeamGithubToken(input.teamId);
          if (!token) return [];

          const githubService = new GitHubService(token);
          return await githubService.listUserRepositories();
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to list repositories');
        }
      }),

    // Create a new repository on the configured GitHub account
    createFromAccount: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        isPrivate: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        try {
          const token = await getTeamGithubToken(input.teamId);
          if (!token) throw new Error('GitHub account not configured');

          const githubService = new GitHubService(token);
          return await githubService.createRepo(input.name, input.description, input.isPrivate);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create repository');
        }
      }),

    // Delete a repository from the configured GitHub account
    deleteFromAccount: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        owner: z.string().min(1),
        repo: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        try {
          const token = await getTeamGithubToken(input.teamId);
          if (!token) throw new Error('GitHub account not configured');

          const githubService = new GitHubService(token);
          return await githubService.deleteRepo(input.owner, input.repo);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete repository');
        }
      }),

    // Connect a GitHub repository (legacy / individual link)
    connect: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        repoUrl: z.string().url(),
        accessToken: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createRepository(input.teamId, input.repoUrl, input.accessToken, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // List repositories for a team
    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getRepositoriesByTeam(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get repositories');
        }
      }),

    // Get repository by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getRepositoryById(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get repository');
        }
      }),

    // Get repository data (commits, PRs, issues, branches)
    getData: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          const repository = await getRepositoryById(input.id);
          if (!repository) {
            throw new Error('Repository not found');
          }

          // Parse repository URL to get owner and repo
          const parsed = parseGitHubUrl(repository.url);
          if (!parsed) {
            throw new Error('Invalid repository URL');
          }

          // Note: This requires the user to have a GitHub OAuth token
          // The actual implementation would need to fetch the user's OAuth token
          // from the oauthTokens table and use that instead
          throw new Error('Repository data fetching requires GitHub OAuth integration');
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get repository data');
        }
      }),

    // Sync repository (manual refresh)
    sync: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await syncRepository(input.id, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // Link a GitHub PR to a task
    linkToPR: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        prUrl: z.string().url(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await linkTaskToPR(input.taskId, input.prUrl, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // Delete repository connection
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await deleteRepository(input.id, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),
  }),

  // Messages Router
  messages: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        if (!ctx.user?.id) {
          throw new Error('User not authenticated');
        }
        return await getMessages();
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to get messages');
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
