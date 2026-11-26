import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  MapPin,
  Globe,
  FileCheck2,
  Building2,
  Wallet,
  Users,
  Activity,
  Printer,
  LogOut,
  Menu,
  X,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { checkInEmployee, checkOutEmployee, getTodayAttendanceForUser } from '../lib/db';
import { todayIsoDate } from '../lib/format';
import { AttendanceRecord, DEPARTMENTS, DepartmentKey } from '../types/domain';

const DEPT_ICONS: Record<DepartmentKey, React.FC<{ className?: string }>> = {
  domestic_tourism: MapPin,
  outbound_tourism: Globe,
  visas: FileCheck2,
  real_estate: Building2,
  accounting: Wallet,
  users_permissions: Users,
  employee_activity: Activity,
  printing: Printer,
};

export const Layout: React.FC = () => {
  const { profile, canView, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [todayAtt, setTodayAtt] = useState<AttendanceRecord | null>(null);
  const [attBusy, setAttBusy] = useState(false);

  const visibleDepartments = DEPARTMENTS.filter((d) => canView(d.key));

  useEffect(() => {
    if (!profile) return;
    getTodayAttendanceForUser(profile.uid, todayIsoDate())
      .then(setTodayAtt)
      .catch(() => {});
  }, [profile]);

  const handleCheckIn = async () => {
    if (!profile || attBusy) return;
    setAttBusy(true);
    try {
      const rec = await checkInEmployee({ uid: profile.uid, name: profile.name }, todayIsoDate());
      setTodayAtt(rec);
    } finally {
      setAttBusy(false);
    }
  };

  const handleCheckOut = async () => {
    if (!todayAtt || attBusy) return;
    if (!window.confirm('هل تريد تسجيل الانصراف (نهاية العمل) الآن؟')) return;
    setAttBusy(true);
    try {
      const updated = await checkOutEmployee(todayAtt);
      setTodayAtt(updated);
    } finally {
      setAttBusy(false);
    }
  };

  const formatTimeShort = (iso: string | null) => {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-brand-page text-brand-ink overflow-x-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-40 w-72 sm:w-64 bg-brand-sidebar text-white flex flex-col transition-transform duration-200 no-print ${
          mobileOpen ? 'translate-x-0 shadow-2xl' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="px-4 py-4 border-b border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-white rounded-xl p-1.5 shadow-sm shrink-0">
              <img
                src="/logos/red-star-logo.jpg"
                alt="Red Star Travel"
                className="h-11 w-11 object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold tracking-tight truncate">Red Star Travel</h1>
              <div className="text-[11px] font-medium text-brand-sidebar-label truncate mt-0.5">
                نظام إدارة السياحة
              </div>
            </div>
          </div>
          <button
            type="button"
            className="lg:hidden text-white/80 hover:text-white shrink-0"
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-xs font-semibold text-brand-sidebar-label">الأقسام</div>
          {visibleDepartments.map((dept) => {
            const Icon = DEPT_ICONS[dept.key];
            return (
              <NavLink
                key={dept.key}
                to={dept.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-sidebar-active text-white'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{dept.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div>
            <div className="text-sm font-semibold truncate">{profile?.name}</div>
            <div className="text-xs text-brand-sidebar-label truncate">{profile?.email}</div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>

          <div
            dir="ltr"
            className="pt-3 border-t border-white/10 flex items-center gap-2.5 opacity-90"
          >
            <img
              src="/logos/triple-mind-logo.jpg"
              alt="Triple Mind Tech Solutions"
              className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/15 shrink-0"
            />
            <div className="min-w-0 leading-tight">
              <div className="text-[9px] uppercase tracking-wider text-brand-sidebar-label">Powered by</div>
              <div className="text-[11px] font-semibold text-white truncate">Triple Mind Tech Solutions</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-brand-border px-3 sm:px-4 lg:px-6 h-14 flex items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg border border-brand-border text-brand-ink hover:bg-brand-info shrink-0"
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <img
              src="/logos/red-star-logo.jpg"
              alt="Red Star Travel"
              className="lg:hidden h-8 w-8 rounded-md object-contain shrink-0"
            />
            <span className="text-sm font-semibold text-brand-accent truncate">
              {profile?.role === 'admin' ? 'مدير النظام' : profile?.name || 'موظف'}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!todayAtt || todayAtt.check_out_at ? (
              <button
                type="button"
                disabled={attBusy}
                onClick={handleCheckIn}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-success-bg text-brand-success border border-brand-success/25 px-3 py-1.5 text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{todayAtt?.check_out_at ? 'بداية وردية جديدة' : 'تسجيل حضور'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden md:inline-flex items-center gap-1 text-xs text-brand-success font-medium bg-brand-success-bg px-2.5 py-1 rounded-lg">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>حضور: {formatTimeShort(todayAtt.check_in_at)}</span>
                </span>
                <button
                  type="button"
                  disabled={attBusy}
                  onClick={handleCheckOut}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-1.5 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>تسجيل انصراف</span>
                </button>
              </div>
            )}
            <div className="hidden lg:block text-xs text-brand-muted border-r border-brand-border pr-2.5">
              الجنيه المصري (ج.م)
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
