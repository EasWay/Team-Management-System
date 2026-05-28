import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Linking,
  ScrollView,
  Platform,
} from 'react-native';
import { Alert } from '@/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';

import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';

type IonIconName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DriveFile {
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

interface FolderEntry {
  id: string;
  name: string;
  ownerId?: number | null; // which member owns this folder (null = team folder)
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function extractFolderId(url: string): string | null {
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function formatBytes(bytes?: string | null): string {
  const n = Number(bytes ?? 0);
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface FileMeta { icon: IonIconName; color: string; label: string }

function getFileMeta(mimeType: string, isFolder = false): FileMeta {
  if (isFolder) return { icon: 'folder', color: '#fbbf24', label: 'Folder' };
  if (mimeType.startsWith('image/')) return { icon: 'image-outline', color: '#34d399', label: 'Image' };
  if (mimeType.includes('pdf')) return { icon: 'document-text-outline', color: '#f87171', label: 'PDF' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv'))
    return { icon: 'grid-outline', color: '#34d399', label: 'Spreadsheet' };
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return { icon: 'easel-outline', color: '#fb923c', label: 'Slides' };
  if (mimeType.includes('document') || mimeType.includes('word'))
    return { icon: 'document-outline', color: '#60a5fa', label: 'Document' };
  if (mimeType.includes('video')) return { icon: 'videocam-outline', color: '#a78bfa', label: 'Video' };
  if (mimeType.includes('audio')) return { icon: 'musical-notes-outline', color: '#f472b6', label: 'Audio' };
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive'))
    return { icon: 'archive-outline', color: '#94a3b8', label: 'Archive' };
  if (mimeType.includes('code') || mimeType.includes('javascript') || mimeType.includes('python') || mimeType.includes('html'))
    return { icon: 'code-slash-outline', color: '#38bdf8', label: 'Code' };
  return { icon: 'document-outline', color: '#64748b', label: 'File' };
}

const FOLDER_MIME = 'application/vnd.google-apps.folder';

/** Read any URI (file://, content://, https://) as a base64 string. */
async function readAsBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.substring(result.indexOf(',') + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Reusable components ────────────────────────────────────────────────────────

function FileRow({
  file,
  canDelete,
  teamId,
  onNavigate,
  onRefresh,
}: {
  file: DriveFile;
  canDelete: boolean;
  teamId: number;
  onNavigate: (id: string, name: string) => void;
  onRefresh: () => void;
}) {
  const isFolder = file.mimeType === FOLDER_MIME;
  const meta = getFileMeta(file.mimeType, isFolder);
  const utils = trpc.useUtils();

  const deleteMutation = trpc.googleDrive.driveDeleteFile.useMutation({
    onSuccess: () => {
      utils.googleDrive.driveListFiles.invalidate();
      onRefresh();
    },
    onError: (e: any) => Alert.alert('Delete failed', e.message),
  });

  const handleOpen = () => {
    const url = file.webViewLink ?? file.webContentLink;
    if (url) Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open file.'));
    else Alert.alert('No preview', 'This file has no preview link.');
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete "${file.name}"?`,
      isFolder ? 'This will permanently delete the folder and all its contents.' : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate({ fileId: file.id, teamId }),
        },
      ],
    );
  };

  return (
    <TouchableOpacity
      onPress={isFolder ? () => onNavigate(file.id, file.name) : handleOpen}
      activeOpacity={0.75}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#0f172a',
        gap: 14,
      }}
    >
      {/* Icon */}
      <View style={{
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: meta.color + '18', borderWidth: 1, borderColor: meta.color + '30',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {deleteMutation.isPending
          ? <ActivityIndicator size="small" color={meta.color} />
          : <Ionicons name={meta.icon} size={22} color={meta.color} />}
      </View>

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#f1f5f9', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
          {file.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
          {!isFolder && file.size && (
            <Text style={{ color: '#475569', fontSize: 11 }}>{formatBytes(file.size)}</Text>
          )}
          {file.modifiedTime && (
            <Text style={{ color: '#334155', fontSize: 11 }}>{formatDate(file.modifiedTime)}</Text>
          )}
        </View>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {canDelete && !isFolder && (
          <TouchableOpacity
            onPress={handleDelete}
            style={{ padding: 8 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={17} color="#ef4444" />
          </TouchableOpacity>
        )}
        <Ionicons
          name={isFolder ? 'chevron-forward' : 'open-outline'}
          size={16}
          color="#334155"
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── File Browser ──────────────────────────────────────────────────────────────

function FileBrowser({
  rootFolderId,
  rootName,
  teamId,
  canDelete,
  canUpload,
  onClose,
}: {
  rootFolderId: string;
  rootName: string;
  teamId: number;
  canDelete: boolean;
  canUpload: boolean;
  onClose: () => void;
}) {
  // Folder navigation stack: [{id, name}, ...]
  const [stack, setStack] = useState<{ id: string; name: string }[]>([
    { id: rootFolderId, name: rootName },
  ]);
  const currentFolder = stack[stack.length - 1];

  const [uploading, setUploading] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const utils = trpc.useUtils();
  const googleStatusQuery = trpc.googleDrive.googleConnectionStatus.useQuery();

  const filesQuery = trpc.googleDrive.driveListFiles.useQuery(
    { folderId: currentFolder.id, teamId },
    { retry: 1 },
  );

  const files: DriveFile[] = (filesQuery.data as DriveFile[] | undefined) ?? [];
  const folders = files.filter(f => f.mimeType === FOLDER_MIME);
  const regularFiles = files.filter(f => f.mimeType !== FOLDER_MIME);
  const sorted = [...folders, ...regularFiles]; // folders first

  const createFolderMutation = trpc.googleDrive.driveCreateFolder.useMutation({
    onSuccess: () => {
      utils.googleDrive.driveListFiles.invalidate();
      filesQuery.refetch();
      setShowNewFolder(false);
      setNewFolderName('');
      setCreatingFolder(false);
    },
    onError: (e: any) => {
      Alert.alert('Error', e.message);
      setCreatingFolder(false);
    },
  });

  const handleUpload = useCallback(async () => {
    if (!googleStatusQuery.data?.connected) {
      Alert.alert(
        'Google Account Required',
        'You need to connect your Google account before uploading files.\n\nGo to Profile → Connections → Connect Google.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploading(true);

      const base64 = await readAsBase64(asset.uri);

      await utils.client.googleDrive.driveUploadFile.mutate({
        folderId: currentFolder.id,
        fileName: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        content: base64,
        teamId,
      });

      utils.googleDrive.driveListFiles.invalidate();
      filesQuery.refetch();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Unknown error');
    } finally {
      setUploading(false);
    }
  }, [currentFolder.id, teamId]);

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    createFolderMutation.mutate({
      name: newFolderName.trim(),
      parentFolderId: currentFolder.id,
      teamId,
    });
  };

  const navigateInto = (id: string, name: string) => {
    setStack(prev => [...prev, { id, name }]);
  };

  const navigateBack = () => {
    if (stack.length === 1) { onClose(); return; }
    setStack(prev => prev.slice(0, -1));
  };

  const isServiceNotConfigured =
    filesQuery.isError &&
    (filesQuery.error as any)?.message?.includes('GOOGLE_SERVICE_ACCOUNT_JSON');

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1e' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#0f172a',
      }}>
        <TouchableOpacity
          onPress={navigateBack}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name={stack.length === 1 ? 'close' : 'arrow-back'} size={18} color="#64748b" />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ color: '#f1f5f9', fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
            {currentFolder.name}
          </Text>
          {/* Breadcrumb */}
          {stack.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                {stack.map((s, i) => (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <Ionicons name="chevron-forward" size={10} color="#334155" />}
                    <Text
                      style={{
                        color: i === stack.length - 1 ? '#64748b' : '#334155',
                        fontSize: 11,
                        fontWeight: i === stack.length - 1 ? '600' : '400',
                      }}
                      numberOfLines={1}
                    >
                      {s.name}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}
        </View>

        {/* Actions row */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canUpload && (
            <TouchableOpacity
              onPress={() => setShowNewFolder(true)}
              style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="folder-open-outline" size={17} color="#64748b" />
            </TouchableOpacity>
          )}
          {canUpload && (
            <TouchableOpacity
              onPress={handleUpload}
              disabled={uploading}
              style={{
                paddingHorizontal: 14, height: 36, borderRadius: 18,
                backgroundColor: '#0ea5e9',
                flexDirection: 'row', alignItems: 'center', gap: 6,
                shadowColor: '#0ea5e9', shadowRadius: 8, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 3 },
              }}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
              }
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>
                {uploading ? 'Uploading…' : 'Upload'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {filesQuery.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={{ color: '#475569', fontSize: 13, marginTop: 12 }}>Loading files…</Text>
        </View>
      ) : isServiceNotConfigured ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 20, backgroundColor: '#fbbf2415',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Ionicons name="key-outline" size={28} color="#fbbf24" />
          </View>
          <Text style={{ color: '#f1f5f9', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 8 }}>
            Google Drive not configured
          </Text>
          <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            Add your <Text style={{ color: '#38bdf8', fontWeight: '600' }}>GOOGLE_SERVICE_ACCOUNT_JSON</Text> to the server environment variables to enable in-app file browsing.
          </Text>
        </View>
      ) : filesQuery.isError ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 }}>
          <Ionicons name="warning-outline" size={40} color="#ef4444" />
          <Text style={{ color: '#f1f5f9', fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 6, textAlign: 'center' }}>
            Couldn't load files
          </Text>
          <Text style={{ color: '#475569', fontSize: 12, textAlign: 'center' }}>
            {(filesQuery.error as any)?.message ?? 'Check that the service account has access to this folder.'}
          </Text>
          <TouchableOpacity
            onPress={() => filesQuery.refetch()}
            style={{
              marginTop: 20, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b',
              borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : sorted.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 20, backgroundColor: '#0f172a',
            borderWidth: 1, borderColor: '#1e293b', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <Ionicons name="folder-open-outline" size={28} color="#334155" />
          </View>
          <Text style={{ color: '#64748b', fontSize: 16, fontWeight: '600', marginBottom: 6 }}>Empty folder</Text>
          {canUpload && (
            <Text style={{ color: '#334155', fontSize: 13, textAlign: 'center' }}>
              Tap <Text style={{ color: '#38bdf8', fontWeight: '600' }}>Upload</Text> to add files here.
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl
              refreshing={filesQuery.isFetching && !filesQuery.isLoading}
              onRefresh={() => filesQuery.refetch()}
              tintColor="#0ea5e9"
            />
          }
          renderItem={({ item }) => (
            <FileRow
              file={item}
              canDelete={canDelete || item.mimeType === FOLDER_MIME ? canDelete : canDelete}
              teamId={teamId}
              onNavigate={navigateInto}
              onRefresh={() => filesQuery.refetch()}
            />
          )}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}

      {/* New Folder Modal */}
      <Modal visible={showNewFolder} animationType="slide" transparent onRequestClose={() => setShowNewFolder(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
            borderTopWidth: 1, borderColor: '#1e293b', padding: 24, paddingBottom: 40,
          }}>
            <View style={{ width: 40, height: 4, backgroundColor: '#1e293b', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '800', marginBottom: 16 }}>New Folder</Text>
            <TextInput
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder="Folder name"
              placeholderTextColor="#334155"
              autoFocus
              style={{
                backgroundColor: '#0a0f1e', borderWidth: 1, borderColor: '#1e293b',
                borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
                color: '#f1f5f9', fontSize: 14, marginBottom: 16,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setShowNewFolder(false); setNewFolderName(''); }}
                style={{ flex: 1, borderWidth: 1, borderColor: '#1e293b', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#475569', fontSize: 14, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                style={{
                  flex: 1,
                  backgroundColor: newFolderName.trim() ? '#0ea5e9' : '#1e293b',
                  borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                }}
              >
                {creatingFolder
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Folder Card (home view) ───────────────────────────────────────────────────

function FolderCard({
  title,
  subtitle,
  icon,
  color,
  badge,
  driveUrl,
  canBrowse,
  onPress,
  onConnect,
}: {
  title: string;
  subtitle?: string;
  icon: IonIconName;
  color: string;
  badge?: string;
  driveUrl?: string | null;
  canBrowse: boolean;
  onPress: () => void;
  onConnect?: () => void;
}) {
  const folderId = driveUrl ? extractFolderId(driveUrl) : null;
  const connected = !!folderId;

  return (
    <TouchableOpacity
      onPress={connected && canBrowse ? onPress : connected ? onConnect : onConnect}
      activeOpacity={0.8}
      style={{
        backgroundColor: '#0f172a',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: connected ? color + '30' : '#1e293b',
        padding: 16,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{
          width: 52, height: 52, borderRadius: 16,
          backgroundColor: color + '18', borderWidth: 1, borderColor: color + '30',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Ionicons name={icon} size={24} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {title}
            </Text>
            {badge && (
              <View style={{ backgroundColor: color + '20', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{badge}</Text>
              </View>
            )}
          </View>
          {subtitle && (
            <Text style={{ color: '#475569', fontSize: 12 }} numberOfLines={1}>{subtitle}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
            {connected ? (
              <>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' }} />
                <Text style={{ color: '#34d399', fontSize: 11, fontWeight: '600' }}>
                  {canBrowse ? 'Tap to browse' : 'Connected — upload only'}
                </Text>
              </>
            ) : (
              <>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#334155' }} />
                <Text style={{ color: '#475569', fontSize: 11 }}>Not connected — tap to connect</Text>
              </>
            )}
          </View>
        </View>
        <Ionicons
          name={connected && canBrowse ? 'chevron-forward' : connected ? 'cloud-upload-outline' : 'link-outline'}
          size={18}
          color={connected ? color : '#334155'}
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Upload-only sheet (for others' folders) ──────────────────────────────────

function UploadOnlySheet({
  folderId,
  folderName,
  teamId,
  visible,
  onClose,
}: {
  folderId: string;
  folderName: string;
  teamId: number;
  visible: boolean;
  onClose: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const utils = trpc.useUtils();
  const googleStatusQuery = trpc.googleDrive.googleConnectionStatus.useQuery();

  const handleUpload = async () => {
    if (!googleStatusQuery.data?.connected) {
      Alert.alert(
        'Google Account Required',
        'You need to connect your Google account before uploading files.\n\nGo to Profile → Connections → Connect Google.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setUploading(true);

      const base64 = await readAsBase64(asset.uri);

      await utils.client.googleDrive.driveUploadFile.mutate({
        folderId,
        fileName: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        content: base64,
        teamId,
      });

      Alert.alert('Uploaded', `"${asset.name}" was added to ${folderName}'s folder.`);
      onClose();
    } catch (err: any) {
      Alert.alert('Upload failed', err?.message ?? 'Unknown error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderTopWidth: 1, borderColor: '#1e293b', padding: 24, paddingBottom: 40,
        }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#1e293b', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ color: '#f1f5f9', fontSize: 18, fontWeight: '800', marginBottom: 6 }}>
            Upload to {folderName}
          </Text>
          <Text style={{ color: '#475569', fontSize: 13, marginBottom: 24, lineHeight: 18 }}>
            You can upload files to this folder, but cannot view its contents.
          </Text>

          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading}
            style={{
              backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              shadowColor: '#0ea5e9', shadowRadius: 8, shadowOpacity: 0.35, shadowOffset: { width: 0, height: 3 },
            }}
          >
            {uploading
              ? <ActivityIndicator color="#fff" />
              : <Ionicons name="cloud-upload-outline" size={20} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
              {uploading ? 'Uploading…' : 'Pick & Upload File'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onClose}
            style={{ marginTop: 12, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#475569', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Connect Drive Modal ───────────────────────────────────────────────────────

function ConnectDriveModal({
  visible,
  connectType,
  connectRole,
  onClose,
  onConnect,
}: {
  visible: boolean;
  connectType: 'team' | 'office';
  connectRole: string;
  onClose: () => void;
  onConnect: (url: string, name: string) => void;
}) {
  const [driveUrl, setDriveUrl] = useState('');
  const [driveName, setDriveName] = useState('');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#0f172a', borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderTopWidth: 1, borderColor: '#1e293b', padding: 24, paddingBottom: 40,
        }}>
          <View style={{ width: 40, height: 4, backgroundColor: '#1e293b', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
          <Text style={{ color: '#f1f5f9', fontSize: 20, fontWeight: '800', marginBottom: 6 }}>
            Connect Google Drive
          </Text>
          <Text style={{ color: '#475569', fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
            {connectType === 'team'
              ? 'Paste the URL of your team\'s shared Google Drive folder.'
              : `Paste the Google Drive folder URL for ${connectRole || 'this member'}.`}
          </Text>

          <Text style={labelSt}>Drive URL *</Text>
          <TextInput
            value={driveUrl}
            onChangeText={setDriveUrl}
            placeholder="https://drive.google.com/drive/folders/..."
            placeholderTextColor="#334155"
            style={inputSt}
            autoCapitalize="none"
            keyboardType="url"
          />

          <Text style={labelSt}>Folder Name (optional)</Text>
          <TextInput
            value={driveName}
            onChangeText={setDriveName}
            placeholder={connectType === 'team' ? 'Team Drive' : `${connectRole} Drive`}
            placeholderTextColor="#334155"
            style={inputSt}
          />

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
            <TouchableOpacity
              onPress={onClose}
              style={{ flex: 1, borderWidth: 1, borderColor: '#1e293b', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#475569', fontSize: 14, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (!driveUrl.trim()) { Alert.alert('Required', 'Please enter a Google Drive URL.'); return; }
                onConnect(driveUrl.trim(), driveName.trim());
                setDriveUrl('');
                setDriveName('');
              }}
              disabled={!driveUrl.trim()}
              style={{ flex: 1, backgroundColor: driveUrl.trim() ? '#0ea5e9' : '#1e293b', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; icon: IonIconName }> = {
  project_manager:    { label: 'Project Manager',    color: '#fbbf24', icon: 'briefcase-outline' },
  fullstack_engineer: { label: 'Full Stack Engineer', color: '#38bdf8', icon: 'code-slash-outline' },
  backend_engineer:   { label: 'Backend Engineer',   color: '#34d399', icon: 'server-outline' },
  lead_researcher:    { label: 'Lead Researcher',    color: '#a78bfa', icon: 'search-outline' },
  systems_architect:  { label: 'Systems Architect',  color: '#f472b6', icon: 'git-network-outline' },
  ai_engineer:        { label: 'AI Engineer',        color: '#fb923c', icon: 'hardware-chip-outline' },
  member:             { label: 'Member',             color: '#64748b', icon: 'person-outline' },
};

function getRoleMeta(role?: string | null) {
  return ROLE_META[role ?? 'member'] ?? ROLE_META.member;
}

export default function FilesScreen() {
  const router = useRouter();
  const { activeTeam } = useTeamStore();
  const { user } = useAuthStore();

  // Browsing state — null = home, populated = file browser open
  const [browsingFolder, setBrowsingFolder] = useState<{
    id: string;
    name: string;
    canDelete: boolean;
    canUpload: boolean;
  } | null>(null);

  // Upload-only sheet
  const [uploadOnlyFolder, setUploadOnlyFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Connect modal
  const [connectModal, setConnectModal] = useState<{
    type: 'team' | 'office';
    role: string;
  } | null>(null);

  const [connecting, setConnecting] = useState(false);
  const utils = trpc.useUtils();

  const membersQuery = trpc.teams.getMembers.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id },
  );
  const membersList: any[] = (membersQuery.data as any[]) ?? [];

  const currentMember = membersList.find(
    m => (m.member?.email ?? m.email) === user?.email,
  );
  const myMemberId: number | null =
    currentMember?.member?.id ?? currentMember?.id ?? null;
  const myOfficeRole: string | null = currentMember?.officeRole ?? null;
  const isProjectManager = myOfficeRole === 'project_manager';

  const driveQuery = trpc.googleDrive.getAllDrives.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id },
  );
  const connections: any[] = (driveQuery.data as any[]) ?? [];

  const teamConn = connections.find(c => c.connectionType === 'team');
  const memberConnections: Record<string, any> = {};
  for (const conn of connections) {
    if (conn.connectionType === 'office' && conn.officeRole) {
      memberConnections[conn.officeRole] = conn;
    }
  }

  const connectTeamMutation = trpc.googleDrive.connectTeam.useMutation({
    onSuccess: () => {
      utils.googleDrive.getAllDrives.invalidate();
      setConnectModal(null);
      setConnecting(false);
    },
    onError: (err: any) => { Alert.alert('Error', err.message); setConnecting(false); },
  });

  const connectOfficeMutation = trpc.googleDrive.connectOffice.useMutation({
    onSuccess: () => {
      utils.googleDrive.getAllDrives.invalidate();
      setConnectModal(null);
      setConnecting(false);
    },
    onError: (err: any) => { Alert.alert('Error', err.message); setConnecting(false); },
  });

  const handleConnect = (url: string, name: string) => {
    if (!connectModal || !activeTeam?.id || !myMemberId) return;
    setConnecting(true);
    if (connectModal.type === 'team') {
      connectTeamMutation.mutate({ teamId: activeTeam.id, driveUrl: url, driveName: name || 'Team Drive' });
    } else {
      connectOfficeMutation.mutate({ teamId: activeTeam.id, officeRole: connectModal.role, driveUrl: url, driveName: name || `${connectModal.role} Drive` });
    }
  };

  // If browsing a folder, show the full-screen file browser
  if (browsingFolder) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0f1e' }} edges={['top', 'bottom']}>
        <FileBrowser
          rootFolderId={browsingFolder.id}
          rootName={browsingFolder.name}
          teamId={activeTeam?.id ?? 0}
          canDelete={browsingFolder.canDelete}
          canUpload={browsingFolder.canUpload}
          onClose={() => setBrowsingFolder(null)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0f1e' }}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={driveQuery.isFetching || membersQuery.isFetching}
            onRefresh={() => { driveQuery.refetch(); membersQuery.refetch(); }}
            tintColor="#0ea5e9"
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="arrow-back" size={18} color="#64748b" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#f1f5f9', fontSize: 24, fontWeight: '800' }}>Files</Text>
              {activeTeam && (
                <Text style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>
                  {activeTeam.name} · Google Drive
                </Text>
              )}
            </View>
            {(isProjectManager || !teamConn) && (
              <TouchableOpacity
                onPress={() => setConnectModal({ type: 'team', role: '' })}
                style={{
                  backgroundColor: '#0ea5e9', borderRadius: 12,
                  paddingHorizontal: 14, paddingVertical: 8,
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                }}
              >
                <Ionicons name="link-outline" size={15} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                  {teamConn ? 'Re-link' : 'Connect'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* ── Team Shared Folder ── */}
          <View style={{ marginBottom: 12, marginTop: 4 }}>
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Team Shared
            </Text>
          </View>

          <FolderCard
            title="Team Shared Folder"
            subtitle="Workspace for everyone"
            driveUrl={teamConn?.driveUrl}
            icon="folder-open-outline"
            color="#38bdf8"
            badge="ALL MEMBERS"
            canBrowse
            onPress={() => {
              const folderId = teamConn?.driveUrl ? extractFolderId(teamConn.driveUrl) : null;
              if (folderId) {
                setBrowsingFolder({
                  id: folderId,
                  name: teamConn?.driveName ?? 'Team Shared Folder',
                  canDelete: isProjectManager,
                  canUpload: true,
                });
              }
            }}
            onConnect={() => setConnectModal({ type: 'team', role: '' })}
          />

          {/* ── Member Folders ── */}
          <View style={{ marginBottom: 12, marginTop: 12 }}>
            <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>
              Member Folders
            </Text>
          </View>

          {membersQuery.isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator color="#38bdf8" />
            </View>
          ) : (
            membersList.map((m: any) => {
              const member = m.member ?? m;
              const role: string | null = m.officeRole ?? null;
              const isMe = member.id === myMemberId;
              const roleMeta = getRoleMeta(role);
              const conn = role ? memberConnections[role] : null;
              const folderId = conn?.driveUrl ? extractFolderId(conn.driveUrl) : null;

              // Permission logic
              const canBrowseThis = isMe || isProjectManager;
              const canDeleteThis = isMe || isProjectManager;
              const canUploadThis = true; // everyone can upload

              return (
                <FolderCard
                  key={member.id}
                  title={member.name ?? 'Member'}
                  subtitle={`${roleMeta.label}`}
                  driveUrl={conn?.driveUrl}
                  icon={isMe ? 'person-circle-outline' : roleMeta.icon}
                  color={isMe ? '#34d399' : roleMeta.color}
                  badge={isMe ? 'YOU' : undefined}
                  canBrowse={canBrowseThis}
                  onPress={() => {
                    if (folderId) {
                      if (canBrowseThis) {
                        setBrowsingFolder({
                          id: folderId,
                          name: member.name ?? 'Member Folder',
                          canDelete: canDeleteThis,
                          canUpload: canUploadThis,
                        });
                      } else {
                        setUploadOnlyFolder({ id: folderId, name: member.name ?? 'Member' });
                      }
                    }
                  }}
                  onConnect={(isMe || isProjectManager)
                    ? () => setConnectModal({ type: 'office', role: role ?? '' })
                    : undefined}
                />
              );
            })
          )}

        </View>
      </ScrollView>

      {/* Upload-only sheet for others' folders */}
      {uploadOnlyFolder && (
        <UploadOnlySheet
          folderId={uploadOnlyFolder.id}
          folderName={uploadOnlyFolder.name}
          teamId={activeTeam?.id ?? 0}
          visible
          onClose={() => setUploadOnlyFolder(null)}
        />
      )}

      {/* Connect Drive modal */}
      {connectModal && (
        <ConnectDriveModal
          visible
          connectType={connectModal.type}
          connectRole={connectModal.role}
          onClose={() => setConnectModal(null)}
          onConnect={handleConnect}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const labelSt = {
  color: '#475569',
  fontSize: 11,
  fontWeight: '700' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
  marginBottom: 8,
};

const inputSt = {
  backgroundColor: '#0a0f1e',
  borderWidth: 1,
  borderColor: '#1e293b',
  borderRadius: 14,
  paddingHorizontal: 16,
  paddingVertical: 12,
  color: '#f1f5f9',
  fontSize: 14,
  marginBottom: 16,
};
