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
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { API_BASE_URL, STORAGE_KEYS } from '@/lib/constants';
import { SecureStorage } from '@/lib/secureStorage';
import { format } from 'date-fns';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string = ''): { icon: IconName; color: string } {
  if (mimeType.startsWith('image/'))   return { icon: 'image-outline',         color: '#38bdf8' };
  if (mimeType === 'application/pdf')  return { icon: 'document-text-outline', color: '#f87171' };
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return { icon: 'grid-outline', color: '#4ade80' };
  if (mimeType.includes('word') || mimeType.includes('document'))
    return { icon: 'document-outline', color: '#60a5fa' };
  if (mimeType.includes('zip') || mimeType.includes('archive'))
    return { icon: 'archive-outline', color: '#fb923c' };
  return { icon: 'attach-outline', color: '#94a3b8' };
}

export default function FilesScreen() {
  const router = useRouter();
  const { activeTeam } = useTeamStore();
  const [uploading, setUploading] = useState(false);

  const utils = trpc.useUtils();

  const filesQuery = trpc.files.list.useQuery(
    { teamId: activeTeam?.id ?? 0 },
    { enabled: !!activeTeam?.id }
  );

  const deleteMutation = trpc.files.delete.useMutation({
    onSuccess: () => utils.files.list.invalidate(),
    onError: (err: any) => Alert.alert('Error', err.message),
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
      Alert.alert('Uploaded!', `${name} uploaded successfully.`);
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
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">

      {/* Header */}
      <View className="px-5 pt-5 pb-4">
        <View className="flex-row items-center gap-3 mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={18} color="#64748b" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-900 dark:text-white">Files</Text>
            <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </Text>
          </View>
        </View>

        {/* Upload buttons */}
        <View className="flex-row gap-2">
          <TouchableOpacity
            onPress={handlePickImage}
            disabled={uploading}
            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl py-3 flex-row items-center justify-center gap-2"
          >
            <Ionicons name="camera-outline" size={16} color="#64748b" />
            <Text className="text-slate-600 dark:text-slate-300 text-sm font-medium">Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePickDocument}
            disabled={uploading}
            className={`flex-1 rounded-2xl py-3 flex-row items-center justify-center gap-2 ${
              uploading ? 'bg-slate-300 dark:bg-slate-700' : 'bg-sky-500'
            }`}
            style={!uploading ? { shadowColor: '#0ea5e9', shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } } : undefined}
          >
            <Ionicons name="cloud-upload-outline" size={16} color={uploading ? '#94a3b8' : '#fff'} />
            <Text className={`text-sm font-bold ${uploading ? 'text-slate-400 dark:text-slate-500' : 'text-white'}`}>
              {uploading ? 'Uploading…' : 'Upload'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* File list */}
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
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        ListEmptyComponent={
          <EmptyState
            title="No files yet"
            description="Upload your first file above."
            icon="folder-open-outline"
            iconColor="#38bdf8"
          />
        }
        renderItem={({ item }) => {
          const { icon: fIcon, color: fColor } = fileIcon(item.mimeType);
          return (
            <View
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-200 dark:border-slate-700 flex-row items-center"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}
            >
              {/* File icon */}
              <View
                className="w-12 h-12 rounded-2xl items-center justify-center mr-3 flex-shrink-0"
                style={{ backgroundColor: fColor + '1a' }}
              >
                <Ionicons name={fIcon} size={22} color={fColor} />
              </View>

              {/* Info */}
              <View className="flex-1 min-w-0">
                <Text className="text-slate-900 dark:text-white font-semibold text-sm" numberOfLines={1}>
                  {item.name}
                </Text>
                <View className="flex-row gap-2 mt-1 items-center">
                  {item.size != null && (
                    <Text className="text-slate-400 dark:text-slate-500 text-xs">{formatBytes(item.size)}</Text>
                  )}
                  {item.size != null && item.createdAt && (
                    <Text className="text-slate-300 dark:text-slate-600 text-xs">·</Text>
                  )}
                  {item.createdAt && (
                    <Text className="text-slate-400 dark:text-slate-500 text-xs">
                      {format(new Date(item.createdAt), 'MMM d')}
                    </Text>
                  )}
                </View>
                {item.tags?.length > 0 && (
                  <View className="flex-row gap-1 mt-1.5 flex-wrap">
                    {item.tags.slice(0, 3).map((tag: string) => (
                      <View key={tag} className="bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-0.5">
                        <Text className="text-slate-500 dark:text-slate-400 text-xs">{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Actions */}
              <View className="flex-row gap-3 ml-2">
                {item.url && (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(item.url)}
                    className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-900/30 items-center justify-center"
                  >
                    <Ionicons name="open-outline" size={16} color="#0ea5e9" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleDelete(item.id, item.name)}
                  className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 items-center justify-center"
                >
                  <Ionicons name="trash-outline" size={16} color="#f87171" />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
