import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { readCache } from './cache';
import {
  ActivityLogRecord,
  ApartmentClientRecord,
  ApartmentRecord,
  AuditLogRecord,
  BookingRecord,
  CommissionRecord,
  DebtRecord,
  DepartmentKey,
  ExpenseRecord,
  FieldDefinition,
  InspectionRecord,
  PaymentMethod,
  PaymentRecord,
  PrintSettings,
  SupplierRecord,
  UserProfile,
  VisaCaseRecord,
  VisaDestination,
} from '../types/domain';

export interface ActorInfo {
  uid: string;
  name: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sortDescBy<T extends Record<string, unknown>>(rows: T[], key: string): T[] {
  return [...rows].sort((a, b) => String(b[key] ?? '').localeCompare(String(a[key] ?? '')));
}

async function syncAutoPayment(params: {
  source_type: 'booking' | 'visa' | 'apartment';
  source_id: string;
  client_name: string;
  reference: string;
  amount_piasters: number;
  payment_method?: PaymentMethod;
  payment_date: string;
  notes: string;
}): Promise<void> {
  const docId = `auto_${params.source_type}_${params.source_id}`;
  const ref = doc(db, 'payments', docId);
  if (params.amount_piasters > 0) {
    await setDoc(
      ref,
      {
        client_name: params.client_name || '—',
        reference: params.reference,
        amount_minor: params.amount_piasters,
        currency: 'EGP',
        exchange_rate_on_receipt: null,
        payment_method: params.payment_method ?? 'cash',
        payment_date: params.payment_date || nowIso().slice(0, 10),
        notes: params.notes,
        source_type: params.source_type,
        source_id: params.source_id,
        created_at: nowIso(),
      },
      { merge: true },
    );
  } else {
    try {
      await deleteDoc(ref);
    } catch {
      // Auto payment doc may not exist
    }
  }
  readCache.invalidate('payments');
}

// ============================================================
// Sequence Numbering (Independent per department)
// ============================================================

const SEQUENCE_PREFIXES: Record<'domestic_tourism' | 'outbound_tourism' | 'visas' | 'real_estate', string> = {
  domestic_tourism: 'DOM',
  outbound_tourism: 'OUT',
  visas: 'VIS',
  real_estate: 'RE',
};

export async function nextSequenceNumber(
  department: 'domestic_tourism' | 'outbound_tourism' | 'visas' | 'real_estate',
): Promise<string> {
  const prefix = SEQUENCE_PREFIXES[department];
  const ref = doc(db, 'counters', department);

  const nextVal = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? Number(snap.data().last_number ?? 0) : 0;
    const next = current + 1;
    tx.set(ref, { department, prefix, last_number: next, updated_at: nowIso() }, { merge: true });
    return next;
  });

  return `${prefix}-${String(nextVal).padStart(4, '0')}`;
}

// ============================================================
// Audit / Activity / Sensitive Access Logs (Append-only)
// ============================================================

export async function recordAudit(params: {
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id: string;
  department: DepartmentKey | null;
  actor: ActorInfo;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  sensitive_changed?: string[];
}): Promise<void> {
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  const before = params.before ?? {};
  const after = params.after ?? {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const k of keys) {
    if (k === 'updated_at' || k === 'created_at' || k === 'id') continue;
    const bv = before[k] ?? null;
    const av = after[k] ?? null;
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      changes[k] = { before: bv, after: av };
    }
  }

  await addDoc(collection(db, 'audit_logs'), {
    action: params.action,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    department: params.department,
    actor_uid: params.actor.uid,
    actor_name: params.actor.name,
    changes,
    sensitive_changed: params.sensitive_changed ?? [],
    occurred_at: nowIso(),
  });
  readCache.invalidate('audit_logs');
}

export async function recordActivity(actor: ActorInfo, event: 'login' | 'logout'): Promise<void> {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      user_uid: actor.uid,
      user_name: actor.name,
      event,
      occurred_at: nowIso(),
    });
    readCache.invalidate('activity_logs');
  } catch {
    // Non-blocking on sign-out edge cases
  }
}

export async function recordSensitiveAccess(
  actor: ActorInfo,
  entityType: string,
  entityId: string,
  field: string,
): Promise<void> {
  await addDoc(collection(db, 'access_logs'), {
    actor_uid: actor.uid,
    actor_name: actor.name,
    entity_type: entityType,
    entity_id: entityId,
    field,
    occurred_at: nowIso(),
  });
}

