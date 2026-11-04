// src/screens/appointments/SelectTimeSlotScreen.tsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../../services/supabase/client';
import {
  isSlotInFuture,
  toDateString,
  addDays,
  SlotRow,
} from '../../services/slots';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SelectTimeSlot'>;
type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'SelectTimeSlot'>;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parseLocalDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00');
}

function describeDate(dateStr: string) {
  const d = parseLocalDate(dateStr);
  const today = toDateString(new Date());
  const tomorrow = addDays(today, 1);
  const weekday =
    dateStr === today ? 'Today' : dateStr === tomorrow ? 'Tmrw' : WEEKDAYS[d.getDay()];
  return { weekday, day: String(d.getDate()), month: MONTHS[d.getMonth()] };
}

function isSlotBookable(slot: SlotRow, now = new Date()): boolean {
  if (!slot.is_available) return false;
  if ((slot.booked_count ?? 0) >= 1) return false;
  return isSlotInFuture(slot.date, slot.start_time, now);
}

export default function SelectTimeSlotScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp>();
  const { profile, user } = useAuth();
  const { clinicId, clinicName, serviceId, serviceName } = route.params;

  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  /** Dates (YYYY-MM-DD) on which this patient already has a booked/confirmed appointment */
  const [bookedDates, setBookedDates] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const fetchSlots = useCallback(async () => {
    try {
      setLoading(true);
      const today = toDateString(new Date());

      // Fetch ALL slots for this clinic/service (including booked) so we can grey them out
      const { data, error } = await supabase
        .from('time_slots')
        .select('id, date, start_time, end_time, is_available, max_patients, booked_count')
        .eq('clinic_id', clinicId)
        .eq('service_id', serviceId)
        .gte('date', today)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      const all = (data || []) as SlotRow[];
      // Keep past times for today out of the list entirely
      const visible = all.filter((s) => isSlotInFuture(s.date, s.start_time));
      setSlots(visible);

      // Load this patient's existing appointments (one slot per day rule)
      let patientId = profile?.id;
      if (!patientId && user?.id) {
        const { data: p } = await supabase
          .from('patients')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        patientId = p?.id;
      }

      let userBooked = new Set<string>();
      if (patientId) {
        const { data: appts } = await supabase
          .from('appointments')
          .select('id, time_slot_id, time_slots ( date )')
          .eq('patient_id', patientId)
          .in('status', ['booked', 'confirmed']);

        (appts || []).forEach((a: any) => {
          const d = a.time_slots?.date;
          if (d) userBooked.add(d);
        });
      }
      setBookedDates(userBooked);

      const dateList = [...new Set(visible.map((s) => s.date))];
      setSelectedDate((prev) => {
        if (prev && visible.some((s) => s.date === prev)) return prev;
        // Prefer a day the user has not already booked that still has open slots
        for (const d of dateList) {
          if (userBooked.has(d)) continue;
          if (visible.some((s) => s.date === d && isSlotBookable(s))) return d;
        }
        return dateList[0] || null;
      });
      setSelectedSlotId(null);
    } catch (err) {
      console.error('Error fetching time slots:', err);
      Alert.alert('Error', 'Failed to load available times');
    } finally {
      setLoading(false);
    }
  }, [clinicId, serviceId, profile?.id, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchSlots();
    }, [fetchSlots])
  );

  // Live updates: when anyone books/cancels a slot for this clinic+service,
  // refresh so taken slots grey out immediately.
  const refetchRef = useRef(fetchSlots);
  refetchRef.current = fetchSlots;
  useEffect(() => {
    // Generate a unique channel name to avoid clashes during React strict mode / fast refresh
    const channelName = `time_slots:${clinicId}:${serviceId}:${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'time_slots', filter: `clinic_id=eq.${clinicId}` },
        (payload: any) => {
          const row = payload.new || payload.old;
          if (row?.service_id && row.service_id !== serviceId) return;
          setSlots((prev) =>
            prev.map((s) => (payload.new && s.id === payload.new.id ? { ...s, ...payload.new } : s))
          );
          
          // If our selection just got taken, drop it and tell the user.
          setSelectedSlotId((cur) => {
            if (cur && payload.new?.id === cur && !isSlotBookable(payload.new)) {
              // Only show the alert if this screen is currently focused (visible)
              // Otherwise, the user is likely on the Confirm screen booking it themselves.
              if (isFocusedRef.current) {
                Alert.alert('Just booked', 'Someone else took that time. Please pick another.');
              }
              return null;
            }
            return cur;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clinicId, serviceId]);

  const dates = useMemo(() => [...new Set(slots.map((s) => s.date))], [slots]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate) return [];
    return slots.filter((s) => s.date === selectedDate);
  }, [slots, selectedDate]);

  const userHasBookingOnSelectedDate = selectedDate ? bookedDates.has(selectedDate) : false;

  const selectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlotId(null);
  };

  const handleSelectSlot = (slot: SlotRow) => {
    if (!isSlotBookable(slot)) {
      Alert.alert('Unavailable', 'This time slot is already booked.');
      return;
    }
    if (bookedDates.has(slot.date)) {
      Alert.alert(
        'One appointment per day',
        'You already have an appointment on this day. Please choose another day or cancel your existing booking first.'
      );
      return;
    }
    setSelectedSlotId(slot.id);
  };

  const handleContinue = () => {
    if (!selectedSlotId || !selectedDate) return;
    const slot = slots.find((s) => s.id === selectedSlotId);
    if (!slot) return;

    if (!isSlotBookable(slot)) {
      Alert.alert('Unavailable', 'This time slot is no longer available.');
      return;
    }
    if (bookedDates.has(slot.date)) {
      Alert.alert(
        'One appointment per day',
        'You already have an appointment on this day.'
      );
      return;
    }

    navigation.navigate('ConfirmBooking', {
      clinicId,
      clinicName,
      serviceId,
      serviceName,
      timeSlotId: slot.id,
      date: slot.date,
      startTime: slot.start_time,
      endTime: slot.end_time,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Select Time</Text>
        <View style={{ width: 40 }} />
      </View>

      {(clinicName || serviceName) && (
        <Text style={styles.subtitle}>
          {[serviceName, clinicName].filter(Boolean).join(' · ')}
        </Text>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7C5C" />
          <Text style={styles.loadingText}>Loading available times...</Text>
        </View>
      ) : slots.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="calendar-outline" size={48} color="#A8A8A8" />
          <Text style={styles.emptyText}>No available time slots</Text>
          <Text style={styles.emptyHint}>Please try another service or check back later</Text>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>Date</Text>

            <ScrollView
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              style={styles.dateScroll}
              contentContainerStyle={styles.dateRow}
            >
              {dates.map((date) => {
                const { weekday, day, month } = describeDate(date);
                const selected = selectedDate === date;
                const userBooked = bookedDates.has(date);
                const hasOpen = slots.some((s) => s.date === date && isSlotBookable(s));
                const unavailable = userBooked || !hasOpen;
                return (
                  <TouchableOpacity
                    key={date}
                    style={[
                      styles.dateChip,
                      selected && styles.dateChipSelected,
                      unavailable && !selected && styles.dateChipUserBooked,
                    ]}
                    onPress={() => selectDate(date)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${weekday} ${day} ${month}${userBooked ? ', you already booked' : ''}`}
                  >
                    <Text
                      style={[
                        styles.dateWeekday,
                        selected && styles.dateTextSelected,
                        unavailable && !selected && styles.dateTextMuted,
                      ]}
                    >
                      {weekday}
                    </Text>
                    <Text
                      style={[
                        styles.dateDay,
                        selected && styles.dateTextSelected,
                        unavailable && !selected && styles.dateTextMuted,
                      ]}
                    >
                      {day}
                    </Text>
                    <Text
                      style={[
                        styles.dateMonth,
                        selected && styles.dateTextSelected,
                        unavailable && !selected && styles.dateTextMuted,
                      ]}
                    >
                      {month}
                    </Text>
                    {userBooked && (
                      <Text style={[styles.dateBookedTag, selected && { color: '#E8F0E0' }]}>
                        booked
                      </Text>
                    )}
                    {!userBooked && !hasOpen && (
                      <Text style={[styles.dateBookedTag, selected && { color: '#E8F0E0' }]}>
                        full
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {userHasBookingOnSelectedDate && (
              <View style={styles.banner}>
                <Ionicons name="information-circle" size={18} color="#EF6C00" />
                <Text style={styles.bannerText}>
                  You already have an appointment on this day. Only one booking per day is allowed.
                </Text>
              </View>
            )}

            <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Time</Text>
            <View style={styles.timeGrid}>
              {slotsForDate.map((slot) => {
                const bookable = isSlotBookable(slot) && !userHasBookingOnSelectedDate;
                const selected = selectedSlotId === slot.id;

                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[
                      styles.timeChip,
                      selected && bookable && styles.timeChipSelected,
                      !bookable && styles.timeChipDisabled,
                    ]}
                    onPress={() => handleSelectSlot(slot)}
                    activeOpacity={bookable ? 0.8 : 1}
                    disabled={!bookable}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: !bookable }}
                  >
                    <Text
                      style={[
                        styles.timeText,
                        selected && bookable && styles.timeTextSelected,
                        !bookable && styles.timeTextDisabled,
                      ]}
                    >
                      {slot.start_time?.slice(0, 5)}
                    </Text>
                    {!bookable ? (
                      <Text style={styles.spotsTextDisabled}>
                        {userHasBookingOnSelectedDate ? '—' : 'Booked'}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueButton, !selectedSlotId && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={!selectedSlotId}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>
                {selectedSlotId ? 'Continue' : 'Select a time to continue'}
              </Text>
              {selectedSlotId && <Ionicons name="arrow-forward" size={20} color="#FFF" />}
            </TouchableOpacity>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  subtitle: {
    textAlign: 'center',
    color: '#6B7C5C',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#666' },
  content: { padding: 16, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  dateScroll: { flexGrow: 0 },
  dateRow: { alignItems: 'center', paddingVertical: 4, paddingRight: 8 },
  dateChip: {
    width: 68,
    height: 96,
    marginRight: 10,
    borderRadius: 14,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateChipSelected: { backgroundColor: '#6B7C5C', borderColor: '#6B7C5C' },
  dateChipUserBooked: { backgroundColor: '#F0F0F0', borderColor: '#DDD' },
  dateWeekday: { fontSize: 12, fontWeight: '600', color: '#777' },
  dateDay: { fontSize: 24, fontWeight: '700', color: '#1a1a1a', marginVertical: 2 },
  dateMonth: { fontSize: 12, fontWeight: '500', color: '#777' },
  dateTextSelected: { color: '#FFF' },
  dateTextMuted: { color: '#AAA' },
  dateBookedTag: { fontSize: 9, fontWeight: '700', color: '#999', marginTop: 2, textTransform: 'uppercase' },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  bannerText: { flex: 1, fontSize: 13, color: '#E65100', lineHeight: 18 },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeChip: {
    width: '30%',
    minWidth: 90,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignItems: 'center',
  },
  timeChipSelected: { backgroundColor: '#6B7C5C', borderColor: '#6B7C5C' },
  timeChipDisabled: {
    backgroundColor: '#ECECEC',
    borderColor: '#E0E0E0',
  },
  timeText: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  timeTextSelected: { color: '#FFF' },
  timeTextDisabled: { color: '#B0B0B0' },
  spotsText: { fontSize: 10, color: '#888', marginTop: 2 },
  spotsTextDisabled: { fontSize: 10, color: '#B0B0B0', marginTop: 2 },

  footer: {
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  continueButton: {
    backgroundColor: '#6B7C5C',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  continueButtonDisabled: { backgroundColor: '#B9C2B0' },
  continueButtonText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#666' },
  emptyHint: { fontSize: 13, color: '#999', textAlign: 'center' },
});