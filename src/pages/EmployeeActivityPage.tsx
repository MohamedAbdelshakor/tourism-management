import React, { useEffect, useMemo, useState } from 'react';
import { listActivityLogs, listApartments, listAttendance, listBookings, listUsers, listVisaCases } from '../lib/db';
import { formatEgp, todayIsoDate } from '../lib/format';
import {
  ActivityLogRecord,
  ApartmentRecord,
  AttendanceRecord,
  BookingRecord,
  UserProfile,
  VisaCaseRecord,
} from '../types/domain';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} س ${m} د`;
}

export const EmployeeActivityPage: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [visas, setVisas] = useState<VisaCaseRecord[]>([]);
  const [apartments, setApartments] = useState<ApartmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [attFilter, setAttFilter] = useState<'today' | 'month' | 'all'>('today');
  const [empFilter, setEmpFilter] = useState<string>('all');

  useEffect(() => {
    Promise.all([listUsers(), listActivityLogs(), listAttendance(), listBookings(), listVisaCases(), listApartments()])
      .then(([u, l, att, b, v, a]) => {
        setUsers(u);
        setLogs(l);
        setAttendance(att);
        setBookings(b);
        setVisas(v);
        setApartments(a);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredAttendance = useMemo(() => {
    const today = todayIsoDate();
    return attendance.filter((r) => {
      if (empFilter !== 'all' && r.user_uid !== empFilter) return false;
      if (attFilter === 'today') return r.date === today;
      if (attFilter === 'month') return r.date?.slice(0, 7) === today.slice(0, 7);
      return true;
    });
  }, [attendance, attFilter, empFilter]);

  const summaries = useMemo(() => {
    const monthPrefix = todayIsoDate().slice(0, 7);
    return users.map((u) => {
      const uLogs = logs.filter((l) => l.user_uid === u.uid);
      const lastLogin = uLogs.find((l) => l.event === 'login')?.occurred_at ?? '—';
      const lastLogout = uLogs.find((l) => l.event === 'logout')?.occurred_at ?? '—';
      const uAttMonth = attendance.filter((a) => a.user_uid === u.uid && a.date?.startsWith(monthPrefix));
      const daysPresent = new Set(uAttMonth.map((a) => a.date)).size;
      const totalMinutes = uAttMonth.reduce((sum, a) => sum + (a.duration_minutes ?? 0), 0);

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
        daysPresent,
        totalMinutes,
        visasCount: uVisas.length,
        invoicesIssued,
        salesCount: uSales.length,
        salesValue,
      };
    });
  }, [users, logs, attendance, bookings, visas, apartments]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">نشاط الموظفين والحضور والانصراف</h1>
        <p className="text-xs text-brand-muted mt-0.5">
          سجل الحضور والانصراف وساعات العمل، أوقات الدخول والخروج، التأشيرات المنجزة، الفواتير الصادرة، ومبيعات العقارات
        </p>
      </div>

      {/* Attendance Section */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-border flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-bold text-brand-accent">سجل الحضور والانصراف</div>
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ['today', 'اليوم'],
                ['month', 'هذا الشهر'],
                ['all', 'الكل'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setAttFilter(key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  attFilter === key ? 'bg-brand-sidebar text-white' : 'bg-white border border-brand-border text-brand-ink'
                }`}
              >
                {label}
              </button>
            ))}
            <select
              value={empFilter}
              onChange={(e) => setEmpFilter(e.target.value)}
              className="form-input text-xs py-1 w-auto"
            >
              <option value="all">كل الموظفين</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-2.5 text-right">التاريخ</th>
                <th className="px-4 py-2.5 text-right">الموظف</th>
                <th className="px-4 py-2.5 text-right">وقت الحضور</th>
                <th className="px-4 py-2.5 text-right">وقت الانصراف</th>
                <th className="px-4 py-2.5 text-right">مدة العمل</th>
                <th className="px-4 py-2.5 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-brand-muted">
                    جارٍ التحميل...
                  </td>
                </tr>
              ) : filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-brand-muted">
                    لا توجد سجلات حضور مطابقة لهذا الفلتر.
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{r.date}</td>
                    <td className="px-4 py-2.5 font-medium">{r.user_name}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-brand-success">
                      {formatTime(r.check_in_at)}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {r.check_out_at ? formatTime(r.check_out_at) : '—'}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDuration(r.duration_minutes)}</td>
                    <td className="px-4 py-2.5 text-center">
                      {r.check_out_at ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-brand-muted font-medium">
                          انصرف
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-brand-success-bg text-brand-success font-medium">
                          حاضر الآن
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Performance Summary */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-brand-border text-sm font-bold text-brand-accent">
          ملخص أداء الموظفين
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[780px]">
            <thead>
              <tr className="table-head">
                <th className="px-4 py-3 text-right">الموظف</th>
                <th className="px-4 py-3 text-center">أيام الحضور (الشهر)</th>
                <th className="px-4 py-3 text-center">ساعات العمل (الشهر)</th>
                <th className="px-4 py-3 text-center">التأشيرات المنجزة</th>
                <th className="px-4 py-3 text-center">الفواتير الصادرة</th>
                <th className="px-4 py-3 text-center">مبيعات العقارات</th>
                <th className="px-4 py-3 text-right">قيمة مبيعات العقارات</th>
                <th className="px-4 py-3 text-right">آخر دخول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-brand-muted">
                    جارٍ التحميل...
                  </td>
                </tr>
              ) : (
                summaries.map((s) => (
                  <tr key={s.user.uid}>
                    <td className="px-4 py-3 font-medium">{s.user.name}</td>
                    <td className="px-4 py-3 text-center font-semibold">{s.daysPresent}</td>
                    <td className="px-4 py-3 text-center text-xs">{formatDuration(s.totalMinutes)}</td>
                    <td className="px-4 py-3 text-center font-semibold">{s.visasCount}</td>
                    <td className="px-4 py-3 text-center font-semibold text-brand-accent">{s.invoicesIssued}</td>
                    <td className="px-4 py-3 text-center font-semibold">{s.salesCount}</td>
                    <td className="px-4 py-3 font-semibold text-brand-success whitespace-nowrap">
                      {formatEgp(s.salesValue)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" dir="ltr">
                      {s.lastLogin !== '—' ? s.lastLogin.replace('T', ' ').slice(0, 19) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Login / Logout Logs */}
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
                <td className="px-4 py-2" dir="ltr">
                  {l.occurred_at.replace('T', ' ').slice(0, 19)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