export async function listAuditLogs(): Promise<AuditLogRecord[]> {
  return readCache.remember('audit_logs', 'all', async () => {
    const snap = await getDocs(collection(db, 'audit_logs'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLogRecord, 'id'>) }));
    return sortDescBy(rows, 'occurred_at').slice(0, 200);
  });
}

export async function listActivityLogs(): Promise<ActivityLogRecord[]> {
  return readCache.remember('activity_logs', 'all', async () => {
    const snap = await getDocs(collection(db, 'activity_logs'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ActivityLogRecord, 'id'>) }));
    return sortDescBy(rows, 'occurred_at').slice(0, 300);
  });
}

// ============================================================
// Users & Permissions
// ============================================================

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<UserProfile, 'uid'>;
  return { uid: snap.id, ...data };
}

export async function listUsers(): Promise<UserProfile[]> {
  return readCache.remember('users', 'all', async () => {
    const snap = await getDocs(collection(db, 'users'));
    const rows = snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<UserProfile, 'uid'>) }));
    return rows.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  });
}

export async function saveUserProfile(
  user: UserProfile,
  actor: ActorInfo,
  isNew: boolean,
  before?: UserProfile | null,
): Promise<void> {
  const now = nowIso();
  const payload = {
    uid: user.uid,
    name: user.name,
    email: user.email,
    role: user.role,
    disabled: user.disabled,
    permissions: user.permissions,
    created_at: user.created_at ?? now,
    updated_at: now,
  };
  await setDoc(doc(db, 'users', user.uid), payload, { merge: true });
  readCache.invalidate('users');
  await recordAudit({
    action: isNew ? 'create' : 'update',
    entity_type: 'user',
    entity_id: user.uid,
    department: 'users_permissions',
    actor,
    before: before ? (before as unknown as Record<string, unknown>) : null,
    after: payload,
  });
}

// ============================================================
// Dynamic Field Definitions (Domestic & Outbound Bookings)
// ============================================================

const DEFAULT_BOOKING_FIELDS: Omit<FieldDefinition, 'id' | 'department'>[] = [
  { key: 'receipt_number', label: 'رقم الإيصال / الفاتورة', type: 'text', section: 'booking', required: false, show_on_receipt: true, options: [], sort_order: 1, is_system: true, deleted_at: null },
  { key: 'booking_date', label: 'تاريخ الحجز', type: 'date', section: 'booking', required: true, show_on_receipt: true, options: [], sort_order: 2, is_system: true, deleted_at: null },
  { key: 'client_name', label: 'اسم العميل', type: 'text', section: 'booking', required: true, show_on_receipt: true, options: [], sort_order: 3, is_system: true, deleted_at: null },
  { key: 'national_id', label: 'الرقم القومي', type: 'national_id', section: 'booking', required: false, show_on_receipt: false, options: [], sort_order: 4, is_system: true, deleted_at: null },
  { key: 'phone', label: 'رقم الهاتف', type: 'text', section: 'booking', required: true, show_on_receipt: true, options: [], sort_order: 5, is_system: true, deleted_at: null },
  { key: 'children', label: 'عدد الأطفال وأعمارهم', type: 'children', section: 'booking', required: false, show_on_receipt: true, options: [], sort_order: 6, is_system: true, deleted_at: null },
  { key: 'extras', label: 'الإضافات', type: 'text', section: 'booking', required: false, show_on_receipt: true, options: [], sort_order: 7, is_system: true, deleted_at: null },
  { key: 'seats', label: 'الكراسي / المقاعد', type: 'text', section: 'booking', required: false, show_on_receipt: true, options: [], sort_order: 8, is_system: true, deleted_at: null },
  { key: 'hotel_name', label: 'اسم الفندق', type: 'text', section: 'hotel', required: false, show_on_receipt: true, options: [], sort_order: 9, is_system: true, deleted_at: null },
  { key: 'rooms', label: 'عدد الغرف', type: 'number', section: 'hotel', required: false, show_on_receipt: true, options: [], sort_order: 10, is_system: true, deleted_at: null },
  { key: 'stay_type', label: 'نوع الإقامة', type: 'select', section: 'hotel', required: false, show_on_receipt: true, options: ['إفطار فقط', 'نصف إقامة', 'إقامة كاملة', 'شامل كلياً (All Inclusive)', 'غرفة فقط'], sort_order: 11, is_system: true, deleted_at: null },
  { key: 'city', label: 'المدينة', type: 'text', section: 'hotel', required: false, show_on_receipt: true, options: [], sort_order: 12, is_system: true, deleted_at: null },
  { key: 'room_type', label: 'نوع الغرفة', type: 'select', section: 'hotel', required: false, show_on_receipt: true, options: ['مفردة (Single)', 'مزدوجة (Double)', 'ثلاثية (Triple)', 'عائلية (Family)', 'جناح (Suite)'], sort_order: 13, is_system: true, deleted_at: null },
  { key: 'check_in', label: 'تاريخ الوصول', type: 'date', section: 'hotel', required: false, show_on_receipt: true, options: [], sort_order: 14, is_system: true, deleted_at: null },
  { key: 'check_out', label: 'تاريخ المغادرة', type: 'date', section: 'hotel', required: false, show_on_receipt: true, options: [], sort_order: 15, is_system: true, deleted_at: null },
  { key: 'price_per_person', label: 'سعر الفرد', type: 'money', section: 'pricing', required: false, show_on_receipt: true, options: [], sort_order: 16, is_system: true, deleted_at: null },
  { key: 'premium_seats', label: 'مقاعد مميزة', type: 'text', section: 'pricing', required: false, show_on_receipt: true, options: [], sort_order: 17, is_system: true, deleted_at: null },
  { key: 'premium_seats_extra', label: 'إضافي المقاعد المميزة', type: 'money', section: 'pricing', required: false, show_on_receipt: true, options: [], sort_order: 18, is_system: true, deleted_at: null },
  { key: 'optional_services', label: 'خدمات اختيارية', type: 'text', section: 'pricing', required: false, show_on_receipt: true, options: [], sort_order: 19, is_system: true, deleted_at: null },
  { key: 'total', label: 'الإجمالي', type: 'money', section: 'pricing', required: true, show_on_receipt: true, options: [], sort_order: 20, is_system: true, deleted_at: null },
  { key: 'paid', label: 'المدفوع', type: 'money', section: 'pricing', required: true, show_on_receipt: true, options: [], sort_order: 21, is_system: true, deleted_at: null },
  { key: 'responsible_employee', label: 'الموظف المسؤول', type: 'employee', section: 'pricing', required: false, show_on_receipt: true, options: [], sort_order: 22, is_system: true, deleted_at: null },
];

