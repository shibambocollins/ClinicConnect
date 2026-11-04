// Supabase Edge Function: send-appointment-confirmation
// Sends a booking confirmation email to the patient.
//
// Secrets (Dashboard -> Edge Functions -> Secrets):
//   RESEND_API_KEY  - required to send mail
//   FROM_EMAIL      - optional

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  appointmentId?: string;
  dateLabel?: string;
  timeLabel?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const appointmentId = (body.appointmentId || '').trim();

    if (!appointmentId) {
      return json({ error: 'appointmentId is required' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[confirm] Missing SUPABASE_URL or SERVICE_ROLE_KEY');
      return json({ error: 'Server misconfigured' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Step 1: load the appointment row only (no embeds - avoids FK/column issues)
    const { data: appt, error: apptErr } = await admin
      .from('appointments')
      .select('id, status, reason_for_visit, patient_id, clinic_id, service_id, time_slot_id')
      .eq('id', appointmentId)
      .maybeSingle();

    if (apptErr) {
      console.error('[confirm] appointment query:', apptErr.message);
      return json({ error: 'Failed to load appointment', detail: apptErr.message }, 500);
    }
    if (!appt) {
      return json({ error: 'Appointment not found' }, 404);
    }

    // Step 2: load related rows independently
    const [patientRes, clinicRes, serviceRes, slotRes] = await Promise.all([
      admin
        .from('patients')
        .select('id, user_id, email, first_name, last_name')
        .eq('id', appt.patient_id)
        .maybeSingle(),
      appt.clinic_id
        ? admin.from('clinics').select('id, name, address, phone').eq('id', appt.clinic_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      appt.service_id
        ? admin.from('services').select('id, name').eq('id', appt.service_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      appt.time_slot_id
        ? admin
            .from('time_slots')
            .select('id, date, start_time, end_time')
            .eq('id', appt.time_slot_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (patientRes.error) {
      console.error('[confirm] patient query:', patientRes.error.message);
      return json({ error: 'Failed to load patient', detail: patientRes.error.message }, 500);
    }

    const patient = patientRes.data;
    if (!patient) {
      return json({ error: 'Patient not found for appointment' }, 404);
    }

    const clinic = clinicRes.data as { name?: string; address?: string; phone?: string } | null;
    const service = serviceRes.data as { name?: string } | null;
    const slot = slotRes.data as {
      date?: string;
      start_time?: string;
      end_time?: string;
    } | null;

    // Resolve email
    let toEmail = (patient.email || '').trim().toLowerCase();
    if (!toEmail && patient.user_id) {
      try {
        const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(
          patient.user_id
        );
        if (authErr) {
          console.warn('[confirm] auth lookup:', authErr.message);
        }
        toEmail = (authUser?.user?.email || '').trim().toLowerCase();
      } catch (e) {
        console.warn('[confirm] auth lookup failed:', e);
      }
    }

    if (!toEmail) {
      console.warn('[confirm] No email for patient', patient.id);
      return json({ ok: true, skipped: true, reason: 'no_email' });
    }

    const patientName =
      [patient.first_name, patient.last_name].filter(Boolean).join(' ') || 'Patient';

    const dateLabel =
      body.dateLabel ||
      (slot?.date
        ? new Date(slot.date + 'T12:00:00').toLocaleDateString('en-ZA', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : 'your appointment date');

    const start = (slot?.start_time || '').slice(0, 5);
    const end = (slot?.end_time || '').slice(0, 5);
    const timeLabel =
      body.timeLabel || (start ? (end ? `${start} - ${end}` : start) : 'your scheduled time');

    const clinicName = clinic?.name || 'the clinic';
    const serviceName = service?.name || 'Appointment';
    const clinicAddress = clinic?.address || '';
    const clinicPhone = clinic?.phone || '';

    const subject = `Appointment confirmed - ${serviceName} on ${dateLabel}`;

    const html = buildEmailHtml({
      patientName,
      serviceName,
      clinicName,
      clinicAddress,
      clinicPhone,
      dateLabel,
      timeLabel,
      reason: appt.reason_for_visit || null,
    });

    const text = [
      `Hi ${patientName},`,
      '',
      'Your appointment has been confirmed.',
      '',
      `Service: ${serviceName}`,
      `Clinic: ${clinicName}`,
      clinicAddress ? `Address: ${clinicAddress}` : null,
      `Date: ${dateLabel}`,
      `Time: ${timeLabel}`,
      appt.reason_for_visit ? `Reason: ${appt.reason_for_visit}` : null,
      clinicPhone ? `Clinic phone: ${clinicPhone}` : null,
      '',
      'You can view or manage this appointment in the ClinicConnect app.',
      '',
      '- ClinicConnect',
    ]
      .filter((line) => line !== null)
      .join('\n');

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail =
      Deno.env.get('FROM_EMAIL') || 'ClinicConnect <onboarding@resend.dev>';

    if (!resendKey) {
      console.warn('[confirm] RESEND_API_KEY not set - skipping send to', toEmail);
      return json({
        ok: true,
        skipped: true,
        reason: 'resend_not_configured',
        to: toEmail,
      });
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject,
        html,
        text,
      }),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text().catch(() => '');
      console.error('[confirm] Resend failed:', resendRes.status, errBody);
      // Still 200 to the client so booking is never "failed" because of email.
      // Client only sees non-2xx as invoke error.
      return json(
        {
          ok: false,
          error: 'Failed to send email',
          status: resendRes.status,
          detail: errBody,
          to: toEmail,
        },
        200
      );
    }

    const resendJson = await resendRes.json().catch(() => ({}));
    console.log('[confirm] Sent to', toEmail, resendJson);

    return json({ ok: true, to: toEmail, id: (resendJson as { id?: string }).id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[confirm] Unhandled:', msg);
    return json({ error: 'Internal error', detail: msg }, 500);
  }
});

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildEmailHtml(p: {
  patientName: string;
  serviceName: string;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  dateLabel: string;
  timeLabel: string;
  reason: string | null;
}): string {
  const rows = [
    ['Service', escapeHtml(p.serviceName)],
    ['Clinic', escapeHtml(p.clinicName)],
    p.clinicAddress ? ['Address', escapeHtml(p.clinicAddress)] : null,
    ['Date', escapeHtml(p.dateLabel)],
    ['Time', escapeHtml(p.timeLabel)],
    p.reason ? ['Reason', escapeHtml(p.reason)] : null,
    p.clinicPhone ? ['Clinic phone', escapeHtml(p.clinicPhone)] : null,
  ].filter(Boolean) as [string, string][];

  const tableRows = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:8px 12px;color:#6b7280;font-size:14px;width:120px;vertical-align:top;">${label}</td>
        <td style="padding:8px 12px;color:#111827;font-size:14px;font-weight:500;">${value}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#6B7C5C;padding:20px 24px;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:600;">ClinicConnect</p>
              <p style="margin:4px 0 0;color:#e8ede4;font-size:13px;">Appointment confirmation</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <p style="margin:0 0 12px;color:#111827;font-size:16px;">Hi ${escapeHtml(p.patientName)},</p>
              <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.5;">
                Your appointment has been <strong style="color:#6B7C5C;">confirmed</strong>. Here are the details:
              </p>
              <table role="presentation" width="100%" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
                ${tableRows}
              </table>
              <p style="margin:20px 0 0;color:#6b7280;font-size:13px;line-height:1.5;">
                You can view or manage this appointment anytime in the ClinicConnect app.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">
                This is an automated message from ClinicConnect.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
