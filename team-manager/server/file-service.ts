import { db } from "./db";
import { files, fileFolders, fileVersions, fileComments, fileShares } from "../drizzle/schema";
import { eq, and, desc, sql, like, or, inArray } from "drizzle-orm";
import { uploadToS3, deleteFromS3, getSignedUrl } from "./storage";
import path from "path";
import crypto from "crypto";

/**
 * File Service
 * Handles file uploads, versioning, organization, and management
 */

// Supported file types and their categories
const FILE_TYPE_MAP: Record<string, string> = {
  // Images
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'image/svg+xml': 'image',
  
  // Documents
  'application/pdf': 'pdf',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
  'application/vnd.ms-excel': 'document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
  'application/vnd.ms-powerpoint': 'document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'document',
  'text/plain': 'document',
  
  // Videos
  'video/mp4': 'video',
  'video/mpeg': 'video',
  'video/quicktime': 'video',
  'video/x-msvideo': 'video',
  'video/webm': 'video',
  
  // Code files
  'text/javascript': 'code',
  'text/typescript': 'code',
  'text/html': 'code',
  'text/css': 'code',
  'application/json': 'code',
  'application/xml': 'code',
  'text/x-python': 'code',
  'text/x-java': 'code',
  'text/x-c': 'code',
  'text/x-cpp': 'code',
  
  // Archives
  'application/zip': 'archive',
  'application/x-rar-compressed': 'archive',
  'application/x-7z-compressed': 'archive',
  'application/x-tar': 'archive',
};

function getFileType(mimeType: string): string {
  return FILE_TYPE_MAP[mimeType] || 'other';
}

function generateFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  return `${timestamp}-${hash}${ext}`;
}

/**
 * Upload a file
 */
export async function uploadFile(data: {
  teamId: number;
  projectId?: number;
  taskId?: number;
  folderId?: number;
  file: {
    originalName: string;
    buffer: Buffer;
    mimeType: string;
    size: number;
  };
  uploadedBy: number;
  tags?: string[];
  description?: string;
}) {
  try {
    const fileName = generateFileName(data.file.originalName);
    const fileType = getFileType(data.file.mimeType);
    
    // Upload to S3 (or local storage)
    const fileUrl = await uploadToS3(fileName, data.file.buffer, data.file.mimeType);
    
    // Generate thumbnail for images/videos if needed
    let thumbnailUrl: string | null = null;
    if (fileType === 'image' || fileType === 'video') {
      // TODO: Implement thumbnail generation
      thumbnailUrl = null;
    }
    
    // Insert file record
    const [file] = await db.insert(files).values({
      teamId: data.teamId,
      projectId: data.projectId,
      taskId: data.taskId,
      folderId: data.folderId,
      fileName,
      originalName: data.file.originalName,
      fileSize: data.file.size,
      mimeType: data.file.mimeType,
      fileType,
      fileUrl,
      thumbnailUrl,
      tags: data.tags || [],
      description: data.description,
      version: 1,
      isLatestVersion: true,
      uploadedBy: data.uploadedBy,
    }).returning();
    
    // Create initial version record
    await db.insert(fileVersions).values({
      fileId: file.id,
      version: 1,
      fileUrl,
      fileSize: data.file.size,
      uploadedBy: data.uploadedBy,
      changeDescription: 'Initial upload',
    });
    
    return file;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error('Failed to upload file');
  }
}

/**
 * Upload a new version of an existing file
 */
