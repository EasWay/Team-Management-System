import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { CollaborativeEditor } from "@/components/CollaborativeEditor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Loader2, FileText, Trash2, Edit2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Editor() {
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newDocumentName, setNewDocumentName] = useState("");
  const [renameDocumentName, setRenameDocumentName] = useState("");
  const [renameDocumentId, setRenameDocumentId] = useState<number | null>(null);
  const [deleteDocumentId, setDeleteDocumentId] = useState<number | null>(null);

  const { data: teams, isLoading: teamsLoading } = trpc.teams.list.useQuery();
  const { data: documents, isLoading: documentsLoading, refetch: refetchDocuments } = trpc.documents.list.useQuery(
    { teamId: selectedTeamId! },
    { enabled: !!selectedTeamId }
  );

  const createDocumentMutation = trpc.documents.create.useMutation({
    onSuccess: (newDoc) => {
      setIsCreateDialogOpen(false);
      setNewDocumentName("");
      setSelectedDocumentId(newDoc.id);
      refetchDocuments();
    },
  });

  const renameDocumentMutation = trpc.documents.update.useMutation({
    onSuccess: () => {
      setIsRenameDialogOpen(false);
      setRenameDocumentName("");
      setRenameDocumentId(null);
      refetchDocuments();
    },
  });

  const deleteDocumentMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      setIsDeleteDialogOpen(false);
      setDeleteDocumentId(null);
      if (selectedDocumentId === deleteDocumentId) {
        setSelectedDocumentId(null);
      }
      refetchDocuments();
    },
  });

  // Auto-select first team if none selected
  useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // Auto-select first document if none selected
  useEffect(() => {
    if (documents && documents.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(documents[0].id);
    }
  }, [documents, selectedDocumentId]);

  const handleCreateDocument = () => {
    if (!selectedTeamId || !newDocumentName.trim()) return;
    createDocumentMutation.mutate({
      teamId: selectedTeamId,
      name: newDocumentName.trim(),
    });
  };

  const handleRenameDocument = () => {
    if (!renameDocumentId || !renameDocumentName.trim()) return;
    renameDocumentMutation.mutate({
      id: renameDocumentId,
      name: renameDocumentName.trim(),
    });
  };

  const handleDeleteDocument = () => {
    if (!deleteDocumentId) return;
    deleteDocumentMutation.mutate({ id: deleteDocumentId });
  };

  const openRenameDialog = (doc: any) => {
    setRenameDocumentId(doc.id);
    setRenameDocumentName(doc.name);
    setIsRenameDialogOpen(true);
  };

  const openDeleteDialog = (docId: number) => {
    setDeleteDocumentId(docId);
    setIsDeleteDialogOpen(true);
  };

  const selectedDocument = documents?.find(d => d.id === selectedDocumentId);

  return (
    <DashboardLayout>
      <div className="space-y-6 h-full flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Collaborative Editor</h1>
            <p className="text-gray-600 mt-2">Edit documents in real-time with your team</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Team Selector */}
            {teamsLoading ? (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading teams...</span>
              </div>
            ) : teams && teams.length > 0 ? (
              <Select 
                value={selectedTeamId?.toString() || ""} 
                onValueChange={(value) => {
                  setSelectedTeamId(parseInt(value));
                  setSelectedDocumentId(null);
                }}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            {/* Create Document Button */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" disabled={!selectedTeamId}>
                  <Plus className="h-4 w-4" />
                  New Document
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Document</DialogTitle>
                  <DialogDescription>
                    Create a new collaborative document for your team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    placeholder="Document name"
                    value={newDocumentName}
                    onChange={(e) => setNewDocumentName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateDocument();
                      }
                    }}
                  />
                  <Button
                    onClick={handleCreateDocument}
                    disabled={!newDocumentName.trim() || createDocumentMutation.isPending}
                    className="w-full"
                  >
                    {createDocumentMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Document"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Documents Sidebar */}
          <div className="w-64 border rounded-lg flex flex-col bg-background">
            <div className="p-4 border-b">
              <h2 className="font-semibold text-sm">Documents</h2>
            </div>

            {/* Documents List */}
            <div className="flex-1 overflow-y-auto">
              {documentsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              ) : !documents || documents.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No documents yet</p>
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                        selectedDocumentId === doc.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <button
                        onClick={() => setSelectedDocumentId(doc.id)}
                        className="flex-1 text-left truncate text-sm font-medium"
                        title={doc.name}
                      >
                        {doc.name}
                      </button>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openRenameDialog(doc)}
                          className="p-1 hover:bg-accent rounded"
                          title="Rename"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => openDeleteDialog(doc.id)}
                          className="p-1 hover:bg-destructive/10 rounded text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 border rounded-lg flex flex-col bg-background min-h-0">
            {selectedDocument ? (
              <>
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="font-semibold">{selectedDocument.name}</h2>
                </div>
                <div className="flex-1 min-h-0">
                  <CollaborativeEditor
                    documentId={selectedDocument.id}
                    initialContent={selectedDocument.yjsState || ""}
                    language="typescript"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    {selectedTeamId ? "Select a document to start editing" : "Select a team first"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rename Document Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
            <DialogDescription>
              Enter a new name for the document.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Document name"
              value={renameDocumentName}
              onChange={(e) => setRenameDocumentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameDocument();
                }
              }}
            />
            <Button
              onClick={handleRenameDocument}
              disabled={!renameDocumentName.trim() || renameDocumentMutation.isPending}
              className="w-full"
            >
              {renameDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                "Rename Document"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Document Alert Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDocument}
              disabled={deleteDocumentMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteDocumentMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
