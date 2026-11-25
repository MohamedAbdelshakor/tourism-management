import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Printer, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getPrintSettings, listApartments, listBookings, listVisaCases, savePrintSettings } from '../lib/db';
import { ApartmentRecord, BookingRecord, PrintSettings, VisaCaseRecord } from '../types/domain';

export const PrintingPage: React.FC = () => {
  const { profile, canEdit } = useAuth();
  const editable = canEdit('printing');

  const [settings, setSettings] = useState<PrintSettings>({
    company_name: '',
    contact_details: '',
    watermark_text: '',
    terms_and_conditions: '',
  });
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [visas, setVisas] = useState<VisaCaseRecord[]>([]);
  const [apartments, setApartments] = useState<ApartmentRecord[]>([]);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    Promise.all([getPrintSettings(), listBookings(), listVisaCases(), listApartments()]).then(([s, b, v, a]) => {
      setSettings(s);
      setBookings(b.slice(0, 15));
      setVisas(v.slice(0, 15));
      setApartments(a.slice(0, 15));
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    await savePrintSettings(settings, { uid: profile.uid, name: profile.name });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">الطباعة وإعدادات الإيصالات والفواتير</h1>
        <p className="text-xs text-brand-muted mt-0.5">
          يدعم مقاسي A4 و A5 مع العلامة المائية، خطوط توقيع العميل والبائع، الشروط والأحكام، وبدون طباعة الرقم القومي
        </p>
      </div>

      {savedMsg && (
        <div className="rounded-lg bg-brand-success-bg text-brand-success px-4 py-2.5 text-sm font-medium">
          تم حفظ إعدادات الطباعة بنجاح.
        </div>
      )}

      <form onSubmit={handleSave} className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-brand-accent">بيانات الشركة والشروط والأحكام</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">اسم الشركة</label>
            <input
              type="text"
              disabled={!editable}
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">نص العلامة المائية</label>
            <input
              type="text"
              disabled={!editable}
              value={settings.watermark_text}
              onChange={(e) => setSettings({ ...settings, watermark_text: e.target.value })}
              className="form-input"
            />
          </div>
        </div>
        <div>
          <label className="form-label">بيانات التواصل (العنوان، الهواتف)</label>
          <input
            type="text"
            disabled={!editable}
            value={settings.contact_details}
            onChange={(e) => setSettings({ ...settings, contact_details: e.target.value })}
            className="form-input"
          />
        </div>
        <div>
          <label className="form-label">الشروط والأحكام</label>
          <textarea
            rows={4}
            disabled={!editable}
            value={settings.terms_and_conditions}
            onChange={(e) => setSettings({ ...settings, terms_and_conditions: e.target.value })}
            className="form-input"
          />
        </div>
        {editable && (
          <button type="submit" className="btn-primary text-xs">
            <Save className="w-4 h-4" />
            <span>حفظ إعدادات الطباعة</span>
          </button>
        )}
      </form>

      {/* Quick Print Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold text-brand-accent">أحدث إيصالات السياحة</h3>
          {bookings.length === 0 ? (
            <p className="text-xs text-brand-muted">لا توجد حجوزات.</p>
          ) : (
            bookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-xs py-1.5 border-b border-brand-border/50">
                <div>
                  <div className="font-semibold">{b.receipt_number}</div>
                  <div className="text-brand-muted">{b.client_name}</div>
                </div>
                <div className="flex gap-1.5">
                  <Link to={`/print/booking/${b.id}?size=a4`} target="_blank" className="btn-secondary py-1 px-2 text-[11px]">
                    <Printer className="w-3 h-3" /> A4
                  </Link>
                  <Link to={`/print/booking/${b.id}?size=a5`} target="_blank" className="btn-secondary py-1 px-2 text-[11px]">
                    A5
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold text-brand-accent">أحدث فواتير التأشيرات</h3>
          {visas.length === 0 ? (
            <p className="text-xs text-brand-muted">لا توجد ملفات تأشيرات.</p>
          ) : (
            visas.map((v) => (
              <div key={v.id} className="flex items-center justify-between text-xs py-1.5 border-b border-brand-border/50">
                <div>
                  <div className="font-semibold">{v.invoice_number}</div>
                  <div className="text-brand-muted">{v.client_name}</div>
                </div>
                <div className="flex gap-1.5">
                  <Link to={`/print/visa/${v.id}?size=a4`} target="_blank" className="btn-secondary py-1 px-2 text-[11px]">
                    <Printer className="w-3 h-3" /> A4
                  </Link>
                  <Link to={`/print/visa/${v.id}?size=a5`} target="_blank" className="btn-secondary py-1 px-2 text-[11px]">
                    A5
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card p-4 space-y-3">
          <h3 className="text-sm font-bold text-brand-accent">أحدث فواتير العقارات</h3>
          {apartments.length === 0 ? (
            <p className="text-xs text-brand-muted">لا توجد شقق.</p>
          ) : (
            apartments.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs py-1.5 border-b border-brand-border/50">
                <div>
                  <div className="font-semibold">{a.invoice_number || a.name_or_address}</div>
                  <div className="text-brand-muted">{a.buyer_name || a.status}</div>
                </div>
                <div className="flex gap-1.5">
                  <Link to={`/print/apartment/${a.id}?size=a4`} target="_blank" className="btn-secondary py-1 px-2 text-[11px]">
                    <Printer className="w-3 h-3" /> A4
                  </Link>
                  <Link to={`/print/apartment/${a.id}?size=a5`} target="_blank" className="btn-secondary py-1 px-2 text-[11px]">
                    A5
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
