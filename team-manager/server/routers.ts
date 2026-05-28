import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { authService } from "./_core/auth";
import { createTeamMember, getTeamMembers, getTeamMemberById, updateTeamMember, deleteTeamMember, getAuditLogs, ValidationError, ConflictError, NotFoundError, IntegrityError, createTeam, getUserTeams, getTeamById, updateTeam, deleteTeam, getCollaborativeTeamMembers, createTeamInvitation, getTeamInvitations, acceptTeamInvitation, rejectTeamInvitation, changeTeamMemberRole, updateTeamMemberOfficeRole, removeTeamMember, checkTeamPermission, getMemberRoleInTeam, createTask, getTasksByTeam, getTaskById, updateTask, deleteTask, moveTask, reopenTask, getTaskHistory, createRepository, getRepositoriesByTeam, getRepositoryById, updateRepository, deleteRepository, linkTaskToPR, syncRepository, createClient, getClientsByTeam, getClientById, updateClient, createProject, getProjectsByTeam, getProjectById, updateProject, deleteProject, createProjectFile, getProjectFiles, getUserByEmail, createUserWithPassword, updateUserLastSignedIn, createProjectFromParsedPRD, setTeamGithubToken, getTeamGithubToken, getAllTeams, requestToJoinTeam, approveJoinRequest, searchGlobalTeamMembers, deleteProjectFile, addMemberToTeam, getMessages, createApproval, getApprovals, getApprovalById, approveOrReject, castVote, getPendingApprovalsForUser, configureTeamApproval, getWorkspaceItems, getItemsByStage, addDeliverable, handoffToNextStage, completeHandoff, getHandoffHistory, getDeliverables, getWorkspaceSummary, saveProjectEvaluation, getProjectEvaluation, getEvaluatedProjects, getProjectsReadyForLaunch, getEvaluationStats, sendChatMessage, getChatMessages, getChatConversations, markMessagesAsRead, listAllUsers, getUserTeamMemberships, setUserSystemRole, removeUserFromSystem, addUserToSystem, sendNotification, getDb, handoffTask, handoffProject, getTasksByRole, getProjectsByRole, getTasksByStage, getProjectsByStage, getMyWorkQueue, acceptHandoff } from "./db";
import { parsePRDText } from "./_core/prdParser";
import { processIdeation } from "./_core/ideationEngine";
import { evaluateProject, quickEvaluate } from "./_core/projectEvaluator";
import { GitHubService, parseGitHubUrl } from "./github-service";
import { getTeamPerformanceMetrics, getProjectAnalytics, getBottleneckAnalysis, getVelocityTracking, getOfficeWorkloadDistribution, getBurndownData } from "./analytics";
import { uploadFile, uploadFileVersion, getFilesByTeam, getFileById, getFileVersions, deleteFile, createFolder, getFoldersByTeam, updateFolder, deleteFolder, moveFileToFolder, addFileComment, getFileComments, shareFile, getFileShares, updateFileTags, searchFiles, getFileStatistics } from "./file-service";
import { createCalendarEvent, getCalendarEvents, getCalendarEventById, updateCalendarEvent, deleteCalendarEvent, createMilestone, getMilestones, getTeamMilestones, updateMilestone, deleteMilestone, createTaskDependency, getTaskDependencies, getProjectDependencies, deleteTaskDependency, setUserAvailability, getUserAvailability, getTeamAvailability, updateUserAvailability, deleteUserAvailability, getGanttChartData, getUpcomingDeadlines } from "./calendar-service";
import { createOfficeRoom, getOfficeRooms, getOfficeRoomById, updateOfficeRoom, deleteOfficeRoom, startVideoCall, joinVideoCall, leaveVideoCall, endVideoCall, getVideoCallById, getVideoCallByRoomId, getActiveCalls, getCallHistory, getCallParticipants, updateParticipantStatus, sendCallMessage, getCallMessages, startRecording, stopRecording, getCallStatistics } from "./video-call-service";
import { upsertNotificationPreferences, getNotificationPreferences, createNotification, getNotifications, getUnreadCount, markNotificationAsRead, markAllAsRead, deleteNotification, createNotificationRule, getNotificationRules, updateNotificationRule, deleteNotificationRule, checkIdleFolders, checkApproachingDeadlines, generateDailyDigest, queueDailyDigest, getPendingDigests, markDigestAsSent, getNotificationStatistics } from "./notification-service";
import { createClientPortalAccess, clientLogin, verifyClientToken, getClientPortalAccess, updateClientPortalAccess, getClientProjects, getClientProjectDetails, createClientFeedback, getClientFeedback, getTeamFeedback, respondToFeedback, logClientActivity, getClientActivityLog, setProjectVisibility, getProjectVisibility, getClientDashboard, changeClientPassword, getClientStatistics } from "./client-portal-service";
import { grantResourcePermission, revokeResourcePermission, checkResourcePermission, getUserResourcePermissions, setOfficeAccessControl, getOfficeAccessControl, checkOfficePermission, logSecurityAudit, getSecurityAuditTrail, exportAuditLogs, enable2FA, verify2FAToken, generateBackupCodes, addIPToWhitelist, checkIPWhitelist, getIPWhitelist, createUserSession, getUserSessions, revokeSession, revokeAllSessions, createPermissionRole, assignRoleToUser, getUserRoles, checkRolePermission } from "./security-service";
import { z } from "zod";
import { users, teamMembersCollaborative } from "../drizzle/schema";
import { eq } from "drizzle-orm";

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

    updateOfficeRole: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        userId: z.number(),
        officeRole: z.enum([
          'project_manager',
          'lead_researcher',
          'systems_architect',
          'backend_engineer',
          'fullstack_engineer',
          'ai_engineer',
          'qa_tester',
          'designer'
        ]).nullable(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await updateTeamMemberOfficeRole(
            input.teamId,
            input.userId,
            input.officeRole,
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
        tags: z.array(z.string()).optional(),
        completionPercentage: z.number().min(0).max(100).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createTask(input as any, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
        }
      }),

    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        status: z.string().optional(),
        assignedTo: z.number().optional(),
        createdBy: z.number().optional(),
        priority: z.string().optional(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) throw new Error('User not authenticated');
          const { teamId, ...filters } = input;
          const role = await getMemberRoleInTeam(teamId, ctx.user.id);
          // Non-admin/team_lead members only see tasks assigned to or created by them
          const viewerMemberId = (role === 'admin' || role === 'team_lead') ? undefined : ctx.user.id;
          return await getTasksByTeam(teamId, { ...filters, viewerMemberId });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get tasks');
        }
      }),

    updateProgress: protectedProcedure
      .input(z.object({
        id: z.number(),
        completionPercentage: z.number().min(0).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) throw new Error('User not authenticated');
          return await updateTask(input.id, { completionPercentage: input.completionPercentage } as any, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
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

    reopen: protectedProcedure
      .input(z.object({
        id: z.number(),
        reason: z.string().min(1, 'A reason is required to reopen a task'),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) throw new Error('User not authenticated');
          return await reopenTask(input.id, input.reason, ctx.user.id);
        } catch (error) {
          handleDatabaseError(error);
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
        clientId: z.number().optional(),
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
    
    // NEW: AI Ideation Engine routes
    processIdeation: protectedProcedure
      .input(z.object({
        chatLogs: z.string().min(10, "Chat logs must be at least 10 characters"),
      }))
      .mutation(async ({ input }) => {
        try {
          const result = await processIdeation(input.chatLogs);
          return result;
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to process ideation');
        }
      }),
    
    activateProject: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        ideationResult: z.object({
          chatLogs: z.string(),
          speakers: z.array(z.object({
            name: z.string(),
            role: z.string(),
            contributions: z.number(),
          })),
          aiAnalysis: z.any(),
          finalDecisionReport: z.any(),
        }),
        clientFirstName: z.string().optional(),
        clientLastName: z.string().optional(),
        clientEmail: z.string().optional(),
        clientPhone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { teamId, ideationResult, clientFirstName, clientLastName, clientEmail, clientPhone } = input;
          
          // Create or find client
          let client;
          if (clientFirstName && clientLastName) {
            client = await createClient({
              teamId,
              firstName: clientFirstName,
              lastName: clientLastName,
              email: clientEmail,
              phone: clientPhone,
            }, ctx.user?.id);
          } else {
            // Use first speaker as client if not provided
            const firstSpeaker = ideationResult.speakers[0];
            const [firstName, ...lastNameParts] = firstSpeaker.name.split(' ');
            client = await createClient({
              teamId,
              firstName: firstName || 'Unknown',
              lastName: lastNameParts.join(' ') || 'Client',
              email: clientEmail,
              phone: clientPhone,
            }, ctx.user?.id);
          }
          
          // Create project with ideation data
          const project = await createProject({
            clientId: client.id,
            teamId,
            name: ideationResult.finalDecisionReport.projectName,
            definition: ideationResult.finalDecisionReport.executiveSummary,
            description: JSON.stringify(ideationResult.finalDecisionReport.businessRequirements),
            status: 'active',
            dateReceived: new Date(),
            // NEW FIELDS from schema
            ideationData: ideationResult,
            workflowStage: 'research', // Move from ideation to research stage (Lead Researcher)
            assignedRole: 'lead_researcher', // First handoff to Lead Researcher
            handoffHistory: [],
            deliverables: {},
          }, ctx.user?.id);
          
          return {
            success: true,
            project,
            client,
            message: `📁 Folder "${project.name}" delivered to Lead Researcher's office (George Essel Bonsu)`
          };
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to activate project');
        }
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
    
    // Team Performance Metrics
    getTeamPerformance: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const timeRange = {
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
          };
          return await getTeamPerformanceMetrics(input.teamId, timeRange);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get team performance');
        }
      }),
    
    // Project Analytics
    getProjectAnalytics: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          const timeRange = {
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
          };
          return await getProjectAnalytics(input.teamId, timeRange);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get project analytics');
        }
      }),
    
    // Bottleneck Analysis
    getBottlenecks: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getBottleneckAnalysis(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get bottleneck analysis');
        }
      }),
    
    // Velocity Tracking
    getVelocity: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        weeks: z.number().default(12),
      }))
      .query(async ({ input }) => {
        try {
          return await getVelocityTracking(input.teamId, input.weeks);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get velocity tracking');
        }
      }),
    
    // Office Workload Distribution
    getWorkloadDistribution: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getOfficeWorkloadDistribution(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get workload distribution');
        }
      }),
    
    // Burndown Chart Data
    getBurndown: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        sprintDays: z.number().default(14),
      }))
      .query(async ({ input }) => {
        try {
          return await getBurndownData(input.teamId, input.sprintDays);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get burndown data');
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
  
  // Files Router - File Storage & Document Management
  files: router({
    // Upload file
    upload: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        projectId: z.number().optional(),
        taskId: z.number().optional(),
        folderId: z.number().optional(),
        fileName: z.string(),
        fileData: z.string(), // base64 encoded file data
        mimeType: z.string(),
        size: z.number(),
        tags: z.array(z.string()).optional(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          
          // Decode base64 file data
          const buffer = Buffer.from(input.fileData, 'base64');
          
          return await uploadFile({
            teamId: input.teamId,
            projectId: input.projectId,
            taskId: input.taskId,
            folderId: input.folderId,
            file: {
              originalName: input.fileName,
              buffer,
              mimeType: input.mimeType,
              size: input.size,
            },
            uploadedBy: ctx.user.id,
            tags: input.tags,
            description: input.description,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to upload file');
        }
      }),
    
    // Upload new version
    uploadVersion: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        fileName: z.string(),
        fileData: z.string(),
        mimeType: z.string(),
        size: z.number(),
        changeDescription: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          
          const buffer = Buffer.from(input.fileData, 'base64');
          
          return await uploadFileVersion({
            fileId: input.fileId,
            file: {
              originalName: input.fileName,
              buffer,
              mimeType: input.mimeType,
              size: input.size,
            },
            uploadedBy: ctx.user.id,
            changeDescription: input.changeDescription,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to upload version');
        }
      }),
    
    // List files
    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        projectId: z.number().optional(),
        taskId: z.number().optional(),
        folderId: z.number().optional(),
        fileType: z.string().optional(),
        tags: z.array(z.string()).optional(),
        search: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getFilesByTeam(input.teamId, {
            projectId: input.projectId,
            taskId: input.taskId,
            folderId: input.folderId,
            fileType: input.fileType,
            tags: input.tags,
            search: input.search,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get files');
        }
      }),
    
    // Get file by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getFileById(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get file');
        }
      }),
    
    // Get file versions
    getVersions: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getFileVersions(input.fileId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get versions');
        }
      }),
    
    // Delete file
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await deleteFile(input.id, ctx.user.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete file');
        }
      }),
    
    // Move file to folder
    move: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        folderId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await moveFileToFolder(input.fileId, input.folderId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to move file');
        }
      }),
    
    // Update tags
    updateTags: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        tags: z.array(z.string()),
      }))
      .mutation(async ({ input }) => {
        try {
          return await updateFileTags(input.fileId, input.tags);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update tags');
        }
      }),
    
    // Search files
    search: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        query: z.string(),
      }))
      .query(async ({ input }) => {
        try {
          return await searchFiles(input.teamId, input.query);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to search files');
        }
      }),
    
    // Get statistics
    getStatistics: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getFileStatistics(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get statistics');
        }
      }),
    
    // Add comment
    addComment: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        comment: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await addFileComment({
            fileId: input.fileId,
            userId: ctx.user.id,
            comment: input.comment,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to add comment');
        }
      }),
    
    // Get comments
    getComments: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getFileComments(input.fileId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get comments');
        }
      }),
    
    // Share file
    share: protectedProcedure
      .input(z.object({
        fileId: z.number(),
        sharedWith: z.number(),
        permission: z.enum(['view', 'edit', 'download']),
        expiresAt: z.date().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await shareFile({
            fileId: input.fileId,
            sharedWith: input.sharedWith,
            sharedBy: ctx.user.id,
            permission: input.permission,
            expiresAt: input.expiresAt,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to share file');
        }
      }),
    
    // Get shares
    getShares: protectedProcedure
      .input(z.object({ fileId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getFileShares(input.fileId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get shares');
        }
      }),
  }),
  
  // Folders Router
  folders: router({
    // Create folder
    create: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        projectId: z.number().optional(),
        parentFolderId: z.number().optional(),
        name: z.string(),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createFolder({
            ...input,
            createdBy: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create folder');
        }
      }),
    
    // List folders
    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        projectId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getFoldersByTeam(input.teamId, input.projectId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get folders');
        }
      }),
    
    // Update folder
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { id, ...data } = input;
          return await updateFolder(id, data);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update folder');
        }
      }),
    
    // Delete folder
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteFolder(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete folder');
        }
      }),
  }),
  
  // Calendar Router - Calendar & Timeline Management
  calendar: router({
    // Create event
    createEvent: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        projectId: z.number().optional(),
        taskId: z.number().optional(),
        title: z.string(),
        description: z.string().optional(),
        eventType: z.enum(['deadline', 'meeting', 'milestone', 'personal', 'office_hours']),
        startDate: z.date(),
        endDate: z.date(),
        allDay: z.boolean().optional(),
        recurrence: z.string().optional(),
        recurrenceEnd: z.date().optional(),
        location: z.string().optional(),
        meetingUrl: z.string().optional(),
        assignedTo: z.array(z.number()).optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        reminders: z.array(z.any()).optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createCalendarEvent({
            ...input,
            createdBy: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create event');
        }
      }),
    
    // Get events
    getEvents: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        eventType: z.string().optional(),
        projectId: z.number().optional(),
        userId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getCalendarEvents(input.teamId, {
            startDate: input.startDate,
            endDate: input.endDate,
            eventType: input.eventType,
            projectId: input.projectId,
            userId: input.userId,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get events');
        }
      }),
    
    // Get event by ID
    getEventById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getCalendarEventById(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get event');
        }
      }),
    
    // Update event
    updateEvent: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        eventType: z.string().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        allDay: z.boolean().optional(),
        location: z.string().optional(),
        meetingUrl: z.string().optional(),
        assignedTo: z.array(z.number()).optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { id, ...data } = input;
          return await updateCalendarEvent(id, data);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update event');
        }
      }),
    
    // Delete event
    deleteEvent: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteCalendarEvent(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete event');
        }
      }),
    
    // Get upcoming deadlines
    getUpcomingDeadlines: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        days: z.number().default(7),
      }))
      .query(async ({ input }) => {
        try {
          return await getUpcomingDeadlines(input.teamId, input.days);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get deadlines');
        }
      }),
  }),
  
  // Milestones Router
  milestones: router({
    // Create milestone
    create: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        projectId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        dueDate: z.date(),
        dependsOn: z.array(z.number()).optional(),
        status: z.string().optional(),
        progress: z.number().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createMilestone({
            ...input,
            createdBy: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create milestone');
        }
      }),
    
    // Get project milestones
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getMilestones(input.projectId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get milestones');
        }
      }),
    
    // Get team milestones
    getByTeam: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getTeamMilestones(input.teamId, {
            startDate: input.startDate,
            endDate: input.endDate,
            status: input.status,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get team milestones');
        }
      }),
    
    // Update milestone
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        dueDate: z.date().optional(),
        status: z.string().optional(),
        progress: z.number().optional(),
        completedAt: z.date().optional(),
        completedBy: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { id, ...data } = input;
          return await updateMilestone(id, data);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update milestone');
        }
      }),
    
    // Delete milestone
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteMilestone(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete milestone');
        }
      }),
  }),
  
  // Task Dependencies Router
  taskDependencies: router({
    // Create dependency
    create: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        dependsOnTaskId: z.number(),
        dependencyType: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish']).optional(),
        lag: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await createTaskDependency(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create dependency');
        }
      }),
    
    // Get task dependencies
    getByTask: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getTaskDependencies(input.taskId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get dependencies');
        }
      }),
    
    // Get project dependencies
    getByProject: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getProjectDependencies(input.projectId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get project dependencies');
        }
      }),
    
    // Delete dependency
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteTaskDependency(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete dependency');
        }
      }),
  }),
  
  // User Availability Router
  availability: router({
    // Set availability
    set: protectedProcedure
      .input(z.object({
        userId: z.number(),
        teamId: z.number(),
        startDate: z.date(),
        endDate: z.date(),
        status: z.enum(['available', 'busy', 'away', 'offline']),
        reason: z.string().optional(),
        isRecurring: z.boolean().optional(),
        recurrencePattern: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await setUserAvailability(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to set availability');
        }
      }),
    
    // Get user availability
    getByUser: protectedProcedure
      .input(z.object({
        userId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getUserAvailability(input.userId, {
            startDate: input.startDate,
            endDate: input.endDate,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get availability');
        }
      }),
    
    // Get team availability
    getByTeam: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getTeamAvailability(input.teamId, {
            startDate: input.startDate,
            endDate: input.endDate,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get team availability');
        }
      }),
    
    // Update availability
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        status: z.string().optional(),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { id, ...data } = input;
          return await updateUserAvailability(id, data);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update availability');
        }
      }),
    
    // Delete availability
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteUserAvailability(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete availability');
        }
      }),
  }),
  
  // Gantt Chart Router
  gantt: router({
    // Get Gantt chart data
    getData: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getGanttChartData(input.projectId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get Gantt data');
        }
      }),
  }),
  
  // Video Calls Router - Office Video Rooms & Calls
  videoCalls: router({
    // Start a call
    start: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        projectId: z.number().optional(),
        title: z.string(),
        description: z.string().optional(),
        callType: z.enum(['office_room', 'quick_huddle', 'scheduled_meeting', 'screen_share']),
        officeRole: z.string().optional(),
        integrationType: z.enum(['webrtc', 'zoom', 'google_meet', 'teams']).optional(),
        externalMeetingId: z.string().optional(),
        meetingUrl: z.string().optional(),
        meetingPassword: z.string().optional(),
        scheduledStartTime: z.date().optional(),
        screenSharingEnabled: z.boolean().optional(),
        recordingEnabled: z.boolean().optional(),
        chatEnabled: z.boolean().optional(),
        maxParticipants: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await startVideoCall({
            ...input,
            hostId: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to start call');
        }
      }),
    
    // Join a call
    join: protectedProcedure
      .input(z.object({
        callId: z.number(),
        isVideoOn: z.boolean().optional(),
        isMuted: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await joinVideoCall({
            ...input,
            userId: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to join call');
        }
      }),
    
    // Leave a call
    leave: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await leaveVideoCall({
            callId: input.callId,
            userId: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to leave call');
        }
      }),
    
    // End a call
    end: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await endVideoCall(input.callId, ctx.user.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to end call');
        }
      }),
    
    // Get call by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getVideoCallById(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get call');
        }
      }),
    
    // Get call by room ID
    getByRoomId: protectedProcedure
      .input(z.object({ roomId: z.string() }))
      .query(async ({ input }) => {
        try {
          return await getVideoCallByRoomId(input.roomId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get call');
        }
      }),
    
    // Get active calls
    getActive: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getActiveCalls(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get active calls');
        }
      }),
    
    // Get call history
    getHistory: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        callType: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getCallHistory(input.teamId, {
            startDate: input.startDate,
            endDate: input.endDate,
            callType: input.callType,
            limit: input.limit,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get call history');
        }
      }),
    
    // Get participants
    getParticipants: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getCallParticipants(input.callId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get participants');
        }
      }),
    
    // Update participant status
    updateParticipant: protectedProcedure
      .input(z.object({
        callId: z.number(),
        isMuted: z.boolean().optional(),
        isVideoOn: z.boolean().optional(),
        isSharingScreen: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await updateParticipantStatus({
            ...input,
            userId: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update status');
        }
      }),
    
    // Send message
    sendMessage: protectedProcedure
      .input(z.object({
        callId: z.number(),
        message: z.string(),
        messageType: z.string().optional(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await sendCallMessage({
            ...input,
            userId: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to send message');
        }
      }),
    
    // Get messages
    getMessages: protectedProcedure
      .input(z.object({
        callId: z.number(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getCallMessages(input.callId, input.limit);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get messages');
        }
      }),
    
    // Start recording
    startRecording: protectedProcedure
      .input(z.object({ callId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await startRecording(input.callId, ctx.user.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to start recording');
        }
      }),
    
    // Stop recording
    stopRecording: protectedProcedure
      .input(z.object({
        callId: z.number(),
        recordingUrl: z.string(),
        recordingDuration: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await stopRecording({
            ...input,
            hostId: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to stop recording');
        }
      }),
    
    // Get statistics
    getStatistics: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getCallStatistics(input.teamId, {
            startDate: input.startDate,
            endDate: input.endDate,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get statistics');
        }
      }),
  }),
  
  // Office Rooms Router
  officeRooms: router({
    // Create room
    create: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        officeRole: z.string(),
        isPublic: z.boolean().optional(),
        maxParticipants: z.number().optional(),
        screenSharingEnabled: z.boolean().optional(),
        recordingEnabled: z.boolean().optional(),
        chatEnabled: z.boolean().optional(),
        knockToEnter: z.boolean().optional(),
        allowedUsers: z.array(z.number()).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createOfficeRoom({
            ...input,
            createdBy: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create room');
        }
      }),
    
    // Get rooms
    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        officeRole: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getOfficeRooms(input.teamId, {
            officeRole: input.officeRole,
            isActive: input.isActive,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get rooms');
        }
      }),
    
    // Get room by ID
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getOfficeRoomById(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get room');
        }
      }),
    
    // Update room
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        maxParticipants: z.number().optional(),
        isPublic: z.boolean().optional(),
        allowedUsers: z.array(z.number()).optional(),
        screenSharingEnabled: z.boolean().optional(),
        recordingEnabled: z.boolean().optional(),
        chatEnabled: z.boolean().optional(),
        knockToEnter: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { id, ...data } = input;
          return await updateOfficeRoom(id, data);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update room');
        }
      }),
    
    // Delete room
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteOfficeRoom(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete room');
        }
      }),
  }),
  
  // NEW: Approvals Router - Decision Table / Quality Gate
  approvals: router({
    create: protectedProcedure
      .input(z.object({
        entityType: z.enum(['task', 'project', 'handoff']),
        entityId: z.number(),
        teamId: z.number(),
        fromStage: z.string().optional(),
        toStage: z.string().optional(),
        deliverables: z.any().optional(),
        comments: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await createApproval(input, ctx.user?.id!);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create approval');
        }
      }),
    
    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
        entityType: z.string().optional(),
        entityId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getApprovals(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch approvals');
        }
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getApprovalById(input.id);
      }),
    
    approve: protectedProcedure
      .input(z.object({
        approvalId: z.number(),
        comments: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await approveOrReject(input.approvalId, 'approved', ctx.user?.id!, input.comments);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to approve');
        }
      }),
    
    reject: protectedProcedure
      .input(z.object({
        approvalId: z.number(),
        comments: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await approveOrReject(input.approvalId, 'rejected', ctx.user?.id!, input.comments);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to reject');
        }
      }),
    
    vote: protectedProcedure
      .input(z.object({
        approvalId: z.number(),
        vote: z.enum(['for', 'against', 'abstain']),
        reason: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await castVote(input.approvalId, ctx.user?.id!, input.vote, input.reason);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to cast vote');
        }
      }),
    
    getPending: protectedProcedure
      .query(async ({ ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await getPendingApprovalsForUser(ctx.user.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch pending approvals');
        }
      }),
    
    configureTeam: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        approvalMode: z.enum(['boss', 'pm', 'team_vote']),
        bossUserId: z.number().optional(),
        pmUserId: z.number().optional(),
        voteThreshold: z.number().min(1).max(100).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await configureTeamApproval(input.teamId, input, ctx.user?.id!);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to configure team approval');
        }
      }),
  }),
  
  // NEW: Handoff Router - Sequential Workflow System
  handoff: router({
    handoffTask: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        toStage: z.enum(['ideation', 'design', 'business', 'development', 'testing', 'review', 'completed']),
        toRole: z.enum(['designer', 'business_strategist', 'backend_dev', 'frontend_dev', 'qa_tester', 'reviewer']),
        toUserId: z.number().optional(),
        deliverables: z.array(z.object({
          type: z.enum(['figma', 'github', 'pdf', 'link', 'document', 'image']),
          url: z.string(),
          description: z.string(),
          uploadedAt: z.string(),
          uploadedBy: z.number().optional(),
        })),
        comments: z.string().optional(),
        requiresApproval: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { taskId, ...handoffData } = input;
          return await handoffTask(taskId, handoffData, ctx.user?.id!);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to handoff task');
        }
      }),
    
    handoffProject: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        toStage: z.enum(['ideation', 'design', 'business', 'development', 'testing', 'review', 'completed']),
        toRole: z.enum(['designer', 'business_strategist', 'backend_dev', 'frontend_dev', 'qa_tester', 'reviewer']),
        toUserId: z.number().optional(),
        deliverables: z.array(z.object({
          type: z.enum(['figma', 'github', 'pdf', 'link', 'document', 'image']),
          url: z.string(),
          description: z.string(),
          uploadedAt: z.string(),
          uploadedBy: z.number().optional(),
        })),
        comments: z.string().optional(),
        requiresApproval: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const { projectId, ...handoffData } = input;
          return await handoffProject(projectId, handoffData, ctx.user?.id!);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to handoff project');
        }
      }),
    
    getTasksByRole: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        role: z.enum(['designer', 'business_strategist', 'backend_dev', 'frontend_dev', 'qa_tester', 'reviewer']),
        userId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getTasksByRole(input.teamId, input.role, input.userId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch tasks by role');
        }
      }),
    
    getProjectsByRole: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        role: z.enum(['designer', 'business_strategist', 'backend_dev', 'frontend_dev', 'qa_tester', 'reviewer']),
        userId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getProjectsByRole(input.teamId, input.role, input.userId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch projects by role');
        }
      }),
    
    getTasksByStage: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        stage: z.enum(['ideation', 'design', 'business', 'development', 'testing', 'review', 'completed']),
      }))
      .query(async ({ input }) => {
        try {
          return await getTasksByStage(input.teamId, input.stage);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch tasks by stage');
        }
      }),
    
    getProjectsByStage: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        stage: z.enum(['ideation', 'design', 'business', 'development', 'testing', 'review', 'completed']),
      }))
      .query(async ({ input }) => {
        try {
          return await getProjectsByStage(input.teamId, input.stage);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch projects by stage');
        }
      }),
    
    getMyWorkQueue: protectedProcedure
      .input(z.object({
        teamId: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await getMyWorkQueue(ctx.user.id, input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch work queue');
        }
      }),
    
    acceptHandoff: protectedProcedure
      .input(z.object({
        entityType: z.enum(['task', 'project']),
        entityId: z.number(),
        approvalId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await acceptHandoff(input.entityType, input.entityId, input.approvalId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to accept handoff');
        }
      }),
  }),
  
  // NEW: Workflow/Handoff Router - Sequential Handoff System
  workflow: router({
    getWorkspace: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        assignedRole: z.enum(['project_manager', 'lead_researcher', 'systems_architect', 'backend_engineer', 'fullstack_engineer', 'ai_engineer', 'qa_tester', 'designer']),
        entityType: z.enum(['task', 'project']).default('task'),
      }))
      .query(async ({ input }) => {
        try {
          return await getWorkspaceItems(input.teamId, input.assignedRole, input.entityType);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch workspace items');
        }
      }),
    
    getByStage: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        workflowStage: z.enum(['ideation', 'research', 'architecture', 'design', 'backend', 'fullstack', 'ai', 'testing', 'review', 'completed']),
        entityType: z.enum(['task', 'project']).default('task'),
      }))
      .query(async ({ input }) => {
        try {
          return await getItemsByStage(input.teamId, input.workflowStage, input.entityType);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch items by stage');
        }
      }),
    
    addDeliverable: protectedProcedure
      .input(z.object({
        entityType: z.enum(['task', 'project']),
        entityId: z.number(),
        deliverable: z.object({
          type: z.enum(['figma', 'github', 'pdf', 'link', 'document', 'image']),
          url: z.string().url(),
          description: z.string(),
          uploadedAt: z.string(),
        }),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await addDeliverable(
            input.entityType,
            input.entityId,
            input.deliverable,
            ctx.user?.id!
          );
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to add deliverable');
        }
      }),
    
    handoff: protectedProcedure
      .input(z.object({
        entityType: z.enum(['task', 'project']),
        entityId: z.number(),
        toStage: z.enum(['ideation', 'research', 'architecture', 'design', 'backend', 'fullstack', 'ai', 'testing', 'review', 'completed']),
        toRole: z.enum(['project_manager', 'lead_researcher', 'systems_architect', 'backend_engineer', 'fullstack_engineer', 'ai_engineer', 'qa_tester', 'designer']),
        toUserId: z.number().optional(),
        comments: z.string().optional(),
        requiresApproval: z.boolean().default(true),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          return await handoffToNextStage(
            input.entityType,
            input.entityId,
            {
              toStage: input.toStage,
              toRole: input.toRole,
              toUserId: input.toUserId,
              comments: input.comments,
              requiresApproval: input.requiresApproval,
            },
            ctx.user?.id!
          );
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to handoff');
        }
      }),
    
    completeHandoff: protectedProcedure
      .input(z.object({
        entityType: z.enum(['task', 'project']),
        entityId: z.number(),
        approvalId: z.number(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await completeHandoff(input.entityType, input.entityId, input.approvalId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to complete handoff');
        }
      }),
    
    getHistory: protectedProcedure
      .input(z.object({
        entityType: z.enum(['task', 'project']),
        entityId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getHandoffHistory(input.entityType, input.entityId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch handoff history');
        }
      }),
    
    getDeliverables: protectedProcedure
      .input(z.object({
        entityType: z.enum(['task', 'project']),
        entityId: z.number(),
        role: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getDeliverables(input.entityType, input.entityId, input.role);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch deliverables');
        }
      }),
    
    getSummary: protectedProcedure
      .input(z.object({
        teamId: z.number(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await getWorkspaceSummary(input.teamId, ctx.user.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch workspace summary');
        }
      }),
  }),
  
  // NEW: Evaluation Router - AI Project Evaluation
  evaluation: router({
    evaluate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          // Get project with all data
          const project = await getProjectById(input.projectId);
          if (!project) {
            throw new Error('Project not found');
          }

          // Run AI evaluation
          const evaluation = await evaluateProject(project as { id: number; name: string; ideationData?: any; deliverables?: any; handoffHistory?: any[] });

          // Save evaluation
          await saveProjectEvaluation(input.projectId, evaluation, ctx.user?.id!);

          return evaluation;
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to evaluate project');
        }
      }),
    
    get: protectedProcedure
      .input(z.object({
        projectId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getProjectEvaluation(input.projectId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch evaluation');
        }
      }),
    
    listEvaluated: protectedProcedure
      .input(z.object({
        teamId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getEvaluatedProjects(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch evaluated projects');
        }
      }),
    
    getReadyForLaunch: protectedProcedure
      .input(z.object({
        teamId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getProjectsReadyForLaunch(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch ready projects');
        }
      }),
    
    getStats: protectedProcedure
      .input(z.object({
        teamId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getEvaluationStats(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to fetch evaluation stats');
        }
      }),
    
    quickEvaluate: protectedProcedure
      .input(z.object({
        projectId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          const project = await getProjectById(input.projectId);
          if (!project) {
            throw new Error('Project not found');
          }
          return await quickEvaluate(project);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to quick evaluate');
        }
      }),
  }),

  // Notifications Router - Smart Notifications & Reminders
  notifications: router({
    // Get user notifications
    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        isRead: z.boolean().optional(),
        type: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await getNotifications(ctx.user.id, input.teamId, {
            isRead: input.isRead,
            type: input.type,
            limit: input.limit,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get notifications');
        }
      }),

    // Get unread count
    getUnreadCount: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await getUnreadCount(ctx.user.id, input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get unread count');
        }
      }),

    // Create notification
    create: protectedProcedure
      .input(z.object({
        userId: z.number(),
        teamId: z.number(),
        type: z.string(),
        title: z.string(),
        message: z.string(),
        priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
        taskId: z.number().optional(),
        projectId: z.number().optional(),
        fileId: z.number().optional(),
        folderId: z.number().optional(),
        actionUrl: z.string().optional(),
        actionLabel: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await createNotification(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create notification');
        }
      }),

    // Mark as read
    markAsRead: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await markNotificationAsRead(input.notificationId, ctx.user.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to mark as read');
        }
      }),

    // Mark all as read
    markAllAsRead: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await markAllAsRead(ctx.user.id, input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to mark all as read');
        }
      }),

    // Delete notification
    delete: protectedProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await deleteNotification(input.notificationId, ctx.user.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete notification');
        }
      }),

    // Get statistics
    getStatistics: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await getNotificationStatistics(ctx.user.id, input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get statistics');
        }
      }),

    // Register mobile push token (Expo push token for APNs / FCM delivery)
    registerPushToken: protectedProcedure
      .input(z.object({
        pushToken: z.string().min(1),
        platform: z.enum(['ios', 'android', 'web']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('User not authenticated');
        const { userPushTokens } = await import('../drizzle/schema');
        const db = await (await import('./db')).getDb();
        if (!db) throw new Error('Database not available');
        const { eq, and } = await import('drizzle-orm');
        // Upsert: if token already exists for this user, update; otherwise insert
        const existing = await db
          .select()
          .from(userPushTokens)
          .where(and(eq(userPushTokens.userId, ctx.user.id), eq(userPushTokens.pushToken, input.pushToken)))
          .limit(1);
        if (existing.length > 0) {
          await db
            .update(userPushTokens)
            .set({ platform: input.platform, updatedAt: new Date() })
            .where(eq(userPushTokens.id, existing[0].id));
        } else {
          await db.insert(userPushTokens).values({
            userId: ctx.user.id,
            pushToken: input.pushToken,
            platform: input.platform,
          });
        }
        return { success: true };
      }),
  }),

  // Notification Preferences Router
  notificationPreferences: router({
    // Get preferences
    get: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await getNotificationPreferences(ctx.user.id, input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get preferences');
        }
      }),

    // Update preferences
    update: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        emailEnabled: z.boolean().optional(),
        pushEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
        taskAssignments: z.boolean().optional(),
        taskDeadlines: z.boolean().optional(),
        mentions: z.boolean().optional(),
        approvalRequests: z.boolean().optional(),
        folderAlerts: z.boolean().optional(),
        projectUpdates: z.boolean().optional(),
        teamMessages: z.boolean().optional(),
        highPriorityOnly: z.boolean().optional(),
        quietHoursEnabled: z.boolean().optional(),
        quietHoursStart: z.string().optional(),
        quietHoursEnd: z.string().optional(),
        quietHoursTimezone: z.string().optional(),
        dailyDigestEnabled: z.boolean().optional(),
        dailyDigestTime: z.string().optional(),
        dailyDigestTimezone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await upsertNotificationPreferences({
            userId: ctx.user.id,
            ...input,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update preferences');
        }
      }),
  }),

  // Notification Rules Router
  notificationRules: router({
    // Create rule
    create: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        name: z.string(),
        description: z.string().optional(),
        ruleType: z.enum(['folder_idle', 'deadline_approaching', 'approval_pending', 'mention', 'task_assignment']),
        conditions: z.any().optional(),
        thresholdHours: z.number().optional(),
        thresholdDays: z.number().optional(),
        notificationType: z.string(),
        notificationPriority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await createNotificationRule({
            ...input,
            createdBy: ctx.user.id,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create rule');
        }
      }),

    // List rules
    list: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        isActive: z.boolean().optional(),
        ruleType: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getNotificationRules(input.teamId, {
            isActive: input.isActive,
            ruleType: input.ruleType,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get rules');
        }
      }),

    // Update rule
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        conditions: z.any().optional(),
        thresholdHours: z.number().optional(),
        thresholdDays: z.number().optional(),
        notificationPriority: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { id, ...data } = input;
          return await updateNotificationRule(id, data);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update rule');
        }
      }),

    // Delete rule
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await deleteNotificationRule(input.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to delete rule');
        }
      }),
  }),

  // Daily Digest Router
  dailyDigest: router({
    // Generate digest
    generate: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await generateDailyDigest(ctx.user.id, input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to generate digest');
        }
      }),

    // Queue digest
    queue: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        scheduledTime: z.date(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await queueDailyDigest(ctx.user.id, input.teamId, input.scheduledTime);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to queue digest');
        }
      }),

    // Get pending digests (admin only)
    getPending: protectedProcedure
      .query(async () => {
        try {
          return await getPendingDigests();
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get pending digests');
        }
      }),

    // Mark as sent (admin only)
    markAsSent: protectedProcedure
      .input(z.object({ digestId: z.number() }))
      .mutation(async ({ input }) => {
        try {
          return await markDigestAsSent(input.digestId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to mark as sent');
        }
      }),
  }),

  // Alert Checks Router - For automated checks
  alertChecks: router({
    // Check idle folders
    checkIdleFolders: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        thresholdHours: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await checkIdleFolders(input.teamId, input.thresholdHours);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to check idle folders');
        }
      }),

    // Check approaching deadlines
    checkDeadlines: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        thresholdDays: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await checkApproachingDeadlines(input.teamId, input.thresholdDays);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to check deadlines');
        }
      }),
  }),

  // Client Portal Router - Client-facing endpoints
  clientPortal: router({
    // Client login
    login: publicProcedure
      .input(z.object({
        email: z.string().email(),
        password: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await clientLogin(input.email, input.password);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Login failed');
        }
      }),

    // Verify token
    verifyToken: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(async ({ input }) => {
        try {
          return await verifyClientToken(input.token);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Invalid token');
        }
      }),

    // Get dashboard
    getDashboard: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getClientDashboard(input.clientId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get dashboard');
        }
      }),

    // Get projects
    getProjects: publicProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getClientProjects(input.clientId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get projects');
        }
      }),

    // Get project details
    getProjectDetails: publicProcedure
      .input(z.object({
        clientId: z.number(),
        projectId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getClientProjectDetails(input.clientId, input.projectId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get project details');
        }
      }),

    // Submit feedback
    submitFeedback: publicProcedure
      .input(z.object({
        clientId: z.number(),
        projectId: z.number(),
        teamId: z.number(),
        feedbackType: z.enum(['general', 'deliverable', 'milestone', 'approval']),
        subject: z.string(),
        message: z.string(),
        rating: z.number().min(1).max(5).optional(),
        deliverableId: z.number().optional(),
        fileId: z.number().optional(),
        attachments: z.any().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await createClientFeedback(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to submit feedback');
        }
      }),

    // Get feedback
    getFeedback: publicProcedure
      .input(z.object({
        clientId: z.number(),
        projectId: z.number().optional(),
        status: z.string().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getClientFeedback(input.clientId, {
            projectId: input.projectId,
            status: input.status,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get feedback');
        }
      }),

    // Get activity log
    getActivityLog: publicProcedure
      .input(z.object({
        clientId: z.number(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getClientActivityLog(input.clientId, input.limit);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get activity log');
        }
      }),

    // Change password
    changePassword: publicProcedure
      .input(z.object({
        clientId: z.number(),
        oldPassword: z.string(),
        newPassword: z.string(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await changeClientPassword(input.clientId, input.oldPassword, input.newPassword);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to change password');
        }
      }),
  }),

  // Client Portal Admin Router - Team management of client portal
  clientPortalAdmin: router({
    // Create client portal access
    createAccess: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        teamId: z.number(),
        email: z.string().email(),
        password: z.string(),
        canViewProjects: z.boolean().optional(),
        canViewDeliverables: z.boolean().optional(),
        canLeaveFeedback: z.boolean().optional(),
        canApprove: z.boolean().optional(),
        customLogo: z.string().optional(),
        brandColor: z.string().optional(),
        whiteLabel: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await createClientPortalAccess(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to create access');
        }
      }),

    // Get client access
    getAccess: protectedProcedure
      .input(z.object({ clientId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getClientPortalAccess(input.clientId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get access');
        }
      }),

    // Update client access
    updateAccess: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        isActive: z.boolean().optional(),
        canViewProjects: z.boolean().optional(),
        canViewDeliverables: z.boolean().optional(),
        canLeaveFeedback: z.boolean().optional(),
        canApprove: z.boolean().optional(),
        customLogo: z.string().optional(),
        brandColor: z.string().optional(),
        whiteLabel: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const { clientId, ...data } = input;
          return await updateClientPortalAccess(clientId, data);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to update access');
        }
      }),

    // Get team feedback
    getTeamFeedback: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        projectId: z.number().optional(),
        status: z.string().optional(),
        clientId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        try {
          return await getTeamFeedback(input.teamId, {
            projectId: input.projectId,
            status: input.status,
            clientId: input.clientId,
          });
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get feedback');
        }
      }),

    // Respond to feedback
    respondToFeedback: protectedProcedure
      .input(z.object({
        feedbackId: z.number(),
        response: z.string(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          if (!ctx.user?.id) {
            throw new Error('User not authenticated');
          }
          return await respondToFeedback(input.feedbackId, input.response, ctx.user.id);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to respond to feedback');
        }
      }),

    // Set project visibility
    setProjectVisibility: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        projectId: z.number(),
        teamId: z.number(),
        isVisible: z.boolean().optional(),
        canViewFiles: z.boolean().optional(),
        canDownloadFiles: z.boolean().optional(),
        canViewTasks: z.boolean().optional(),
        canViewTimeline: z.boolean().optional(),
        customStatus: z.string().optional(),
        customDescription: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          return await setProjectVisibility(input);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to set visibility');
        }
      }),

    // Get project visibility
    getProjectVisibility: protectedProcedure
      .input(z.object({
        clientId: z.number(),
        projectId: z.number(),
      }))
      .query(async ({ input }) => {
        try {
          return await getProjectVisibility(input.clientId, input.projectId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get visibility');
        }
      }),

    // Get client statistics
    getStatistics: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        try {
          return await getClientStatistics(input.teamId);
        } catch (error) {
          throw new Error(error instanceof Error ? error.message : 'Failed to get statistics');
        }
      }),
  }),

  // Security & Permissions Router - Comprehensive security management
  security: router({
    // Resource Permissions
    permissions: router({
      // Grant permission
      grant: protectedProcedure
        .input(z.object({
          teamId: z.number(),
          userId: z.number(),
          resourceType: z.enum(['project', 'task', 'file', 'folder', 'office', 'repository']),
          resourceId: z.number(),
          permission: z.enum(['read', 'write', 'admin', 'none']),
          expiresAt: z.date().optional(),
          reason: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          try {
            if (!ctx.user?.id) {
              throw new Error('User not authenticated');
            }
            return await grantResourcePermission({
              ...input,
              grantedBy: ctx.user.id,
            });
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to grant permission');
          }
        }),

      // Revoke permission
      revoke: protectedProcedure
        .input(z.object({ permissionId: z.number() }))
        .mutation(async ({ input, ctx }) => {
          try {
            if (!ctx.user?.id) {
              throw new Error('User not authenticated');
            }
            return await revokeResourcePermission(input.permissionId, ctx.user.id);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to revoke permission');
          }
        }),

      // Check permission
      check: protectedProcedure
        .input(z.object({
          userId: z.number(),
          resourceType: z.string(),
          resourceId: z.number(),
          requiredPermission: z.string(),
        }))
        .query(async ({ input }) => {
          try {
            return await checkResourcePermission(
              input.userId,
              input.resourceType,
              input.resourceId,
              input.requiredPermission
            );
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to check permission');
          }
        }),

      // Get user permissions
      getUserPermissions: protectedProcedure
        .input(z.object({
          userId: z.number(),
          resourceType: z.string().optional(),
        }))
        .query(async ({ input }) => {
          try {
            return await getUserResourcePermissions(input.userId, input.resourceType);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to get permissions');
          }
        }),
    }),

    // Office Access Control
    officeAccess: router({
      // Set office access
      set: protectedProcedure
        .input(z.object({
          teamId: z.number(),
          userId: z.number(),
          officeRole: z.string(),
          accessLevel: z.enum(['full', 'limited', 'view_only', 'none']),
          canViewTasks: z.boolean().optional(),
          canEditTasks: z.boolean().optional(),
          canDeleteTasks: z.boolean().optional(),
          canViewFiles: z.boolean().optional(),
          canUploadFiles: z.boolean().optional(),
          canDeleteFiles: z.boolean().optional(),
          canInviteMembers: z.boolean().optional(),
          canManagePermissions: z.boolean().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          try {
            if (!ctx.user?.id) {
              throw new Error('User not authenticated');
            }
            return await setOfficeAccessControl({
              ...input,
              grantedBy: ctx.user.id,
            });
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to set office access');
          }
        }),

      // Get office access
      get: protectedProcedure
        .input(z.object({
          userId: z.number(),
          officeRole: z.string(),
          teamId: z.number(),
        }))
        .query(async ({ input }) => {
          try {
            return await getOfficeAccessControl(input.userId, input.officeRole, input.teamId);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to get office access');
          }
        }),

      // Check office permission
      check: protectedProcedure
        .input(z.object({
          userId: z.number(),
          officeRole: z.string(),
          teamId: z.number(),
          permission: z.string(),
        }))
        .query(async ({ input }) => {
          try {
            return await checkOfficePermission(
              input.userId,
              input.officeRole,
              input.teamId,
              input.permission
            );
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to check permission');
          }
        }),
    }),

    // Audit Trail
    audit: router({
      // Get audit trail
      getTrail: protectedProcedure
        .input(z.object({
          teamId: z.number().optional(),
          userId: z.number().optional(),
          action: z.string().optional(),
          resourceType: z.string().optional(),
          status: z.string().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          flagged: z.boolean().optional(),
          limit: z.number().optional(),
        }))
        .query(async ({ input }) => {
          try {
            return await getSecurityAuditTrail(input);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to get audit trail');
          }
        }),

      // Export audit logs
      export: protectedProcedure
        .input(z.object({
          teamId: z.number().optional(),
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          format: z.enum(['json', 'csv']).optional(),
        }))
        .query(async ({ input }) => {
          try {
            return await exportAuditLogs(input);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to export logs');
          }
        }),
    }),

    // Two-Factor Authentication
    twoFactor: router({
      // Enable 2FA
      enable: protectedProcedure
        .input(z.object({
          userId: z.number(),
          method: z.enum(['totp', 'sms', 'email']),
        }))
        .mutation(async ({ input }) => {
          try {
            return await enable2FA(input.userId, input.method);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to enable 2FA');
          }
        }),

      // Verify 2FA token
      verify: protectedProcedure
        .input(z.object({
          userId: z.number(),
          token: z.string(),
        }))
        .mutation(async ({ input }) => {
          try {
            return await verify2FAToken(input.userId, input.token);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to verify token');
          }
        }),

      // Generate backup codes
      generateBackupCodes: protectedProcedure
        .input(z.object({ userId: z.number() }))
        .mutation(async ({ input }) => {
          try {
            return await generateBackupCodes(input.userId);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to generate codes');
          }
        }),
    }),

    // IP Whitelist
    ipWhitelist: router({
      // Add IP
      add: protectedProcedure
        .input(z.object({
          teamId: z.number(),
          ipAddress: z.string(),
          ipRange: z.string().optional(),
          label: z.string(),
          description: z.string().optional(),
          appliesToAllUsers: z.boolean().optional(),
          specificUsers: z.array(z.number()).optional(),
          expiresAt: z.date().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          try {
            if (!ctx.user?.id) {
              throw new Error('User not authenticated');
            }
            return await addIPToWhitelist({
              ...input,
              addedBy: ctx.user.id,
            });
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to add IP');
          }
        }),

      // Check IP
      check: protectedProcedure
        .input(z.object({
          teamId: z.number(),
          ipAddress: z.string(),
          userId: z.number().optional(),
        }))
        .query(async ({ input }) => {
          try {
            return await checkIPWhitelist(input.teamId, input.ipAddress, input.userId);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to check IP');
          }
        }),

      // Get whitelist
      list: protectedProcedure
        .input(z.object({ teamId: z.number() }))
        .query(async ({ input }) => {
          try {
            return await getIPWhitelist(input.teamId);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to get whitelist');
          }
        }),
    }),

    // Session Management
    sessions: router({
      // Get user sessions
      list: protectedProcedure
        .input(z.object({
          userId: z.number(),
          activeOnly: z.boolean().optional(),
        }))
        .query(async ({ input }) => {
          try {
            return await getUserSessions(input.userId, input.activeOnly);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to get sessions');
          }
        }),

      // Revoke session
      revoke: protectedProcedure
        .input(z.object({
          sessionId: z.number(),
          userId: z.number(),
        }))
        .mutation(async ({ input }) => {
          try {
            return await revokeSession(input.sessionId, input.userId);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to revoke session');
          }
        }),

      // Revoke all sessions
      revokeAll: protectedProcedure
        .input(z.object({
          userId: z.number(),
          exceptSessionId: z.number().optional(),
        }))
        .mutation(async ({ input }) => {
          try {
            return await revokeAllSessions(input.userId, input.exceptSessionId);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to revoke sessions');
          }
        }),
    }),

    // Role-Based Access Control
    roles: router({
      // Create role
      create: protectedProcedure
        .input(z.object({
          teamId: z.number(),
          name: z.string(),
          description: z.string().optional(),
          permissions: z.array(z.string()),
          level: z.number().optional(),
          inheritsFrom: z.number().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          try {
            if (!ctx.user?.id) {
              throw new Error('User not authenticated');
            }
            return await createPermissionRole({
              ...input,
              createdBy: ctx.user.id,
            });
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to create role');
          }
        }),

      // Assign role to user
      assign: protectedProcedure
        .input(z.object({
          userId: z.number(),
          roleId: z.number(),
          teamId: z.number(),
          expiresAt: z.date().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
          try {
            if (!ctx.user?.id) {
              throw new Error('User not authenticated');
            }
            return await assignRoleToUser({
              ...input,
              assignedBy: ctx.user.id,
            });
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to assign role');
          }
        }),

      // Get user roles
      getUserRoles: protectedProcedure
        .input(z.object({
          userId: z.number(),
          teamId: z.number(),
        }))
        .query(async ({ input }) => {
          try {
            return await getUserRoles(input.userId, input.teamId);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to get roles');
          }
        }),

      // Check role permission
      checkPermission: protectedProcedure
        .input(z.object({
          userId: z.number(),
          teamId: z.number(),
          permission: z.string(),
        }))
        .query(async ({ input }) => {
          try {
            return await checkRolePermission(input.userId, input.teamId, input.permission);
          } catch (error) {
            throw new Error(error instanceof Error ? error.message : 'Failed to check permission');
          }
        }),
    }),
  }),

  // Google Drive Integration Router - Team and Office-level Google Drive connections
  googleDrive: router({
    // Connect Team Google Drive
    connectTeam: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        driveUrl: z.string().url(),
        driveName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new Error('User not authenticated');
        }
        const { connectTeamGoogleDrive } = await import('./google-drive-service');
        return await connectTeamGoogleDrive({
          ...input,
          connectedBy: ctx.user.id,
        });
      }),

    // Connect Office Google Drive
    connectOffice: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        officeRole: z.string(),
        driveUrl: z.string().url(),
        driveName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) {
          throw new Error('User not authenticated');
        }
        const { connectOfficeGoogleDrive } = await import('./google-drive-service');
        return await connectOfficeGoogleDrive({
          ...input,
          userId: ctx.user.id,
          connectedBy: ctx.user.id,
        });
      }),

    // Get Team Google Drive
    getTeamDrive: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        const { getTeamGoogleDrive } = await import('./google-drive-service');
        return await getTeamGoogleDrive(input.teamId);
      }),

    // Get Office Google Drive
    getOfficeDrive: protectedProcedure
      .input(z.object({
        teamId: z.number(),
        officeRole: z.string(),
      }))
      .query(async ({ input }) => {
        const { getOfficeGoogleDrive } = await import('./google-drive-service');
        return await getOfficeGoogleDrive(input.teamId, input.officeRole);
      }),

    // Get All Team Google Drives
    getAllDrives: protectedProcedure
      .input(z.object({ teamId: z.number() }))
      .query(async ({ input }) => {
        const { getAllTeamGoogleDrives } = await import('./google-drive-service');
        return await getAllTeamGoogleDrives(input.teamId);
      }),

    // Disconnect Google Drive
    disconnect: protectedProcedure
      .input(z.object({ connectionId: z.number() }))
      .mutation(async ({ input }) => {
        const { disconnectGoogleDrive } = await import('./google-drive-service');
        return await disconnectGoogleDrive(input.connectionId);
      }),

    // Update Google Drive Connection
    update: protectedProcedure
      .input(z.object({
        connectionId: z.number(),
        driveUrl: z.string().url().optional(),
        driveName: z.string().optional(),
        autoSync: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { connectionId, ...data } = input;
        const { updateGoogleDriveConnection } = await import('./google-drive-service');
        return await updateGoogleDriveConnection(connectionId, data);
      }),

    // ── Drive API operations (requires GOOGLE_SERVICE_ACCOUNT_JSON) ──

    /** List files in a Google Drive folder */
    driveListFiles: protectedProcedure
      .input(z.object({
        folderId: z.string().min(1),
        teamId: z.number(),
      }))
      .query(async ({ input }) => {
        const { listDriveFiles } = await import('./google-drive-service');
        return await listDriveFiles(input.folderId);
      }),

    /** Upload a base64-encoded file to Google Drive */
    driveUploadFile: protectedProcedure
      .input(z.object({
        folderId: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        content: z.string().min(1), // base64
        teamId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        const { uploadDriveFile } = await import('./google-drive-service');
        const { getOAuthToken } = await import('./oauth-token-service');
        const googleToken = await getOAuthToken(ctx.user.id, 'google');
        return await uploadDriveFile({
          folderId: input.folderId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          content: input.content,
          userAccessToken: googleToken?.accessToken,
        });
      }),

    /** Delete a file from Google Drive */
    driveDeleteFile: protectedProcedure
      .input(z.object({
        fileId: z.string().min(1),
        teamId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        const { deleteDriveFile } = await import('./google-drive-service');
        await deleteDriveFile(input.fileId);
        return { success: true };
      }),

    /** Create a subfolder in Google Drive */
    driveCreateFolder: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        parentFolderId: z.string().min(1),
        teamId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        const { createDriveFolder } = await import('./google-drive-service');
        return await createDriveFolder(input.name, input.parentFolderId);
      }),

    /** Rename a file/folder in Google Drive */
    driveRenameFile: protectedProcedure
      .input(z.object({
        fileId: z.string().min(1),
        name: z.string().min(1),
        teamId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        const { updateDriveFile } = await import('./google-drive-service');
        return await updateDriveFile(input.fileId, { name: input.name });
      }),
  }),

  // ─── Direct Messaging (WhatsApp-style) ────────────────────────────────────────
  chat: router({
    /** Get list of conversations for the current member */
    getConversations: protectedProcedure
      .input(z.object({
        memberId: z.number(),
        teamId: z.number(),
      }))
      .query(async ({ input }) => {
        return await getChatConversations(input.memberId, input.teamId);
      }),

    /** Get messages between two members */
    getMessages: protectedProcedure
      .input(z.object({
        memberA: z.number(),
        memberB: z.number(),
        teamId: z.number(),
        limit: z.number().min(1).max(100).optional(),
        before: z.date().optional(),
      }))
      .query(async ({ input }) => {
        return await getChatMessages(
          input.memberA,
          input.memberB,
          input.teamId,
          input.limit ?? 50,
          input.before
        );
      }),

    /** Send a message */
    send: protectedProcedure
      .input(z.object({
        fromMemberId: z.number(),
        toMemberId: z.number(),
        teamId: z.number(),
        content: z.string().min(1).max(4000),
        messageType: z.enum(['text', 'image', 'file']).optional(),
        fileUrl: z.string().url().optional(),
        fileName: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        const msg = await sendChatMessage(
          input.fromMemberId,
          input.toMemberId,
          input.teamId,
          input.content,
          input.messageType ?? 'text',
          input.fileUrl,
          input.fileName
        );
        // Broadcast via socket
        try {
          const { getSocketServer } = await import('./socket-server');
          const io = getSocketServer();
          if (io) {
            io.to(`member:${input.toMemberId}`).emit('chatMessage', msg);
            io.to(`member:${input.fromMemberId}`).emit('chatMessage', msg);
          }
        } catch {}
        return msg;
      }),

    /** Mark messages from a sender as read */
    markRead: protectedProcedure
      .input(z.object({
        fromMemberId: z.number(),
        toMemberId: z.number(),
        teamId: z.number(),
      }))
      .mutation(async ({ input }) => {
        await markMessagesAsRead(input.fromMemberId, input.toMemberId, input.teamId);
        return { ok: true };
      }),
  }),

  admin: router({
    listUsers: protectedProcedure
      .query(async ({ ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const [caller] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (caller?.role !== 'admin') throw new Error('Admin access required');

        const allUsers = await listAllUsers();
        const usersWithMemberships = await Promise.all(
          allUsers.map(async (u) => ({
            ...u,
            memberships: await getUserTeamMemberships(u.id),
          }))
        );
        return usersWithMemberships;
      }),

    setSystemRole: protectedProcedure
      .input(z.object({ userId: z.number(), role: z.enum(['admin', 'user']) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const [caller] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (caller?.role !== 'admin') throw new Error('Admin access required');

        await setUserSystemRole(input.userId, input.role);

        // Notify affected user
        const [targetUser] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
        if (targetUser) {
          const [teamRow] = await db.select({ teamId: teamMembersCollaborative.teamId }).from(teamMembersCollaborative).where(eq(teamMembersCollaborative.memberId, input.userId)).limit(1);
          if (teamRow) {
            await sendNotification({
              userId: input.userId,
              teamId: teamRow.teamId,
              type: 'team_messages',
              title: input.role === 'admin' ? 'You are now an Admin' : 'Role Updated',
              message: input.role === 'admin' ? 'You have been granted admin access to the system.' : 'Your system role has been updated.',
              priority: 'high',
              actionUrl: '/',
              actionLabel: 'Go to Dashboard',
            });
          }
        }

        return { success: true };
      }),

    removeUser: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        if (input.userId === ctx.user.id) throw new Error('Cannot remove yourself');
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const [caller] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (caller?.role !== 'admin') throw new Error('Admin access required');

        await removeUserFromSystem(input.userId);
        return { success: true };
      }),

    addUser: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        email: z.string().email(),
        teamId: z.number(),
        role: z.string().default('developer'),
        officeRole: z.string().default('fullstack_engineer'),
        position: z.string().default('Team Member'),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user?.id) throw new Error('Not authenticated');
        const db = await getDb();
        if (!db) throw new Error('Database unavailable');
        const [caller] = await db.select({ role: users.role }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
        if (caller?.role !== 'admin') throw new Error('Admin access required');

        return await addUserToSystem(input);
      }),
  }),
});

export type AppRouter = typeof appRouter;
