import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Pencil, Printer, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { deleteBooking, getBooking, revealBookingNationalId } from '../lib/db';
import { formatEgp } from '../lib/format';
import { BookingRecord, DEPARTMENT_LABELS } from '../types/domain';

interface Props {
  department: 'domestic_tourism' | 'outbound_tourism';
}

export const BookingDetailPage: React.FC<Props> = ({ department }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, canEdit } = useAuth();
  const basePath = department === 'domestic_tourism' ? '/domestic-bookings' : '/outbound-bookings';

  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealedNid, setRevealedNid] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const rec = await getBooking(id);
        setBooking(rec);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleReveal = async () => {
    if (!booking || !profile) return;
    if (revealedNid !== null) {
      setRevealedNid(null);
      return;
    }
    setRevealing(true);
    try {
      const val = await revealBookingNationalId(booking.id, { uid: profile.uid, name: profile.name });
      setRevealedNid(val || 'غير مسجل');
    } finally {
      setRevealing(false);
    }
  };

  const handleDelete = async () => {
    if (!booking || !profile) return;
    if (!window.confirm(`حذف الحجز رقم ${booking.receipt_number}؟`)) return;
    await deleteBooking(booking, { uid: profile.uid, name: profile.name });
    navigate(basePath);
  };

  if (loading) {
    return <div className="card p-8 text-center text-brand-muted">جارٍ تحميل بيانات الحجز...</div>;
  }

  if (!booking) {
    return <div className="card p-8 text-center text-brand-muted">الحجز غير موجود.</div>;
  }

  const editable = canEdit(department);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to={basePath} className="btn-secondary text-xs px-3 py-1.5">
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-brand-ink">
              حجز رقم {booking.receipt_number} — {booking.client_name}
            </h1>
            <p className="text-xs text-brand-muted">
              {DEPARTMENT_LABELS[department]} | {booking.booking_date} ({booking.booking_day})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/print/booking/${booking.id}?size=a4`} target="_blank" className="btn-secondary text-xs">
            <Printer className="w-4 h-4" />
            <span>طباعة A4</span>
          </Link>
          <Link to={`/print/booking/${booking.id}?size=a5`} target="_blank" className="btn-secondary text-xs">
            <Printer className="w-4 h-4" />
            <span>طباعة A5</span>
          </Link>
          {editable && (
            <>
              <Link to={`${basePath}/${booking.id}/edit`} className="btn-primary text-xs">
                <Pencil className="w-4 h-4" />
                <span>تعديل</span>
              </Link>
              <button type="button" onClick={handleDelete} className="btn-danger text-xs">
                <Trash2 className="w-4 h-4" />
                <span>حذف</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-brand-muted">الإجمالي</div>
          <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(booking.total_piasters)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">المدفوع</div>
          <div className="text-lg font-bold text-brand-success mt-1">{formatEgp(booking.paid_piasters)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">المتبقي</div>
          <div className="text-lg font-bold text-brand-accent mt-1">{formatEgp(booking.remaining_piasters)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 space-y-3 text-sm">
          <h2 className="font-bold text-brand-accent border-b border-brand-border pb-2">بيانات الحجز والعميل</h2>
          <DetailRow label="اسم العميل" value={booking.client_name} />
          <DetailRow label="الهاتف" value={booking.phone} dir="ltr" />
          <div className="flex items-center justify-between gap-2 py-1 border-b border-brand-border/50">
            <span className="text-brand-muted text-xs">الرقم القومي</span>
            <div className="flex items-center gap-2">
              <span className="font-medium" dir="ltr">
                {revealedNid !== null ? revealedNid : booking.national_id_masked || '—'}
              </span>
              {booking.has_national_id && (
                <button
                  type="button"
                  onClick={handleReveal}
                  disabled={revealing}
                  className="text-xs text-brand-primary hover:underline flex items-center gap-1"
                >
                  {revealedNid !== null ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{revealedNid !== null ? 'إخفاء' : 'إظهار'}</span>
                </button>
              )}
            </div>
          </div>
          <DetailRow
            label="الأطفال"
            value={
              booking.children_count > 0
                ? `${booking.children_count} (الأعمار: ${(booking.children_ages || []).join('، ')})`
                : 'لا يوجد'
            }
          />
          <DetailRow label="الإضافات" value={booking.extras || '—'} />
          <DetailRow label="الكراسي / المقاعد" value={booking.seats || '—'} />
        </div>

        <div className="card p-5 space-y-3 text-sm">
          <h2 className="font-bold text-brand-accent border-b border-brand-border pb-2">الفندق والإقامة</h2>
          <DetailRow label="اسم الفندق" value={booking.hotel_name || '—'} />
          <DetailRow label="المدينة" value={booking.city || '—'} />
          <DetailRow label="عدد الغرف" value={String(booking.rooms || 0)} />
          <DetailRow label="نوع الإقامة" value={booking.stay_type || '—'} />
          <DetailRow label="نوع الغرفة" value={booking.room_type || '—'} />
          <DetailRow label="تاريخ الوصول" value={booking.check_in || '—'} />
          <DetailRow label="تاريخ المغادرة" value={booking.check_out || '—'} />
        </div>

        <div className="card p-5 space-y-3 text-sm">
          <h2 className="font-bold text-brand-accent border-b border-brand-border pb-2">التسعير والمسؤولية</h2>
          <DetailRow label="سعر الفرد" value={formatEgp(booking.price_per_person_piasters)} />
          <DetailRow label="مقاعد مميزة" value={booking.premium_seats || '—'} />
          <DetailRow label="إضافي المقاعد المميزة" value={formatEgp(booking.premium_seats_extra_piasters)} />
          <DetailRow label="خدمات اختيارية" value={booking.optional_services || '—'} />
          <DetailRow label="الموظف المسؤول" value={booking.responsible_employee_name || '—'} />
        </div>
      </div>

      {Object.keys(booking.custom || {}).length > 0 && (
        <div className="card p-5 space-y-3 text-sm">
          <h2 className="font-bold text-brand-accent border-b border-brand-border pb-2">الحقول الإضافية</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(booking.custom).map(([k, v]) => (
              <DetailRow
                key={k}
                label={booking.custom_labels?.[k] ?? k}
                value={typeof v === 'boolean' ? (v ? 'نعم' : 'لا') : String(v || '—')}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string; dir?: 'ltr' | 'rtl' }> = ({ label, value, dir }) => (
  <div className="flex items-center justify-between gap-2 py-1 border-b border-brand-border/50">
    <span className="text-brand-muted text-xs">{label}</span>
    <span className="font-medium text-brand-ink" dir={dir}>
      {value}
    </span>
  </div>
);
