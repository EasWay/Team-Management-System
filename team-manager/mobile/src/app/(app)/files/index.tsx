import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { SecureStorage } from '@/lib/secureStorage';
import { format } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

type TabKey = 'drive' | 'local';

interface DriveConnection {
  id: number;
  driveUrl: string;
  driveName: string;
  isActive: boolean;
  connectionType: string;
}

interface FileItem {
  id: number;
  name: string;
  url?: string;
  mimeType?: string;
  size?: number;
  createdAt?: string;
  tags?: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileEmoji(mimeType: string = ''): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.startsWith('audio/')) return '🎵';
  return '📎';
}

// ─── SegmentedControl ─────────────────────────────────────────────────────────
// Pill-style tab switcher. Uses TouchableOpacity only — no ScrollView.
// Active pill = bg-sky-600 with white text (contrast ratio ≥ 4.5:1).
// Inactive = transparent with slate-400 text for clear affordance.

function SegmentedControl({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: 'drive', label: 'Google Drive', icon: '🗂️' },
    { key: 'local', label: 'Local Files', icon: '📁' },
  ];

  return (
    <View
      className="flex-row bg-slate-800 rounded-2xl p-1 mx-5 mb-2"
      style={{ minHeight: 48 }}
      accessibilityRole="tablist"
    >
      {tabs.map(({ key, label, icon }) => {
        const isActive = active === key;
        return (
          <TouchableOpacity
            key={key}
            onPress={() => onChange(key)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={label}
            className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl ${
              isActive ? 'bg-sky-600' : 'bg-transparent'
            }`}
            style={{ minHeight: 40 }}
          >
            <Text className="text-sm" style={{ lineHeight: 18 }}>
              {icon}
            </Text>
            <Text
              className={`text-sm font-semibold ${
                isActive ? 'text-white' : 'text-slate-400'
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── ConnectedDriveCard ───────────────────────────────────────────────────────
// Visual hierarchy: live-dot + drive name as primary label, URL as secondary.
// "Open Drive" CTA is the dominant action; disconnect uses a subtle chevron.
// All interactive targets meet the 48 dp minimum for motor-impaired users.

function ConnectedDriveCard({
  drive,
  onDisconnect,
}: {
  drive: DriveConnection;
  onDisconnect: (id: number, name: string) => void;
}) {
  const displayName = drive.driveName || 'Team Drive';

  return (
    <View className="mx-5 mb-4">
      {/* Card shell */}
      <View
        className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 6,
        }}
      >
        {/* Top stripe — adds premium depth without a gradient library */}
        <View className="h-0.5 bg-sky-600/40" />

        <View className="p-4">
          {/* Drive identity row */}
          <View className="flex-row items-center mb-4">
            {/* Live indicator */}
            <View className="mr-3 items-center justify-center" style={{ width: 16, height: 16 }}>
              <View
                className="bg-emerald-500 rounded-full"
                style={{ width: 10, height: 10 }}
              />
            </View>

            {/* Name + URL */}
            <View className="flex-1 min-w-0 mr-2">
              <Text
                className="text-white font-semibold text-base leading-5"
                numberOfLines={1}
              >
                {displayName}
              </Text>
              <Text
                className="text-slate-400 text-xs mt-0.5 leading-4"
                numberOfLines={1}
              >
                {drive.driveUrl}
              </Text>
            </View>

            {/* Status badge */}
            <View className="bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2.5 py-1">
              <Text className="text-emerald-400 text-xs font-semibold">Active</Text>
            </View>
          </View>

          {/* Divider */}
          <View className="h-px bg-slate-700/50 mb-4" />

          {/* Action row */}
          <View className="flex-row gap-2.5">
            {/* Open Drive — primary CTA */}
            <TouchableOpacity
              onPress={() => Linking.openURL(drive.driveUrl)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open Google Drive"
              className="flex-1 bg-sky-600 rounded-xl flex-row items-center justify-center gap-2 px-4"
              style={{ minHeight: 44 }}
            >
              <Text className="text-white font-semibold text-sm">Open Drive</Text>
              <Text className="text-white text-sm">↗</Text>
            </TouchableOpacity>

            {/* Disconnect — secondary, destructive intent */}
            <TouchableOpacity
              onPress={() => onDisconnect(drive.id, displayName)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Disconnect drive"
              className="bg-slate-700/60 border border-slate-600/60 rounded-xl items-center justify-center px-4"
              style={{ minHeight: 44 }}
            >
              <Text className="text-slate-300 text-sm font-medium">Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Shared-files hint — below card so it doesn't clutter the card itself */}
      <View className="flex-row items-center justify-center gap-1.5 mt-3">
        <View className="bg-slate-700 rounded-full" style={{ width: 4, height: 4 }} />
        <Text className="text-slate-500 text-xs">
          Files are shared across all devices via Google Drive
        </Text>
        <View className="bg-slate-700 rounded-full" style={{ width: 4, height: 4 }} />
      </View>
    </View>
  );
}

// ─── DriveEmptyState ──────────────────────────────────────────────────────────
// Follows the "recognition over recall" principle: clearly shows what Google
// Drive integration does before asking the user to commit to it.

function DriveEmptyState({ onPress }: { onPress: () => void }) {
  return (
    <View className="items-center px-8 pt-8 pb-6">
      {/* Icon container with layered rings for depth */}
      <View className="items-center justify-center mb-6">
        <View
          className="bg-slate-800/40 border border-slate-700/40 rounded-full items-center justify-center"
          style={{ width: 120, height: 120 }}
        >
          <View
            className="bg-slate-800 border border-slate-700/60 rounded-full items-center justify-center"
            style={{ width: 88, height: 88 }}
          >
            <Text style={{ fontSize: 40 }}>🗂️</Text>
          </View>
        </View>
      </View>

      {/* Headline */}
      <Text className="text-white text-2xl font-bold text-center mb-2 tracking-tight">
        Connect Google Drive
      </Text>

      {/* Supporting copy */}
      <Text className="text-slate-400 text-sm text-center leading-6 mb-2">
        Share files with your team across all devices and environments.
        Keep everyone in sync with a single shared folder.
      </Text>

      {/* Feature bullets — reduces cognitive load on the CTA */}
      <View className="self-stretch bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 mb-8 gap-3">
        {[
          { icon: '🔄', text: 'Always in sync across all team members' },
          { icon: '📂', text: 'Organise files in any Drive folder structure' },
          { icon: '🔒', text: 'Access controlled via Google Drive permissions' },
        ].map(({ icon, text }) => (
          <View key={text} className="flex-row items-center gap-3">
            <Text className="text-base">{icon}</Text>
            <Text className="text-slate-300 text-sm flex-1 leading-5">{text}</Text>
          </View>
        ))}
      </View>

      {/* Primary CTA */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Connect Google Drive"
        className="bg-sky-600 rounded-2xl items-center justify-center w-full"
        style={{ minHeight: 52 }}
      >
        <Text className="text-white font-bold text-base">Connect Drive</Text>
      </TouchableOpacity>

      {/* Fine-print hint */}
      <Text className="text-slate-600 text-xs text-center mt-4 leading-5">
        Share your Google Drive folder with the team{'\n'}and paste the share link here
      </Text>
    </View>
  );
}

// ─── ConnectDriveModal ────────────────────────────────────────────────────────
// Bottom-sheet modal. Keyboard-aware so inputs never hide behind the keyboard.
// Scrim tap dismisses — consistent with mobile OS conventions (Fitts' Law: large dismiss target).
// Fields reset on close to prevent stale data leaking between sessions.

function ConnectDriveModal({
  visible,
  connecting,
  onConnect,
  onCancel,
}: {
  visible: boolean;
  connecting: boolean;
  onConnect: (url: string, name: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [urlTouched, setUrlTouched] = useState(false);

  const urlError = urlTouched && url.trim().length === 0;

  const handleSubmit = () => {
    setUrlTouched(true);
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('URL required', 'Please paste your Google Drive folder link.');
      return;
    }
    onConnect(trimmed, name.trim());
  };

  const handleCancel = () => {
    setUrl('');
    setName('');
    setUrlTouched(false);
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      {/* Full-screen scrim — large dismiss target per Fitts' Law */}
      <Pressable
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.65)' }}
        onPress={handleCancel}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Sheet interior — stopPropagation prevents scrim dismiss */}
          <Pressable onPress={() => {}}>
            <View
              className="bg-slate-900 rounded-t-3xl border-t border-slate-700/50"
              style={{ paddingBottom: Platform.OS === 'ios' ? 40 : 24 }}
            >
              {/* Drag handle */}
              <View className="items-center pt-3 pb-4">
                <View className="w-10 h-1 bg-slate-700 rounded-full" />
              </View>

              <View className="px-5">
                {/* Sheet header */}
                <View className="flex-row items-center gap-3 mb-1">
                  <Text style={{ fontSize: 28 }}>🗂️</Text>
                  <Text className="text-white text-xl font-bold flex-1">
                    Connect Google Drive
                  </Text>
                </View>
                <Text className="text-slate-400 text-sm leading-5 mb-6">
                  Share your Google Drive folder with the team and paste the link here.
                </Text>

                {/* Drive URL field */}
                <Text className="text-slate-300 text-sm font-medium mb-1.5">
                  Drive Link{' '}
                  <Text className="text-red-400">*</Text>
                </Text>
                <TextInput
                  value={url}
                  onChangeText={(v) => {
                    setUrl(v);
                    setUrlTouched(true);
                  }}
                  onBlur={() => setUrlTouched(true)}
                  placeholder="Paste your Google Drive folder link"
                  placeholderTextColor="#475569"
                  autoCorrect={false}
                  autoCapitalize="none"
                  keyboardType="url"
                  returnKeyType="next"
                  selectionColor="#0ea5e9"
                  className={`bg-slate-800 rounded-xl px-4 text-white text-sm mb-1 border ${
                    urlError ? 'border-red-500/70' : 'border-slate-700'
                  }`}
                  style={{ minHeight: 48 }}
                />
                {urlError && (
                  <Text className="text-red-400 text-xs mb-3 ml-1">
                    Drive link is required
                  </Text>
                )}
                {!urlError && <View className="mb-4" />}

                {/* Drive name field */}
                <Text className="text-slate-300 text-sm font-medium mb-1.5">
                  Drive Name{' '}
                  <Text className="text-slate-500 text-xs font-normal">(optional)</Text>
                </Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Drive name (optional)"
                  placeholderTextColor="#475569"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  selectionColor="#0ea5e9"
                  className="bg-slate-800 border border-slate-700 rounded-xl px-4 text-white text-sm mb-6"
                  style={{ minHeight: 48 }}
                />

                {/* Action buttons — equal width for balance, primary right (natural reading flow) */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={handleCancel}
                    disabled={connecting}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-xl items-center justify-center"
                    style={{ minHeight: 48 }}
                  >
                    <Text className="text-slate-300 font-semibold text-sm">Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={connecting}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Connect drive"
                    className={`flex-1 rounded-xl items-center justify-center ${
                      connecting ? 'bg-sky-700' : 'bg-sky-600'
                    }`}
                    style={{ minHeight: 48, opacity: connecting ? 0.8 : 1 }}
                  >
                    {connecting ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text className="text-white font-bold text-sm">Connect</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

// ─── UploadActionRow ──────────────────────────────────────────────────────────
// Two upload actions side-by-side. Photo = secondary (slate), Upload = primary (sky).
// When uploading, both disable and the primary shows a spinner (feedback law).

function UploadActionRow({
  uploading,
  onPickImage,
  onPickDocument,
}: {
  uploading: boolean;
  onPickImage: () => void;
  onPickDocument: () => void;
}) {
  return (
    <View className="flex-row gap-3 px-5 pb-4">
      {/* Photo picker — secondary action */}
      <TouchableOpacity
        onPress={onPickImage}
        disabled={uploading}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Pick photo"
        className={`flex-1 bg-slate-800 border border-slate-700/60 rounded-xl flex-row items-center justify-center gap-2 ${
          uploading ? 'opacity-50' : ''
        }`}
        style={{ minHeight: 48 }}
      >
        <Text className="text-base">📷</Text>
        <Text className="text-slate-200 text-sm font-semibold">Photo</Text>
      </TouchableOpacity>

      {/* Document picker — primary upload action */}
      <TouchableOpacity
        onPress={onPickDocument}
        disabled={uploading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Upload file"
        className={`flex-1 rounded-xl flex-row items-center justify-center gap-2 ${
          uploading ? 'bg-sky-700 opacity-75' : 'bg-sky-600'
        }`}
        style={{ minHeight: 48 }}
      >
        {uploading ? (
          <>
            <ActivityIndicator color="#fff" size="small" />
            <Text className="text-white text-sm font-semibold">Uploading…</Text>
          </>
        ) : (
          <>
            <Text className="text-base">⬆️</Text>
            <Text className="text-white text-sm font-semibold">Upload File</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── FileCard ─────────────────────────────────────────────────────────────────
// Left: file-type icon in a rounded container (object recognition).
// Centre: file name + meta (size, date) in vertical stack.
// Right: Open + Delete actions — vertically stacked to preserve row height.

function FileCard({
  item,
  onOpen,
  onDelete,
}: {
  item: FileItem;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      className="bg-slate-800/60 border border-slate-700/50 rounded-2xl px-4 py-3 mb-3 flex-row items-center"
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      {/* File type icon */}
      <View
        className="bg-slate-700/70 border border-slate-600/40 rounded-xl items-center justify-center mr-3"
        style={{ width: 44, height: 44 }}
      >
        <Text style={{ fontSize: 22 }}>{fileEmoji(item.mimeType)}</Text>
      </View>

      {/* File metadata */}
      <View className="flex-1 min-w-0 mr-2">
        <Text
          className="text-white font-semibold text-sm leading-5"
          numberOfLines={1}
        >
          {item.name}
        </Text>

        {/* Secondary meta row */}
        <View className="flex-row items-center gap-1.5 mt-0.5 flex-wrap">
          {item.size != null && (
            <Text className="text-slate-500 text-xs">
              {formatBytes(item.size)}
            </Text>
          )}
          {item.size != null && item.createdAt && (
            <Text className="text-slate-700 text-xs">·</Text>
          )}
          {item.createdAt && (
            <Text className="text-slate-500 text-xs">
              {format(new Date(item.createdAt), 'MMM d, yyyy')}
            </Text>
          )}
        </View>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View className="flex-row gap-1 mt-1.5 flex-wrap">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} label={tag} variant="default" />
            ))}
          </View>
        )}
      </View>

      {/* Actions — right-aligned, vertical stack avoids crowding */}
      <View className="items-center gap-0.5">
        {item.url && (
          <TouchableOpacity
            onPress={onOpen}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.name}`}
            className="items-center justify-center rounded-xl px-3"
            style={{ minHeight: 40, minWidth: 44 }}
          >
            <Text className="text-sky-400 text-sm font-semibold">Open</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onDelete}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${item.name}`}
          className="items-center justify-center rounded-xl"
          style={{ minHeight: 40, minWidth: 44 }}
        >
          <Text className="text-slate-500 text-sm font-medium">Del</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── SectionDivider ───────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3 px-5 mb-3">
      <View className="flex-1 h-px bg-slate-800" />
      <Text className="text-slate-600 text-xs font-medium uppercase tracking-widest">
        {label}
      </Text>
      <View className="flex-1 h-px bg-slate-800" />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FilesScreen() {
  const { activeTeam } = useTeamStore();
  const teamId = activeTeam?.id ?? 0;

  const [activeTab, setActiveTab] = useState<TabKey>('drive');
  const [uploading, setUploading] = useState(false);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const utils = trpc.useUtils();

  // ── Queries ────────────────────────────────────────────────────────────────
  const teamDriveQuery = trpc.googleDrive.getTeamDrive.useQuery(
    { teamId },
    { enabled: !!teamId }
  );

  const filesQuery = trpc.files.list.useQuery(
    { teamId },
    { enabled: !!teamId }
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const connectMutation = trpc.googleDrive.connectTeam.useMutation({
    onSuccess: () => {
      utils.googleDrive.getTeamDrive.invalidate({ teamId });
      utils.googleDrive.getAllDrives.invalidate({ teamId });
      setConnectModalOpen(false);
      setConnecting(false);
    },
    onError: (err) => {
      setConnecting(false);
      Alert.alert('Connection failed', err.message);
    },
  });

  const disconnectMutation = trpc.googleDrive.disconnect.useMutation({
    onSuccess: () => {
      utils.googleDrive.getTeamDrive.invalidate({ teamId });
      utils.googleDrive.getAllDrives.invalidate({ teamId });
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const deleteMutation = trpc.files.delete.useMutation({
    onSuccess: () => utils.files.list.invalidate(),
    onError: (err) => Alert.alert('Error', err.message),
  });

  // ── Upload helpers ─────────────────────────────────────────────────────────
  const uploadFile = async (uri: string, name: string, type: string) => {
    setUploading(true);
    try {
      const token = await SecureStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
      const formData = new FormData();
      formData.append('file', { uri, name, type } as any);
      if (teamId) formData.append('teamId', String(teamId));

      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      await utils.files.list.invalidate();
      Alert.alert('Uploaded', `${name} was uploaded successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert('Upload Error', msg);
    } finally {
      setUploading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      await uploadFile(
        asset.uri,
        asset.name,
        asset.mimeType ?? 'application/octet-stream'
      );
    } catch {
      Alert.alert('Error', 'Could not open document picker.');
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        'Please grant photo library access in Settings.'
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
    await uploadFile(
      asset.uri,
      name,
      asset.type === 'video' ? 'video/mp4' : 'image/jpeg'
    );
  };

  const handleDelete = (fileId: number, name: string) => {
    Alert.alert('Delete File', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate({ id: fileId }),
      },
    ]);
  };

  const handleConnect = (url: string, name: string) => {
    setConnecting(true);
    connectMutation.mutate({
      teamId,
      driveUrl: url,
      driveName: name || undefined,
    });
  };

  const handleDisconnect = (connectionId: number, driveName: string) => {
    Alert.alert(
      'Disconnect Drive',
      `Disconnect "${driveName}" from this team? Files on Google Drive will not be deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnectMutation.mutate({ connectionId }),
        },
      ]
    );
  };

  // ── Derived state ──────────────────────────────────────────────────────────
  const drive = (teamDriveQuery.data ?? null) as DriveConnection | null;
  const files = (filesQuery.data as FileItem[] | undefined) ?? [];

  const isInitialLoad =
    (activeTab === 'drive' && teamDriveQuery.isLoading && !teamDriveQuery.data) ||
    (activeTab === 'local' && filesQuery.isLoading && !filesQuery.data);

  if (isInitialLoad) return <LoadingScreen />;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-slate-950" edges={['top']}>

      {/* ── Header ── */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-2xl font-bold text-white tracking-tight">
              Files
            </Text>
            {activeTeam?.name && (
              <Text className="text-slate-500 text-sm mt-0.5">
                {activeTeam.name}
              </Text>
            )}
          </View>

          {/* Contextual hint badge */}
          {activeTab === 'drive' && drive && (
            <View className="bg-emerald-500/15 border border-emerald-500/25 rounded-full px-3 py-1">
              <Text className="text-emerald-400 text-xs font-semibold">
                Drive Connected
              </Text>
            </View>
          )}
          {activeTab === 'local' && (
            <View className="bg-slate-800 border border-slate-700/60 rounded-full px-3 py-1">
              <Text className="text-slate-400 text-xs font-semibold">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Segmented control ── */}
      <View className="pb-2">
        <SegmentedControl active={activeTab} onChange={setActiveTab} />
      </View>

      {/* ── Google Drive tab ── */}
      {activeTab === 'drive' && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 48, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={teamDriveQuery.isFetching}
              onRefresh={() => teamDriveQuery.refetch()}
              tintColor="#0ea5e9"
            />
          }
        >
          {drive ? (
            <>
              <View className="pt-2" />
              <ConnectedDriveCard
                drive={drive}
                onDisconnect={handleDisconnect}
              />

              {/* Additional drives section — getAllDrives awareness */}
              <AllDrivesSection teamId={teamId} activeDriveId={drive.id} onDisconnect={handleDisconnect} />
            </>
          ) : (
            <DriveEmptyState onPress={() => setConnectModalOpen(true)} />
          )}
        </ScrollView>
      )}

      {/* ── Local files tab ── */}
      {activeTab === 'local' && (
        <>
          <View className="pt-1" />
          <UploadActionRow
            uploading={uploading}
            onPickImage={handlePickImage}
            onPickDocument={handlePickDocument}
          />

          {files.length > 0 && <SectionDivider label="Uploaded files" />}

          <FlatList
            data={files}
            keyExtractor={(item) => String(item.id)}
            refreshControl={
              <RefreshControl
                refreshing={filesQuery.isFetching}
                onRefresh={() => filesQuery.refetch()}
                tintColor="#0ea5e9"
              />
            }
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 48,
              flexGrow: 1,
            }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="flex-1 pt-6">
                <EmptyState
                  title="No local files yet"
                  description="Upload a photo or file to share it with your team."
                  icon="📂"
                />
              </View>
            }
            renderItem={({ item }) => (
              <FileCard
                item={item}
                onOpen={() => Linking.openURL(item.url!)}
                onDelete={() => handleDelete(item.id, item.name)}
              />
            )}
          />
        </>
      )}

      {/* ── Connect drive modal ── */}
      <ConnectDriveModal
        visible={connectModalOpen}
        connecting={connecting}
        onConnect={handleConnect}
        onCancel={() => setConnectModalOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── AllDrivesSection ─────────────────────────────────────────────────────────
// Shows additional drive connections beyond the primary one.
// Keeps the primary card prominent (Gestalt figure/ground) while surfacing
// extra connections for power users.

function AllDrivesSection({
  teamId,
  activeDriveId,
  onDisconnect,
}: {
  teamId: number;
  activeDriveId: number;
  onDisconnect: (id: number, name: string) => void;
}) {
  const allDrivesQuery = trpc.googleDrive.getAllDrives.useQuery(
    { teamId },
    { enabled: !!teamId }
  );

  const extras = ((allDrivesQuery.data ?? []) as DriveConnection[]).filter(
    (d) => d.id !== activeDriveId
  );

  if (!extras.length) return null;

  return (
    <View className="mt-2">
      <SectionDivider label="Other connections" />
      {extras.map((d) => (
        <ConnectedDriveCard
          key={d.id}
          drive={d}
          onDisconnect={onDisconnect}
        />
      ))}
    </View>
  );
}
