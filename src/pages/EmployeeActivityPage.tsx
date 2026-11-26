import React, { useEffect, useMemo, useState } from 'react';
import { listActivityLogs, listApartments, listBookings, listUsers, listVisaCases } from '../lib/db';
import { formatEgp } from '../lib/format';
import {
  ActivityLogRecord,
  ApartmentRecord,
  BookingRecord,
  UserProfile,
  VisaCaseRecord,
} from '../types/domain';

export const EmployeeActivityPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [visas, setVisas] = useState<VisaCaseRecord[]>([]);
  const [apartments, setApartments] = useState<ApartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([listUsers(), listActivityLogs(), listBookings(), listVisaCases(), listApartments()])
      .then(([u, l, b, v, a]) => {
        setUsers(u);
        setLogs(l);
        setBookings(b);
        setVisas(v);
        setApartments(a);
      })
      .finally(() => setLoading(false));
  }, []);

  const summaries = useMemo(() => {
    return users.map((u) => {
      const uLogs = logs.filter((l) => l.user_uid === u.uid);
      const lastLogin = uLogs.find((l) => l.event === 'login')?.occurred_at ?? '—';
      const lastLogout = uLogs.find((l) => l.event === 'logout')?.occurred_at ?? '—';
      const uBookings = bookings.filter((b) => b.responsible_employee_uid === u.uid);
      const uVisas = visas.filter((v) => v.responsible_employee_uid === u.uid);
      const uSales = apartments.filter(
        (a) => a.responsible_employee_uid === u.uid && (a.buyer_name.trim() !== '' || a.status === 'مباع'),
      );
      const invoicesIssued = uBookings.length + uVisas.length + uSales.filter((s) => s.invoice_number).length;
      const salesValue = uSales.reduce((s, a) => s + (a.price_piasters ?? 0), 0);

      return {
        user: u,
        lastLogin,
        lastLogout,
        visasCount: uVisas.length,
        invoicesIssued,
        salesCount: uSales.length,
        salesValue,
      };
    });
  }, [users, logs, bookings, visas, apartments]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">نشاط الموظفين</h1>
        <p className="text-xs text-brand-muted mt-0.5">
          أوقات الدخول والخروج، التأشيرات المنجزة، الفواتير الصادرة، وعدد وقيمة مبيعات العقارات لكل موظف
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3 text-right">الموظف</th>
                <th className="px-4 py-3 text-right">آخر دخول</th>
                <th className="px-4 py-3 text-right">آخر خروج</th>
                <th className="px-4 py-3 text-center">التأشيرات المنجزة</th>
                <th className="px-4 py-3 text-center">الفواتير الصادرة</th>
                <th className="px-4 py-3 text-center">مبيعات العقارات (عدد)</th>
                <th className="px-4 py-3 text-right">قيمة مبيعات العقارات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-brand-muted">جارٍ التحميل...</td>
                </tr>
              ) : (
                summaries.map((s) => (
                  <tr key={s.user.uid}>
                    <td className="px-4 py-3 font-medium">{s.user.name}</td>
                    <td className="px-4 py-3 text-xs" dir="ltr">
                      {s.lastLogin !== '—' ? s.lastLogin.replace('T', ' ').slice(0, 19) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" dir="ltr">
                      {s.lastLogout !== '—' ? s.lastLogout.replace('T', ' ').slice(0, 19) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{s.visasCount}</td>
                    <td className="px-4 py-3 text-center font-semibold text-brand-accent">{s.invoicesIssued}</td>
                    <td className="px-4 py-3 text-center font-semibold">{s.salesCount}</td>
                    <td className="px-4 py-3 font-semibold text-brand-success">{formatEgp(s.salesValue)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-brand-border text-sm font-bold text-brand-accent">
          سجل الدخول والخروج الأخير
        </div>
        <table className="w-full text-xs min-w-[440px]">
          <thead>
            <tr className="table-head">
              <th className="px-4 py-2.5 text-right">الموظف</th>
              <th className="px-4 py-2.5 text-right">الحدث</th>
              <th className="px-4 py-2.5 text-right">الوقت</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {logs.slice(0, 50).map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-2">{l.user_name}</td>
                <td className="px-4 py-2">{l.event === 'login' ? 'تسجيل دخول' : 'تسجيل خروج'}</td>
                <td className="px-4 py-2" dir="ltr">{l.occurred_at.replace('T', ' ').slice(0, 19)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
