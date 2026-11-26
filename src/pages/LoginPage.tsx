import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DEPARTMENTS } from '../types/domain';

export const LoginPage: React.FC = () => {
  const { profile, login, error: authError, canView } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (profile) {
    const firstAllowed = DEPARTMENTS.find((d) => canView(d.key));
    return <Navigate to={firstAllowed?.path ?? '/domestic-bookings'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch {
      setLocalError('بيانات الدخول غير صحيحة أو الحساب غير مفعل.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-brand-page px-4 py-8">
      <div className="w-full max-w-md card overflow-hidden">
        <div className="bg-white px-6 pt-6 pb-4 text-center border-b border-brand-border">
          <img
            src="/logos/red-star-logo.jpg"
            alt="Red Star Travel"
            className="h-28 w-auto mx-auto object-contain"
          />
          <div className="text-xs font-medium text-brand-muted mt-2">نظام الإدارة المتكامل</div>
          <h1 className="text-lg font-bold text-brand-sidebar mt-0.5">تسجيل الدخول</h1>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {(localError || authError) && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {localError || authError}
            </div>
          )}

          <div>
            <label className="form-label">البريد الإلكتروني</label>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input text-left"
              placeholder="admin@admin.com"
            />
          </div>

          <div>
            <label className="form-label">كلمة المرور</label>
            <input
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input text-left"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'جارٍ تسجيل الدخول...' : 'دخول'}
          </button>

          <div className="note-box text-xs text-brand-muted">
            التسجيل العام مغلق. يتم إنشاء حسابات الموظفين فقط من خلال مدير النظام.
          </div>
        </form>
      </div>

      {/* Developer Credit */}
      <div
        dir="ltr"
        className="mt-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-brand-sidebar/95 text-white/90 shadow-sm border border-brand-border/40"
      >
        <img
          src="/logos/triple-mind-logo.jpg"
          alt="Triple Mind Tech Solutions"
          className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/15"
        />
        <div className="text-left leading-tight">
          <div className="text-[10px] uppercase tracking-wider text-brand-sidebar-label">Powered by</div>
          <div className="text-xs font-semibold text-white">Triple Mind Tech Solutions</div>
        </div>
      </div>
    </div>
  );
};
