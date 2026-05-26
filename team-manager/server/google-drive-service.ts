import { getDb } from "./db";
import { googleDriveConnections, googleDriveFilesCache, teamMembers } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Google Drive Service
 * Handles Google Drive integration for teams and individual offices
 */

// Connect Team Google Drive
export async function connectTeamGoogleDrive(data: {
  teamId: number;
  driveUrl: string;
  driveName?: string;
  connectedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [connection] = await db.insert(googleDriveConnections).values({
    teamId: data.teamId,
    connectionType: 'team',
    driveUrl: data.driveUrl,
    driveName: data.driveName || 'Team Drive',
    connectedBy: data.connectedBy,
    isActive: true,
  }).returning();

  return connection;
}

// Connect Office Google Drive
export async function connectOfficeGoogleDrive(data: {
  teamId: number;
  userId: number;
  officeRole: string;
  driveUrl: string;
  driveName?: string;
  connectedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if connection already exists for this office
  const existing = await db.select()
    .from(googleDriveConnections)
    .where(
      and(
        eq(googleDriveConnections.teamId, data.teamId),
        eq(googleDriveConnections.officeRole, data.officeRole),
        eq(googleDriveConnections.connectionType, 'office')
      )
    );

  if (existing.length > 0) {
    // Update existing connection
    const [updated] = await db.update(googleDriveConnections)
      .set({
        driveUrl: data.driveUrl,
        driveName: data.driveName || `${data.officeRole} Office Drive`,
        userId: data.userId,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(googleDriveConnections.id, existing[0].id))
      .returning();
    
    return updated;
  }

  // Create new connection
  const [connection] = await db.insert(googleDriveConnections).values({
    teamId: data.teamId,
    userId: data.userId,
    officeRole: data.officeRole,
    connectionType: 'office',
    driveUrl: data.driveUrl,
    driveName: data.driveName || `${data.officeRole} Office Drive`,
    connectedBy: data.connectedBy,
    isActive: true,
  }).returning();

  return connection;
}

// Get Team Google Drive Connection
export async function getTeamGoogleDrive(teamId: number) {
  const db = await getDb();
  if (!db) return null;

  const [connection] = await db.select()
    .from(googleDriveConnections)
    .where(
      and(
        eq(googleDriveConnections.teamId, teamId),
        eq(googleDriveConnections.connectionType, 'team'),
        eq(googleDriveConnections.isActive, true)
      )
    )
    .orderBy(desc(googleDriveConnections.createdAt))
    .limit(1);

  return connection || null;
}

// Get Office Google Drive Connection
export async function getOfficeGoogleDrive(teamId: number, officeRole: string) {
  const db = await getDb();
  if (!db) return null;

  const [connection] = await db.select()
    .from(googleDriveConnections)
    .where(
      and(
        eq(googleDriveConnections.teamId, teamId),
        eq(googleDriveConnections.officeRole, officeRole),
        eq(googleDriveConnections.connectionType, 'office'),
        eq(googleDriveConnections.isActive, true)
      )
    )
    .orderBy(desc(googleDriveConnections.createdAt))
    .limit(1);

  return connection || null;
}

// Get All Google Drive Connections for a Team
export async function getAllTeamGoogleDrives(teamId: number) {
  const db = await getDb();
  if (!db) return [];

  const connections = await db.select()
    .from(googleDriveConnections)
    .where(
      and(
        eq(googleDriveConnections.teamId, teamId),
        eq(googleDriveConnections.isActive, true)
      )
    )
    .orderBy(desc(googleDriveConnections.createdAt));

  return connections;
}

// Disconnect Google Drive
export async function disconnectGoogleDrive(connectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db.update(googleDriveConnections)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(googleDriveConnections.id, connectionId))
    .returning();

  return updated;
}

// Update Google Drive Connection
export async function updateGoogleDriveConnection(connectionId: number, data: {
  driveUrl?: string;
  driveName?: string;
  autoSync?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [updated] = await db.update(googleDriveConnections)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(googleDriveConnections.id, connectionId))
    .returning();

  return updated;
}

// Get Google Drive Connection by ID
export async function getGoogleDriveConnection(connectionId: number) {
  const db = await getDb();
  if (!db) return null;

  const [connection] = await db.select()
    .from(googleDriveConnections)
    .where(eq(googleDriveConnections.id, connectionId));

  return connection || null;
}

// Cache Google Drive File
export async function cacheGoogleDriveFile(data: {
  connectionId: number;
  googleFileId: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  parentFolderId?: string;
  folderPath?: string;
  createdTime?: Date;
  modifiedTime?: Date;
  owners?: any;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Check if file already cached
  const existing = await db.select()
    .from(googleDriveFilesCache)
    .where(eq(googleDriveFilesCache.googleFileId, data.googleFileId));

  if (existing.length > 0) {
    // Update existing cache
    const [updated] = await db.update(googleDriveFilesCache)
      .set({
        fileName: data.fileName,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
        webViewLink: data.webViewLink,
        webContentLink: data.webContentLink,
        thumbnailLink: data.thumbnailLink,
        parentFolderId: data.parentFolderId,
        folderPath: data.folderPath,
        modifiedTime: data.modifiedTime,
        owners: data.owners,
        lastFetchedAt: new Date(),
      })
      .where(eq(googleDriveFilesCache.id, existing[0].id))
      .returning();
    
    return updated;
  }

  // Create new cache entry
  const [cached] = await db.insert(googleDriveFilesCache).values({
    connectionId: data.connectionId,
    googleFileId: data.googleFileId,
    fileName: data.fileName,
    mimeType: data.mimeType,
    fileSize: data.fileSize,
    webViewLink: data.webViewLink,
    webContentLink: data.webContentLink,
    thumbnailLink: data.thumbnailLink,
    parentFolderId: data.parentFolderId,
    folderPath: data.folderPath,
    createdTime: data.createdTime,
    modifiedTime: data.modifiedTime,
    owners: data.owners,
  }).returning();

  return cached;
}

// Get Cached Google Drive Files
export async function getCachedGoogleDriveFiles(connectionId: number) {
  const db = await getDb();
  if (!db) return [];

  const files = await db.select()
    .from(googleDriveFilesCache)
    .where(eq(googleDriveFilesCache.connectionId, connectionId))
    .orderBy(desc(googleDriveFilesCache.modifiedTime));

  return files;
}
