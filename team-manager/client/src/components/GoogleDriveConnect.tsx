import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Cloud,
  Link as LinkIcon,
  ExternalLink,
  Loader2,
  CheckCircle2,
  XCircle,
  Folder,
  Upload,
} from "lucide-react";

interface GoogleDriveConnectProps {
  teamId: number;
  officeRole?: string;
  connectionType: 'team' | 'office';
  /** True when the current user owns this drive (can connect/disconnect/delete) */
  isOwner?: boolean;
}

export function GoogleDriveConnect({ teamId, officeRole, connectionType, isOwner = true }: GoogleDriveConnectProps) {
  const [driveUrl, setDriveUrl] = useState("");
  const [driveName, setDriveName] = useState("");
  const [showConnectDialog, setShowConnectDialog] = useState(false);

  // Get existing connection
  const { data: connection, refetch } = connectionType === 'team'
    ? trpc.googleDrive.getTeamDrive.useQuery({ teamId })
    : trpc.googleDrive.getOfficeDrive.useQuery({ teamId, officeRole: officeRole! }, { enabled: !!officeRole });

  // Connect mutations
  const connectTeamMutation = trpc.googleDrive.connectTeam.useMutation({
    onSuccess: () => {
      toast.success("Team Google Drive connected successfully!");
      setShowConnectDialog(false);
      setDriveUrl("");
      setDriveName("");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const connectOfficeMutation = trpc.googleDrive.connectOffice.useMutation({
    onSuccess: () => {
      toast.success("Office Google Drive connected successfully!");
      setShowConnectDialog(false);
      setDriveUrl("");
      setDriveName("");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const disconnectMutation = trpc.googleDrive.disconnect.useMutation({
    onSuccess: () => {
      toast.success("Google Drive disconnected");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleConnect = () => {
    if (!driveUrl) {
      toast.error("Please enter a Google Drive URL");
      return;
    }

    if (connectionType === 'team') {
      connectTeamMutation.mutate({
        teamId,
        driveUrl,
        driveName: driveName || undefined,
      });
    } else if (officeRole) {
      connectOfficeMutation.mutate({
        teamId,
        officeRole,
        driveUrl,
        driveName: driveName || undefined,
      });
    }
  };

  const handleDisconnect = () => {
    if (!connection?.id) return;

    if (confirm("Are you sure you want to disconnect this Google Drive?")) {
      disconnectMutation.mutate({ connectionId: connection.id });
    }
  };

  const handleOpenDrive = () => {
    if (connection?.driveUrl) {
      window.open(connection.driveUrl, '_blank');
    }
  };

  const isConnected = !!connection && connection.isActive;
  const isLoading = connectTeamMutation.isPending || connectOfficeMutation.isPending || disconnectMutation.isPending;

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50/50 to-cyan-50/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base">
              {connectionType === 'team' ? '☁️ Team Google Drive' : isOwner ? '☁️ My Office Drive' : '☁️ Office Drive'}
            </CardTitle>
          </div>
          {isConnected && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          {connectionType === 'team'
            ? 'Shared drive for the entire team'
            : isOwner ? 'Your personal office drive' : 'Add files to this office drive'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isConnected ? (
          <>
            {/* Connected Drive Info */}
            <div className="p-4 bg-white rounded-lg border space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Folder className="h-4 w-4 text-blue-600" />
                    <p className="font-medium text-sm">{connection.driveName || 'Google Drive'}</p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {connection.driveUrl}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenDrive}
                  className="flex-1"
                >
                  <ExternalLink className="h-3 w-3 mr-2" />
                  Open Drive
                </Button>
                {/* Only the owner can disconnect */}
                {isOwner && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 mr-2" />
                        Disconnect
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Info */}
            <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
              {isOwner
                ? `💡 Files in this drive are accessible to ${connectionType === 'team' ? 'all team members' : 'you in this office'}`
                : '💡 You can add files to this drive. Only the owner can remove or modify files.'}
            </div>
          </>
        ) : (
          <>
            {/* Not Connected State */}
            <div className="flex flex-col items-center justify-center h-32 text-center bg-white/50 rounded-lg border-2 border-dashed">
              <Cloud className="h-12 w-12 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground mb-3">
                {isOwner ? 'No drive connected' : 'No drive connected by the owner yet'}
              </p>

              {/* Only owners can connect a drive */}
              {isOwner && (
                <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <LinkIcon className="h-3 w-3 mr-2" />
                      Connect Google Drive
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {connectionType === 'team' ? '☁️ Connect Team Google Drive' : '☁️ Connect Office Google Drive'}
                      </DialogTitle>
                      <DialogDescription>
                        {connectionType === 'team'
                          ? 'Connect your team\'s shared Google Drive for easy file access'
                          : 'Connect your personal Google Drive for this office'}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="driveUrl">Google Drive URL *</Label>
                        <Input
                          id="driveUrl"
                          type="url"
                          placeholder="https://drive.google.com/drive/folders/..."
                          value={driveUrl}
                          onChange={(e) => setDriveUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          📋 Copy the URL from your Google Drive folder
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="driveName">Drive Name (Optional)</Label>
                        <Input
                          id="driveName"
                          placeholder={connectionType === 'team' ? 'Team Shared Drive' : 'My Office Drive'}
                          value={driveName}
                          onChange={(e) => setDriveName(e.target.value)}
                        />
                      </div>

                      <div className="bg-blue-50 p-3 rounded-lg text-xs space-y-2">
                        <p className="font-semibold text-blue-900">📖 How to get your Google Drive URL:</p>
                        <ol className="list-decimal list-inside space-y-1 text-blue-800">
                          <li>Open Google Drive in your browser</li>
                          <li>Navigate to the folder you want to connect</li>
                          <li>Copy the URL from your browser's address bar</li>
                          <li>Paste it above</li>
                        </ol>
                      </div>

                      <Button
                        onClick={handleConnect}
                        disabled={isLoading || !driveUrl}
                        className="w-full"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <LinkIcon className="h-4 w-4 mr-2" />
                            Connect Drive
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
