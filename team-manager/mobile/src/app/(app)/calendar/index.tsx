import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { trpc } from '@/lib/api';
import { useTeamStore } from '@/store/teamStore';
import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/Button';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

function eventTypeEmoji(type: string = ''): string {
  if (type === 'meeting') return '🤝';
  if (type === 'deadline') return '⏰';
  if (type === 'milestone') return '🏁';
  if (type === 'review') return '🔍';
  return '📅';
}

export default function CalendarScreen() {
  const { activeTeam } = useTeamStore();
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
      utils.calendar.getEvents.invalidate();
      setShowCreate(false);
      setTitle('');
      setDescription('');
    },
    onError: (err) => Alert.alert('Error', err.message),
  });

  const deleteMutation = trpc.calendar.deleteEvent.useMutation({
    onSuccess: () => utils.calendar.getEvents.invalidate(),
    onError: (err) => Alert.alert('Error', err.message),
  });

  const events = (eventsQuery.data as any[] ?? []);

  // Build marked dates for calendar
  const markedDates = events.reduce(
    (acc: Record<string, any>, event: any) => {
      const dateStr = format(new Date(event.startDate), 'yyyy-MM-dd');
      acc[dateStr] = {
        marked: true,
        dotColor: '#0ea5e9',
        ...(dateStr === selectedDate ? { selected: true, selectedColor: '#0ea5e9' } : {}),
      };
      return acc;
    },
    {
      [selectedDate]: {
        selected: true,
        selectedColor: '#0ea5e9',
      },
    }
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
    // Map UI event types to schema enum values
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

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={eventsQuery.isFetching} onRefresh={() => eventsQuery.refetch()} tintColor="#0ea5e9" />
        }
      >
        {/* Header */}
        <View className="px-5 pt-4 pb-3 flex-row justify-between items-center">
          <Text className="text-2xl font-bold text-white">Calendar</Text>
          <TouchableOpacity onPress={() => setShowCreate(true)} className="bg-sky-600 rounded-xl px-4 py-2">
            <Text className="text-white font-semibold">+ Event</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar */}
        <View className="mx-5 rounded-2xl overflow-hidden border border-slate-700 mb-4">
          <Calendar
            current={selectedDate}
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={{
              backgroundColor: '#1e293b',
              calendarBackground: '#1e293b',
              textSectionTitleColor: '#94a3b8',
              selectedDayBackgroundColor: '#0ea5e9',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#0ea5e9',
              dayTextColor: '#e2e8f0',
              textDisabledColor: '#475569',
              arrowColor: '#0ea5e9',
              monthTextColor: '#f1f5f9',
              indicatorColor: '#0ea5e9',
              dotColor: '#0ea5e9',
            }}
          />
        </View>

        {/* Events for selected day */}
        <View className="px-5 mb-8">
          <Text className="text-lg font-bold text-white mb-3">
            {format(new Date(selectedDate), 'EEEE, MMMM d')}
          </Text>

          {dayEvents.length === 0 ? (
            <View className="bg-slate-800 rounded-xl p-6 items-center border border-slate-700">
              <Text className="text-2xl mb-2">📅</Text>
              <Text className="text-slate-300 font-medium">No events</Text>
              <TouchableOpacity onPress={() => setShowCreate(true)} className="mt-3">
                <Text className="text-sky-400 text-sm">+ Add event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dayEvents.map((event: any) => (
              <View key={event.id} className="bg-slate-800 rounded-xl p-4 mb-3 border border-slate-700">
                <View className="flex-row items-start">
                  <Text className="text-2xl mr-3">{eventTypeEmoji(event.type)}</Text>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">{event.title}</Text>
                    {event.description && (
                      <Text className="text-slate-400 text-sm mt-1">{event.description}</Text>
                    )}
                    <Text className="text-slate-500 text-xs mt-2">
                      {format(new Date(event.startDate), 'h:mm a')} – {format(new Date(event.endDate), 'h:mm a')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert('Delete', 'Remove this event?', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate({ id: event.id }) },
                      ])
                    }
                  >
                    <Text className="text-red-400">🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create Event Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View className="flex-1 bg-black/60 justify-end">
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}>
            <View className="bg-slate-900 rounded-t-3xl px-5 pt-6 pb-10 border-t border-slate-700">
              <Text className="text-xl font-bold text-white mb-5">New Event</Text>

              <Text className="text-slate-400 text-sm mb-1">Title *</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Event title"
                placeholderTextColor="#475569"
                className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-4"
              />

              <Text className="text-slate-400 text-sm mb-1">Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Optional notes"
                placeholderTextColor="#475569"
                multiline
                className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white mb-4"
              />

              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text className="text-slate-400 text-sm mb-1">Start Time</Text>
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                    placeholderTextColor="#475569"
                    className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-slate-400 text-sm mb-1">End Time</Text>
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="10:00"
                    placeholderTextColor="#475569"
                    className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white"
                  />
                </View>
              </View>

              <Text className="text-slate-400 text-sm mb-2">Type</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
                {['meeting', 'deadline', 'milestone', 'review', 'other'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setEventType(t)}
                    className={`px-4 py-2 rounded-xl border ${eventType === t ? 'bg-sky-600 border-sky-500' : 'bg-slate-800 border-slate-600'}`}
                  >
                    <Text className={eventType === t ? 'text-white font-semibold' : 'text-slate-300'}>
                      {eventTypeEmoji(t)} {t.charAt(0).toUpperCase() + t.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
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
