/**
 * Load appointments visible to a doctor or nurse.
 * Scope:
 *   1. Same clinic as the staff member (when clinic_id is set)
 *   2. Same department as the staff member, via services.department
 *      (when department is set and the column exists / has data)
 *
 * Failures never throw past this module for missing optional columns —
 * we degrade to clinic-only filtering.
 */
import { supabase } from './supabase/client';
import type { Staff } from '../types';

const APPT_SELECT = `
  id,
  status,
  patient_id,
  clinic_id,
  service_id,
  created_at,
  reason_for_visit,
  patients ( id, first_name, last_name, contact_number, email, id_number ),
  services ( id, service_name, department ),
  clinics ( id, clinic_name ),
  time_slots ( id, date, start_time, end_time )
`;

/** Prefer a leaner select if services.department is not in the schema yet. */
const APPT_SELECT_NO_DEPT = `
  id,
  status,
  patient_id,
  clinic_id,
  service_id,
  created_at,
  reason_for_visit,
  patients ( id, first_name, last_name, contact_number, email, id_number ),
  services ( id, service_name ),
  clinics ( id, clinic_name ),
  time_slots ( id, date, start_time, end_time )
`;

export type StaffAppointmentRow = {
  id: string;
  status: string;
  patient_id: string | null;
  clinic_id?: string | null;
  service_id?: string | null;
  created_at?: string;
  reason_for_visit?: string | null;
  patients?: {
    id?: string;
    first_name?: string;
    last_name?: string;
    contact_number?: string | null;
    email?: string | null;
    id_number?: string | null;
  } | null;
  services?: {
    id?: string;
    service_name?: string;
    department?: string | null;
  } | null;
  clinics?: { id?: string; clinic_name?: string } | null;
  time_slots?: {
    id?: string;
    date?: string;
    start_time?: string;
    end_time?: string;
  } | null;
};

/**
 * Resolve service IDs that belong to the staff member's department
 * (and clinic, when available). Returns null when no department filter
 * should be applied (no department set, or column missing / empty).
 */
async function serviceIdsForDepartment(
  department: string,
  clinicId?: string | null
): Promise<string[] | null> {
  try {
    let q = supabase
      .from('services')
      .select('id')
      .eq('department', department)
      .eq('status', 'active');

    if (clinicId) {
      q = q.eq('clinic_id', clinicId);
    }

    const { data, error } = await q;
    if (error) {
      // Column may not exist yet — treat as "no department filter"
      console.warn('[staffAppointments] department filter skipped:', error.message);
      return null;
    }
    if (!data || data.length === 0) {
      // No services tagged with this department yet — fall back to clinic-only
      return null;
    }
    return data.map((r) => r.id as string);
  } catch (e) {
    console.warn('[staffAppointments] department lookup failed:', e);
    return null;
  }
}

export async function fetchStaffScopedAppointments(
  staff: Pick<Staff, 'clinic_id' | 'department'> | null | undefined,
  opts?: {
    statuses?: string[];
    limit?: number;
    /** When true, only rows whose time_slots.date is today (client-side filter). */
    todayOnly?: boolean;
  }
): Promise<StaffAppointmentRow[]> {
  const statuses = opts?.statuses ?? ['booked', 'confirmed'];
  const limit = opts?.limit ?? 50;

  const clinicId = staff?.clinic_id || null;
  const department = (staff?.department || '').trim() || null;

  let serviceIds: string[] | null = null;
  if (department) {
    serviceIds = await serviceIdsForDepartment(department, clinicId);
  }

  const runQuery = async (select: string) => {
    let q = supabase
      .from('appointments')
      .select(select)
      .in('status', statuses)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (clinicId) {
      q = q.eq('clinic_id', clinicId);
    }
    if (serviceIds && serviceIds.length > 0) {
      q = q.in('service_id', serviceIds);
    }

    return q;
  };

  // Explicitly type the response to avoid union-type inference errors
  let result: { data: any; error: any } = await runQuery(APPT_SELECT);

  // If PostgREST rejects services.department (column missing), retry without it
  if (result.error && /department/i.test(result.error.message)) {
    console.warn('[staffAppointments] retrying without services.department');
    result = await runQuery(APPT_SELECT_NO_DEPT);
  }

  if (result.error) {
    throw result.error;
  }

  let rows = (result.data || []) as StaffAppointmentRow[];

  // Extra safety: if we couldn't restrict by service_id but department is set
  // and rows include services.department, filter client-side.
  if (department && !serviceIds) {
    const hasDeptOnRows = rows.some(
      (r) => r.services && 'department' in (r.services as object)
    );
    if (hasDeptOnRows) {
      rows = rows.filter((r) => {
        const d = (r.services as { department?: string | null } | null)?.department;
        // Keep rows with matching department; drop ones with a different non-empty department.
        // Keep rows with null/empty department so untagged services still show for the clinic.
        if (!d) return true;
        return d === department;
      });
    }
  }

  if (opts?.todayOnly) {
    const today = new Date().toISOString().slice(0, 10);
    const todays = rows.filter((a) => a.time_slots?.date === today);
    if (todays.length > 0) rows = todays;
  }

  return rows;
}

export async function countStaffScopedAppointments(
  staff: Pick<Staff, 'clinic_id' | 'department'> | null | undefined,
  statuses: string[] = ['booked', 'confirmed']
): Promise<number> {
  const clinicId = staff?.clinic_id || null;
  const department = (staff?.department || '').trim() || null;

  let serviceIds: string[] | null = null;
  if (department) {
    serviceIds = await serviceIdsForDepartment(department, clinicId);
  }

  let q = supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .in('status', statuses);

  if (clinicId) q = q.eq('clinic_id', clinicId);
  if (serviceIds && serviceIds.length > 0) q = q.in('service_id', serviceIds);

  const { count, error } = await q;
  if (error) {
    console.warn('[staffAppointments] count failed:', error.message);
    return 0;
  }
  return count ?? 0;
}