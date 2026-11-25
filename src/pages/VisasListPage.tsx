import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Eye, Pencil, Trash2, Printer, Globe2, ListChecks } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { deleteVisaCase, listVisaCases } from '../lib/db';
import { formatEgp } from '../lib/format';
import { VisaCaseRecord } from '../types/domain';

export const VisasListPage: React.FC = () => {
  const { profile, canEdit, isAdmin } = useAuth();
  const [cases, setCases] = useState<VisaCaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const editable = canEdit('visas');

  const load = async () => {
    setLoading(true);
    try {
      setCases(await listVisaCases());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.client_name.toLowerCase().includes(q) ||
        c.invoice_number.toLowerCase().includes(q) ||
        c.destination_name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q),
    );
  }, [cases, search]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, c) => ({
          price: acc.price + (c.visa_price_piasters ?? 0),
          paid: acc.paid + (c.paid_piasters ?? 0),
          remaining: acc.remaining + (c.remaining_piasters ?? 0),
        }),
        { price: 0, paid: 0, remaining: 0 },
      ),
    [filtered],
  );

  const handleDelete = async (row: VisaCaseRecord) => {
    if (!profile) return;
    if (!window.confirm(`حذف ملف التأشيرة رقم ${row.invoice_number} للعميل ${row.client_name}؟`)) return;
    await deleteVisaCase(row, { uid: profile.uid, name: profile.name });
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">التأشيرات واستقدام العمالة</h1>
          <p className="text-xs text-brand-muted mt-0.5">ملفات التأشيرات، الوجهات بحقولها المتغيرة، قائمة الأوراق، الموردين والمصروفات</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Link to="/visas/destinations" className="btn-secondary text-xs">
              <Globe2 className="w-4 h-4" />
              <span>إدارة الوجهات</span>
            </Link>
          )}
          {editable && (
            <>
              <Link to="/visas/papers" className="btn-secondary text-xs">
                <ListChecks className="w-4 h-4" />
                <span>قائمة الأوراق المطلوبة</span>
              </Link>
              <Link to="/visas/create" className="btn-primary text-xs">
                <Plus className="w-4 h-4" />
                <span>ملف تأشيرة جديد</span>
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-brand-muted">إجمالي أسعار التأشيرات</div>
          <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(totals.price)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">إجمالي المدفوع</div>
          <div className="text-lg font-bold text-brand-success mt-1">{formatEgp(totals.paid)}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-brand-muted">إجمالي المتبقي</div>
          <div className="text-lg font-bold text-brand-accent mt-1">{formatEgp(totals.remaining)}</div>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-brand-muted absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم العميل، رقم الفاتورة، الوجهة، الهاتف..."
            className="form-input pr-9"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3 text-right">رقم الفاتورة</th>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">العميل</th>
                <th className="px-4 py-3 text-right">الوجهة</th>
                <th className="px-4 py-3 text-right">السعر</th>
                <th className="px-4 py-3 text-right">المدفوع</th>
                <th className="px-4 py-3 text-right">المتبقي</th>
                <th className="px-4 py-3 text-right">المورد</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-brand-muted">
                    جارٍ تحميل ملفات التأشيرات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-brand-muted">
                    لا توجد ملفات تأشيرات حالياً.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-brand-page/60">
                    <td className="px-4 py-3 font-semibold text-brand-accent whitespace-nowrap">{c.invoice_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.case_date}</td>
                    <td className="px-4 py-3 font-medium">
                      <div>{c.client_name}</div>
                      <div className="text-xs text-brand-muted" dir="ltr">
                        {c.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3">{c.destination_name || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{formatEgp(c.visa_price_piasters)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-brand-success font-medium">
                      {formatEgp(c.paid_piasters)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{formatEgp(c.remaining_piasters)}</td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{c.supplier_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link to={`/visas/${c.id}`} className="p-1.5 rounded hover:bg-brand-info text-brand-accent" title="عرض">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/print/visa/${c.id}?size=a4`}
                          target="_blank"
                          className="p-1.5 rounded hover:bg-brand-info text-brand-ink"
                          title="طباعة"
                        >
                          <Printer className="w-4 h-4" />
                        </Link>
                        {editable && (
                          <>
                            <Link to={`/visas/${c.id}/edit`} className="p-1.5 rounded hover:bg-brand-info text-brand-primary" title="تعديل">
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(c)}
                              className="p-1.5 rounded hover:bg-red-50 text-red-600"
                              title="حذف"
                            >
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
    </div>
  );
};
