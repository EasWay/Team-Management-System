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
import { format, startOfMonth, endOfMonth } from 'date-fns';

const C = {
  bg: '#020617',
  surface: '#0f172a',
  card: '#1e293b',
  border: 'rgba(51,65,85,0.7)',
  text: '#f8fafc',
  muted: '#94a3b8',
  subtle: '#475569',
  primary: '#0ea5e9',
};

const EVENT_TYPES = [
  { key: 'meeting', emoji: '🤝', label: 'Meeting', color: '#0ea5e9' },
  { key: 'deadline', emoji: '⏰', label: 'Deadline', color: '#f43f5e' },
  { key: 'milestone', emoji: '🏁', label: 'Milestone', color: '#10b981' },
  { key: 'review', emoji: '🔍', label: 'Review', color: '#f59e0b' },
  { key: 'other', emoji: '📅', label: 'Other', color: '#8b5cf6' },
];

function eventColor(type: string): string {
  return EVENT_TYPES.find((t) => t.key === type)?.color ?? '#0ea5e9';
}
function eventEmoji(type: string): string {
  return EVENT_TYPES.find((t) => t.key === type)?.emoji ?? '📅';
}

function FieldLabel({ label }: { label: string }) {
  return (
    <Text style={{ color: C.subtle, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
      {label}
    </Text>
  );
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

  const markedDates = events.reduce(
    (acc: Record<string, any>, event: any) => {
      const dateStr = format(new Date(event.startDate), 'yyyy-MM-dd');
      acc[dateStr] = {
        marked: true,
        dotColor: eventColor(event.type ?? event.eventType),
        ...(dateStr === selectedDate ? { selected: true, selectedColor: C.primary } : {}),
      };
      return acc;
    },
    { [selectedDate]: { selected: true, selectedColor: C.primary } }
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={eventsQuery.isFetching} onRefresh={() => eventsQuery.refetch()} tintColor={C.primary} />
        }
      >
        {/* Header */}
        <View style={{
          paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <View>
            <Text style={{ color: C.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 }}>Calendar</Text>
            {activeTeam ? <Text style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>{activeTeam.name}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={{
              backgroundColor: C.primary, borderRadius: 24, paddingHorizontal: 16,
              paddingVertical: 10, minHeight: 44, justifyContent: 'center',
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>+ Event</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar widget */}
        <View style={{
          marginHorizontal: 20,
          borderRadius: 20,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: C.border,
          marginBottom: 20,
        }}>
          <Calendar
            current={selectedDate}
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            theme={{
              backgroundColor: C.card,
              calendarBackground: C.card,
              textSectionTitleColor: C.muted,
              selectedDayBackgroundColor: C.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: C.primary,
              dayTextColor: '#e2e8f0',
              textDisabledColor: '#334155',
              arrowColor: C.primary,
              monthTextColor: C.text,
              indicatorColor: C.primary,
              dotColor: C.primary,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDayHeaderFontSize: 12,
            }}
          />
        </View>

        {/* Day events */}
        <View style={{ paddingHorizontal: 20, marginBottom: 32 }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 12 }}>
            {format(new Date(selectedDate), 'EEEE, MMMM d')}
          </Text>

          {dayEvents.length === 0 ? (
            <View style={{
              backgroundColor: C.card, borderRadius: 16, padding: 24,
              alignItems: 'center', borderWidth: 1, borderColor: C.border,
            }}>
              <Text style={{ fontSize: 28, marginBottom: 10 }}>📅</Text>
              <Text style={{ color: C.muted, fontSize: 14 }}>No events scheduled</Text>
              <TouchableOpacity
                onPress={() => setShowCreate(true)}
                style={{ marginTop: 12, paddingVertical: 6, paddingHorizontal: 16 }}
              >
                <Text style={{ color: C.primary, fontSize: 14, fontWeight: '600' }}>+ Add event</Text>
              </TouchableOpacity>
            </View>
          ) : (
            dayEvents.map((event: any) => {
              const type = event.type ?? event.eventType ?? 'other';
              const accentColor = eventColor(type);
              return (
                <View key={event.id} style={{
                  backgroundColor: C.card, borderRadius: 16, padding: 16,
                  marginBottom: 10, borderWidth: 1, borderColor: C.border,
                  borderLeftWidth: 3, borderLeftColor: accentColor,
                  flexDirection: 'row', alignItems: 'flex-start',
                }}>
                  <Text style={{ fontSize: 24, marginRight: 12 }}>{eventEmoji(type)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontWeight: '700', fontSize: 15, marginBottom: 3 }}>
                      {event.title}
                    </Text>
                    {event.description ? (
                      <Text style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>{event.description}</Text>
                    ) : null}
                    <Text style={{ color: C.subtle, fontSize: 12 }}>
                      {format(new Date(event.startDate), 'h:mm a')} – {format(new Date(event.endDate), 'h:mm a')}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      Alert.alert('Delete event', `Remove "${event.title}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate({ id: event.id }) },
                      ])
                    }
                    style={{ padding: 4 }}
                  >
                    <Text style={{ color: '#f43f5e', fontSize: 16 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Create Event Modal */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ justifyContent: 'flex-end', flexGrow: 1 }}>
            <View style={{
              backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 20, paddingTop: 24, paddingBottom: 36,
              borderTopWidth: 1, borderTopColor: C.border,
            }}>
              {/* Drag handle */}
              <View style={{ width: 36, height: 4, backgroundColor: C.card, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

              <Text style={{ color: C.text, fontSize: 20, fontWeight: '800', marginBottom: 20, letterSpacing: -0.3 }}>
                New Event
              </Text>

              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="Title *" />
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Event title"
                  placeholderTextColor={C.subtle}
                  style={{
                    backgroundColor: C.card, borderWidth: 1, borderColor: '#334155',
                    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15,
                  }}
                />
              </View>

              <View style={{ marginBottom: 16 }}>
                <FieldLabel label="Description" />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Optional notes"
                  placeholderTextColor={C.subtle}
                  multiline
                  style={{
                    backgroundColor: C.card, borderWidth: 1, borderColor: '#334155',
                    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15,
                    minHeight: 72, textAlignVertical: 'top',
                  }}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Start Time" />
                  <TextInput
                    value={startTime}
                    onChangeText={setStartTime}
                    placeholder="09:00"
                    placeholderTextColor={C.subtle}
                    style={{
                      backgroundColor: C.card, borderWidth: 1, borderColor: '#334155',
                      borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15,
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="End Time" />
                  <TextInput
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="10:00"
                    placeholderTextColor={C.subtle}
                    style={{
                      backgroundColor: C.card, borderWidth: 1, borderColor: '#334155',
                      borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15,
                    }}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 24 }}>
                <FieldLabel label="Event Type" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {EVENT_TYPES.map((t) => (
                    <TouchableOpacity
                      key={t.key}
                      onPress={() => setEventType(t.key)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
                        backgroundColor: eventType === t.key ? t.color : C.card,
                        borderWidth: 1,
                        borderColor: eventType === t.key ? t.color : C.border,
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        minHeight: 44,
                      }}
                    >
                      <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
                      <Text style={{
                        color: eventType === t.key ? 'white' : C.muted,
                        fontWeight: eventType === t.key ? '700' : '400',
                        fontSize: 13,
                      }}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <Button label="Cancel" onPress={() => setShowCreate(false)} variant="secondary" style={{ flex: 1 }} />
                <Button label="Create Event" onPress={handleCreate} loading={createMutation.isPending} style={{ flex: 1 }} />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