export async function listFieldDefinitions(
  department: 'domestic_tourism' | 'outbound_tourism',
  includeDeleted = false,
): Promise<FieldDefinition[]> {
  const all = await readCache.remember('field_definitions', department, async () => {
    const q = query(collection(db, 'field_definitions'), where('department', '==', department));
    const snap = await getDocs(q);
    if (snap.empty) {
      return DEFAULT_BOOKING_FIELDS.map((f) => ({
        ...f,
        id: `${department}__${f.key}`,
        department,
      }));
    }
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<FieldDefinition, 'id'>) }))
      .sort((a, b) => a.sort_order - b.sort_order);
  });

  return includeDeleted ? all : all.filter((f) => !f.deleted_at);
}

export async function ensureFieldDefinitionsPersisted(
  department: 'domestic_tourism' | 'outbound_tourism',
): Promise<FieldDefinition[]> {
  const q = query(collection(db, 'field_definitions'), where('department', '==', department));
  const snap = await getDocs(q);
  if (snap.empty) {
    for (const f of DEFAULT_BOOKING_FIELDS) {
      const id = `${department}__${f.key}`;
      await setDoc(doc(db, 'field_definitions', id), { ...f, department });
    }
    readCache.invalidate('field_definitions');
  }
  return listFieldDefinitions(department, true);
}

export async function saveFieldDefinition(field: FieldDefinition, actor: ActorInfo, isNew: boolean): Promise<void> {
  const { id, ...rest } = field;
  await setDoc(doc(db, 'field_definitions', id), rest, { merge: true });
  readCache.invalidate('field_definitions');
  await recordAudit({
    action: isNew ? 'create' : 'update',
    entity_type: 'field_definition',
    entity_id: id,
    department: field.department,
    actor,
    after: rest as unknown as Record<string, unknown>,
  });
}

// ============================================================
// Bookings (Domestic & Outbound)
// ============================================================

export async function listBookings(department?: 'domestic_tourism' | 'outbound_tourism'): Promise<BookingRecord[]> {
  const suffix = department ?? 'all';
  return readCache.remember('bookings', suffix, async () => {
    const q = department
      ? query(collection(db, 'bookings'), where('department', '==', department))
      : collection(db, 'bookings');
    const snap = await getDocs(q);
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BookingRecord, 'id'>) }));
    return sortDescBy(rows, 'created_at');
  });
}

export async function getBooking(id: string): Promise<BookingRecord | null> {
  const snap = await getDoc(doc(db, 'bookings', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<BookingRecord, 'id'>) };
}

