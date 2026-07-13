/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export type TeamMember = import("../drizzle/schema").TeamMember;
export * from "./_core/errors";

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
}
