import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { authService } from "./_core/auth";
import { createTeamMember, getTeamMembers, getTeamMemberById, updateTeamMember, deleteTeamMember, createDepartment, getDepartments, getDepartmentById, updateDepartment, deleteDepartment, getDepartmentHierarchy, setDepartmentParent, assignMemberToDepartment, unassignMemberFromDepartment, getDepartmentMembers, createTeamMemberWithDepartment, getTeamMembersWithDepartments, getTeamMemberByIdWithDepartment, getDepartmentStats, getTeamMemberDistributionReport, getUnassignedTeamMembers, exportDepartmentData, exportDepartmentDataAsJSON, exportDepartmentDataAsCSV, getAuditLogs, getAssignmentHistoryReport, getDepartmentTrendsReport, getMemberMovementPatternsReport, DepartmentError, ValidationError, ConflictError, NotFoundError, IntegrityError, createTeam, getUserTeams, getTeamById, updateTeam, deleteTeam, getCollaborativeTeamMembers, createTeamInvitation, getTeamInvitations, acceptTeamInvitation, rejectTeamInvitation, changeTeamMemberRole, removeTeamMember, checkTeamPermission, createTask, getTasksByTeam, getTaskById, updateTask, deleteTask, moveTask, getTaskHistory, createRepository, getRepositoriesByTeam, getRepositoryById, updateRepository, deleteRepository, linkTaskToPR, syncRepository, createDocument, getDocumentsByTeam, getDocumentById, updateDocument, updateDocumentYjsState, deleteDocument, getActiveDocumentUsers, getUserByEmail, createUserWithPassword, updateUserLastSignedIn } from "./db";
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
  if (error instanceof DepartmentError) {
    // Map our custom error types to appropriate tRPC error codes
    switch (error.constructor) {
      case ValidationError:
        throw new Error(`Validation Error: ${error.message}`);
      case ConflictError:
        throw new Error(`Conflict: ${error.message}`);
      case NotFoundError:
        throw new Error(`Not Found: ${error.message}`);
      case IntegrityError:
        throw new Error(`Data Integrity Error: ${error.message}`);
      default:
        throw new Error(`Department Error: ${error.message}`);
    }
  }
  
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
        const accessToken = await authService.generateAccessToken(user.id, user.email!);
        const refreshToken = await authService.generateRefreshToken(user.id, user.email!);

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
        const accessToken = await authService.generateAccessToken(user.id, user.email!);
        const refreshToken = await authService.generateRefreshToken(user.id, user.email!);

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
          payload.email
        );

        // Optionally generate new refresh token (30-day expiration)
        const refreshToken = await authService.generateRefreshToken(
          payload.userId,
          payload.email
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
    listWithDepartments: publicProcedure.query(async () => {
      return getTeamMembersWithDepartments();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getTeamMemberById(input.id);
    }),
    getByIdWithDepartment: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getTeamMemberByIdWithDepartment(input.id);
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
    createWithDepartment: publicProcedure
      .input(z.object({
        name: z.string().min(1),
        position: z.string().min(1),
        duties: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        pictureFileName: z.string().optional(),
        departmentId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const auditContext = {
            userId: ctx.user?.id,
            ipAddress: ctx.req.ip || ctx.req.connection.remoteAddress,
            userAgent: ctx.req.headers['user-agent']
          };
          return await createTeamMemberWithDepartment(input, auditContext);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create team member with department');
        }
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
  }),

  department: router({
    list: publicProcedure.query(async () => {
      return getDepartments();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return getDepartmentById(input.id);
    }),
    create: publicProcedure
      .input(z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional().nullable(),
        parentId: z.number().optional(),
        managerId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const auditContext = getAuditContext(ctx);
          return await createDepartment(input, auditContext);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional().nullable(),
        parentId: z.number().optional(),
        managerId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { id, ...data } = input;
          const auditContext = getAuditContext(ctx);
          return await updateDepartment(id, data, auditContext);
        } catch (error) {
          handleDatabaseError(error);
        }
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
          return await deleteDepartment(input.id, auditContext);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),
    
    // Hierarchy management endpoints
    getHierarchy: publicProcedure.query(async () => {
      try {
        return await getDepartmentHierarchy();
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to get department hierarchy');
      }
    }),
    setParent: publicProcedure
      .input(z.object({
        departmentId: z.number(),
        parentId: z.number().nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const auditContext = {
            userId: ctx.user?.id,
            ipAddress: ctx.req.ip || ctx.req.connection.remoteAddress,
            userAgent: ctx.req.headers['user-agent']
          };
          return await setDepartmentParent(input.departmentId, input.parentId, auditContext);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to set department parent');
        }
      }),
    
    // Assignment endpoints
    assignMember: publicProcedure
      .input(z.object({
        teamMemberId: z.number(),
        departmentId: z.number(),
        assignedBy: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const auditContext = {
            userId: ctx.user?.id,
            ipAddress: ctx.req.ip || ctx.req.connection.remoteAddress,
            userAgent: ctx.req.headers['user-agent']
          };
          return await assignMemberToDepartment(input, auditContext);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),
    unassignMember: publicProcedure
      .input(z.object({
        teamMemberId: z.number(),
        departmentId: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const auditContext = {
            userId: ctx.user?.id,
            ipAddress: ctx.req.ip || ctx.req.connection.remoteAddress,
            userAgent: ctx.req.headers['user-agent']
          };
          return await unassignMemberFromDepartment(input, auditContext);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),
    getMembers: publicProcedure
      .input(z.object({ departmentId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getDepartmentMembers(input.departmentId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get department members');
        }
      }),
    
    // Reporting endpoints
    getStats: publicProcedure.query(async () => {
      try {
        return await getDepartmentStats();
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to get department statistics');
      }
    }),
    getDistributionReport: publicProcedure.query(async () => {
      try {
        return await getTeamMemberDistributionReport();
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to get team member distribution report');
      }
    }),
    getUnassignedMembers: publicProcedure.query(async () => {
      try {
        return await getUnassignedTeamMembers();
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Failed to get unassigned team members');
      }
    }),
    
    // Historical reporting endpoints
    getAssignmentHistory: publicProcedure
      .input(z.object({
        teamMemberId: z.number().optional(),
        departmentId: z.number().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getAssignmentHistoryReport(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get assignment history');
        }
      }),
    
    getDepartmentTrends: publicProcedure
      .input(z.object({
        departmentId: z.number().optional(),
        timeRange: z.enum(['30d', '90d', '1y', 'all']).optional().default('90d'),
      }))
      .query(async ({ input }) => {
        try {
          return await getDepartmentTrendsReport(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get department trends');
        }
      }),
    
    getMemberMovementPatterns: publicProcedure
      .input(z.object({
        timeRange: z.enum(['30d', '90d', '1y', 'all']).optional().default('90d'),
      }))
      .query(async ({ input }) => {
        try {
          return await getMemberMovementPatternsReport(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get member movement patterns');
        }
      }),
    
    // Export endpoints
    exportData: publicProcedure
      .input(z.object({
        includeHistoricalData: z.boolean().optional().default(true),
        exportedBy: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await exportDepartmentData({
            includeHistoricalData: input.includeHistoricalData,
            exportedBy: input.exportedBy,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to export department data');
        }
      }),
    exportJSON: publicProcedure
      .input(z.object({
        includeHistoricalData: z.boolean().optional().default(true),
        exportedBy: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await exportDepartmentDataAsJSON({
            includeHistoricalData: input.includeHistoricalData,
            exportedBy: input.exportedBy,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to export department data as JSON');
        }
      }),
    exportCSV: publicProcedure
      .input(z.object({
        includeHistoricalData: z.boolean().optional().default(true),
        exportedBy: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await exportDepartmentDataAsCSV({
            includeHistoricalData: input.includeHistoricalData,
            exportedBy: input.exportedBy,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to export department data as CSV');
        }
      }),
    
    // Audit log endpoints
    getAuditLogs: publicProcedure
      .input(z.object({
        entityType: z.string().optional(),
        entityId: z.number().optional(),
        userId: z.number().optional(),
        operation: z.string().optional(),
        limit: z.number().min(1).max(1000).optional().default(100),
        offset: z.number().min(0).optional().default(0),
      }))
      .query(async ({ input }) => {
        try {
          return await getAuditLogs(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get audit logs');
        }
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
        assigneeId: z.number().optional(),
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
        assigneeId: z.number().optional(),
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
        assigneeId: z.number().optional(),
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
        position: z.number().min(0),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await moveTask(input.id, input.status, input.position, ctx.user.id);
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

  // Documents Router (Collaborative Code Editor)
  documents: router({
    // Create a new document
    create: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        name: z.string().min(1),
        yjsState: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createDocument(
            {
              teamId: input.teamId,
              name: input.name,
              yjsState: input.yjsState || null,
            },
            ctx.user.id
          );
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // List documents for a team
    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getDocumentsByTeam(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get documents');
        }
      }),

    // Get document by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          const document = await getDocumentById(input.id);
          if (!document) {
            throw new Error('Document not found');
          }
          return document;
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get document');
        }
      }),

    // Update document Yjs state
    updateYjsState: protectedProcedure
      .input(z.object({
        id: z.number(),
        yjsState: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await updateDocumentYjsState(input.id, input.yjsState, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // Update document (rename)
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await updateDocument(input.id, { name: input.name }, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // Delete document
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await deleteDocument(input.id, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    // Get active users editing a document
    getActiveUsers: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getActiveDocumentUsers(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get active users');
        }
      }),
  }),

  // Repositories Router
  repositories: router({
    // Connect a GitHub repository
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

          // Create GitHub service with encrypted token
          const githubService = GitHubService.fromEncryptedToken(repository.accessToken);

          // Fetch repository data
          return await githubService.getRepositoryData(parsed.owner, parsed.repo);
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
});

export type AppRouter = typeof appRouter;
