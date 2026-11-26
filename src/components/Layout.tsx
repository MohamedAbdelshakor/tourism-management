import React, { useState } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { DEPARTMENTS, DepartmentKey } from '../types/domain';

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

  const visibleDepartments = DEPARTMENTS.filter((d) => canView(d.key));

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex bg-brand-page text-brand-ink">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-40 w-64 bg-brand-sidebar text-white flex flex-col transition-transform duration-200 no-print ${
          mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
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
        <header className="bg-white border-b border-brand-border px-4 lg:px-6 h-14 flex items-center justify-between no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="lg:hidden p-2 rounded-lg border border-brand-border text-brand-ink"
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-brand-accent">
              {profile?.role === 'admin' ? 'مدير النظام' : 'موظف'}
            </span>
          </div>
          <div className="text-xs text-brand-muted">العملة الافتراضية: الجنيه المصري (ج.م)</div>
        </header>

        <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
