import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { trpc } from '@/lib/api';
import { LoadingScreen } from '@/components/LoadingScreen';
import { EmptyState } from '@/components/EmptyState';
import { format } from 'date-fns';

const SERVICE_COLORS: Record<string, string> = {
  design:     '#a78bfa',
  development:'#38bdf8',
  consulting: '#fb923c',
  support:    '#34d399',
  other:      '#94a3b8',
};

function getServiceColor(type: string): string {
  const key = type?.toLowerCase() ?? '';
  for (const [k, v] of Object.entries(SERVICE_COLORS)) {
    if (key.includes(k)) return v;
  }
  return SERVICE_COLORS.other;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function MessagesScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<any>(null);

  const messagesQuery = trpc.messages.list.useQuery(undefined);
  const messages = (messagesQuery.data as any[] ?? []);

  if (messagesQuery.isLoading && !messagesQuery.data) return <LoadingScreen />;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-800 items-center justify-center">
          <Ionicons name="arrow-back" size={18} color="#64748b" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-2xl font-bold text-slate-900 dark:text-white">Messages</Text>
          <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">Client inquiries & requests</Text>
        </View>
        <View className="bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-700 rounded-xl px-3 py-1">
          <Text className="text-sky-600 dark:text-sky-300 text-xs font-bold">{messages.length} total</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={messagesQuery.isFetching}
            onRefresh={() => messagesQuery.refetch()}
            tintColor="#0ea5e9"
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState
            title="No messages yet"
            description="Client inquiries will appear here."
            icon="mail-outline"
            iconColor="#38bdf8"
          />
        }
        renderItem={({ item }) => {
          const color = getServiceColor(item.serviceType);
          return (
            <TouchableOpacity
              onPress={() => setSelected(item)}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-3 border border-slate-200 dark:border-slate-700"
              style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 }}
            >
              <View className="flex-row items-start gap-3">
                {/* Avatar */}
                <View
                  className="w-11 h-11 rounded-full items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: color + '22' }}
                >
                  <Text className="font-bold text-sm" style={{ color }}>
                    {getInitials(item.clientName)}
                  </Text>
                </View>

                {/* Content */}
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-start justify-between gap-2">
                    <Text className="text-slate-900 dark:text-white font-semibold text-base flex-1" numberOfLines={1}>
                      {item.clientName}
                    </Text>
                    {item.createdAt && (
                      <Text className="text-slate-400 dark:text-slate-500 text-xs flex-shrink-0">
                        {format(new Date(item.createdAt), 'MMM d')}
                      </Text>
                    )}
                  </View>
                  <Text className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">{item.clientEmail}</Text>
                  <Text className="text-slate-600 dark:text-slate-300 text-sm mt-1.5" numberOfLines={2}>
                    {item.details}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-2">
                    <View
                      className="rounded-lg px-2.5 py-1"
                      style={{ backgroundColor: color + '18' }}
                    >
                      <Text className="text-xs font-medium capitalize" style={{ color }}>
                        {item.serviceType}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <View
            className="bg-white dark:bg-slate-900 rounded-t-3xl px-5 pt-6 pb-12 border-t border-slate-200 dark:border-slate-700"
            style={{ maxHeight: '80%' }}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Handle */}
              <View className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full self-center mb-5" />

              {/* Header */}
              <View className="flex-row justify-between items-start mb-5">
                <View className="flex-1">
                  <Text className="text-xl font-bold text-slate-900 dark:text-white">{selected?.clientName}</Text>
                  <Text className="text-sky-500 dark:text-sky-400 text-sm mt-0.5">{selected?.clientEmail}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelected(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 items-center justify-center"
                >
                  <Ionicons name="close" size={16} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* Service type badge */}
              {selected?.serviceType && (
                <View className="mb-5">
                  <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Service Type</Text>
                  <View
                    className="self-start rounded-xl px-4 py-2"
                    style={{ backgroundColor: getServiceColor(selected.serviceType) + '22' }}
                  >
                    <Text
                      className="font-semibold capitalize text-sm"
                      style={{ color: getServiceColor(selected.serviceType) }}
                    >
                      {selected.serviceType}
                    </Text>
                  </View>
                </View>
              )}

              {/* Message details */}
              <View className="mb-5">
                <Text className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Message</Text>
                <View className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700">
                  <Text className="text-slate-700 dark:text-slate-200 text-sm leading-6">{selected?.details}</Text>
                </View>
              </View>

              {/* Date */}
              {selected?.createdAt && (
                <View className="flex-row items-center gap-2">
                  <Ionicons name="time-outline" size={14} color="#64748b" />
                  <Text className="text-slate-400 dark:text-slate-500 text-xs">
                    Received {format(new Date(selected.createdAt), 'MMMM d, yyyy · h:mm a')}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
