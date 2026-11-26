export type DepartmentKey =
  | 'domestic_tourism'
  | 'outbound_tourism'
  | 'visas'
  | 'real_estate'
  | 'accounting'
  | 'users_permissions'
  | 'employee_activity'
  | 'printing';

export type PermissionLevel = 'none' | 'view' | 'edit';

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'money'
  | 'checkbox'
  | 'link'
  | 'national_id'
  | 'children'
  | 'employee';

export type PaymentMethod = 'cash' | 'instapay' | 'vodafone_cash';

export interface DepartmentMeta {
  key: DepartmentKey;
  label: string;
  path: string;
}

export const DEPARTMENTS: DepartmentMeta[] = [
  { key: 'domestic_tourism', label: 'السياحة الداخلية', path: '/domestic-bookings' },
  { key: 'outbound_tourism', label: 'السياحة الخارجية', path: '/outbound-bookings' },
  { key: 'visas', label: 'التأشيرات واستقدام العمالة', path: '/visas' },
  { key: 'real_estate', label: 'العقارات', path: '/real-estate' },
  { key: 'accounting', label: 'الحسابات', path: '/accounting' },
  { key: 'users_permissions', label: 'المستخدمين والصلاحيات', path: '/users' },
  { key: 'employee_activity', label: 'نشاط الموظفين', path: '/employee-activity' },
  { key: 'printing', label: 'الطباعة', path: '/printing' },
];

export const DEPARTMENT_LABELS: Record<DepartmentKey, string> = DEPARTMENTS.reduce(
  (acc, item) => ({ ...acc, [item.key]: item.label }),
  {} as Record<DepartmentKey, string>,
);

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  none: 'لا يوجد وصول',
  view: 'عرض فقط',
  edit: 'عرض وتعديل',
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'نقدي' },
  { value: 'instapay', label: 'إنستا باي' },
  { value: 'vodafone_cash', label: 'فودافون كاش' },
];

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  disabled: boolean;
  permissions: Partial<Record<DepartmentKey, PermissionLevel>>;
  created_at?: string;
  updated_at?: string;
}

export interface FieldDefinition {
  id: string;
  department: 'domestic_tourism' | 'outbound_tourism';
  key: string;
  label: string;
  type: FieldType;
  section: 'booking' | 'hotel' | 'pricing' | 'custom';
  required: boolean;
  show_on_receipt: boolean;
  options: string[];
  default_url?: string;
  sort_order: number;
  is_system: boolean;
  deleted_at: string | null;
}

export interface BookingRecord {
  id: string;
  department: 'domestic_tourism' | 'outbound_tourism';
  receipt_number: string;
  booking_date: string;
  booking_day: string;
  client_name: string;
  national_id_masked?: string;
  has_national_id?: boolean;
  phone: string;
  children_count: number;
  children_ages: number[];
  extras: string;
  seats: string;
  hotel_name: string;
  rooms: number;
  stay_type: string;
  city: string;
  room_type: string;
  check_in: string;
  check_out: string;
  price_per_person_piasters: number;
  premium_seats: string;
  premium_seats_extra_piasters: number;
  optional_services: string;
  total_piasters: number;
  paid_piasters: number;
  remaining_piasters: number;
  installments_paid_piasters?: number;
  payment_method?: PaymentMethod;
  responsible_employee_uid: string;
  responsible_employee_name: string;
  custom: Record<string, string | boolean>;
  custom_labels: Record<string, string>;
  custom_types: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface VisaDestinationField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'link';
  required: boolean;
  options: string[];
  default_url?: string;
}

export interface VisaDestination {
  id: string;
  name: string;
  fields: VisaDestinationField[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VisaCaseRecord {
  id: string;
  invoice_number: string;
  case_date: string;
  client_name: string;
  phone: string;
  destination_id: string;
  destination_name: string;
  destination_values: Record<string, string | boolean>;
  destination_field_labels: Record<string, string>;
  destination_field_types: Record<string, string>;
  visa_price_piasters: number;
  paid_piasters: number;
  remaining_piasters: number;
  installments_paid_piasters?: number;
  payment_method?: PaymentMethod;
  supplier_id: string | null;
  supplier_name: string;
  supplier_cost_piasters: number;
  supplier_paid_piasters: number;
  supplier_remaining_piasters: number;
  expenses_total_piasters: number;
  papers_checklist: { name: string; checked: boolean }[];
  responsible_employee_uid: string;
  responsible_employee_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierRecord {
  id: string;
  name: string;
  phone: string;
  opening_total_piasters: number;
  opening_paid_piasters: number;
  created_at: string;
}

export interface ExpenseRecord {
  id: string;
  category: 'visa' | 'other';
  entity_type: string;
  entity_id: string | null;
  description: string;
  amount_piasters: number;
  expense_date: string;
  created_at: string;
}

export interface ApartmentRecord {
  id: string;
  name_or_address: string;
  price_piasters: number;
  profit_percentage: string;
  status: string;
  invoice_number: string;
  buyer_name: string;
  buyer_phone: string;
  paid_piasters: number;
  remaining_piasters: number;
  installments_paid_piasters?: number;
  payment_method?: PaymentMethod;
  sale_date: string;
  responsible_employee_uid: string;
  responsible_employee_name: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ApartmentClientRecord {
  id: string;
  client_name: string;
  phone: string;
  apartment_id: string | null;
  apartment_name: string;
  follow_up_date: string;
  notes: string;
  responsible_employee_uid: string;
  responsible_employee_name: string;
  created_at: string;
}

export interface InspectionRecord {
  id: string;
  fee_piasters: number;
  inspection_date: string;
  inspection_day: string;
  place: string;
  apartment_id: string;
  apartment_name: string;
  agent_name: string;
  created_at: string;
}

export interface PaymentRecord {
  id: string;
  client_name: string;
  reference: string;
  amount_minor: number;
  currency: string;
  exchange_rate_on_receipt: string | null;
  payment_method: PaymentMethod;
  payment_date: string;
  notes: string;
  source_type?: 'booking' | 'visa' | 'apartment' | 'manual';
  source_id?: string;
  is_installment?: boolean;
  created_at: string;
}

export interface DebtRecord {
  id: string;
  direction: 'client_owes' | 'company_owes';
  party_name: string;
  description: string;
  total_piasters: number;
  paid_piasters: number;
  remaining_piasters: number;
  installments_paid_piasters?: number;
  payment_method?: PaymentMethod;
  debt_date: string;
  created_at: string;
}

export interface CommissionRecord {
  id: string;
  employee_uid: string;
  employee_name: string;
  commission_percentage: string;
  commission_amount_piasters: number;
  commission_date: string;
  notes: string;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  action: 'create' | 'update' | 'delete';
  entity_type: string;
  entity_id: string;
  department: DepartmentKey | null;
  actor_uid: string;
  actor_name: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  sensitive_changed: string[];
  occurred_at: string;
}

export interface ActivityLogRecord {
  id: string;
  user_uid: string;
  user_name: string;
  event: 'login' | 'logout';
  occurred_at: string;
}

export interface AttendanceRecord {
  id: string;
  user_uid: string;
  user_name: string;
  date: string;
  check_in_at: string;
  check_out_at: string | null;
  duration_minutes: number | null;
}

export interface PrintSettings {
  company_name: string;
  contact_details: string;
  watermark_text: string;
  terms_and_conditions: string;
}
