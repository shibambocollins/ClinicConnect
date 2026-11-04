import { supabase } from '../supabase/client';
import { sendPushToUser } from './pushNotifications';

export interface BookingConfirmationParams {
  patientUserId: string;
  patientId: string;
  appointmentId: string;
  clinicName: string;
  serviceName: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM[:SS] */
  startTime: string;
  endTime?: string | null;
  reason?: string | null;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export async function sendBookingConfirmation(
  p: BookingConfirmationParams
): Promise<void> {
  const dateLabel = fmtDate(p.date);
  const timeLabel = `${p.startTime.slice(0, 5)}${
    p.endTime ? ` – ${p.endTime.slice(0, 5)}` : ''
  }`;

  const body = `Your ${p.serviceName} appointment at ${p.clinicName} is confirmed for ${dateLabel} at ${p.startTime.slice(0, 5)}.`;

  // 1) In-app + push.
  try {
    await sendPushToUser(p.patientUserId, {
      title: 'Appointment confirmed',
      body,
      data: {
        type: 'appointment_confirmation',
        screen: 'AppointmentDetail',
        appointmentId: p.appointmentId,
        patientId: p.patientId,
      },
    });
  } catch (e) {
    console.warn('[BookingConfirmation] Push/in-app failed:', e);
  }

  // 2) Email via Edge Function. Failures must not break the booking.
  try {
    const { error } = await supabase.functions.invoke('send-appointment-confirmation', {
      body: {
        appointmentId: p.appointmentId,
        dateLabel,
        timeLabel,
      },
    });
    if (error) {
      console.warn('[BookingConfirmation] Email function returned error:', error.message);
    }
  } catch (e) {
    console.warn('[BookingConfirmation] Email invocation failed:', e);
  }
}