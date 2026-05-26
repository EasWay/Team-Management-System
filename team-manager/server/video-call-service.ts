import { db } from "./db";
import { videoCalls, callParticipants, callMessages, officeRooms } from "../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import crypto from "crypto";

/**
 * Video Call Service
 * Handles video calls, office rooms, and real-time communication
 */

/**
 * Generate unique room ID
 */
function generateRoomId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Create office room
 */
export async function createOfficeRoom(data: {
  teamId: number;
  name: string;
  description?: string;
  officeRole: string;
  isPublic?: boolean;
  maxParticipants?: number;
  screenSharingEnabled?: boolean;
  recordingEnabled?: boolean;
  chatEnabled?: boolean;
  knockToEnter?: boolean;
  allowedUsers?: number[];
  createdBy: number;
}) {
  try {
    const [room] = await db.insert(officeRooms).values(data).returning();
    return room;
  } catch (error) {
    console.error('Error creating office room:', error);
    throw new Error('Failed to create office room');
  }
}

/**
 * Get office rooms for a team
 */
export async function getOfficeRooms(teamId: number, filters?: {
  officeRole?: string;
  isActive?: boolean;
}) {
  try {
    const conditions = [eq(officeRooms.teamId, teamId)];
    
    if (filters?.officeRole) {
      conditions.push(eq(officeRooms.officeRole, filters.officeRole));
    }
    
    if (filters?.isActive !== undefined) {
      conditions.push(eq(officeRooms.isActive, filters.isActive));
    }
    
    const rooms = await db.select()
      .from(officeRooms)
      .where(and(...conditions))
      .orderBy(officeRooms.name);
    
    return rooms;
  } catch (error) {
    console.error('Error getting office rooms:', error);
    throw new Error('Failed to get office rooms');
  }
}

/**
 * Get office room by ID
 */
export async function getOfficeRoomById(roomId: number) {
  try {
    const [room] = await db.select().from(officeRooms).where(eq(officeRooms.id, roomId));
    return room;
  } catch (error) {
    console.error('Error getting office room:', error);
    throw new Error('Failed to get office room');
  }
}

/**
 * Update office room
 */
export async function updateOfficeRoom(roomId: number, data: Partial<{
  name: string;
  description: string;
  isActive: boolean;
  maxParticipants: number;
  isPublic: boolean;
  allowedUsers: number[];
  screenSharingEnabled: boolean;
  recordingEnabled: boolean;
  chatEnabled: boolean;
  knockToEnter: boolean;
}>) {
  try {
    const [room] = await db.update(officeRooms)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(officeRooms.id, roomId))
      .returning();
    
    return room;
  } catch (error) {
    console.error('Error updating office room:', error);
    throw new Error('Failed to update office room');
  }
}

/**
 * Delete office room
 */
