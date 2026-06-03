import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Alert } from '@/components/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Calendar } from 'react-native-calendars';
import { useColorScheme } from 'nativewind';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/Button';
import { format, startOfMonth, endOfMonth } from 'date-fns';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const EVENT_TYPES: { key: string; label: string; icon: IconName; color: string }[] = [
  { key: 'meeting',   label: 'Meeting',   icon: 'people-outline',    color: '#888888' },
  { key: 'deadline',  label: 'Deadline',  icon: 'alarm-outline',     color: '#f87171' },
  { key: 'milestone', label: 'Milestone', icon: 'flag-outline',      color: '#888888' },
  { key: 'review',    label: 'Review',    icon: 'eye-outline',       color: '#AAAAAA' },
  { key: 'other',     label: 'Other',     icon: 'calendar-outline',  color: '#888888' },
];

function getEventType(type: string) {
  return EVENT_TYPES.find((e) => e.key === type) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

export default function CalendarScreen() {
  const router = useRouter();
  const { activeTeam } = useTeamStore();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [eventType, setEventType] = useState('meeting');

  const utils = trpc.useUtils();

  const now = new Date(selectedDate);
  const eventsQuery = trpc.calendar.getEvents.useQuery(
    {
      teamId: activeTeam?.id ?? 0,
      startDate: startOfMonth(now),
      endDate: endOfMonth(now),
    },
    { enabled: !!activeTeam?.id }
  );

  const createMutation = trpc.calendar.createEvent.useMutation({
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      utils.calendar.getEvents.invalidate();
      setShowCreate(false);
      setTitle('');
      setDescription('');
    },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const deleteMutation = trpc.calendar.deleteEvent.useMutation({
    onSuccess: () => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); utils.calendar.getEvents.invalidate(); },
    onError: (err: any) => Alert.alert('Error', err.message),
  });

  const events = (eventsQuery.data as any[] ?? []);

  const markedDates = events.reduce(
    (acc: Record<string, any>, event: any) => {
      const dateStr = format(new Date(event.startDate), 'yyyy-MM-dd');
      const evType = getEventType(event.type);
      acc[dateStr] = {
        marked: true,
        dotColor: evType.color,
        ...(dateStr === selectedDate ? { selected: true, selectedColor: isDark ? '#FFFFFF' : '#0A0A0A' } : {}),
      };
      return acc;
    },
    { [selectedDate]: { selected: true, selectedColor: isDark ? '#FFFFFF' : '#0A0A0A' } }
  );

  const dayEvents = events.filter((e: any) => {
    const dateStr = format(new Date(e.startDate), 'yyyy-MM-dd');
    return dateStr === selectedDate;
  });

  const handleCreate = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Event title is required.');
      return;
    }
    const startDate = new Date(`${selectedDate}T${startTime}:00`);
    const endDate = new Date(`${selectedDate}T${endTime}:00`);
    const eventTypeMap: Record<string, string> = {
      meeting: 'meeting',
      deadline: 'deadline',
      milestone: 'milestone',
      review: 'office_hours',
      other: 'personal',
    };
    createMutation.mutate({
      title: title.trim(),
      description: description.trim(),
      startDate,
      endDate,
      eventType: (eventTypeMap[eventType] ?? 'meeting') as any,
      teamId: activeTeam!.id,
    });
  };

  if (eventsQuery.isLoading && !eventsQuery.data) return <LoadingScreen />;

  // Calendar theme based on color scheme
  const calTheme = isDark
    ? {
        backgroundColor: '#000000',
        calendarBackground: '#000000',
        textSectionTitleColor: '#888888',
        selectedDayBackgroundColor: '#FFFFFF',
        selectedDayTextColor: '#000000',
        todayTextColor: '#FFFFFF',
        dayTextColor: '#F2F2F2',
        textDisabledColor: '#444444',
        arrowColor: '#FFFFFF',
        monthTextColor: '#F2F2F2',
        indicatorColor: '#FFFFFF',
        dotColor: '#FFFFFF',
      }
    : {
        backgroundColor: '#F5F5F5',
        calendarBackground: '#F5F5F5',
        textSectionTitleColor: '#AAAAAA',
        selectedDayBackgroundColor: '#0A0A0A',
        selectedDayTextColor: '#FFFFFF',
        todayTextColor: '#0A0A0A',
        dayTextColor: '#0A0A0A',
        textDisabledColor: '#CCCCCC',
        arrowColor: '#0A0A0A',
        monthTextColor: '#0A0A0A',
        indicatorColor: '#0A0A0A',
        dotColor: '#0A0A0A',
      };

  return (
    <SafeAreaView className="flex-1 bg-neutral-50 dark:bg-black">
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={eventsQuery.isFetching}
            onRefresh={() => eventsQuery.refetch()}
            tintColor={isDark ? '#FFFFFF' : '#0A0A0A'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-5 pt-5 pb-4 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-neutral-900 items-center justify-center"
          >
            <Ionicons name="arrow-back" size={18} color="#64748b" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-2xl font-bold text-slate-900 dark:text-white">Calendar</Text>
            {activeTeam && (
              <Text className="text-slate-500 dark:text-neutral-400 text-xs mt-0.5">{activeTeam.name}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            className="bg-black dark:bg-white rounded-2xl px-4 py-2.5 flex-row items-center gap-1.5"
            style={{ shadowColor: '#888888', shadowRadius: 8, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 3 } }}
          >
            <Ionicons name="add" size={16} color="#fff" />
            <Text className="text-white font-bold text-sm">Event</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar widget */}
        <View className="mx-5 rounded-2xl overflow-hidden border border-slate-200 dark:border-neutral-800 mb-5">
          <Calendar
            current={selectedDate}
            onDayPress={(day: any) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedDate(day.dateString); }}
            markedDates={markedDates}
            theme={calTheme}
          />
        </View>

        {/* Day events */}
        <View className="px-5 mb-10">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-slate-900 dark:text-white font-bold text-lg">
              {format(new Date(selectedDate), 'EEE, MMM d')}
            </Text>
            <Text className="text-slate-400 dark:text-neutral-500 text-xs">
              {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {dayEvents.length === 0 ? (
            <TouchableOpacity
              onPress={() => setShowCreate(true)}
              className="bg-white dark:bg-neutral-900 rounded-2xl p-6 items-center border border-dashed border-slate-200 dark:border-neutral-800"
            >
              <Ionicons name="calendar-outline" size={32} color="#94a3b8" />
              <Text className="text-slate-400 dark:text-neutral-500 font-medium mt-3">No events</Text>
              <Text className="text-neutral-600 dark:text-neutral-400 text-sm mt-1.5">+ Add event</Text>
            </TouchableOpacity>
          ) : (
            dayEvents.map((event: any) => {
              const evType = getEventType(event.type);
              return (
                <View
                  key={event.id}
                  className="bg-white dark:bg-neutral-900 rounded-2xl p-4 mb-3 border border-slate-200 dark:border-neutral-800 flex-row items-start gap-3"
                  style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3 }}
                >
                  {/* Color stripe */}
                  <View className="w-1 self-stretch rounded-full" style={{ backgroundColor: evType.color }} />

                  {/* Icon */}
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: evType.color + '1a' }}
                  >
                    <Ionicons name={evType.icon} size={18} color={evType.color} />
                  </View>

                  {/* Content */}
                  <View className="flex-1">
                    <Text className="text-slate-900 dark:text-white font-semibold text-base">{event.title}</Text>
                    {event.description && (
                      <Text className="text-slate-500 dark:text-neutral-400 text-sm mt-1 leading-5">{event.description}</Text>
                    )}
                    <View className="flex-row items-center gap-1.5 mt-2">
                      <Ionicons name="time-outline" size={12} color="#94a3b8" />
                      <Text className="text-slate-400 dark:text-neutral-500 text-xs">
                        {format(new Date(event.startDate), 'h:mm a')}
                        {' – '}
                        {format(new Date(event.endDate), 'h:mm a')}
                      </Text>
                    </View>
                  </View>

                  {/* Delete */}
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert('Delete Event', 'Remove this event?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate({ id: event.id }) },
                      ])
                    }
                    className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-900/20 items-center justify-center"
                  >
                    <Ionicons name="trash-outline" size={15} color="#f87171" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Create Event Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}
          >
            <View className="bg-white dark:bg-black rounded-t-3xl px-5 pt-6 pb-12 border-t border-slate-200 dark:border-neutral-800">
              <View className="w-10 h-1 bg-slate-300 dark:bg-neutral-700 rounded-full self-center mb-5" />
              <Text className="text-xl font-bold text-slate-900 dark:text-white mb-5">New Event</Text>

              <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Event title"
                placeholderTextColor="#94a3b8"
                className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-4"
              />

              <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">Notes</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional description"
                placeholderTextColor="#94a3b8"
                multiline
                className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl px-4 py-3.5 text-slate-900 dark:text-white mb-4"
                style={{ minHeight: 72, textAlignVertical: 'top' }}
              />

              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">Start</Text>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                    placeholderTextColor="#94a3b8"
                    className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl px-4 py-3 text-slate-900 dark:text-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">End</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="10:00"
                    placeholderTextColor="#94a3b8"
                    className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-2xl px-4 py-3 text-slate-900 dark:text-white"
                  />
                </View>
              </View>

              <Text className="text-slate-500 dark:text-neutral-400 text-xs font-bold uppercase tracking-wider mb-2">Type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, marginBottom: 20 }}
              >
                {EVENT_TYPES.map((et) => {
                  const isSelected = eventType === et.key;
                  return (
                    <TouchableOpacity
                      key={et.key}
                      onPress={() => setEventType(et.key)}
                      className="px-4 py-2.5 rounded-2xl border flex-row items-center gap-1.5"
                      style={{
                        backgroundColor: isSelected ? et.color : 'transparent',
                        borderColor: isSelected ? et.color : '#cbd5e1',
                      }}
                    >
                      <Ionicons name={et.icon} size={13} color={isSelected ? '#fff' : et.color} />
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: isSelected ? '#fff' : et.color }}
                      >
                        {et.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <View className="flex-row gap-3">
                <Button label="Cancel" onPress={() => setShowCreate(false)} variant="secondary" style={{ flex: 1 }} />
                <Button label="Create" onPress={handleCreate} loading={createMutation.isPending} style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
