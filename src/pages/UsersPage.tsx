import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createAuthUserWithoutSigningOutAdmin } from '../lib/firebase';
import { listAuditLogs, listUsers, saveUserProfile } from '../lib/db';
import {
  AuditLogRecord,
  DEPARTMENTS,
  DepartmentKey,
  PERMISSION_LABELS,
  PermissionLevel,
  UserProfile,
} from '../types/domain';

const EMPTY_PERMS: Record<DepartmentKey, PermissionLevel> = {
  domestic_tourism: 'none',
  outbound_tourism: 'none',
  visas: 'none',
  real_estate: 'none',
  accounting: 'none',
  users_permissions: 'none',
  employee_activity: 'none',
  printing: 'none',
};

export const UsersPage: React.FC = () => {
  const { profile, isAdmin } = useAuth();
  const [tab, setTab] = useState<'users' | 'audit'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'employee' | 'admin'>('employee');
  const [perms, setPerms] = useState<Record<DepartmentKey, PermissionLevel>>({ ...EMPTY_PERMS });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [u, l] = await Promise.all([listUsers(), listAuditLogs()]);
      setUsers(u);
      setLogs(l);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isAdmin) return;
    setErr(null);
    setMsg(null);
    setCreating(true);
    try {
      const newUid = await createAuthUserWithoutSigningOutAdmin(email, password);
      const userProfile: UserProfile = {
        uid: newUid,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        disabled: false,
        permissions: role === 'admin' ? Object.fromEntries(DEPARTMENTS.map((d) => [d.key, 'edit'])) : perms,
      };
      await saveUserProfile(userProfile, { uid: profile.uid, name: profile.name }, true);
      setName('');
      setEmail('');
      setPassword('');
      setRole('employee');
      setPerms({ ...EMPTY_PERMS });
      setMsg('تم إنشاء حساب الموظف بنجاح دون تسجيل خروجك.');
      await load();
    } catch {
      setErr('تعذّر إنشاء الحساب. تأكد أن البريد غير مستخدم مسبقاً وكلمة المرور 6 أحرف على الأقل.');
    } finally {
      setCreating(false);
    }
  };

  const updatePerm = async (u: UserProfile, dept: DepartmentKey, level: PermissionLevel) => {
    if (!profile || !isAdmin) return;
    const updated: UserProfile = {
      ...u,
      permissions: { ...u.permissions, [dept]: level },
    };
    await saveUserProfile(updated, { uid: profile.uid, name: profile.name }, false, u);
    await load();
  };

  const toggleDisabled = async (u: UserProfile) => {
    if (!profile || !isAdmin || u.uid === profile.uid) return;
    const updated: UserProfile = { ...u, disabled: !u.disabled };
    await saveUserProfile(updated, { uid: profile.uid, name: profile.name }, false, u);
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">المستخدمين والصلاحيات</h1>
        <p className="text-xs text-brand-muted mt-0.5">إدارة حسابات الموظفين، مصفوفة الصلاحيات لكل قسم، وسجل التعديلات</p>
      </div>

      <div className="flex gap-2 border-b border-brand-border pb-2">
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold ${
            tab === 'users' ? 'bg-brand-primary text-white' : 'bg-white border border-brand-border text-brand-ink'
          }`}
        >
          المستخدمين ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('audit')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold ${
            tab === 'audit' ? 'bg-brand-primary text-white' : 'bg-white border border-brand-border text-brand-ink'
          }`}
        >
          سجل التعديلات ({logs.length})
        </button>
      </div>

      {tab === 'users' && (
        <div className="space-y-5">
          {isAdmin && (
            <form onSubmit={handleCreate} className="card p-5 space-y-4">
              <h2 className="text-sm font-bold text-brand-accent flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span>إنشاء حساب موظف جديد</span>
              </h2>

              {msg && <div className="rounded-lg bg-brand-success-bg text-brand-success px-3 py-2 text-xs">{msg}</div>}
              {err && <div className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-xs">{err}</div>}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم الكامل" className="form-input" />
                <input type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="employee@tourism.eg" className="form-input text-left" />
                <input type="password" dir="ltr" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور (6+ أحرف)" className="form-input text-left" />
                <select value={role} onChange={(e) => setRole(e.target.value as 'employee' | 'admin')} className="form-input">
                  <option value="employee">موظف (حسب الصلاحيات)</option>
                  <option value="admin">مدير نظام (صلاحية كاملة)</option>
                </select>
              </div>

              {role === 'employee' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {DEPARTMENTS.map((d) => (
                    <div key={d.key} className="bg-brand-page p-2.5 rounded-lg">
                      <label className="block text-xs font-medium text-brand-ink mb-1">{d.label}</label>
                      <select
                        value={perms[d.key]}
                        onChange={(e) => setPerms({ ...perms, [d.key]: e.target.value as PermissionLevel })}
                        className="form-input text-xs py-1"
                      >
                        {(['none', 'view', 'edit'] as PermissionLevel[]).map((lvl) => (
                          <option key={lvl} value={lvl}>{PERMISSION_LABELS[lvl]}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <button type="submit" disabled={creating} className="btn-primary text-xs">
                {creating ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
              </button>
            </form>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="table-head">
                    <th className="px-3 py-3 text-right">الموظف</th>
                    <th className="px-3 py-3 text-right">الدور</th>
                    {DEPARTMENTS.map((d) => (
                      <th key={d.key} className="px-2 py-3 text-center">{d.label}</th>
                    ))}
                    {isAdmin && <th className="px-3 py-3 text-center">الحالة</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border">
                  {loading ? (
                    <tr>
                      <td colSpan={DEPARTMENTS.length + 3} className="px-4 py-6 text-center text-brand-muted">جارٍ التحميل...</td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.uid} className={u.disabled ? 'bg-slate-50 opacity-70' : ''}>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-brand-ink">{u.name}</div>
                          <div className="text-[11px] text-brand-muted" dir="ltr">{u.email}</div>
                        </td>
                        <td className="px-3 py-2.5">{u.role === 'admin' ? 'مدير' : 'موظف'}</td>
                        {DEPARTMENTS.map((d) => (
                          <td key={d.key} className="px-1.5 py-2.5 text-center">
                            {u.role === 'admin' ? (
                              <span className="text-brand-success font-medium">كامل</span>
                            ) : isAdmin ? (
                              <select
                                value={u.permissions?.[d.key] ?? 'none'}
                                onChange={(e) => updatePerm(u, d.key, e.target.value as PermissionLevel)}
                                className="form-input text-[11px] py-1 px-1.5"
                              >
                                <option value="none">لا</option>
                                <option value="view">عرض</option>
                                <option value="edit">تعديل</option>
                              </select>
                            ) : (
                              <span>{PERMISSION_LABELS[u.permissions?.[d.key] ?? 'none']}</span>
                            )}
                          </td>
                        ))}
                        {isAdmin && (
                          <td className="px-3 py-2.5 text-center">
                            {u.uid !== profile?.uid ? (
                              <button
                                type="button"
                                onClick={() => toggleDisabled(u)}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                                  u.disabled ? 'bg-brand-success-bg text-brand-success' : 'bg-red-50 text-red-700'
                                }`}
                              >
                                {u.disabled ? 'تفعيل' : 'تعطيل'}
                              </button>
                            ) : (
                              <span className="text-brand-muted">الحساب الحالي</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="table-head">
                  <th className="px-4 py-3 text-right">الوقت</th>
                  <th className="px-4 py-3 text-right">الموظف</th>
                  <th className="px-4 py-3 text-right">الإجراء</th>
                  <th className="px-4 py-3 text-right">الكيان</th>
                  <th className="px-4 py-3 text-right">التغييرات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap" dir="ltr">
                      {l.occurred_at?.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{l.actor_name}</td>
                    <td className="px-4 py-2.5">
                      {l.action === 'create' ? 'إضافة' : l.action === 'update' ? 'تعديل' : 'حذف'}
                    </td>
                    <td className="px-4 py-2.5">{l.entity_type}</td>
                    <td className="px-4 py-2.5 text-brand-muted max-w-md truncate">
                      {Object.keys(l.changes || {}).join('، ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
