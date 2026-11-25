import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, recordActivity } from '../lib/db';
import { readCache } from '../lib/cache';
import { DepartmentKey, PermissionLevel, UserProfile } from '../types/domain';

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  permissionFor: (dept: DepartmentKey) => PermissionLevel;
  canView: (dept: DepartmentKey) => boolean;
  canEdit: (dept: DepartmentKey) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async (uid: string): Promise<UserProfile | null> => {
    const userDoc = await getUserProfile(uid);
    if (!userDoc || userDoc.disabled) {
      await signOut(auth);
      setProfile(null);
      setError('هذا الحساب معطّل أو غير مصرح له بالدخول للنظام.');
      return null;
    }
    setProfile(userDoc);
    setError(null);
    return userDoc;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        await loadProfile(fbUser.uid);
      } catch {
        setProfile(null);
        setError('تعذّر تحميل بيانات الحساب. يرجى المحاولة مرة أخرى.');
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    const loaded = await loadProfile(cred.user.uid);
    if (loaded) {
      await recordActivity({ uid: loaded.uid, name: loaded.name }, 'login');
    }
  };

  const logout = async () => {
    if (profile) {
      await recordActivity({ uid: profile.uid, name: profile.name }, 'logout');
    }
    readCache.clearAll();
    await signOut(auth);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await loadProfile(auth.currentUser.uid);
    }
  };

  const isAdmin = profile?.role === 'admin';

  const permissionFor = (dept: DepartmentKey): PermissionLevel => {
    if (!profile) return 'none';
    if (profile.role === 'admin') return 'edit';
    return profile.permissions?.[dept] ?? 'none';
  };

  const canView = (dept: DepartmentKey): boolean => {
    const p = permissionFor(dept);
    return p === 'view' || p === 'edit';
  };

  const canEdit = (dept: DepartmentKey): boolean => permissionFor(dept) === 'edit';

  return (
    <AuthContext.Provider
      value={{
        profile,
        loading,
        error,
        login,
        logout,
        refreshProfile,
        isAdmin,
        permissionFor,
        canView,
        canEdit,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