export async function saveBooking(
  booking: Omit<BookingRecord, 'id' | 'created_at' | 'updated_at'>,
  actor: ActorInfo,
  options: { id?: string; plainNationalId?: string; before?: BookingRecord | null } = {},
): Promise<string> {
  const now = nowIso();
  const isNew = !options.id;
  const receiptNumber = booking.receipt_number.trim() || (await nextSequenceNumber(booking.department));

  const payload = {
    ...booking,
    receipt_number: receiptNumber,
    created_at: options.before?.created_at ?? now,
    updated_at: now,
  };

  let id = options.id;
  if (id) {
    await setDoc(doc(db, 'bookings', id), payload, { merge: true });
  } else {
    const ref = await addDoc(collection(db, 'bookings'), payload);
    id = ref.id;
  }

  const sensitiveChanged: string[] = [];
  if (options.plainNationalId && options.plainNationalId.trim() !== '') {
    await setDoc(doc(db, 'bookings', id, 'private', 'national_id'), {
      value: options.plainNationalId.trim(),
      updated_at: now,
    });
    sensitiveChanged.push('national_id');
  }

  await syncAutoPayment({
    source_type: 'booking',
    source_id: id,
    client_name: booking.client_name,
    reference: receiptNumber,
    amount_piasters: booking.paid_piasters,
    payment_method: booking.payment_method,
    payment_date: booking.booking_date,
    notes: booking.department === 'domestic_tourism' ? 'تحصيل تلقائي — سياحة داخلية' : 'تحصيل تلقائي — سياحة خارجية',
  });

  readCache.invalidate('bookings');
  await recordAudit({
    action: isNew ? 'create' : 'update',
    entity_type: 'booking',
    entity_id: id,
    department: booking.department,
    actor,
    before: options.before ? (options.before as unknown as Record<string, unknown>) : null,
    after: payload as unknown as Record<string, unknown>,
    sensitive_changed: sensitiveChanged,
  });

  return id;
}

export async function deleteBooking(booking: BookingRecord, actor: ActorInfo): Promise<void> {
  try {
    await deleteDoc(doc(db, 'bookings', booking.id, 'private', 'national_id'));
  } catch {
    // Private subdoc may not exist
  }
  await deleteDoc(doc(db, 'bookings', booking.id));
  await syncAutoPayment({
    source_type: 'booking',
    source_id: booking.id,
    client_name: booking.client_name,
    reference: booking.receipt_number,
    amount_piasters: 0,
    payment_date: booking.booking_date,
    notes: '',
  });

  readCache.invalidate('bookings');
  await recordAudit({
    action: 'delete',
    entity_type: 'booking',
    entity_id: booking.id,
    department: booking.department,
    actor,
    before: booking as unknown as Record<string, unknown>,
  });
}

export async function revealBookingNationalId(bookingId: string, actor: ActorInfo): Promise<string> {
  const snap = await getDoc(doc(db, 'bookings', bookingId, 'private', 'national_id'));
  await recordSensitiveAccess(actor, 'booking', bookingId, 'national_id');
  if (!snap.exists()) return '';
  return String(snap.data().value ?? '');
}

// ============================================================
// Visas, Destinations, Required Papers, Suppliers, Expenses
// ============================================================

