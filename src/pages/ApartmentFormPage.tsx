import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getApartment, getApartmentStatuses, listUsers, saveApartment } from '../lib/db';
import { formatEgp, fromPiasters, toPiasters } from '../lib/format';
import { ApartmentRecord, UserProfile } from '../types/domain';

export const ApartmentFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [statuses, setStatuses] = useState<string[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [existing, setExisting] = useState<ApartmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nameOrAddress, setNameOrAddress] = useState('');
  const [price, setPrice] = useState('0');
  const [profitPercentage, setProfitPercentage] = useState('');
  const [status, setStatus] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [paid, setPaid] = useState('0');
  const [saleDate, setSaleDate] = useState('');
  const [responsibleUid, setResponsibleUid] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [stList, allUsers] = await Promise.all([getApartmentStatuses(), listUsers()]);
        setStatuses(stList);
        setUsers(allUsers.filter((u) => !u.disabled));

        if (id) {
          const rec = await getApartment(id);
          if (rec) {
            setExisting(rec);
            setNameOrAddress(rec.name_or_address);
            setPrice(fromPiasters(rec.price_piasters));
            setProfitPercentage(rec.profit_percentage || '');
            setStatus(rec.status || stList[0] || '');
            setInvoiceNumber(rec.invoice_number || '');
            setBuyerName(rec.buyer_name || '');
            setBuyerPhone(rec.buyer_phone || '');
            setPaid(fromPiasters(rec.paid_piasters));
            setSaleDate(rec.sale_date || '');
            setResponsibleUid(rec.responsible_employee_uid || '');
            setNotes(rec.notes || '');
          }
        } else {
          setStatus(stList[0] || 'متاح');
          if (profile) setResponsibleUid(profile.uid);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, profile]);

  const pricePiasters = toPiasters(price);
  const paidPiasters = toPiasters(paid);
  const remainingPiasters = Math.max(0, pricePiasters - paidPiasters);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);

    if (paidPiasters > pricePiasters) {
      setError('لا يمكن أن يكون المبلغ المدفوع أكبر من سعر الشقة.');
      return;
    }

    const emp = users.find((u) => u.uid === responsibleUid);
    setSaving(true);
    try {
      const savedId = await saveApartment(
        {
          name_or_address: nameOrAddress.trim(),
          price_piasters: pricePiasters,
          profit_percentage: profitPercentage.trim(),
          status,
          invoice_number: invoiceNumber.trim(),
          buyer_name: buyerName.trim(),
          buyer_phone: buyerPhone.trim(),
          paid_piasters: paidPiasters,
          remaining_piasters: remainingPiasters,
          sale_date: saleDate,
          responsible_employee_uid: responsibleUid || profile.uid,
          responsible_employee_name: emp?.name ?? profile.name,
          notes: notes.trim(),
        },
        { uid: profile.uid, name: profile.name },
        { id, before: existing },
      );
      navigate(`/real-estate/apartments/${savedId}`);
    } catch {
      setError('حدث خطأ أثناء حفظ الشقة.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="card p-8 text-center text-brand-muted">جارٍ التحميل...</div>;

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/real-estate" className="btn-secondary text-xs px-3 py-1.5">
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </Link>
          <h1 className="text-xl font-bold text-brand-ink">{id ? 'تعديل بيانات شقة' : 'إضافة شقة جديدة'}</h1>
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          <span>{saving ? 'جارٍ الحفظ...' : 'حفظ'}</span>
        </button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">بيانات الوحدة</h2>
          <div>
            <label className="form-label">اسم الشقة / العنوان</label>
            <input type="text" required value={nameOrAddress} onChange={(e) => setNameOrAddress(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">السعر (ج.م)</label>
            <input type="number" step="0.01" min="0" required value={price} onChange={(e) => setPrice(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">نسبة الربح % (تُسجل كما هي بدون حساب تلقائي)</label>
            <input
              type="text"
              value={profitPercentage}
              onChange={(e) => setProfitPercentage(e.target.value)}
              placeholder="مثال: 2.5"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">الحالة</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-input">
              {statuses.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">الموظف المسؤول</label>
            <select value={responsibleUid} onChange={(e) => setResponsibleUid(e.target.value)} className="form-input">
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">بيانات البيع والتحصيل (اختياري)</h2>
          <div>
            <label className="form-label">رقم الفاتورة (تلقائي RE-0001 عند وجود مشتري)</label>
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">اسم المشتري</label>
            <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">هاتف المشتري</label>
            <input type="text" dir="ltr" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)} className="form-input text-left" />
          </div>
          <div>
            <label className="form-label">المدفوع (ج.م)</label>
            <input type="number" step="0.01" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} className="form-input" />
          </div>
          <div className="bg-brand-info rounded-lg p-3 text-sm flex justify-between">
            <span className="text-brand-muted">المتبقي</span>
            <span className="font-bold text-brand-accent">{formatEgp(remainingPiasters)}</span>
          </div>
          <div>
            <label className="form-label">تاريخ البيع</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">ملاحظات</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input" />
          </div>
        </div>
      </div>
    </form>
  );
};
