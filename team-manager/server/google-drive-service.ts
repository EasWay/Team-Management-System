import { getDb } from "./db";
import { googleDriveConnections, googleDriveFilesCache, teamMembers } from "../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { google } from "googleapis";
import { Readable } from "stream";

// ─── Drive API helpers ────────────────────────────────────────────────────────

/** Extract the Google Drive folder ID from a Drive URL. */
export function extractFolderIdFromUrl(url: string): string | null {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Build a GoogleAuth client from the service-account JSON stored in env. */
function getAuthClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is not set");
  const credentials = JSON.parse(raw);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

function getDriveClient() {
  return google.drive({ version: "v3", auth: getAuthClient() });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
  thumbnailLink?: string | null;
  createdTime?: string | null;
  modifiedTime?: string | null;
  parents?: string[] | null;
}

/** List files / subfolders in a Google Drive folder. */
export async function listDriveFiles(folderId: string): Promise<DriveFile[]> {
  const drive = getDriveClient();
  const resp = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields:
      "files(id,name,mimeType,size,webViewLink,webContentLink,thumbnailLink,createdTime,modifiedTime,parents)",
    orderBy: "folder,name",
    pageSize: 200,
  });
  return (resp.data.files ?? []) as DriveFile[];
}

/** Upload a base64-encoded file to a Google Drive folder. */
export async function uploadDriveFile(data: {
  folderId: string;
  fileName: string;
  mimeType: string;
  content: string; // base64
}): Promise<DriveFile> {
  const drive = getDriveClient();
  const buffer = Buffer.from(data.content, "base64");
  const stream = Readable.from(buffer);
  const resp = await drive.files.create({
    requestBody: { name: data.fileName, parents: [data.folderId] },
    media: { mimeType: data.mimeType, body: stream },
    fields: "id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime",
  });
  return resp.data as DriveFile;
}

/** Permanently delete a file from Google Drive. */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const drive = getDriveClient();
  await drive.files.delete({ fileId });
}

/** Create a subfolder inside a Google Drive folder. */
export async function createDriveFolder(
  name: string,
  parentFolderId: string,
): Promise<DriveFile> {
  const drive = getDriveClient();
  const resp = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    },
    fields: "id,name,mimeType,webViewLink,createdTime",
  });
  return resp.data as DriveFile;
}

/** Rename / move a file. */
export async function updateDriveFile(
  fileId: string,
  update: { name?: string },
): Promise<DriveFile> {
  const drive = getDriveClient();
  const resp = await drive.files.update({
    fileId,
    requestBody: update,
    fields: "id,name,mimeType,size,webViewLink,webContentLink,modifiedTime",
  });
  return resp.data as DriveFile;
}

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
