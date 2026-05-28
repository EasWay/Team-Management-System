import { useState, useCallback, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useTeamContext } from "../contexts/TeamContext";
import {
  Upload,
  Folder,
  File,
  Image,
  FileText,
  Video,
  Code,
  Archive,
  Search,
  Grid,
  List,
  Plus,
  MoreVertical,
  Download,
  Trash2,
  Share2,
  Tag,
  Clock,
  FolderPlus,
  X,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

// File type icons
const FILE_TYPE_ICONS: Record<string, any> = {
  image: Image,
  pdf: FileText,
  video: Video,
  code: Code,
  document: FileText,
  archive: Archive,
  other: File,
};

// File type colors
const FILE_TYPE_COLORS: Record<string, string> = {
  image: "text-purple-500",
  pdf: "text-red-500",
  video: "text-blue-500",
  code: "text-green-500",
  document: "text-yellow-500",
  archive: "text-orange-500",
  other: "text-muted-foreground",
};

export default function FileManager() {
  const { selectedTeamId, teams } = useTeamContext();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<number | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Folder form state
  const [folderName, setFolderName] = useState("");
  const [folderDescription, setFolderDescription] = useState("");
  const [folderColor, setFolderColor] = useState("#8b5cf6");

  const currentTeamName = teams?.find((t: any) => t.id === selectedTeamId)?.name || "Select a Team";

  // Fetch data
  const { data: files, isLoading: loadingFiles, refetch: refetchFiles } = trpc.files.list.useQuery(
    {
      teamId: selectedTeamId || 0,
      folderId: selectedFolder || undefined,
      fileType: selectedFileType || undefined,
      search: searchQuery || undefined,
    },
    { enabled: !!selectedTeamId }
  );

  const { data: folders, isLoading: loadingFolders, refetch: refetchFolders } = trpc.folders.list.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  const { data: statistics } = trpc.files.getStatistics.useQuery(
    { teamId: selectedTeamId || 0 },
    { enabled: !!selectedTeamId }
  );

  // Mutations
  const uploadFileMutation = trpc.files.upload.useMutation({
    onSuccess: () => {
      toast.success("File uploaded successfully");
      refetchFiles();
      setUploadDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const createFolderMutation = trpc.folders.create.useMutation({
    onSuccess: () => {
      toast.success("Folder created successfully");
      refetchFolders();
      setFolderDialogOpen(false);
      setFolderName("");
      setFolderDescription("");
    },
    onError: (error) => {
      toast.error(`Failed to create folder: ${error.message}`);
    },
  });

  const deleteFileMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      toast.success("File deleted successfully");
      refetchFiles();
    },
    onError: (error) => {
      toast.error(`Failed to delete file: ${error.message}`);
    },
  });

  // Handle file upload
  const handleFileUpload = useCallback(
    async (fileList: FileList) => {
      if (!selectedTeamId) {
        toast.error("Please select a team first");
        return;
      }

      const file = fileList[0];
      if (!file) return;

      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        toast.error("File size must be less than 50MB");
        return;
      }

      try {
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = async (e) => {
          const base64Data = e.target?.result as string;
          const base64 = base64Data.split(",")[1]; // Remove data:image/png;base64, prefix

          await uploadFileMutation.mutateAsync({
            teamId: selectedTeamId,
            folderId: selectedFolder || undefined,
            fileName: file.name,
            fileData: base64,
            mimeType: file.type,
            size: file.size,
          });
        };
        reader.readAsDataURL(file);
      } catch (error) {
        console.error("Upload error:", error);
      }
    },
    [selectedTeamId, selectedFolder, uploadFileMutation]
  );

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files);
      }
    },
    [handleFileUpload]
  );

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  // Format date
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get file icon
  const getFileIcon = (fileType: string) => {
    const Icon = FILE_TYPE_ICONS[fileType] || File;
    const colorClass = FILE_TYPE_COLORS[fileType] || "text-muted-foreground";
    return <Icon className={`size-5 ${colorClass}`} />;
  };

  // Handle file click
  const handleFileClick = (file: any) => {
    setSelectedFile(file);
    setPreviewDialogOpen(true);
  };

  // Create folder
  const handleCreateFolder = () => {
    if (!folderName.trim()) {
      toast.error("Folder name is required");
      return;
    }

    createFolderMutation.mutate({
      teamId: selectedTeamId!,
      name: folderName,
      description: folderDescription,
      color: folderColor,
    });
  };

  const isLoading = loadingFiles || loadingFolders;

  return (
    <DashboardLayout>
      <div className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-6 pb-20 overflow-y-auto custom-scrollbar">
        {/* Header */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
              <span>{currentTeamName}</span>
              <span className="size-1 bg-foreground/20 rounded-full"></span>
              <span>File Manager</span>
            </div>
            <h1 className="text-3xl font-light tracking-tight text-foreground">
              Documents & Files
            </h1>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => setFolderDialogOpen(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <FolderPlus className="size-4" />
              New Folder
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              className="gap-2"
            >
              <Upload className="size-4" />
              Upload File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
          </div>
        </section>

        {/* Statistics */}
        {statistics && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Total Files
              </div>
              <div className="text-3xl font-light text-foreground">
                {statistics.totalFiles || 0}
              </div>
            </div>
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Storage Used
              </div>
              <div className="text-3xl font-light text-foreground">
                {formatFileSize(statistics.totalSize || 0)}
              </div>
            </div>
            <div className="liquid-glass p-6 space-y-2 rounded-xl">
              <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                Folders
              </div>
              <div className="text-3xl font-light text-foreground">
                {folders?.length || 0}
              </div>
            </div>
          </section>
        )}

        {/* Toolbar */}
        <section className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 rounded transition-colors ${
                viewMode === "grid"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Grid className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 rounded transition-colors ${
                viewMode === "list"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <List className="size-4" />
            </button>
          </div>
        </section>

        {/* Breadcrumb */}
        {selectedFolder && (
          <section className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => setSelectedFolder(null)}
              className="hover:text-foreground transition-colors"
            >
              All Files
            </button>
            <ChevronRight className="size-4" />
            <span className="text-foreground">
              {folders?.find((f) => f.id === selectedFolder)?.name}
            </span>
          </section>
        )}

        {/* Folders Section */}
        {!selectedFolder && folders && folders.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-foreground">Folders</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                  className="liquid-glass p-4 rounded-xl hover:bg-foreground/5 transition-colors text-left"
                >
                  <Folder className="size-8 mb-2" style={{ color: folder.color || "#8b5cf6" }} />
                  <div className="text-sm font-medium text-foreground truncate">
                    {folder.name}
                  </div>
                  {folder.description && (
                    <div className="text-xs text-muted-foreground truncate mt-1">
                      {folder.description}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Files Section */}
        <section
          className={`liquid-glass p-6 rounded-xl min-h-[400px] ${
            isDragging ? "border-2 border-dashed border-primary bg-primary/5" : ""
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isLoading ? (
            <div className="flex justify-center items-center py-20">
              <RefreshCw className="animate-spin size-8 text-muted-foreground" />
            </div>
          ) : files && files.length > 0 ? (
            viewMode === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="group relative p-4 rounded-lg border border-border hover:border-foreground/20 hover:bg-foreground/5 transition-all cursor-pointer"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="flex flex-col items-center gap-3">
                      {getFileIcon(file.fileType)}
                      <div className="text-center w-full">
                        <div className="text-sm font-medium text-foreground truncate">
                          {file.originalName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatFileSize(file.fileSize)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded bg-background/80 hover:bg-background"
                          >
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Download className="size-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Share2 className="size-4 mr-2" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFileMutation.mutate({ id: file.id });
                            }}
                            className="text-red-500"
                          >
                            <Trash2 className="size-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:border-foreground/20 hover:bg-foreground/5 transition-all cursor-pointer"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {getFileIcon(file.fileType)}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {file.originalName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(file.createdAt ?? new Date())} • {formatFileSize(file.fileSize)}
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded hover:bg-foreground/10"
                        >
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Download className="size-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="size-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFileMutation.mutate({ id: file.id });
                          }}
                          className="text-red-500"
                        >
                          <Trash2 className="size-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Upload className="size-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No files yet
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Drag and drop files here or click the upload button
              </p>
              <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload className="size-4" />
                Upload Your First File
              </Button>
            </div>
          )}
        </section>

        {/* Create Folder Dialog */}
        <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
              <DialogDescription>
                Organize your files by creating folders
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Folder Name</label>
                <Input
                  placeholder="Enter folder name"
                  value={folderName}
                  onChange={(e) => setFolderName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
                <Textarea
                  placeholder="Enter folder description"
                  value={folderDescription}
                  onChange={(e) => setFolderDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Color</label>
                <div className="flex gap-2">
                  {["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"].map(
                    (color) => (
                      <button
                        key={color}
                        onClick={() => setFolderColor(color)}
                        className={`size-8 rounded-full border-2 ${
                          folderColor === color ? "border-foreground" : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    )
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateFolder}>Create Folder</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* File Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{selectedFile?.originalName}</DialogTitle>
              <DialogDescription>
                {selectedFile && (
                  <div className="flex items-center gap-4 text-sm">
                    <span>{formatFileSize(selectedFile.fileSize)}</span>
                    <span>•</span>
                    <span>{formatDate(selectedFile.createdAt)}</span>
                    <span>•</span>
                    <span>Version {selectedFile.version}</span>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {selectedFile?.fileType === "image" ? (
                <img
                  src={selectedFile.fileUrl}
                  alt={selectedFile.originalName}
                  className="w-full rounded-lg"
                />
              ) : selectedFile?.fileType === "pdf" ? (
                <iframe
                  src={selectedFile.fileUrl}
                  className="w-full h-[600px] rounded-lg"
                  title={selectedFile.originalName}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  {getFileIcon(selectedFile?.fileType)}
                  <p className="text-sm text-muted-foreground mt-4">
                    Preview not available for this file type
                  </p>
                  <Button className="mt-4 gap-2">
                    <Download className="size-4" />
                    Download File
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
