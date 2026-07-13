import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import type { DriveFile } from "@shared/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Folder,
  FolderPlus,
  Upload,
  Loader2,
  MoreVertical,
  Trash2,
  ExternalLink,
  Image,
  FileText,
  FileSpreadsheet,
  Presentation,
  Video,
  Music,
  Archive,
  Code,
  File as FileIcon,
  AlertTriangle,
  KeyRound,
  RefreshCw,
} from "lucide-react";

const FOLDER_MIME = "application/vnd.google-apps.folder";

interface GoogleDriveBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rootFolderId: string;
  rootName: string;
  teamId: number;
  canDelete: boolean;
  canUpload: boolean;
}

function formatBytes(bytes?: string | null): string {
  const n = Number(bytes ?? 0);
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDriveFileMeta(mimeType: string, isFolder: boolean) {
  if (isFolder) return { icon: Folder, color: "text-blue-500" };
  if (mimeType.startsWith("image/")) return { icon: Image, color: "text-purple-500" };
  if (mimeType.includes("pdf")) return { icon: FileText, color: "text-red-500" };
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("csv"))
    return { icon: FileSpreadsheet, color: "text-green-500" };
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return { icon: Presentation, color: "text-orange-500" };
  if (mimeType.includes("document") || mimeType.includes("word"))
    return { icon: FileText, color: "text-blue-500" };
  if (mimeType.includes("video")) return { icon: Video, color: "text-pink-500" };
  if (mimeType.includes("audio")) return { icon: Music, color: "text-yellow-500" };
  if (mimeType.includes("zip") || mimeType.includes("compressed") || mimeType.includes("archive"))
    return { icon: Archive, color: "text-orange-500" };
  if (mimeType.includes("code") || mimeType.includes("javascript") || mimeType.includes("python") || mimeType.includes("html"))
    return { icon: Code, color: "text-green-500" };
  return { icon: FileIcon, color: "text-muted-foreground" };
}