export async function listVisaDestinations(includeDeleted = false): Promise<VisaDestination[]> {
  const all = await readCache.remember('visa_destinations', 'all', async () => {
    const snap = await getDocs(collection(db, 'visa_destinations'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<VisaDestination, 'id'>) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  });
  return includeDeleted ? all : all.filter((d) => !d.deleted_at);
}

export async function saveVisaDestination(
  dest: Omit<VisaDestination, 'id' | 'created_at' | 'updated_at'>,
  actor: ActorInfo,
  id?: string,
): Promise<string> {
  const now = nowIso();
  const payload = { ...dest, created_at: now, updated_at: now };
  let docId = id;
  if (docId) {
    await setDoc(doc(db, 'visa_destinations', docId), { ...dest, updated_at: now }, { merge: true });
  } else {
    const ref = await addDoc(collection(db, 'visa_destinations'), payload);
    docId = ref.id;
  }
  readCache.invalidate('visa_destinations');
  await recordAudit({
    action: id ? 'update' : 'create',
    entity_type: 'visa_destination',
    entity_id: docId,
    department: 'visas',
    actor,
    after: dest as unknown as Record<string, unknown>,
  });
  return docId;
}

const DEFAULT_VISA_PAPERS = [
  'جواز سفر ساري لمدة 6 أشهر على الأقل',
  'عدد 2 صورة شخصية بخلفية بيضاء',
  'صورة البطاقة الشخصية (الرقم القومي)',
  'كشف حساب بنكي لآخر 6 أشهر',
  'خطاب جهة العمل / السجل التجاري والبطاقة الضريبية',
];

export async function getVisaRequiredPapers(): Promise<string[]> {
  return readCache.remember('settings', 'visa_required_papers', async () => {
    const snap = await getDoc(doc(db, 'settings', 'visa_required_papers'));
    if (!snap.exists()) return DEFAULT_VISA_PAPERS;
    const items = snap.data().items;
    return Array.isArray(items) ? items.map(String) : DEFAULT_VISA_PAPERS;
  });
}

export async function saveVisaRequiredPapers(items: string[], actor: ActorInfo): Promise<void> {
  await setDoc(doc(db, 'settings', 'visa_required_papers'), { items, updated_at: nowIso() }, { merge: true });
  readCache.invalidate('settings');
  await recordAudit({
    action: 'update',
    entity_type: 'settings',
    entity_id: 'visa_required_papers',
    department: 'visas',
    actor,
    after: { items },
  });
}

export async function listVisaCases(): Promise<VisaCaseRecord[]> {
  return readCache.remember('visa_cases', 'all', async () => {
    const snap = await getDocs(collection(db, 'visa_cases'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisaCaseRecord, 'id'>) }));
    return sortDescBy(rows, 'created_at');
  });
}

export async function getVisaCase(id: string): Promise<VisaCaseRecord | null> {
  const snap = await getDoc(doc(db, 'visa_cases', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<VisaCaseRecord, 'id'>) };
}

export async function saveVisaCase(
  vc: Omit<VisaCaseRecord, 'id' | 'created_at' | 'updated_at'>,
  actor: ActorInfo,
  options: { id?: string; before?: VisaCaseRecord | null } = {},
): Promise<string> {
  const now = nowIso();
  const invoiceNumber = vc.invoice_number.trim() || (await nextSequenceNumber('visas'));
  const payload = {
    ...vc,
    invoice_number: invoiceNumber,
    created_at: options.before?.created_at ?? now,
    updated_at: now,
  };
  let id = options.id;
  if (id) {
    await setDoc(doc(db, 'visa_cases', id), payload, { merge: true });
  } else {
    const ref = await addDoc(collection(db, 'visa_cases'), payload);
    id = ref.id;
  }
  await syncAutoPayment({
    source_type: 'visa',
    source_id: id,
    client_name: vc.client_name,
    reference: invoiceNumber,
    amount_piasters: vc.paid_piasters,
    payment_method: vc.payment_method,
    payment_date: vc.case_date,
    notes: `تحصيل تلقائي — تأشيرات (${vc.destination_name || 'عام'})`,
  });

  readCache.invalidate('visa_cases');
  await recordAudit({
    action: options.id ? 'update' : 'create',
    entity_type: 'visa_case',
    entity_id: id,
    department: 'visas',
    actor,
    before: options.before ? (options.before as unknown as Record<string, unknown>) : null,
    after: payload as unknown as Record<string, unknown>,
  });
  return id;
}

export async function deleteVisaCase(vc: VisaCaseRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'visa_cases', vc.id));
  await syncAutoPayment({
    source_type: 'visa',
    source_id: vc.id,
    client_name: vc.client_name,
    reference: vc.invoice_number,
    amount_piasters: 0,
    payment_date: vc.case_date,
    notes: '',
  });

  readCache.invalidate('visa_cases');
  await recordAudit({
    action: 'delete',
    entity_type: 'visa_case',
    entity_id: vc.id,
    department: 'visas',
    actor,
    before: vc as unknown as Record<string, unknown>,
  });
}

export async function listSuppliers(): Promise<SupplierRecord[]> {
  return readCache.remember('suppliers', 'all', async () => {
    const snap = await getDocs(collection(db, 'suppliers'));
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<SupplierRecord, 'id'>) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  });
}

export async function saveSupplier(
  supplier: Omit<SupplierRecord, 'id' | 'created_at'>,
  actor: ActorInfo,
  id?: string,
): Promise<string> {
  const now = nowIso();
  let docId = id;
  if (docId) {
    await setDoc(doc(db, 'suppliers', docId), supplier, { merge: true });
  } else {
    const ref = await addDoc(collection(db, 'suppliers'), { ...supplier, created_at: now });
    docId = ref.id;
  }
  readCache.invalidate('suppliers');
  await recordAudit({
    action: id ? 'update' : 'create',
    entity_type: 'supplier',
    entity_id: docId,
    department: 'accounting',
    actor,
    after: supplier as unknown as Record<string, unknown>,
  });
  return docId;
}