export async function uploadFileVersion(data: {
  fileId: number;
  file: {
    originalName: string;
    buffer: Buffer;
    mimeType: string;
    size: number;
  };
  uploadedBy: number;
  changeDescription?: string;
}) {
  try {
    // Get existing file
    const [existingFile] = await db.select().from(files).where(eq(files.id, data.fileId));
    
    if (!existingFile) {
      throw new Error('File not found');
    }
    
    const fileName = generateFileName(data.file.originalName);
    const fileUrl = await uploadToS3(fileName, data.file.buffer, data.file.mimeType);
    
    const newVersion = existingFile.version + 1;
    
    // Mark old version as not latest
    await db.update(files)
      .set({ isLatestVersion: false })
      .where(eq(files.id, data.fileId));
    
    // Update file with new version
    const [updatedFile] = await db.update(files)
      .set({
        fileName,
        fileUrl,
        fileSize: data.file.size,
        version: newVersion,
        isLatestVersion: true,
        parentFileId: data.fileId,
        updatedAt: new Date(),
      })
      .where(eq(files.id, data.fileId))
      .returning();
    
    // Create version record
    await db.insert(fileVersions).values({
      fileId: data.fileId,
      version: newVersion,
      fileUrl,
      fileSize: data.file.size,
      uploadedBy: data.uploadedBy,
      changeDescription: data.changeDescription || `Version ${newVersion}`,
    });
    
    return updatedFile;
  } catch (error) {
    console.error('Error uploading file version:', error);
    throw new Error('Failed to upload file version');
  }
}

/**
 * Get files by team
 */
export async function getFilesByTeam(teamId: number, filters?: {
  projectId?: number;
  taskId?: number;
  folderId?: number;
  fileType?: string;
  tags?: string[];
  search?: string;
}) {
  try {
    let query = db.select().from(files).where(eq(files.teamId, teamId));
    
    const conditions = [eq(files.teamId, teamId)];
    
    if (filters?.projectId) {
      conditions.push(eq(files.projectId, filters.projectId));
    }
    
    if (filters?.taskId) {
      conditions.push(eq(files.taskId, filters.taskId));
    }
    
    if (filters?.folderId) {
      conditions.push(eq(files.folderId, filters.folderId));
    }
    
    if (filters?.fileType) {
      conditions.push(eq(files.fileType, filters.fileType));
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          like(files.originalName, `%${filters.search}%`),
          like(files.description, `%${filters.search}%`)
        )!
      );
    }
    
    const result = await db.select().from(files)
      .where(and(...conditions))
      .orderBy(desc(files.createdAt));
    
    return result;
  } catch (error) {
    console.error('Error getting files:', error);
    throw new Error('Failed to get files');
  }
}

/**
 * Get file by ID
 */
export async function getFileById(fileId: number) {
  try {
    const [file] = await db.select().from(files).where(eq(files.id, fileId));
    return file;
  } catch (error) {
    console.error('Error getting file:', error);
    throw new Error('Failed to get file');
  }
}

/**
 * Get file versions
 */
export async function getFileVersions(fileId: number) {
  try {
    const versions = await db.select()
      .from(fileVersions)
      .where(eq(fileVersions.fileId, fileId))
      .orderBy(desc(fileVersions.version));
    
    return versions;
  } catch (error) {
    console.error('Error getting file versions:', error);
    throw new Error('Failed to get file versions');
  }
}

/**
 * Delete file
 */
export async function deleteFile(fileId: number, userId: number) {
  try {
    const [file] = await db.select().from(files).where(eq(files.id, fileId));
    
    if (!file) {
      throw new Error('File not found');
    }
    
    // Delete from S3
    await deleteFromS3(file.fileName);
    
    // Delete all versions from S3
    const versions = await db.select().from(fileVersions).where(eq(fileVersions.fileId, fileId));
    for (const version of versions) {
      const versionFileName = version.fileUrl.split('/').pop();
      if (versionFileName) {
        await deleteFromS3(versionFileName);
      }
    }
    
    // Delete from database (cascade will handle related records)
    await db.delete(files).where(eq(files.id, fileId));
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Failed to delete file');
  }
}

/**
 * Create folder
 */
export async function createFolder(data: {
  teamId: number;
  projectId?: number;
  parentFolderId?: number;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdBy: number;
}) {
  try {
    const [folder] = await db.insert(fileFolders).values(data).returning();
    return folder;
  } catch (error) {
    console.error('Error creating folder:', error);
    throw new Error('Failed to create folder');
  }
}

/**
 * Get folders by team
 */
export async function getFoldersByTeam(teamId: number, projectId?: number) {
  try {
    const conditions = [eq(fileFolders.teamId, teamId)];
    
    if (projectId) {
      conditions.push(eq(fileFolders.projectId, projectId));
    }
    
    const folders = await db.select()
      .from(fileFolders)
      .where(and(...conditions))
      .orderBy(fileFolders.name);
    
    return folders;
  } catch (error) {
    console.error('Error getting folders:', error);
    throw new Error('Failed to get folders');
  }
}