export function GoogleDriveBrowser({
  open,
  onOpenChange,
  rootFolderId,
  rootName,
  teamId,
  canDelete,
  canUpload,
}: GoogleDriveBrowserProps) {
  const [stack, setStack] = useState<{ id: string; name: string }[]>([
    { id: rootFolderId, name: rootName },
  ]);
  const [uploading, setUploading] = useState(false);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [fileToDelete, setFileToDelete] = useState<DriveFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolder = stack[stack.length - 1];
  const utils = trpc.useUtils();

  const googleStatusQuery = trpc.googleDrive.googleConnectionStatus.useQuery();
  const filesQuery = trpc.googleDrive.driveListFiles.useQuery(
    { folderId: currentFolder.id, teamId },
    { retry: 1 }
  );

  const createFolderMutation = trpc.googleDrive.driveCreateFolder.useMutation({
    onSuccess: () => {
      toast.success("Folder created");
      utils.googleDrive.driveListFiles.invalidate();
      filesQuery.refetch();
      setShowNewFolderDialog(false);
      setNewFolderName("");
    },
    onError: (error) => toast.error(error.message),
  });

  const uploadFileMutation = trpc.googleDrive.driveUploadFile.useMutation({
    onSuccess: () => {
      toast.success("File uploaded");
      utils.googleDrive.driveListFiles.invalidate();
      filesQuery.refetch();
    },
    onError: (error) => toast.error(error.message),
    onSettled: () => setUploading(false),
  });

  const deleteFileMutation = trpc.googleDrive.driveDeleteFile.useMutation({
    onSuccess: () => {
      toast.success("Deleted");
      utils.googleDrive.driveListFiles.invalidate();
      filesQuery.refetch();
      setFileToDelete(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const files: DriveFile[] = (filesQuery.data as DriveFile[] | undefined) ?? [];
  const folders = files.filter((f) => f.mimeType === FOLDER_MIME);
  const regularFiles = files.filter((f) => f.mimeType !== FOLDER_MIME);
  const sorted = [...folders, ...regularFiles];

  const navigateInto = (id: string, name: string) => {
    setStack((prev) => [...prev, { id, name }]);
  };

  const navigateToCrumb = (index: number) => {
    setStack((prev) => prev.slice(0, index + 1));
  };

  const handleUploadClick = () => {
    if (!googleStatusQuery.data?.connected) {
      toast.error("Connect your Google account before uploading files.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileSelected = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      const base64 = base64Data.split(",")[1];
      uploadFileMutation.mutate({
        folderId: currentFolder.id,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        content: base64,
        teamId,
      });
    };
    reader.onerror = () => {
      toast.error("Could not read file");
      setUploading(false);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    createFolderMutation.mutate({
      name: newFolderName.trim(),
      parentFolderId: currentFolder.id,
      teamId,
    });
  };

  const handleRowClick = (file: DriveFile) => {
    if (file.mimeType === FOLDER_MIME) {
      navigateInto(file.id, file.name);
      return;
    }
    const url = file.webViewLink ?? file.webContentLink;
    if (url) window.open(url, "_blank");
    else toast.error("This file has no preview link");
  };

  const isServiceNotConfigured =
    filesQuery.isError &&
    filesQuery.error?.message?.includes("GOOGLE_SERVICE_ACCOUNT_JSON");

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-blue-600" />
            {currentFolder.name}
          </DialogTitle>
          <Breadcrumb>
            <BreadcrumbList>
              {stack.map((crumb, i) => (
                <div key={crumb.id} className="flex items-center gap-1.5">
                  {i > 0 && <BreadcrumbSeparator />}
                  <BreadcrumbItem>
                    {i === stack.length - 1 ? (
                      <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button onClick={() => navigateToCrumb(i)}>{crumb.name}</button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </div>
              ))}
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex gap-2 pt-2">
            {canUpload && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewFolderDialog(true)}
                >
                  <FolderPlus className="h-3.5 w-3.5 mr-2" />
                  New Folder
                </Button>
                <Button size="sm" onClick={handleUploadClick} disabled={uploading}>
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-2" />
                  )}
                  {uploading ? "Uploading..." : "Upload"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => handleFileSelected(e.target.files)}
                />
              </>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1">
          {filesQuery.isLoading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isServiceNotConfigured ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRound />
                </EmptyMedia>
                <EmptyTitle>Google Drive not configured</EmptyTitle>
                <EmptyDescription>
                  The server is missing its Google service account credentials.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : filesQuery.isError ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangle />
                </EmptyMedia>
                <EmptyTitle>Couldn't load files</EmptyTitle>
                <EmptyDescription>{filesQuery.error?.message}</EmptyDescription>
              </EmptyHeader>
              <Button size="sm" variant="outline" onClick={() => filesQuery.refetch()}>
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Retry
              </Button>
            </Empty>
          ) : sorted.length === 0 ? (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Folder />
                </EmptyMedia>
                <EmptyTitle>Empty folder</EmptyTitle>
                {canUpload && (
                  <EmptyDescription>
                    Use Upload or New Folder above to add content here.
                  </EmptyDescription>
                )}
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="divide-y">
              {sorted.map((file) => {
                const isFolder = file.mimeType === FOLDER_MIME;
                const meta = getDriveFileMeta(file.mimeType, isFolder);
                const Icon = meta.icon;
                return (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 px-6 py-3 hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleRowClick(file)}
                  >
                    <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className={`h-4.5 w-4.5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {!isFolder && file.size && <span>{formatBytes(file.size)}</span>}
                        {file.modifiedTime && <span>{formatDate(file.modifiedTime)}</span>}
                      </div>
                    </div>
                    {!isFolder && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(file.webViewLink || file.webContentLink) && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(file.webViewLink ?? file.webContentLink!, "_blank");
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5 mr-2" />
                              Open
                            </DropdownMenuItem>
                          )}
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFileToDelete(file);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>

      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoFocus
          />
          <Button
            onClick={handleCreateFolder}
            disabled={createFolderMutation.isPending || !newFolderName.trim()}
            className="w-full"
          >
            {createFolderMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FolderPlus className="h-4 w-4 mr-2" />
            )}
            Create
          </Button>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!fileToDelete} onOpenChange={(v) => !v && setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{fileToDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() =>
                fileToDelete && deleteFileMutation.mutate({ fileId: fileToDelete.id, teamId })
              }
            >
              {deleteFileMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