export async function deleteOfficeRoom(roomId: number) {
  try {
    await db.delete(officeRooms).where(eq(officeRooms.id, roomId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting office room:', error);
    throw new Error('Failed to delete office room');
  }
}

/**
 * Start a video call
 */
export async function startVideoCall(data: {
  teamId: number;
  projectId?: number;
  title: string;
  description?: string;
  callType: string;
  officeRole?: string;
  hostId: number;
  integrationType?: string;
  externalMeetingId?: string;
  meetingUrl?: string;
  meetingPassword?: string;
  scheduledStartTime?: Date;
  screenSharingEnabled?: boolean;
  recordingEnabled?: boolean;
  chatEnabled?: boolean;
  maxParticipants?: number;
}) {
  try {
    const roomId = generateRoomId();
    
    const [call] = await db.insert(videoCalls).values({
      ...data,
      roomId,
      status: 'active',
      actualStartTime: new Date(),
    }).returning();
    
    // Add host as first participant
    await db.insert(callParticipants).values({
      callId: call.id,
      userId: data.hostId,
      joinedAt: new Date(),
      isVideoOn: true,
      isMuted: false,
    });
    
    // Update office room if this is an office room call
    if (data.officeRole) {
      const [room] = await db.select()
        .from(officeRooms)
        .where(
          and(
            eq(officeRooms.teamId, data.teamId),
            eq(officeRooms.officeRole, data.officeRole)
          )
        );
      
      if (room) {
        await db.update(officeRooms)
          .set({
            currentCallId: call.id,
            activeParticipants: 1,
          })
          .where(eq(officeRooms.id, room.id));
      }
    }
    
    return call;
  } catch (error) {
    console.error('Error starting video call:', error);
    throw new Error('Failed to start video call');
  }
}

/**
 * Join a video call
 */
export async function joinVideoCall(data: {
  callId: number;
  userId: number;
  isVideoOn?: boolean;
  isMuted?: boolean;
}) {
  try {
    // Check if user is already in the call
    const [existing] = await db.select()
      .from(callParticipants)
      .where(
        and(
          eq(callParticipants.callId, data.callId),
          eq(callParticipants.userId, data.userId),
          sql`${callParticipants.leftAt} IS NULL`
        )
      );
    
    if (existing) {
      return existing;
    }
    
    // Add participant
    const [participant] = await db.insert(callParticipants).values({
      callId: data.callId,
      userId: data.userId,
      joinedAt: new Date(),
      isVideoOn: data.isVideoOn ?? true,
      isMuted: data.isMuted ?? false,
    }).returning();
    
    // Update active participants count
    const [call] = await db.select().from(videoCalls).where(eq(videoCalls.id, data.callId));
    
    if (call?.officeRole) {
      await db.execute(sql`
        UPDATE ${officeRooms}
        SET active_participants = active_participants + 1
        WHERE team_id = ${call.teamId}
        AND office_role = ${call.officeRole}
      `);
    }
    
    return participant;
  } catch (error) {
    console.error('Error joining video call:', error);
    throw new Error('Failed to join video call');
  }
}

/**
 * Leave a video call
 */
export async function leaveVideoCall(data: {
  callId: number;
  userId: number;
}) {
  try {
    const [participant] = await db.select()
      .from(callParticipants)
      .where(
        and(
          eq(callParticipants.callId, data.callId),
          eq(callParticipants.userId, data.userId),
          sql`${callParticipants.leftAt} IS NULL`
        )
      );
    
    if (!participant) {
      throw new Error('Participant not found in call');
    }
    
    const leftAt = new Date();
    const duration = Math.floor((leftAt.getTime() - new Date(participant.joinedAt).getTime()) / 1000);
    
    await db.update(callParticipants)
      .set({
        leftAt,
        duration,
      })
      .where(eq(callParticipants.id, participant.id));
    
    // Update active participants count
    const [call] = await db.select().from(videoCalls).where(eq(videoCalls.id, data.callId));
    
    if (call?.officeRole) {
      await db.execute(sql`
        UPDATE ${officeRooms}
        SET active_participants = GREATEST(active_participants - 1, 0)
        WHERE team_id = ${call.teamId}
        AND office_role = ${call.officeRole}
      `);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error leaving video call:', error);
    throw new Error('Failed to leave video call');
  }
}

/**
 * End a video call
 */
export async function endVideoCall(callId: number, hostId: number) {
  try {
    const [call] = await db.select().from(videoCalls).where(eq(videoCalls.id, callId));
    
    if (!call) {
      throw new Error('Call not found');
    }
    
    if (call.hostId !== hostId) {
      throw new Error('Only the host can end the call');
    }
    
    const endTime = new Date();
    const duration = call.actualStartTime
      ? Math.floor((endTime.getTime() - new Date(call.actualStartTime).getTime()) / 1000)
      : 0;
    
    // Update call status
    await db.update(videoCalls)
      .set({
        status: 'ended',
        endTime,
        duration,
      })
      .where(eq(videoCalls.id, callId));
    
    // End all active participants
    await db.execute(sql`
      UPDATE ${callParticipants}
      SET left_at = ${endTime},
          duration = EXTRACT(EPOCH FROM (${endTime} - joined_at))
      WHERE call_id = ${callId}
      AND left_at IS NULL
    `);
    
    // Update office room
    if (call.officeRole) {
      await db.update(officeRooms)
        .set({
          currentCallId: null,
          activeParticipants: 0,
        })
        .where(
          and(
            eq(officeRooms.teamId, call.teamId),
            eq(officeRooms.officeRole, call.officeRole)
          )
        );
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error ending video call:', error);
    throw error;
  }
}

/**
 * Get video call by ID
 */
export async function getVideoCallById(callId: number) {
  try {
    const [call] = await db.select().from(videoCalls).where(eq(videoCalls.id, callId));
    return call;
  } catch (error) {
    console.error('Error getting video call:', error);
    throw new Error('Failed to get video call');
  }
}

/**
 * Get video call by room ID
 */
export async function getVideoCallByRoomId(roomId: string) {
  try {
    const [call] = await db.select().from(videoCalls).where(eq(videoCalls.roomId, roomId));
    return call;
  } catch (error) {
    console.error('Error getting video call by room ID:', error);
    throw new Error('Failed to get video call');
  }
}

/**
 * Get active calls for a team
 */
export async function getActiveCalls(teamId: number) {
  try {
    const calls = await db.select()
      .from(videoCalls)
      .where(
        and(
          eq(videoCalls.teamId, teamId),
          eq(videoCalls.status, 'active')
        )
      )
      .orderBy(desc(videoCalls.actualStartTime));
    
    return calls;
  } catch (error) {
    console.error('Error getting active calls:', error);
    throw new Error('Failed to get active calls');
  }
}

/**
 * Get call history for a team
 */
export async function getCallHistory(teamId: number, filters?: {
  startDate?: Date;
  endDate?: Date;
  callType?: string;
  limit?: number;
}) {
  try {
    const conditions = [eq(videoCalls.teamId, teamId)];
    
    if (filters?.startDate) {
      conditions.push(sql`${videoCalls.actualStartTime} >= ${filters.startDate}`);
    }
    
    if (filters?.endDate) {
      conditions.push(sql`${videoCalls.actualStartTime} <= ${filters.endDate}`);
    }
    
    if (filters?.callType) {
      conditions.push(eq(videoCalls.callType, filters.callType));
    }
    
    let query = db.select()
      .from(videoCalls)
      .where(and(...conditions))
      .orderBy(desc(videoCalls.actualStartTime));
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    const calls = await query;
    return calls;
  } catch (error) {
    console.error('Error getting call history:', error);
    throw new Error('Failed to get call history');
  }
}

/**
 * Get call participants
 */
export async function getCallParticipants(callId: number) {
  try {
    const participants = await db.select()
      .from(callParticipants)
      .where(eq(callParticipants.callId, callId))
      .orderBy(callParticipants.joinedAt);
    
    return participants;
  } catch (error) {
    console.error('Error getting call participants:', error);
    throw new Error('Failed to get call participants');
  }
}

/**
 * Update participant status
 */
export async function updateParticipantStatus(data: {
  callId: number;
  userId: number;
  isMuted?: boolean;
  isVideoOn?: boolean;
  isSharingScreen?: boolean;
}) {
  try {
    const [participant] = await db.select()
      .from(callParticipants)
      .where(
        and(
          eq(callParticipants.callId, data.callId),
          eq(callParticipants.userId, data.userId),
          sql`${callParticipants.leftAt} IS NULL`
        )
      );
    
    if (!participant) {
      throw new Error('Participant not found in active call');
    }
    
    const updates: any = {};
    if (data.isMuted !== undefined) updates.isMuted = data.isMuted;
    if (data.isVideoOn !== undefined) updates.isVideoOn = data.isVideoOn;
    if (data.isSharingScreen !== undefined) updates.isSharingScreen = data.isSharingScreen;
    
    await db.update(callParticipants)
      .set(updates)
      .where(eq(callParticipants.id, participant.id));
    
    return { success: true };
  } catch (error) {
    console.error('Error updating participant status:', error);
    throw new Error('Failed to update participant status');
  }
}

/**
 * Send call message
 */
export async function sendCallMessage(data: {
  callId: number;
  userId: number;
  message: string;
  messageType?: string;
  fileUrl?: string;
  fileName?: string;
}) {
  try {
    const [msg] = await db.insert(callMessages).values(data).returning();
    return msg;
  } catch (error) {
    console.error('Error sending call message:', error);
    throw new Error('Failed to send call message');
  }
}

/**
 * Get call messages
 */
export async function getCallMessages(callId: number, limit?: number) {
  try {
    let query = db.select()
      .from(callMessages)
      .where(eq(callMessages.callId, callId))
      .orderBy(callMessages.createdAt);
    
    if (limit) {
      query = query.limit(limit) as any;
    }
    
    const messages = await query;
    return messages;
  } catch (error) {
    console.error('Error getting call messages:', error);
    throw new Error('Failed to get call messages');
  }
}

/**
 * Start recording
 */
export async function startRecording(callId: number, hostId: number) {
  try {
    const [call] = await db.select().from(videoCalls).where(eq(videoCalls.id, callId));
    
    if (!call) {
      throw new Error('Call not found');
    }
    
    if (call.hostId !== hostId) {
      throw new Error('Only the host can start recording');
    }
    
    await db.update(videoCalls)
      .set({ isRecorded: true })
      .where(eq(videoCalls.id, callId));
    
    return { success: true };
  } catch (error) {
    console.error('Error starting recording:', error);
    throw error;
  }
}

/**
 * Stop recording
 */
export async function stopRecording(data: {
  callId: number;
  hostId: number;
  recordingUrl: string;
  recordingDuration: number;
}) {
  try {
    const [call] = await db.select().from(videoCalls).where(eq(videoCalls.id, data.callId));
    
    if (!call) {
      throw new Error('Call not found');
    }
    
    if (call.hostId !== data.hostId) {
      throw new Error('Only the host can stop recording');
    }
    
    await db.update(videoCalls)
      .set({
        recordingUrl: data.recordingUrl,
        recordingDuration: data.recordingDuration,
      })
      .where(eq(videoCalls.id, data.callId));
    
    return { success: true };
  } catch (error) {
    console.error('Error stopping recording:', error);
    throw error;
  }
}

/**
 * Get call statistics
 */
export async function getCallStatistics(teamId: number, filters?: {
  startDate?: Date;
  endDate?: Date;
}) {
  try {
    const conditions = [eq(videoCalls.teamId, teamId)];
    
    if (filters?.startDate) {
      conditions.push(sql`${videoCalls.actualStartTime} >= ${filters.startDate}`);
    }
    
    if (filters?.endDate) {
      conditions.push(sql`${videoCalls.actualStartTime} <= ${filters.endDate}`);
    }
    
    const stats = await db.select({
      totalCalls: sql<number>`count(*)`,
      totalDuration: sql<number>`sum(${videoCalls.duration})`,
      avgDuration: sql<number>`avg(${videoCalls.duration})`,
      totalRecorded: sql<number>`count(*) FILTER (WHERE ${videoCalls.isRecorded} = true)`,
      callsByType: sql<any>`json_object_agg(${videoCalls.callType}, count(*))`,
    })
    .from(videoCalls)
    .where(and(...conditions));
    
    return stats[0];
  } catch (error) {
    console.error('Error getting call statistics:', error);
    throw new Error('Failed to get call statistics');
  }
}
