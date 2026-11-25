import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { getApartment, getBooking, getPrintSettings, getVisaCase } from '../lib/db';
import { formatEgp } from '../lib/format';
import { ApartmentRecord, BookingRecord, PrintSettings, VisaCaseRecord } from '../types/domain';

export const PrintDocumentPage: React.FC = () => {
  const { kind, id } = useParams<{ kind: 'booking' | 'visa' | 'apartment'; id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const size = searchParams.get('size') === 'a5' ? 'a5' : 'a4';

  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [visa, setVisa] = useState<VisaCaseRecord | null>(null);
  const [apartment, setApartment] = useState<ApartmentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id || !kind) return;
      setLoading(true);
      try {
        const s = await getPrintSettings();
        setSettings(s);
        if (kind === 'booking') setBooking(await getBooking(id));
        if (kind === 'visa') setVisa(await getVisaCase(id));
        if (kind === 'apartment') setApartment(await getApartment(id));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [kind, id]);

  if (loading) {
    return <div className="p-10 text-center text-brand-muted">جارٍ تجهيز المستند للطباعة...</div>;
  }

  let title = '';
  let docNumber = '';
  let docDate = '';
  let clientName = '';
  let clientPhone = '';
  let rows: { label: string; value: string }[] = [];
  let total = 0;
  let paid = 0;
  let remaining = 0;

  if (kind === 'booking' && booking) {
    title =
      booking.department === 'domestic_tourism'
        ? 'إيصال حجز — السياحة الداخلية'
        : 'إيصال حجز — السياحة الخارجية';
    docNumber = booking.receipt_number;
    docDate = `${booking.booking_date} (${booking.booking_day})`;
    clientName = booking.client_name;
    clientPhone = booking.phone;
    total = booking.total_piasters;
    paid = booking.paid_piasters;
    remaining = booking.remaining_piasters;
    // NOTE: National ID is intentionally NEVER printed.
    rows = [
      { label: 'اسم الفندق', value: booking.hotel_name || '—' },
      { label: 'المدينة', value: booking.city || '—' },
      { label: 'عدد الغرف', value: String(booking.rooms || 0) },
      { label: 'نوع الإقامة', value: booking.stay_type || '—' },
      { label: 'نوع الغرفة', value: booking.room_type || '—' },
      { label: 'الوصول / المغادرة', value: `${booking.check_in || '—'} إلى ${booking.check_out || '—'}` },
      { label: 'الأطفال', value: booking.children_count ? `${booking.children_count} (${(booking.children_ages || []).join('، ')})` : 'لا يوجد' },
      { label: 'الكراسي / المقاعد', value: booking.seats || '—' },
      { label: 'الإضافات والخدمات', value: [booking.extras, booking.optional_services].filter(Boolean).join(' — ') || '—' },
      { label: 'الموظف المسؤول', value: booking.responsible_employee_name || '—' },
    ];
  } else if (kind === 'visa' && visa) {
    title = 'فاتورة — التأشيرات واستقدام العمالة';
    docNumber = visa.invoice_number;
    docDate = visa.case_date;
    clientName = visa.client_name;
    clientPhone = visa.phone;
    total = visa.visa_price_piasters;
    paid = visa.paid_piasters;
    remaining = visa.remaining_piasters;
    rows = [
      { label: 'الوجهة', value: visa.destination_name || '—' },
      { label: 'الموظف المسؤول', value: visa.responsible_employee_name || '—' },
      ...Object.entries(visa.destination_values || {}).map(([k, v]) => ({
        label: visa.destination_field_labels?.[k] ?? k,
        value: typeof v === 'boolean' ? (v ? 'نعم' : 'لا') : String(v || '—'),
      })),
    ];
  } else if (kind === 'apartment' && apartment) {
    title = 'فاتورة — قسم العقارات';
    docNumber = apartment.invoice_number || '—';
    docDate = apartment.sale_date || '—';
    clientName = apartment.buyer_name || '—';
    clientPhone = apartment.buyer_phone || '—';
    total = apartment.price_piasters;
    paid = apartment.paid_piasters;
    remaining = apartment.remaining_piasters;
    rows = [
      { label: 'الشقة / العنوان', value: apartment.name_or_address },
      { label: 'الحالة', value: apartment.status },
      { label: 'الموظف المسؤول', value: apartment.responsible_employee_name || '—' },
    ];
  } else {
    return <div className="p-10 text-center text-brand-muted">المستند غير موجود.</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4">
      <style>{`@page { size: ${size === 'a5' ? 'A5' : 'A4'} portrait; margin: 12mm; }`}</style>

      {/* Toolbar */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between gap-3 no-print">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSearchParams({ size: 'a4' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              size === 'a4' ? 'bg-brand-primary text-white' : 'bg-white border border-brand-border'
            }`}
          >
            مقاس A4
          </button>
          <button
            type="button"
            onClick={() => setSearchParams({ size: 'a5' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              size === 'a5' ? 'bg-brand-primary text-white' : 'bg-white border border-brand-border'
            }`}
          >
            مقاس A5
          </button>
        </div>
        <button type="button" onClick={() => window.print()} className="btn-primary text-xs">
          <Printer className="w-4 h-4" />
          <span>طباعة الآن</span>
        </button>
      </div>

      {/* Printable Sheet */}
      <div
        className={`relative bg-white mx-auto border border-brand-border shadow-sm overflow-hidden ${
          size === 'a5' ? 'max-w-[148mm] p-5 text-xs' : 'max-w-[210mm] p-8 text-sm'
        }`}
      >
        {/* Watermark */}
        {settings?.watermark_text && (
          <div className="pointer-events-none select-none absolute inset-0 flex items-center justify-center opacity-[0.06] -rotate-45">
            <span className="text-6xl font-extrabold text-brand-sidebar whitespace-nowrap">
              {settings.watermark_text}
            </span>
          </div>
        )}

        <div className="relative z-10 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-brand-sidebar pb-3">
            <div>
              <h1 className="text-lg font-extrabold text-brand-sidebar">{settings?.company_name}</h1>
              <p className="text-xs text-brand-muted mt-1">{settings?.contact_details}</p>
            </div>
            <div className="text-left">
              <div className="font-bold text-brand-accent">{title}</div>
              <div className="text-xs mt-1">
                رقم المستند: <span className="font-bold">{docNumber}</span>
              </div>
              <div className="text-xs text-brand-muted">التاريخ: {docDate}</div>
            </div>
          </div>

          {/* Client Box */}
          <div className="grid grid-cols-2 gap-3 bg-brand-page border border-brand-border rounded-lg p-3">
            <div>
              <span className="text-brand-muted text-xs">اسم العميل: </span>
              <span className="font-bold">{clientName}</span>
            </div>
            <div>
              <span className="text-brand-muted text-xs">رقم الهاتف: </span>
              <span className="font-bold" dir="ltr">
                {clientPhone}
              </span>
            </div>
          </div>

          {/* Details Table */}
          <table className="w-full border border-brand-border">
            <tbody className="divide-y divide-brand-border">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="bg-brand-table-head px-3 py-2 font-semibold w-1/3">{r.label}</td>
                  <td className="px-3 py-2">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Financial Totals */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="border border-brand-border rounded-lg p-2.5">
              <div className="text-xs text-brand-muted">الإجمالي</div>
              <div className="font-bold text-brand-ink mt-0.5">{formatEgp(total)}</div>
            </div>
            <div className="border border-brand-border rounded-lg p-2.5 bg-brand-success-bg/50">
              <div className="text-xs text-brand-muted">المدفوع</div>
              <div className="font-bold text-brand-success mt-0.5">{formatEgp(paid)}</div>
            </div>
            <div className="border border-brand-border rounded-lg p-2.5 bg-brand-info/60">
              <div className="text-xs text-brand-muted">المتبقي</div>
              <div className="font-bold text-brand-accent mt-0.5">{formatEgp(remaining)}</div>
            </div>
          </div>

          {/* Terms */}
          {settings?.terms_and_conditions && (
            <div className="note-box whitespace-pre-line text-xs leading-relaxed">
              <div className="font-bold text-brand-accent mb-1">الشروط والأحكام:</div>
              {settings.terms_and_conditions}
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-10 pt-8">
            <div className="text-center">
              <div className="border-t border-brand-ink/40 pt-2 font-semibold">توقيع العميل</div>
            </div>
            <div className="text-center">
              <div className="border-t border-brand-ink/40 pt-2 font-semibold">توقيع البائع / الشركة</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
