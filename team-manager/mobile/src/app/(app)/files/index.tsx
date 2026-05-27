import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
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
  return '📎';
}

export default function FilesScreen() {
  const { activeTeam } = useTeamStore();
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();

  const filesQuery = trpc.files.list.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const deleteMutation = trpc.files.delete.useMutation({
    onSuccess: () => utils.files.list.invalidate(),
    onError: (err) => Alert.alert('Error', err.message),
  });

  const uploadFile = async (uri: string, name: string, type: string) => {
    setUploading(true);
    try {
      const token = await SecureStorage.get(STORAGE_KEYS.ACCESS_TOKEN);
      const formData = new FormData();
      formData.append('file', { uri, name, type } as any);
      if (activeTeam?.id) formData.append('teamId', String(activeTeam.id));

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
      Alert.alert('Success', `${name} uploaded successfully.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert('Upload Error', msg);
    } finally {
      setUploading(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const asset = result.assets[0];
      await uploadFile(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
    } catch {
      Alert.alert('Error', 'Could not open document picker.');
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Please grant photo library access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All });
    if (result.canceled) return;
    const asset = result.assets[0];
    const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
    await uploadFile(asset.uri, name, asset.type === 'video' ? 'video/mp4' : 'image/jpeg');
  };

  const handleDelete = (fileId: number, name: string) => {
    Alert.alert('Delete File', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate({ id: fileId }) },
    ]);
  };

  const files = (filesQuery.data as any[] ?? []);

  if (filesQuery.isLoading && !filesQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-2xl font-bold text-white">Files</Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handlePickImage}
              disabled={uploading}
              className="bg-slate-700 rounded-xl px-3 py-2"
            >
              <Text className="text-slate-200 text-sm">📷 Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickDocument}
              disabled={uploading}
              className={`rounded-xl px-3 py-2 ${uploading ? 'bg-slate-700 opacity-60' : 'bg-sky-600'}`}
            >
              <Text className="text-white text-sm font-semibold">
                {uploading ? 'Uploading...' : '⬆️ Upload'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* File list */}
      <FlatList
        data={files}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={filesQuery.isFetching} onRefresh={() => filesQuery.refetch()} tintColor="#0ea5e9" />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState title="No files yet" description="Upload your first file above." icon="📂" />
        }
        renderItem={({ item }) => (
          <View className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700 flex-row items-center">
            <Text className="text-3xl mr-3">{fileEmoji(item.mimeType)}</Text>
            <View className="flex-1 min-w-0">
              <Text className="text-white font-semibold" numberOfLines={1}>{item.name}</Text>
              <View className="flex-row gap-2 mt-1 flex-wrap">
                {item.size != null && (
                  <Text className="text-slate-500 text-xs">{formatBytes(item.size)}</Text>
                )}
                {item.createdAt && (
                  <Text className="text-slate-500 text-xs">
                    {format(new Date(item.createdAt), 'MMM d')}
                  </Text>
                )}
              </View>
              {item.tags?.length > 0 && (
                <View className="flex-row gap-1 mt-2 flex-wrap">
                  {item.tags.slice(0, 3).map((tag: string) => (
                    <Badge key={tag} label={tag} variant="default" />
                  ))}
                </View>
              )}
            </View>
            <View className="flex-row gap-3 ml-3">
              {item.url && (
                <TouchableOpacity onPress={() => Linking.openURL(item.url)}>
                  <Text className="text-sky-400 text-sm">Open</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => handleDelete(item.id, item.name)}>
                <Text className="text-red-400 text-sm">🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