export async function deleteSupplier(supplier: SupplierRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'suppliers', supplier.id));
  readCache.invalidate('suppliers');
  await recordAudit({
    action: 'delete',
    entity_type: 'supplier',
    entity_id: supplier.id,
    department: 'accounting',
    actor,
    before: supplier as unknown as Record<string, unknown>,
  });
}

export async function listExpenses(): Promise<ExpenseRecord[]> {
  return readCache.remember('expenses', 'all', async () => {
    const snap = await getDocs(collection(db, 'expenses'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExpenseRecord, 'id'>) }));
    return sortDescBy(rows, 'expense_date');
  });
}

export async function addExpense(
  exp: Omit<ExpenseRecord, 'id' | 'created_at'>,
  actor: ActorInfo,
): Promise<string> {
  const ref = await addDoc(collection(db, 'expenses'), { ...exp, created_at: nowIso() });
  readCache.invalidate('expenses');
  await recordAudit({
    action: 'create',
    entity_type: 'expense',
    entity_id: ref.id,
    department: exp.category === 'visa' ? 'visas' : 'accounting',
    actor,
    after: exp as unknown as Record<string, unknown>,
  });
  return ref.id;
}

export async function deleteExpense(exp: ExpenseRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'expenses', exp.id));
  readCache.invalidate('expenses');
  await recordAudit({
    action: 'delete',
    entity_type: 'expense',
    entity_id: exp.id,
    department: exp.category === 'visa' ? 'visas' : 'accounting',
    actor,
    before: exp as unknown as Record<string, unknown>,
  });
}

// ============================================================
// Real Estate (Apartments, Statuses, Clients, Inspections)
// ============================================================

const DEFAULT_APARTMENT_STATUSES = ['متاح', 'محجوز', 'مباع', 'موقوف'];

export async function getApartmentStatuses(): Promise<string[]> {
  return readCache.remember('settings', 'apartment_statuses', async () => {
    const snap = await getDoc(doc(db, 'settings', 'apartment_statuses'));
    if (!snap.exists()) return DEFAULT_APARTMENT_STATUSES;
    const items = snap.data().items;
    return Array.isArray(items) && items.length ? items.map(String) : DEFAULT_APARTMENT_STATUSES;
  });
}

export async function saveApartmentStatuses(items: string[], actor: ActorInfo): Promise<void> {
  await setDoc(doc(db, 'settings', 'apartment_statuses'), { items, updated_at: nowIso() }, { merge: true });
  readCache.invalidate('settings');
  await recordAudit({
    action: 'update',
    entity_type: 'settings',
    entity_id: 'apartment_statuses',
    department: 'real_estate',
    actor,
    after: { items },
  });
}

export async function listApartments(): Promise<ApartmentRecord[]> {
  return readCache.remember('apartments', 'all', async () => {
    const snap = await getDocs(collection(db, 'apartments'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApartmentRecord, 'id'>) }));
    return sortDescBy(rows, 'created_at');
  });
}

export async function getApartment(id: string): Promise<ApartmentRecord | null> {
  const snap = await getDoc(doc(db, 'apartments', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ApartmentRecord, 'id'>) };
}

export async function saveApartment(
  apt: Omit<ApartmentRecord, 'id' | 'created_at' | 'updated_at'>,
  actor: ActorInfo,
  options: { id?: string; before?: ApartmentRecord | null } = {},
): Promise<string> {
  const now = nowIso();
  const invoiceNumber =
    apt.invoice_number.trim() || (apt.buyer_name.trim() ? await nextSequenceNumber('real_estate') : '');
  const payload = {
    ...apt,
    invoice_number: invoiceNumber,
    created_at: options.before?.created_at ?? now,
    updated_at: now,
  };
  let id = options.id;
  if (id) {
    await setDoc(doc(db, 'apartments', id), payload, { merge: true });
  } else {
    const ref = await addDoc(collection(db, 'apartments'), payload);
    id = ref.id;
  }
  await syncAutoPayment({
    source_type: 'apartment',
    source_id: id,
    client_name: apt.buyer_name || apt.name_or_address,
    reference: invoiceNumber || apt.name_or_address,
    amount_piasters: apt.paid_piasters,
    payment_method: apt.payment_method,
    payment_date: apt.sale_date || nowIso().slice(0, 10),
    notes: `تحصيل تلقائي — عقارات (${apt.name_or_address})`,
  });

  readCache.invalidate('apartments');
  await recordAudit({
    action: options.id ? 'update' : 'create',
    entity_type: 'apartment',
    entity_id: id,
    department: 'real_estate',
    actor,
    before: options.before ? (options.before as unknown as Record<string, unknown>) : null,
    after: payload as unknown as Record<string, unknown>,
  });
  return id;
}

