import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getApartmentStatuses, saveApartmentStatuses } from '../lib/db';

export const ApartmentStatusesPage: React.FC = () => {
  const { profile } = useAuth();
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState('');
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    getApartmentStatuses().then(setItems);
  }, []);

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems([...items, newItem.trim()]);
    setNewItem('');
  };

  const handleSave = async () => {
    if (!profile) return;
    const clean = items.map((s) => s.trim()).filter(Boolean);
    if (!clean.length) return;
    await saveApartmentStatuses(clean, { uid: profile.uid, name: profile.name });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  return (
    <div className="space-y-5 max-w-xl">
      <div className="flex items-center gap-3">
        <Link to="/real-estate" className="btn-secondary text-xs px-3 py-1.5">
          <ArrowRight className="w-4 h-4" />
          <span>رجوع</span>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-brand-ink">إدارة حالات الشقق</h1>
          <p className="text-xs text-brand-muted">قائمة الحالات القابلة للتعديل لقسم العقارات</p>
        </div>
      </div>

      {savedMsg && (
        <div className="rounded-lg bg-brand-success-bg text-brand-success px-4 py-2.5 text-sm font-medium">
          تم حفظ قائمة الحالات بنجاح.
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="أضف حالة جديدة (مثل: قيد التفاوض)..."
            className="form-input"
          />
          <button type="button" onClick={addItem} className="btn-secondary text-xs shrink-0">
            <Plus className="w-4 h-4" />
            <span>إضافة</span>
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...items];
                  next[idx] = e.target.value;
                  setItems(next);
                }}
                className="form-input text-sm"
              />
              <button
                type="button"
                onClick={() => setItems(items.filter((_, i) => i !== idx))}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button type="button" onClick={handleSave} className="btn-primary text-xs">
          <Save className="w-4 h-4" />
          <span>حفظ الحالات</span>
        </button>
      </div>
    </div>
  );
};
