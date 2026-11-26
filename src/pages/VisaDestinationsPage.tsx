import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { listVisaDestinations, saveVisaDestination } from '../lib/db';
import { VisaDestination, VisaDestinationField } from '../types/domain';

export const VisaDestinationsPage: React.FC = () => {
  const { profile } = useAuth();
  const [destinations, setDestinations] = useState<VisaDestination[]>([]);
  const [name, setName] = useState('');
  const [fields, setFields] = useState<VisaDestinationField[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setDestinations(await listVisaDestinations(false));
  };

  useEffect(() => {
    load();
  }, []);

  const addFieldRow = () => {
    setFields([
      ...fields,
      { key: `f_${Date.now()}_${fields.length}`, label: '', type: 'text', required: false, options: [] },
    ]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !name.trim()) return;
    const cleanFields = fields.filter((f) => f.label.trim() !== '');
    await saveVisaDestination(
      { name: name.trim(), fields: cleanFields, deleted_at: null },
      { uid: profile.uid, name: profile.name },
      editingId ?? undefined,
    );
    setName('');
    setFields([]);
    setEditingId(null);
    await load();
  };

  const startEdit = (d: VisaDestination) => {
    setEditingId(d.id);
    setName(d.name);
    setFields(d.fields || []);
  };

  const handleArchive = async (d: VisaDestination) => {
    if (!profile) return;
    if (!window.confirm(`أرشفة الوجهة "${d.name}"؟ ستظل الملفات السابقة مقروءة.`)) return;
    await saveVisaDestination(
      { name: d.name, fields: d.fields, deleted_at: new Date().toISOString() },
      { uid: profile.uid, name: profile.name },
      d.id,
    );
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/visas" className="btn-secondary text-xs px-3 py-1.5">
          <ArrowRight className="w-4 h-4" />
          <span>رجوع</span>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-brand-ink">إدارة وجهات التأشيرات والحقول المتغيرة</h1>
          <p className="text-xs text-brand-muted">خصص مجموعة حقول مستقلة لكل دولة/وجهة (للمدير فقط)</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-brand-accent">{editingId ? 'تعديل وجهة' : 'إضافة وجهة جديدة'}</h2>
        <div className="max-w-md">
          <label className="form-label">اسم الوجهة / الدولة</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: السعودية — تأشيرة عمل"
            className="form-input"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-ink">الحقول الخاصة بالوجهة</span>
            <button type="button" onClick={addFieldRow} className="btn-secondary text-xs py-1 px-2.5">
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة حقل</span>
            </button>
          </div>
          {fields.map((f, idx) => (
            <div key={f.key} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-brand-page p-2.5 rounded-lg">
              <input
                type="text"
                placeholder="اسم الحقل"
                value={f.label}
                onChange={(e) => {
                  const next = [...fields];
                  next[idx] = { ...next[idx], label: e.target.value };
                  setFields(next);
                }}
                className="form-input text-xs"
              />
              <select
                value={f.type}
                onChange={(e) => {
                  const next = [...fields];
                  next[idx] = { ...next[idx], type: e.target.value as VisaDestinationField['type'] };
                  setFields(next);
                }}
                className="form-input text-xs"
              >
                <option value="text">نص</option>
                <option value="number">رقم</option>
                <option value="date">تاريخ</option>
                <option value="select">قائمة اختيارات</option>
                <option value="checkbox">نعم/لا</option>
                <option value="link">زر برابط (لينك)</option>
              </select>
              {f.type === 'select' ? (
                <input
                  type="text"
                  placeholder="خيارات مفصولة بفاصلة"
                  value={f.options.join(', ')}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = {
                      ...next[idx],
                      options: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    };
                    setFields(next);
                  }}
                  className="form-input text-xs"
                />
              ) : f.type === 'link' ? (
                <input
                  type="url"
                  dir="ltr"
                  placeholder="الرابط (https://...)"
                  value={f.default_url ?? ''}
                  onChange={(e) => {
                    const next = [...fields];
                    next[idx] = { ...next[idx], default_url: e.target.value };
                    setFields(next);
                  }}
                  className="form-input text-xs text-left"
                />
              ) : (
                <label className="flex items-center gap-2 text-xs px-2">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => {
                      const next = [...fields];
                      next[idx] = { ...next[idx], required: e.target.checked };
                      setFields(next);
                    }}
                  />
                  <span>إلزامي</span>
                </label>
              )}
              <button
                type="button"
                onClick={() => setFields(fields.filter((_, i) => i !== idx))}
                className="text-red-600 text-xs hover:underline justify-self-end px-2"
              >
                حذف الحقل
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button type="submit" className="btn-primary text-xs">
            حفظ الوجهة
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setName('');
                setFields([]);
              }}
              className="btn-secondary text-xs"
            >
              إلغاء التعديل
            </button>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {destinations.map((d) => (
          <div key={d.id} className="card p-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-brand-ink">{d.name}</h3>
              <p className="text-xs text-brand-muted mt-1">
                الحقول ({d.fields.length}): {d.fields.map((f) => f.label).join('، ') || 'لا توجد حقول إضافية'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => startEdit(d)} className="btn-secondary text-xs py-1 px-2.5">
                تعديل
              </button>
              <button type="button" onClick={() => handleArchive(d)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
