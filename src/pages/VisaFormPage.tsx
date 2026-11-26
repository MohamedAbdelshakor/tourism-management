import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getVisaCase,
  getVisaRequiredPapers,
  listSuppliers,
  listUsers,
  listVisaDestinations,
  saveVisaCase,
} from '../lib/db';
import { formatEgp, fromPiasters, todayIsoDate, toPiasters } from '../lib/format';
import { PAYMENT_METHODS, PaymentMethod, SupplierRecord, UserProfile, VisaCaseRecord, VisaDestination } from '../types/domain';

export const VisaFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [destinations, setDestinations] = useState<VisaDestination[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [existing, setExisting] = useState<VisaCaseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [caseDate, setCaseDate] = useState(todayIsoDate());
  const [clientName, setClientName] = useState('');
  const [phone, setPhone] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [destValues, setDestValues] = useState<Record<string, string | boolean>>({});
  const [visaPrice, setVisaPrice] = useState('0');
  const [paid, setPaid] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [supplierId, setSupplierId] = useState('');
  const [supplierCost, setSupplierCost] = useState('0');
  const [supplierPaid, setSupplierPaid] = useState('0');
  const [checklist, setChecklist] = useState<{ name: string; checked: boolean }[]>([]);
  const [responsibleUid, setResponsibleUid] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [dests, sups, allUsers, defaultPapers] = await Promise.all([
          listVisaDestinations(false),
          listSuppliers(),
          listUsers(),
          getVisaRequiredPapers(),
        ]);
        setDestinations(dests);
        setSuppliers(sups);
        setUsers(allUsers.filter((u) => !u.disabled));

        if (id) {
          const rec = await getVisaCase(id);
          if (rec) {
            setExisting(rec);
            setInvoiceNumber(rec.invoice_number);
            setCaseDate(rec.case_date || todayIsoDate());
            setClientName(rec.client_name);
            setPhone(rec.phone);
            setDestinationId(rec.destination_id || '');
            setDestValues(rec.destination_values || {});
            setVisaPrice(fromPiasters(rec.visa_price_piasters));
            setPaid(fromPiasters(rec.paid_piasters));
            setPaymentMethod(rec.payment_method ?? 'cash');
            setSupplierId(rec.supplier_id || '');
            setSupplierCost(fromPiasters(rec.supplier_cost_piasters));
            setSupplierPaid(fromPiasters(rec.supplier_paid_piasters));
            setChecklist(
              rec.papers_checklist?.length
                ? rec.papers_checklist
                : defaultPapers.map((name) => ({ name, checked: false })),
            );
            setResponsibleUid(rec.responsible_employee_uid || '');
            setNotes(rec.notes || '');
          }
        } else {
          setChecklist(defaultPapers.map((name) => ({ name, checked: false })));
          if (profile) setResponsibleUid(profile.uid);
        }
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [id, profile]);

  const selectedDestination = useMemo(
    () => destinations.find((d) => d.id === destinationId) ?? null,
    [destinations, destinationId],
  );

  const pricePiasters = toPiasters(visaPrice);
  const paidPiasters = toPiasters(paid);
  const remainingPiasters = Math.max(0, pricePiasters - paidPiasters);

  const supCostPiasters = toPiasters(supplierCost);
  const supPaidPiasters = toPiasters(supplierPaid);
  const supRemPiasters = Math.max(0, supCostPiasters - supPaidPiasters);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setError(null);

    if (paidPiasters > pricePiasters) {
      setError('لا يمكن أن يكون المبلغ المدفوع أكبر من سعر التأشيرة.');
      return;
    }
    if (supPaidPiasters > supCostPiasters) {
      setError('لا يمكن أن يكون المدفوع للمورد أكبر من تكلفة المورد.');
      return;
    }

    const sup = suppliers.find((s) => s.id === supplierId);
    const emp = users.find((u) => u.uid === responsibleUid);
    const fieldLabels: Record<string, string> = {};
    const fieldTypes: Record<string, string> = {};
    for (const f of selectedDestination?.fields ?? []) {
      fieldLabels[f.key] = f.label;
      fieldTypes[f.key] = f.type;
    }

    setSaving(true);
    try {
      const savedId = await saveVisaCase(
        {
          invoice_number: invoiceNumber.trim(),
          case_date: caseDate,
          client_name: clientName.trim(),
          phone: phone.trim(),
          destination_id: destinationId,
          destination_name: selectedDestination?.name ?? existing?.destination_name ?? '',
          destination_values: destValues,
          destination_field_labels: { ...(existing?.destination_field_labels ?? {}), ...fieldLabels },
          destination_field_types: { ...(existing?.destination_field_types ?? {}), ...fieldTypes },
          visa_price_piasters: pricePiasters,
          paid_piasters: paidPiasters,
          remaining_piasters: remainingPiasters,
          payment_method: paymentMethod,
          supplier_id: supplierId || null,
          supplier_name: sup?.name ?? '',
          supplier_cost_piasters: supCostPiasters,
          supplier_paid_piasters: supPaidPiasters,
          supplier_remaining_piasters: supRemPiasters,
          expenses_total_piasters: existing?.expenses_total_piasters ?? 0,
          papers_checklist: checklist,
          responsible_employee_uid: responsibleUid || profile.uid,
          responsible_employee_name: emp?.name ?? profile.name,
          notes: notes.trim(),
        },
        { uid: profile.uid, name: profile.name },
        { id, before: existing },
      );
      navigate(`/visas/${savedId}`);
    } catch {
      setError('حدث خطأ أثناء حفظ ملف التأشيرة.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card p-8 text-center text-brand-muted">جارٍ التحميل...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/visas" className="btn-secondary text-xs px-3 py-1.5">
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-brand-ink">{id ? 'تعديل ملف تأشيرة' : 'ملف تأشيرة جديد'}</h1>
            <p className="text-xs text-brand-muted">الترقيم مستقل لقسم التأشيرات (VIS-0001) عند تركه فارغاً</p>
          </div>
        </div>
        <button type="submit" disabled={saving} className="btn-primary">
          <Save className="w-4 h-4" />
          <span>{saving ? 'جارٍ الحفظ...' : 'حفظ الملف'}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">بيانات العميل والوجهة</h2>
          <div>
            <label className="form-label">رقم الفاتورة</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="تلقائي (VIS-0001)"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">التاريخ</label>
            <input type="date" required value={caseDate} onChange={(e) => setCaseDate(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">اسم العميل</label>
            <input type="text" required value={clientName} onChange={(e) => setClientName(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">رقم الهاتف</label>
            <input type="text" dir="ltr" required value={phone} onChange={(e) => setPhone(e.target.value)} className="form-input text-left" />
          </div>
          <div>
            <label className="form-label">الوجهة</label>
            <select value={destinationId} onChange={(e) => setDestinationId(e.target.value)} className="form-input">
              <option value="">— اختر الوجهة —</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">الموظف المسؤول</label>
            <select value={responsibleUid} onChange={(e) => setResponsibleUid(e.target.value)} className="form-input">
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">السعر والمورد</h2>
          <div>
            <label className="form-label">سعر التأشيرة (ج.م)</label>
            <input type="number" step="0.01" min="0" required value={visaPrice} onChange={(e) => setVisaPrice(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">المدفوع من العميل (ج.م)</label>
            <input type="number" step="0.01" min="0" required value={paid} onChange={(e) => setPaid(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">طريقة الدفع (تُسجل تلقائياً في الحسابات)</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className="form-input">
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="bg-brand-info rounded-lg p-3 text-sm flex justify-between">
            <span className="text-brand-muted">المتبقي على العميل</span>
            <span className="font-bold text-brand-accent">{formatEgp(remainingPiasters)}</span>
          </div>

          <hr className="border-brand-border" />
          <div>
            <label className="form-label">المورد (اختياري)</label>
            <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="form-input">
              <option value="">— بدون مورد —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">تكلفة المورد (ج.م)</label>
            <input type="number" step="0.01" min="0" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">المدفوع للمورد (ج.م)</label>
            <input type="number" step="0.01" min="0" value={supplierPaid} onChange={(e) => setSupplierPaid(e.target.value)} className="form-input" />
          </div>
          <div className="text-xs text-brand-muted flex justify-between">
            <span>المتبقي للمورد:</span>
            <span className="font-semibold text-brand-ink">{formatEgp(supRemPiasters)}</span>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">
            قائمة الأوراق المطلوبة (تحديد فقط)
          </h2>
          <div className="space-y-2.5">
            {checklist.map((item, idx) => (
              <label key={idx} className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={item.checked}
                  onChange={(e) => {
                    const next = [...checklist];
                    next[idx] = { ...next[idx], checked: e.target.checked };
                    setChecklist(next);
                  }}
                />
                <span className={item.checked ? 'line-through text-brand-muted' : 'text-brand-ink'}>{item.name}</span>
              </label>
            ))}
          </div>
          <div>
            <label className="form-label">ملاحظات</label>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="form-input" />
          </div>
        </div>
      </div>

      {/* Destination Variable Fields */}
      {selectedDestination && selectedDestination.fields.length > 0 && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-brand-accent border-b border-brand-border pb-2">
            حقول وجهة: {selectedDestination.name}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedDestination.fields.map((f) => (
              <div key={f.key}>
                <label className="form-label">{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    required={f.required}
                    value={String(destValues[f.key] ?? '')}
                    onChange={(e) => setDestValues({ ...destValues, [f.key]: e.target.value })}
                    className="form-input"
                  >
                    <option value="">— اختر —</option>
                    {f.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input
                      type="checkbox"
                      checked={Boolean(destValues[f.key])}
                      onChange={(e) => setDestValues({ ...destValues, [f.key]: e.target.checked })}
                    />
                    <span>نعم</span>
                  </label>
                ) : (
                  <input
                    type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                    required={f.required}
                    value={String(destValues[f.key] ?? '')}
                    onChange={(e) => setDestValues({ ...destValues, [f.key]: e.target.value })}
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