/**
 * Update folder
 */
export async function updateFolder(folderId: number, data: {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}) {
  try {
    const [folder] = await db.update(fileFolders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fileFolders.id, folderId))
      .returning();
    
    return folder;
  } catch (error) {
    console.error('Error updating folder:', error);
    throw new Error('Failed to update folder');
  }
}

/**
 * Delete folder
 */
export async function deleteFolder(folderId: number) {
  try {
    // Check if folder has files
    const folderFiles = await db.select().from(files).where(eq(files.folderId, folderId));
    
    if (folderFiles.length > 0) {
      throw new Error('Cannot delete folder with files. Please move or delete files first.');
    }
    
    await db.delete(fileFolders).where(eq(fileFolders.id, folderId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
}

/**
 * Move file to folder
 */
export async function moveFileToFolder(fileId: number, folderId: number | null) {
  try {
    const [file] = await db.update(files)
      .set({ folderId, updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .returning();
    
    return file;
  } catch (error) {
    console.error('Error moving file:', error);
    throw new Error('Failed to move file');
  }
}

/**
 * Add comment to file
 */
export async function addFileComment(data: {
  fileId: number;
  userId: number;
  comment: string;
}) {
  try {
    const [comment] = await db.insert(fileComments).values(data).returning();
    return comment;
  } catch (error) {
    console.error('Error adding comment:', error);
    throw new Error('Failed to add comment');
  }
}

/**
 * Get file comments
 */
export async function getFileComments(fileId: number) {
  try {
    const comments = await db.select()
      .from(fileComments)
      .where(eq(fileComments.fileId, fileId))
      .orderBy(desc(fileComments.createdAt));
    
    return comments;
  } catch (error) {
    console.error('Error getting comments:', error);
    throw new Error('Failed to get comments');
  }
}

/**
 * Share file with user
 */
export async function shareFile(data: {
  fileId: number;
  sharedWith: number;
  sharedBy: number;
  permission: 'view' | 'edit' | 'download';
  expiresAt?: Date;
}) {
  try {
    const [share] = await db.insert(fileShares).values(data).returning();
    return share;
  } catch (error) {
    console.error('Error sharing file:', error);
    throw new Error('Failed to share file');
  }
}

/**
 * Get file shares
 */
export async function getFileShares(fileId: number) {
  try {
    const shares = await db.select()
      .from(fileShares)
      .where(eq(fileShares.fileId, fileId));
    
    return shares;
  } catch (error) {
    console.error('Error getting file shares:', error);
    throw new Error('Failed to get file shares');
  }
}

/**
 * Update file tags
 */
export async function updateFileTags(fileId: number, tags: string[]) {
  try {
    const [file] = await db.update(files)
      .set({ tags, updatedAt: new Date() })
      .where(eq(files.id, fileId))
      .returning();
    
    return file;
  } catch (error) {
    console.error('Error updating tags:', error);
    throw new Error('Failed to update tags');
  }
}

/**
 * Search files
 */
export async function searchFiles(teamId: number, query: string) {
  try {
    const results = await db.select()
      .from(files)
      .where(
        and(
          eq(files.teamId, teamId),
          or(
            like(files.originalName, `%${query}%`),
            like(files.description, `%${query}%`),
            sql`${files.tags}::text LIKE ${`%${query}%`}`
          )!
        )
      )
      .orderBy(desc(files.createdAt))
      .limit(50);
    
    return results;
  } catch (error) {
    console.error('Error searching files:', error);
    throw new Error('Failed to search files');
  }
}

/**
 * Get file statistics for a team
 */
export async function getFileStatistics(teamId: number) {
  try {
    const stats = await db.select({
      totalFiles: sql<number>`count(*)`,
      totalSize: sql<number>`sum(${files.fileSize})`,
      filesByType: sql<any>`json_object_agg(${files.fileType}, count(*))`,
    })
    .from(files)
    .where(eq(files.teamId, teamId));
    
    return stats[0];
  } catch (error) {
    console.error('Error getting file statistics:', error);
    throw new Error('Failed to get file statistics');
  }
}
