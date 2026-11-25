import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { addExpense, deleteExpense, deleteVisaCase, getVisaCase, listExpenses, saveVisaCase } from '../lib/db';
import { formatEgp, todayIsoDate, toPiasters } from '../lib/format';
import { ExpenseRecord, VisaCaseRecord } from '../types/domain';

export const VisaDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, canEdit } = useAuth();
  const editable = canEdit('visas');

  const [vc, setVc] = useState<VisaCaseRecord | null>(null);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(todayIsoDate());

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [rec, allExp] = await Promise.all([getVisaCase(id), listExpenses()]);
      setVc(rec);
      setExpenses(allExp.filter((e) => e.category === 'visa' && e.entity_id === id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !vc || !expDesc.trim()) return;
    const amt = toPiasters(expAmount);
    if (amt <= 0) return;

    await addExpense(
      {
        category: 'visa',
        entity_type: 'visa_case',
        entity_id: vc.id,
        description: expDesc.trim(),
        amount_piasters: amt,
        expense_date: expDate,
      },
      { uid: profile.uid, name: profile.name },
    );

    const nextTotal = (vc.expenses_total_piasters ?? 0) + amt;
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = vc;
    await saveVisaCase({ ...rest, expenses_total_piasters: nextTotal }, { uid: profile.uid, name: profile.name }, { id: vc.id, before: vc });
    setExpDesc('');
    setExpAmount('');
    await load();
  };

  const handleDeleteExpense = async (exp: ExpenseRecord) => {
    if (!profile || !vc) return;
    await deleteExpense(exp, { uid: profile.uid, name: profile.name });
    const nextTotal = Math.max(0, (vc.expenses_total_piasters ?? 0) - exp.amount_piasters);
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = vc;
    await saveVisaCase({ ...rest, expenses_total_piasters: nextTotal }, { uid: profile.uid, name: profile.name }, { id: vc.id, before: vc });
    await load();
  };

  const handleDelete = async () => {
    if (!profile || !vc) return;
    if (!window.confirm(`حذف ملف التأشيرة ${vc.invoice_number}؟`)) return;
    await deleteVisaCase(vc, { uid: profile.uid, name: profile.name });
    navigate('/visas');
  };

  if (loading) return <div className="card p-8 text-center text-brand-muted">جارٍ التحميل...</div>;
  if (!vc) return <div className="card p-8 text-center text-brand-muted">ملف التأشيرة غير موجود.</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/visas" className="btn-secondary text-xs px-3 py-1.5">
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-brand-ink">
              ملف تأشيرة {vc.invoice_number} — {vc.client_name}
            </h1>
            <p className="text-xs text-brand-muted">
              الوجهة: {vc.destination_name || '—'} | التاريخ: {vc.case_date}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/print/visa/${vc.id}?size=a4`} target="_blank" className="btn-secondary text-xs">
            <Printer className="w-4 h-4" />
            <span>طباعة A4</span>
          </Link>
          <Link to={`/print/visa/${vc.id}?size=a5`} target="_blank" className="btn-secondary text-xs">
            <Printer className="w-4 h-4" />
            <span>طباعة A5</span>
          </Link>
          {editable && (
            <>
              <Link to={`/visas/${vc.id}/edit`} className="btn-primary text-xs">
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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-xs text-brand-muted">سعر التأشيرة</div>
          <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(vc.visa_price_piasters)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">المدفوع</div>
          <div className="text-lg font-bold text-brand-success mt-1">{formatEgp(vc.paid_piasters)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">المتبقي</div>
          <div className="text-lg font-bold text-brand-accent mt-1">{formatEgp(vc.remaining_piasters)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">مصروفات الملف</div>
          <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(vc.expenses_total_piasters)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card p-5 space-y-3 text-sm">
          <h2 className="font-bold text-brand-accent border-b border-brand-border pb-2">تفاصيل الملف والمورد</h2>
          <div className="flex justify-between py-1 border-b border-brand-border/50">
            <span className="text-brand-muted text-xs">الهاتف</span>
            <span dir="ltr">{vc.phone}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-brand-border/50">
            <span className="text-brand-muted text-xs">المورد</span>
            <span>{vc.supplier_name || '—'}</span>
          </div>
          <div className="flex justify-between py-1 border-b border-brand-border/50">
            <span className="text-brand-muted text-xs">تكلفة / مدفوع / متبقي للمورد</span>
            <span>
              {formatEgp(vc.supplier_cost_piasters)} / {formatEgp(vc.supplier_paid_piasters)} / {formatEgp(vc.supplier_remaining_piasters)}
            </span>
          </div>
          <div className="flex justify-between py-1 border-b border-brand-border/50">
            <span className="text-brand-muted text-xs">الموظف المسؤول</span>
            <span>{vc.responsible_employee_name || '—'}</span>
          </div>
          {Object.entries(vc.destination_values || {}).map(([k, v]) => (
            <div key={k} className="flex justify-between py-1 border-b border-brand-border/50">
              <span className="text-brand-muted text-xs">{vc.destination_field_labels?.[k] ?? k}</span>
              <span>{typeof v === 'boolean' ? (v ? 'نعم' : 'لا') : String(v || '—')}</span>
            </div>
          ))}
          {vc.notes && <div className="note-box text-xs">{vc.notes}</div>}
        </div>

        <div className="card p-5 space-y-3 text-sm">
          <h2 className="font-bold text-brand-accent border-b border-brand-border pb-2">قائمة الأوراق المطلوبة</h2>
          <ul className="space-y-2">
            {(vc.papers_checklist || []).map((p, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                    p.checked ? 'bg-brand-success' : 'bg-slate-300'
                  }`}
                />
                <span className={p.checked ? 'text-brand-success font-medium' : 'text-brand-muted'}>{p.name}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Visa Case Expenses */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-brand-accent">مصروفات التأشيرة</h2>
        {editable && (
          <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              placeholder="بيان المصروف (مثل: رسوم سفارة)"
              className="form-input"
            />
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="المبلغ (ج.م)"
              className="form-input"
            />
            <input type="date" required value={expDate} onChange={(e) => setExpDate(e.target.value)} className="form-input" />
            <button type="submit" className="btn-primary text-xs">
              <Plus className="w-4 h-4" />
              <span>إضافة مصروف</span>
            </button>
          </form>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="table-head">
              <th className="px-4 py-2.5 text-right">التاريخ</th>
              <th className="px-4 py-2.5 text-right">البيان</th>
              <th className="px-4 py-2.5 text-right">المبلغ</th>
              {editable && <th className="px-4 py-2.5 text-center">حذف</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={editable ? 4 : 3} className="px-4 py-6 text-center text-brand-muted">
                  لا توجد مصروفات مسجلة لهذا الملف.
                </td>
              </tr>
            ) : (
              expenses.map((exp) => (
                <tr key={exp.id}>
                  <td className="px-4 py-2.5">{exp.expense_date}</td>
                  <td className="px-4 py-2.5">{exp.description}</td>
                  <td className="px-4 py-2.5 font-medium">{formatEgp(exp.amount_piasters)}</td>
                  {editable && (
                    <td className="px-4 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(exp)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
