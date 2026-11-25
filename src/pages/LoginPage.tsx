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
    <div className="min-h-screen flex items-center justify-center bg-brand-page px-4">
      <div className="w-full max-w-md card overflow-hidden">
        <div className="bg-brand-sidebar text-white px-6 py-6">
          <div className="text-xs text-brand-sidebar-label">نظام الإدارة المتكامل</div>
          <h1 className="text-xl font-bold mt-1">تسجيل الدخول</h1>
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
              placeholder="admin@tourism.eg"
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
    </div>
  );
};