export async function deleteApartment(apt: ApartmentRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'apartments', apt.id));
  await syncAutoPayment({
    source_type: 'apartment',
    source_id: apt.id,
    client_name: apt.buyer_name || apt.name_or_address,
    reference: apt.invoice_number,
    amount_piasters: 0,
    payment_date: apt.sale_date,
    notes: '',
  });

  readCache.invalidate('apartments');
  await recordAudit({
    action: 'delete',
    entity_type: 'apartment',
    entity_id: apt.id,
    department: 'real_estate',
    actor,
    before: apt as unknown as Record<string, unknown>,
  });
}

export async function listApartmentClients(): Promise<ApartmentClientRecord[]> {
  return readCache.remember('apartment_clients', 'all', async () => {
    const snap = await getDocs(collection(db, 'apartment_clients'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ApartmentClientRecord, 'id'>) }));
    return sortDescBy(rows, 'created_at');
  });
}

export async function addApartmentClient(
  client: Omit<ApartmentClientRecord, 'id' | 'created_at'>,
  actor: ActorInfo,
): Promise<string> {
  const ref = await addDoc(collection(db, 'apartment_clients'), { ...client, created_at: nowIso() });
  readCache.invalidate('apartment_clients');
  await recordAudit({
    action: 'create',
    entity_type: 'apartment_client',
    entity_id: ref.id,
    department: 'real_estate',
    actor,
    after: client as unknown as Record<string, unknown>,
  });
  return ref.id;
}

export async function deleteApartmentClient(client: ApartmentClientRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'apartment_clients', client.id));
  readCache.invalidate('apartment_clients');
  await recordAudit({
    action: 'delete',
    entity_type: 'apartment_client',
    entity_id: client.id,
    department: 'real_estate',
    actor,
    before: client as unknown as Record<string, unknown>,
  });
}

export async function listInspections(): Promise<InspectionRecord[]> {
  return readCache.remember('inspections', 'all', async () => {
    const snap = await getDocs(collection(db, 'inspections'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InspectionRecord, 'id'>) }));
    return sortDescBy(rows, 'inspection_date');
  });
}

export async function addInspection(
  insp: Omit<InspectionRecord, 'id' | 'created_at'>,
  actor: ActorInfo,
): Promise<string> {
  const ref = await addDoc(collection(db, 'inspections'), { ...insp, created_at: nowIso() });
  readCache.invalidate('inspections');
  await recordAudit({
    action: 'create',
    entity_type: 'inspection',
    entity_id: ref.id,
    department: 'real_estate',
    actor,
    after: insp as unknown as Record<string, unknown>,
  });
  return ref.id;
}

export async function deleteInspection(insp: InspectionRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'inspections', insp.id));
  readCache.invalidate('inspections');
  await recordAudit({
    action: 'delete',
    entity_type: 'inspection',
    entity_id: insp.id,
    department: 'real_estate',
    actor,
    before: insp as unknown as Record<string, unknown>,
  });
}

// ============================================================
// Accounting (Payments, Debts, Commissions)
// ============================================================

export async function listPayments(): Promise<PaymentRecord[]> {
  return readCache.remember('payments', 'all', async () => {
    const snap = await getDocs(collection(db, 'payments'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PaymentRecord, 'id'>) }));
    return sortDescBy(rows, 'payment_date');
  });
}

export async function addPayment(
  payment: Omit<PaymentRecord, 'id' | 'created_at'>,
  actor: ActorInfo,
): Promise<string> {
  const ref = await addDoc(collection(db, 'payments'), { ...payment, created_at: nowIso() });
  readCache.invalidate('payments');
  await recordAudit({
    action: 'create',
    entity_type: 'payment',
    entity_id: ref.id,
    department: 'accounting',
    actor,
    after: payment as unknown as Record<string, unknown>,
  });
  return ref.id;
}

export async function deletePayment(payment: PaymentRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'payments', payment.id));
  readCache.invalidate('payments');
  await recordAudit({
    action: 'delete',
    entity_type: 'payment',
    entity_id: payment.id,
    department: 'accounting',
    actor,
    before: payment as unknown as Record<string, unknown>,
  });
}

