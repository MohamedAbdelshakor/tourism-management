import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Settings2, Eye, Pencil, Trash2, Printer } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { deleteBooking, listBookings } from '../lib/db';
import { formatEgp } from '../lib/format';
import { BookingRecord, DEPARTMENT_LABELS } from '../types/domain';

interface Props {
  department: 'domestic_tourism' | 'outbound_tourism';
}

export const BookingsListPage: React.FC<Props> = ({ department }) => {
  const { profile, canEdit, isAdmin } = useAuth();
  const [rows, setRows] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const basePath = department === 'domestic_tourism' ? '/domestic-bookings' : '/outbound-bookings';
  const editable = canEdit(department);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listBookings(department);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [department]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        r.receipt_number.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.hotel_name.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        total: acc.total + (r.total_piasters ?? 0),
        paid: acc.paid + (r.paid_piasters ?? 0),
        remaining: acc.remaining + (r.remaining_piasters ?? 0),
      }),
      { total: 0, paid: 0, remaining: 0 },
    );
  }, [filtered]);

  const handleDelete = async (row: BookingRecord) => {
    if (!profile) return;
    if (!window.confirm(`هل أنت متأكد من حذف الحجز رقم ${row.receipt_number} للعميل ${row.client_name}؟`)) {
      return;
    }
    await deleteBooking(row, { uid: profile.uid, name: profile.name });
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-ink">{DEPARTMENT_LABELS[department]}</h1>
          <p className="text-xs text-brand-muted mt-0.5">إدارة الحجوزات والإيصالات المستقلة للقسم</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Link to={`${basePath}/fields`} className="btn-secondary text-xs">
              <Settings2 className="w-4 h-4" />
              <span>إدارة الحقول</span>
            </Link>
          )}
          {editable && (
            <Link to={`${basePath}/create`} className="btn-primary text-xs">
              <Plus className="w-4 h-4" />
              <span>حجز جديد</span>
            </Link>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <div className="text-xs text-brand-muted">إجمالي الحجوزات المعروضة</div>
          <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(totals.total)}</div>
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

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-brand-muted absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم العميل، رقم الإيصال، الهاتف، الفندق، المدينة..."
            className="form-input pr-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3 text-right">رقم الإيصال</th>
                <th className="px-4 py-3 text-right">التاريخ</th>
                <th className="px-4 py-3 text-right">العميل</th>
                <th className="px-4 py-3 text-right">الهاتف</th>
                <th className="px-4 py-3 text-right">الفندق / المدينة</th>
                <th className="px-4 py-3 text-right">الإجمالي</th>
                <th className="px-4 py-3 text-right">المدفوع</th>
                <th className="px-4 py-3 text-right">المتبقي</th>
                <th className="px-4 py-3 text-right">الموظف</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-brand-muted">
                    جارٍ تحميل الحجوزات...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-brand-muted">
                    لا توجد حجوزات مطابقة حالياً.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-page/60">
                    <td className="px-4 py-3 font-semibold text-brand-accent whitespace-nowrap">
                      {row.receipt_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div>{row.booking_date}</div>
                      <div className="text-xs text-brand-muted">{row.booking_day}</div>
                    </td>
                    <td className="px-4 py-3 font-medium">{row.client_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap" dir="ltr">
                      {row.phone}
                    </td>
                    <td className="px-4 py-3">
                      <div>{row.hotel_name || '—'}</div>
                      <div className="text-xs text-brand-muted">{row.city || ''}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{formatEgp(row.total_piasters)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-brand-success font-medium">
                      {formatEgp(row.paid_piasters)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">
                      {formatEgp(row.remaining_piasters)}
                    </td>
                    <td className="px-4 py-3 text-xs text-brand-muted">{row.responsible_employee_name || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Link
                          to={`${basePath}/${row.id}`}
                          className="p-1.5 rounded hover:bg-brand-info text-brand-accent"
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          to={`/print/booking/${row.id}?size=a4`}
                          target="_blank"
                          className="p-1.5 rounded hover:bg-brand-info text-brand-ink"
                          title="طباعة الإيصال"
                        >
                          <Printer className="w-4 h-4" />
                        </Link>
                        {editable && (
                          <>
                            <Link
                              to={`${basePath}/${row.id}/edit`}
                              className="p-1.5 rounded hover:bg-brand-info text-brand-primary"
                              title="تعديل"
                            >
                              <Pencil className="w-4 h-4" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
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
