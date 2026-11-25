import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getBooking, listFieldDefinitions, listUsers, saveBooking } from '../lib/db';
import { arabicWeekday, formatEgp, fromPiasters, maskNationalId, todayIsoDate, toPiasters } from '../lib/format';
import { BookingRecord, DEPARTMENT_LABELS, FieldDefinition, UserProfile } from '../types/domain';

interface Props {
  department: 'domestic_tourism' | 'outbound_tourism';
}

export const BookingFormPage: React.FC<Props> = ({ department }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const basePath = department === 'domestic_tourism' ? '/domestic-bookings' : '/outbound-bookings';

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [existing, setExisting] = useState<BookingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core state
  const [receiptNumber, setReceiptNumber] = useState('');
  const [bookingDate, setBookingDate] = useState(todayIsoDate());
  const [clientName, setClientName] = useState('');
  const [nationalIdPlain, setNationalIdPlain] = useState('');
  const [phone, setPhone] = useState('');
  const [childrenCount, setChildrenCount] = useState(0);
  const [childrenAges, setChildrenAges] = useState<string[]>([]);
  const [extras, setExtras] = useState('');
  const [seats, setSeats] = useState('');

  const [hotelName, setHotelName] = useState('');
  const [rooms, setRooms] = useState(1);
  const [stayType, setStayType] = useState('');
  const [city, setCity] = useState('');
  const [roomType, setRoomType] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  const [pricePerPerson, setPricePerPerson] = useState('0');
  const [premiumSeats, setPremiumSeats] = useState('');
  const [premiumSeatsExtra, setPremiumSeatsExtra] = useState('0');
  const [optionalServices, setOptionalServices] = useState('');
  const [total, setTotal] = useState('0');
  const [paid, setPaid] = useState('0');
  const [responsibleUid, setResponsibleUid] = useState('');

  const [customValues, setCustomValues] = useState<Record<string, string | boolean>>({});

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [defs, allUsers] = await Promise.all([
          listFieldDefinitions(department, false),
          listUsers(),
        ]);
        setFields(defs);
        setUsers(allUsers.filter((u) => !u.disabled));

        if (id) {
          const rec = await getBooking(id);
          if (rec) {
            setExisting(rec);
            setReceiptNumber(rec.receipt_number);
            setBookingDate(rec.booking_date || todayIsoDate());
            setClientName(rec.client_name);
            setPhone(rec.phone);
            setChildrenCount(rec.children_count || 0);
            setChildrenAges((rec.children_ages || []).map(String));
            setExtras(rec.extras || '');
            setSeats(rec.seats || '');
            setHotelName(rec.hotel_name || '');
            setRooms(rec.rooms || 1);
            setStayType(rec.stay_type || '');
            setCity(rec.city || '');
            setRoomType(rec.room_type || '');
            setCheckIn(rec.check_in || '');
            setCheckOut(rec.check_out || '');
            setPricePerPerson(fromPiasters(rec.price_per_person_piasters));
            setPremiumSeats(rec.premium_seats || '');
            setPremiumSeatsExtra(fromPiasters(rec.premium_seats_extra_piasters));
            setOptionalServices(rec.optional_services || '');
            setTotal(fromPiasters(rec.total_piasters));
            setPaid(fromPiasters(rec.paid_piasters));
            setResponsibleUid(rec.responsible_employee_uid || '');
            setCustomValues(rec.custom || {});
          }
        } else if (profile) {
          setResponsibleUid(profile.uid);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [department, id, profile]);

  const activeKeys = useMemo(() => new Set(fields.map((f) => f.key)), [fields]);
  const fieldByKey = useMemo(() => {
    const map: Record<string, FieldDefinition> = {};
    for (const f of fields) map[f.key] = f;
    return map;
  }, [fields]);

  const customFields = useMemo(() => fields.filter((f) => !f.is_system), [fields]);

  const totalPiasters = toPiasters(total);
  const paidPiasters = toPiasters(paid);
  const remainingPiasters = Math.max(0, totalPiasters - paidPiasters);
  const bookingDay = arabicWeekday(bookingDate);

  const handleChildrenCountChange = (count: number) => {
    const safe = Math.max(0, Math.min(20, count));
    setChildrenCount(safe);
    setChildrenAges((prev) => {
      const next = [...prev];
      while (next.length < safe) next.push('');
      return next.slice(0, safe);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);

    if (paidPiasters > totalPiasters) {
      setError('لا يمكن أن يكون المبلغ المدفوع أكبر من الإجمالي.');
      return;
    }

    if (checkIn && checkOut && checkOut < checkIn) {
      setError('تاريخ المغادرة يجب أن يكون بعد أو يساوي تاريخ الوصول.');
      return;
    }

    const responsibleUser = users.find((u) => u.uid === responsibleUid);
    const customLabels: Record<string, string> = {};
    const customTypes: Record<string, string> = {};
    for (const cf of customFields) {
      customLabels[cf.key] = cf.label;
      customTypes[cf.key] = cf.type;
    }

    const masked = nationalIdPlain.trim()
      ? maskNationalId(nationalIdPlain)
      : existing?.national_id_masked ?? '';
    const hasNid = Boolean(nationalIdPlain.trim() || existing?.has_national_id);

    setSaving(true);
    try {
      const savedId = await saveBooking(
        {
          department,
          receipt_number: receiptNumber.trim(),
          booking_date: bookingDate,
          booking_day: bookingDay,
          client_name: clientName.trim(),
          national_id_masked: masked,
          has_national_id: hasNid,
          phone: phone.trim(),
          children_count: childrenCount,
          children_ages: childrenAges.map((a) => Number(a) || 0),
          extras: extras.trim(),
          seats: seats.trim(),
          hotel_name: hotelName.trim(),
          rooms: Number(rooms) || 0,
          stay_type: stayType,
          city: city.trim(),
          room_type: roomType,
          check_in: checkIn,
          check_out: checkOut,
          price_per_person_piasters: toPiasters(pricePerPerson),
          premium_seats: premiumSeats.trim(),
          premium_seats_extra_piasters: toPiasters(premiumSeatsExtra),
          optional_services: optionalServices.trim(),
          total_piasters: totalPiasters,
          paid_piasters: paidPiasters,
          remaining_piasters: remainingPiasters,
          responsible_employee_uid: responsibleUid || profile.uid,
          responsible_employee_name: responsibleUser?.name ?? profile.name,
          custom: customValues,
          custom_labels: { ...(existing?.custom_labels ?? {}), ...customLabels },
          custom_types: { ...(existing?.custom_types ?? {}), ...customTypes },
        },
        { uid: profile.uid, name: profile.name },
        { id, plainNationalId: nationalIdPlain, before: existing },
      );
      navigate(`${basePath}/${savedId}`);
    } catch {
      setError('حدث خطأ أثناء حفظ الحجز. يرجى التأكد من البيانات والمحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card p-8 text-center text-brand-muted">جارٍ تحميل النموذج...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={basePath} className="btn-secondary text-xs px-3 py-1.5">
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-brand-ink">
              {id ? 'تعديل حجز' : 'حجز جديد'} — {DEPARTMENT_LABELS[department]}
            </h1>
            <p className="text-xs text-brand-muted">اترك رقم الإيصال فارغاً للتوليد التلقائي المستقل للقسم</p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          <span>{saving ? 'جارٍ الحفظ...' : 'حفظ الحجز'}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Totals strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-brand-info border border-brand-border rounded-xl p-4">
        <div>
          <div className="text-xs text-brand-muted">الإجمالي</div>
          <div className="text-lg font-bold text-brand-ink">{formatEgp(totalPiasters)}</div>
        </div>
        <div>
          <div className="text-xs text-brand-muted">المدفوع</div>
          <div className="text-lg font-bold text-brand-success">{formatEgp(paidPiasters)}</div>
        </div>
        <div>
          <div className="text-xs text-brand-muted">المتبقي</div>
          <div className="text-lg font-bold text-brand-accent">{formatEgp(remainingPiasters)}</div>
        </div>
      </div>

      {/* 3-Column Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: بيانات الحجز */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">بيانات الحجز</h2>

          {activeKeys.has('receipt_number') && (
            <div>
              <label className="form-label">{fieldByKey.receipt_number.label}</label>
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                placeholder="تلقائي (مثل DOM-0001)"
                className="form-input"
              />
            </div>
          )}

          {activeKeys.has('booking_date') && (
            <div>
              <label className="form-label">
                {fieldByKey.booking_date.label} {bookingDay && <span className="text-brand-accent">({bookingDay})</span>}
              </label>
              <input
                type="date"
                required={fieldByKey.booking_date.required}
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {activeKeys.has('client_name') && (
            <div>
              <label className="form-label">{fieldByKey.client_name.label}</label>
              <input
                type="text"
                required={fieldByKey.client_name.required}
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {activeKeys.has('national_id') && (
            <div>
              <label className="form-label">{fieldByKey.national_id.label}</label>
              <input
                type="text"
                dir="ltr"
                value={nationalIdPlain}
                onChange={(e) => setNationalIdPlain(e.target.value)}
                placeholder={existing?.has_national_id ? `محفوظ (${existing.national_id_masked}) — اكتب لتحديثه` : '14 رقم'}
                className="form-input text-left"
              />
              <p className="text-[11px] text-brand-muted mt-1">لا يظهر في الجداول أو الإيصال المطبوع افتراضياً.</p>
            </div>
          )}

          {activeKeys.has('phone') && (
            <div>
              <label className="form-label">{fieldByKey.phone.label}</label>
              <input
                type="text"
                dir="ltr"
                required={fieldByKey.phone.required}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input text-left"
              />
            </div>
          )}

          {activeKeys.has('children') && (
            <div className="space-y-2">
              <label className="form-label">{fieldByKey.children.label}</label>
              <input
                type="number"
                min={0}
                max={20}
                value={childrenCount}
                onChange={(e) => handleChildrenCountChange(Number(e.target.value))}
                className="form-input"
                placeholder="عدد الأطفال"
              />
              {childrenCount > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {childrenAges.map((age, idx) => (
                    <input
                      key={idx}
                      type="number"
                      min={0}
                      max={18}
                      value={age}
                      onChange={(e) => {
                        const next = [...childrenAges];
                        next[idx] = e.target.value;
                        setChildrenAges(next);
                      }}
                      placeholder={`عمر طفل ${idx + 1}`}
                      className="form-input text-xs"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeKeys.has('extras') && (
            <div>
              <label className="form-label">{fieldByKey.extras.label}</label>
              <input type="text" value={extras} onChange={(e) => setExtras(e.target.value)} className="form-input" />
            </div>
          )}

          {activeKeys.has('seats') && (
            <div>
              <label className="form-label">{fieldByKey.seats.label}</label>
              <input type="text" value={seats} onChange={(e) => setSeats(e.target.value)} className="form-input" />
            </div>
          )}
        </div>

        {/* Column 2: الفندق والإقامة */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">الفندق والإقامة</h2>

          {activeKeys.has('hotel_name') && (
            <div>
              <label className="form-label">{fieldByKey.hotel_name.label}</label>
              <input type="text" value={hotelName} onChange={(e) => setHotelName(e.target.value)} className="form-input" />
            </div>
          )}

          {activeKeys.has('city') && (
            <div>
              <label className="form-label">{fieldByKey.city.label}</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className="form-input" />
            </div>
          )}

          {activeKeys.has('rooms') && (
            <div>
              <label className="form-label">{fieldByKey.rooms.label}</label>
              <input
                type="number"
                min={0}
                value={rooms}
                onChange={(e) => setRooms(Number(e.target.value))}
                className="form-input"
              />
            </div>
          )}

          {activeKeys.has('stay_type') && (
            <div>
              <label className="form-label">{fieldByKey.stay_type.label}</label>
              <select value={stayType} onChange={(e) => setStayType(e.target.value)} className="form-input">
                <option value="">— اختر —</option>
                {(fieldByKey.stay_type.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeKeys.has('room_type') && (
            <div>
              <label className="form-label">{fieldByKey.room_type.label}</label>
              <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className="form-input">
                <option value="">— اختر —</option>
                {(fieldByKey.room_type.options || []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeKeys.has('check_in') && (
            <div>
              <label className="form-label">{fieldByKey.check_in.label}</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="form-input" />
            </div>
          )}

          {activeKeys.has('check_out') && (
            <div>
              <label className="form-label">{fieldByKey.check_out.label}</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="form-input" />
            </div>
          )}
        </div>

        {/* Column 3: الأسعار */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">الأسعار والتحصيل</h2>

          {activeKeys.has('price_per_person') && (
            <div>
              <label className="form-label">{fieldByKey.price_per_person.label} (ج.م)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={pricePerPerson}
                onChange={(e) => setPricePerPerson(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {activeKeys.has('premium_seats') && (
            <div>
              <label className="form-label">{fieldByKey.premium_seats.label}</label>
              <input
                type="text"
                value={premiumSeats}
                onChange={(e) => setPremiumSeats(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {activeKeys.has('premium_seats_extra') && (
            <div>
              <label className="form-label">{fieldByKey.premium_seats_extra.label} (ج.م)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={premiumSeatsExtra}
                onChange={(e) => setPremiumSeatsExtra(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {activeKeys.has('optional_services') && (
            <div>
              <label className="form-label">{fieldByKey.optional_services.label}</label>
              <input
                type="text"
                value={optionalServices}
                onChange={(e) => setOptionalServices(e.target.value)}
                className="form-input"
              />
            </div>
          )}

          {activeKeys.has('total') && (
            <div>
              <label className="form-label">{fieldByKey.total.label} (ج.م)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="form-input font-semibold"
              />
            </div>
          )}

          {activeKeys.has('paid') && (
            <div>
              <label className="form-label">{fieldByKey.paid.label} (ج.م)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                className="form-input font-semibold"
              />
            </div>
          )}

          {activeKeys.has('responsible_employee') && (
            <div>
              <label className="form-label">{fieldByKey.responsible_employee.label}</label>
              <select
                value={responsibleUid}
                onChange={(e) => setResponsibleUid(e.target.value)}
                className="form-input"
              >
                <option value="">— اختر الموظف —</option>
                {users.map((u) => (
                  <option key={u.uid} value={u.uid}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Custom Fields added by admin */}
      {customFields.length > 0 && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">حقول إضافية للقسم</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {customFields.map((cf) => (
              <div key={cf.id}>
                <label className="form-label">{cf.label}</label>
                {cf.type === 'select' ? (
                  <select
                    required={cf.required}
                    value={String(customValues[cf.key] ?? '')}
                    onChange={(e) => setCustomValues({ ...customValues, [cf.key]: e.target.value })}
                    className="form-input"
                  >
                    <option value="">— اختر —</option>
                    {cf.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : cf.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input
                      type="checkbox"
                      checked={Boolean(customValues[cf.key])}
                      onChange={(e) => setCustomValues({ ...customValues, [cf.key]: e.target.checked })}
                    />
                    <span>نعم</span>
                  </label>
                ) : (
                  <input
                    type={cf.type === 'date' ? 'date' : cf.type === 'number' || cf.type === 'money' ? 'number' : 'text'}
                    step={cf.type === 'money' ? '0.01' : undefined}
                    required={cf.required}
                    value={String(customValues[cf.key] ?? '')}
                    onChange={(e) => setCustomValues({ ...customValues, [cf.key]: e.target.value })}
                    className="form-input"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
};