export async function listDebts(): Promise<DebtRecord[]> {
  return readCache.remember('debts', 'all', async () => {
    const snap = await getDocs(collection(db, 'debts'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DebtRecord, 'id'>) }));
    return sortDescBy(rows, 'debt_date');
  });
}

export async function addDebt(debt: Omit<DebtRecord, 'id' | 'created_at'>, actor: ActorInfo): Promise<string> {
  const ref = await addDoc(collection(db, 'debts'), { ...debt, created_at: nowIso() });
  readCache.invalidate('debts');
  await recordAudit({
    action: 'create',
    entity_type: 'debt',
    entity_id: ref.id,
    department: 'accounting',
    actor,
    after: debt as unknown as Record<string, unknown>,
  });
  return ref.id;
}

export async function updateDebtPaid(debt: DebtRecord, newPaidPiasters: number, actor: ActorInfo): Promise<void> {
  const remaining = Math.max(0, debt.total_piasters - newPaidPiasters);
  await updateDoc(doc(db, 'debts', debt.id), {
    paid_piasters: newPaidPiasters,
    remaining_piasters: remaining,
  });
  readCache.invalidate('debts');
  await recordAudit({
    action: 'update',
    entity_type: 'debt',
    entity_id: debt.id,
    department: 'accounting',
    actor,
    before: { paid_piasters: debt.paid_piasters, remaining_piasters: debt.remaining_piasters },
    after: { paid_piasters: newPaidPiasters, remaining_piasters: remaining },
  });
}

export async function deleteDebt(debt: DebtRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'debts', debt.id));
  readCache.invalidate('debts');
  await recordAudit({
    action: 'delete',
    entity_type: 'debt',
    entity_id: debt.id,
    department: 'accounting',
    actor,
    before: debt as unknown as Record<string, unknown>,
  });
}

export async function listCommissions(): Promise<CommissionRecord[]> {
  return readCache.remember('commissions', 'all', async () => {
    const snap = await getDocs(collection(db, 'commissions'));
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommissionRecord, 'id'>) }));
    return sortDescBy(rows, 'commission_date');
  });
}

export async function addCommission(
  comm: Omit<CommissionRecord, 'id' | 'created_at'>,
  actor: ActorInfo,
): Promise<string> {
  const ref = await addDoc(collection(db, 'commissions'), { ...comm, created_at: nowIso() });
  readCache.invalidate('commissions');
  await recordAudit({
    action: 'create',
    entity_type: 'commission',
    entity_id: ref.id,
    department: 'accounting',
    actor,
    after: comm as unknown as Record<string, unknown>,
  });
  return ref.id;
}

export async function deleteCommission(comm: CommissionRecord, actor: ActorInfo): Promise<void> {
  await deleteDoc(doc(db, 'commissions', comm.id));
  readCache.invalidate('commissions');
  await recordAudit({
    action: 'delete',
    entity_type: 'commission',
    entity_id: comm.id,
    department: 'accounting',
    actor,
    before: comm as unknown as Record<string, unknown>,
  });
}

// ============================================================
// Print Settings
// ============================================================

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  company_name: 'Red Star Travel — ريد ستار للسياحة',
  contact_details: 'القاهرة، جمهورية مصر العربية | هاتف: 01000000000',
  watermark_text: '',
  terms_and_conditions:
    '1. يرجى مراجعة جميع البيانات الموضحة في هذا الإيصال فور الاستلام.\n2. تطبق سياسة الإلغاء والتعديل الخاصة بالفنادق وشركات الطيران والجهات المعنية.\n3. لا يُعتد بأي تعديل إلا بموجب إيصال رسمي معتمد من الشركة.',
};

export async function getPrintSettings(): Promise<PrintSettings> {
  return readCache.remember('settings', 'print', async () => {
    const snap = await getDoc(doc(db, 'settings', 'print'));
    if (!snap.exists()) return DEFAULT_PRINT_SETTINGS;
    return { ...DEFAULT_PRINT_SETTINGS, ...(snap.data() as Partial<PrintSettings>) };
  });
}

export async function savePrintSettings(settings: PrintSettings, actor: ActorInfo): Promise<void> {
  await setDoc(doc(db, 'settings', 'print'), { ...settings, updated_at: nowIso() }, { merge: true });
  readCache.invalidate('settings');
  await recordAudit({
    action: 'update',
    entity_type: 'settings',
    entity_id: 'print',
    department: 'printing',
    actor,
    after: settings as unknown as Record<string, unknown>,
  });
}
