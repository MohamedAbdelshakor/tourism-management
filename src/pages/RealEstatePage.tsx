import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Pencil, Trash2, Printer, Settings2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  addApartmentClient,
  addInspection,
  deleteApartment,
  deleteApartmentClient,
  deleteInspection,
  listApartmentClients,
  listApartments,
  listInspections,
} from '../lib/db';
import { arabicWeekday, formatEgp, todayIsoDate, toPiasters } from '../lib/format';
import { ApartmentClientRecord, ApartmentRecord, InspectionRecord } from '../types/domain';

export const RealEstatePage: React.FC = () => {
  const { profile, canEdit } = useAuth();
  const editable = canEdit('real_estate');

  const [tab, setTab] = useState<'apartments' | 'clients' | 'inspections'>('apartments');
  const [apartments, setApartments] = useState<ApartmentRecord[]>([]);
  const [clients, setClients] = useState<ApartmentClientRecord[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Client form
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cAptId, setCAptId] = useState('');
  const [cDate, setCDate] = useState(todayIsoDate());
  const [cNotes, setCNotes] = useState('');

  // Inspection form
  const [iFee, setIFee] = useState('0');
  const [iDate, setIDate] = useState(todayIsoDate());
  const [iPlace, setIPlace] = useState('');
  const [iAptId, setIAptId] = useState('');
  const [iAgent, setIAgent] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [apts, cls, ins] = await Promise.all([listApartments(), listApartmentClients(), listInspections()]);
      setApartments(apts);
      setClients(cls);
      setInspections(ins);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeleteApt = async (apt: ApartmentRecord) => {
    if (!profile) return;
    if (!window.confirm(`حذف الشقة "${apt.name_or_address}"؟`)) return;
    await deleteApartment(apt, { uid: profile.uid, name: profile.name });
    await load();
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !cName.trim()) return;
    const apt = apartments.find((a) => a.id === cAptId);
    await addApartmentClient(
      {
        client_name: cName.trim(),
        phone: cPhone.trim(),
        apartment_id: cAptId || null,
        apartment_name: apt?.name_or_address ?? '',
        follow_up_date: cDate,
        notes: cNotes.trim(),
        responsible_employee_uid: profile.uid,
        responsible_employee_name: profile.name,
      },
      { uid: profile.uid, name: profile.name },
    );
    setCName('');
    setCPhone('');
    setCAptId('');
    setCNotes('');
    await load();
  };

  const handleAddInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !iAptId) return;
    const apt = apartments.find((a) => a.id === iAptId);
    await addInspection(
      {
        fee_piasters: toPiasters(iFee),
        inspection_date: iDate,
        inspection_day: arabicWeekday(iDate),
        place: iPlace.trim(),
        apartment_id: iAptId,
        apartment_name: apt?.name_or_address ?? '',
        agent_name: iAgent.trim() || profile.name,
      },
      { uid: profile.uid, name: profile.name },
    );
    setIFee('0');
    setIPlace('');
    setIAptId('');
    setIAgent('');
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">العقارات</h1>
          <p className="text-xs text-brand-muted mt-0.5">إدارة الشقق، حالات الوحدات، متابعة العملاء، والمعاينات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <>
              <Link to="/real-estate/statuses" className="btn-secondary text-xs">
                <Settings2 className="w-4 h-4" />
                <span>إدارة الحالات</span>
              </Link>
              <Link to="/real-estate/apartments/create" className="btn-primary text-xs">
                <Plus className="w-4 h-4" />
                <span>إضافة شقة</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-brand-border pb-2 -mx-1 px-1">
        {[
          { id: 'apartments', label: `الشقق (${apartments.length})` },
          { id: 'clients', label: `متابعة العملاء (${clients.length})` },
          { id: 'inspections', label: `المعاينات (${inspections.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as typeof tab)}
            className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-brand-primary text-white' : 'bg-white border border-brand-border text-brand-ink hover:bg-brand-info'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'apartments' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="px-4 py-3 text-right">الشقة / العنوان</th>
                  <th className="px-4 py-3 text-right">السعر</th>
                  <th className="px-4 py-3 text-right">نسبة الربح</th>
                  <th className="px-4 py-3 text-right">الحالة</th>
                  <th className="px-4 py-3 text-right">المشتري</th>
                  <th className="px-4 py-3 text-right">رقم الفاتورة</th>
                  <th className="px-4 py-3 text-right">المدفوع / المتبقي</th>
                  <th className="px-4 py-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-brand-muted">جارٍ التحميل...</td>
                  </tr>
                ) : apartments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-brand-muted">لا توجد شقق مسجلة حالياً.</td>
                  </tr>
                ) : (
                  apartments.map((a) => (
                    <tr key={a.id} className="hover:bg-brand-page/60">
                      <td className="px-4 py-3 font-medium">{a.name_or_address}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatEgp(a.price_piasters)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{a.profit_percentage ? `${a.profit_percentage}%` : '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs bg-brand-info text-brand-accent font-medium">
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">{a.buyer_name || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-brand-accent">{a.invoice_number || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs">
                        <div className="text-brand-success">{formatEgp(a.paid_piasters)}</div>
                        <div className="text-brand-muted">متبقي: {formatEgp(a.remaining_piasters)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link to={`/real-estate/apartments/${a.id}`} className="p-1.5 rounded hover:bg-brand-info text-brand-accent">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link to={`/print/apartment/${a.id}?size=a4`} target="_blank" className="p-1.5 rounded hover:bg-brand-info text-brand-ink">
                            <Printer className="w-4 h-4" />
                          </Link>
                          {editable && (
                            <>
                              <Link to={`/real-estate/apartments/${a.id}/edit`} className="p-1.5 rounded hover:bg-brand-info text-brand-primary">
                                <Pencil className="w-4 h-4" />
                              </Link>
                              <button type="button" onClick={() => handleDeleteApt(a)} className="p-1.5 rounded hover:bg-red-50 text-red-600">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'clients' && (
        <div className="space-y-4">
          {editable && (
            <form onSubmit={handleAddClient} className="card p-5 grid grid-cols-1 md:grid-cols-6 gap-3">
              <input type="text" required value={cName} onChange={(e) => setCName(e.target.value)} placeholder="اسم العميل" className="form-input" />
              <input type="text" dir="ltr" required value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="الهاتف" className="form-input text-left" />
              <select value={cAptId} onChange={(e) => setCAptId(e.target.value)} className="form-input">
                <option value="">— الشقة المهتم بها —</option>
                {apartments.map((a) => (
                  <option key={a.id} value={a.id}>{a.name_or_address}</option>
                ))}
              </select>
              <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="form-input" />
              <input type="text" value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="ملاحظات المتابعة" className="form-input" />
              <button type="submit" className="btn-primary text-xs">إضافة عميل</button>
            </form>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="table-head">
                  <th className="px-4 py-3 text-right">العميل</th>
                  <th className="px-4 py-3 text-right">الهاتف</th>
                  <th className="px-4 py-3 text-right">الشقة</th>
                  <th className="px-4 py-3 text-right">تاريخ المتابعة</th>
                  <th className="px-4 py-3 text-right">ملاحظات</th>
                  {editable && <th className="px-4 py-3 text-center">حذف</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {clients.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium">{c.client_name}</td>
                    <td className="px-4 py-3" dir="ltr">{c.phone}</td>
                    <td className="px-4 py-3">{c.apartment_name || '—'}</td>
                    <td className="px-4 py-3">{c.follow_up_date}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{c.notes || '—'}</td>
                    {editable && (
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!profile) return;
                            await deleteApartmentClient(c, { uid: profile.uid, name: profile.name });
                            await load();
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'inspections' && (
        <div className="space-y-4">
          {editable && (
            <form onSubmit={handleAddInspection} className="card p-5 grid grid-cols-1 md:grid-cols-6 gap-3">
              <select required value={iAptId} onChange={(e) => setIAptId(e.target.value)} className="form-input">
                <option value="">— اختر الشقة —</option>
                {apartments.map((a) => (
                  <option key={a.id} value={a.id}>{a.name_or_address}</option>
                ))}
              </select>
              <input type="number" step="0.01" min="0" value={iFee} onChange={(e) => setIFee(e.target.value)} placeholder="رسوم المعاينة (ج.م)" className="form-input" />
              <input type="date" required value={iDate} onChange={(e) => setIDate(e.target.value)} className="form-input" />
              <input type="text" required value={iPlace} onChange={(e) => setIPlace(e.target.value)} placeholder="المكان" className="form-input" />
              <input type="text" value={iAgent} onChange={(e) => setIAgent(e.target.value)} placeholder="الوسيط / المندوب" className="form-input" />
              <button type="submit" className="btn-primary text-xs">تسجيل معاينة</button>
            </form>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="table-head">
                  <th className="px-4 py-3 text-right">الشقة</th>
                  <th className="px-4 py-3 text-right">التاريخ واليوم</th>
                  <th className="px-4 py-3 text-right">المكان</th>
                  <th className="px-4 py-3 text-right">الرسوم</th>
                  <th className="px-4 py-3 text-right">الوسيط / المندوب</th>
                  {editable && <th className="px-4 py-3 text-center">حذف</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {inspections.map((ins) => (
                  <tr key={ins.id}>
                    <td className="px-4 py-3 font-medium">{ins.apartment_name}</td>
                    <td className="px-4 py-3">{ins.inspection_date} ({ins.inspection_day})</td>
                    <td className="px-4 py-3">{ins.place}</td>
                    <td className="px-4 py-3">{formatEgp(ins.fee_piasters)}</td>
                    <td className="px-4 py-3">{ins.agent_name}</td>
                    {editable && (
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!profile) return;
                            await deleteInspection(ins, { uid: profile.uid, name: profile.name });
                            await load();
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
