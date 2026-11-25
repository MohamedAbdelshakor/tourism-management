import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DepartmentKey } from '../types/domain';

interface ProtectedRouteProps {
  children: React.ReactNode;
  department?: DepartmentKey;
  requireEdit?: boolean;
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  department,
  requireEdit = false,
  requireAdmin = false,
}) => {
  const { profile, loading, isAdmin, canView, canEdit } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-page text-brand-muted">
        جارٍ التحميل...
      </div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <ForbiddenView />;
  }

  if (department) {
    const allowed = requireEdit ? canEdit(department) : canView(department);
    if (!allowed) {
      return <ForbiddenView />;
    }
  }

  return <>{children}</>;
};

const ForbiddenView: React.FC = () => (
  <div className="card p-8 max-w-lg mx-auto mt-10 text-center">
    <div className="text-3xl font-bold text-brand-accent mb-2">403</div>
    <h2 className="text-lg font-bold text-brand-ink mb-2">غير مصرح بالوصول</h2>
    <p className="text-sm text-brand-muted">
      لا تملك الصلاحية المطلوبة لعرض أو تعديل هذه الصفحة. يرجى مراجعة مدير النظام.
    </p>
  </div>
);
