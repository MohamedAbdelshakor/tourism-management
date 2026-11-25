import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ensureFieldDefinitionsPersisted, saveFieldDefinition } from '../lib/db';
import { DEPARTMENT_LABELS, FieldDefinition, FieldType } from '../types/domain';

interface Props {
  department: 'domestic_tourism' | 'outbound_tourism';
}

export const ManageFieldsPage: React.FC<Props> = ({ department }) => {
  const { profile } = useAuth();
  const basePath = department === 'domestic_tourism' ? '/domestic-bookings' : '/outbound-bookings';

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [optionsText, setOptionsText] = useState('');
  const [required, setRequired] = useState(false);
  const [showOnReceipt, setShowOnReceipt] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await ensureFieldDefinitionsPersisted(department);
      setFields(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [department]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !label.trim()) return;
    const key = `custom_${Date.now()}`;
    const newField: FieldDefinition = {
      id: `${department}__${key}`,
      department,
      key,
      label: label.trim(),
      type,
      section: 'custom',
      required,
      show_on_receipt: showOnReceipt,
      options:
        type === 'select'
          ? optionsText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      sort_order: fields.length + 1,
      is_system: false,
      deleted_at: null,
    };
    await saveFieldDefinition(newField, { uid: profile.uid, name: profile.name }, true);
    setLabel('');
    setOptionsText('');
    setRequired(false);
    await load();
  };

  const toggleSoftDelete = async (f: FieldDefinition) => {
    if (!profile) return;
    await saveFieldDefinition(
      { ...f, deleted_at: f.deleted_at ? null : new Date().toISOString() },
      { uid: profile.uid, name: profile.name },
      false,
    );
    await load();
  };

  const updateLabel = async (f: FieldDefinition, newLabel: string) => {
    if (!profile || !newLabel.trim() || newLabel === f.label) return;
    await saveFieldDefinition(
      { ...f, label: newLabel.trim() },
      { uid: profile.uid, name: profile.name },
      false,
    );
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to={basePath} className="btn-secondary text-xs px-3 py-1.5">
          <ArrowRight className="w-4 h-4" />
          <span>رجوع</span>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-brand-ink">إدارة الحقول — {DEPARTMENT_LABELS[department]}</h1>
          <p className="text-xs text-brand-muted">
            يمكن للمدير إضافة أو تعديل أو إخفاء أي حقل (بما في ذلك الحقول الأساسية) مع بقاء السجلات القديمة مقروءة.
          </p>
        </div>
      </div>

      {/* Add Custom Field */}
      <form onSubmit={handleAdd} className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-brand-accent">إضافة حقل جديد</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="form-label">اسم الحقل</label>
            <input
              type="text"
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="form-input"
              placeholder="مثال: رقم جواز السفر"
            />
          </div>
          <div>
            <label className="form-label">النوع</label>
            <select value={type} onChange={(e) => setType(e.target.value as FieldType)} className="form-input">
              <option value="text">نص</option>
              <option value="number">رقم</option>
              <option value="money">مبلغ مالي</option>
              <option value="date">تاريخ</option>
              <option value="select">قائمة اختيارات</option>
              <option value="checkbox">مربع اختيار (نعم/لا)</option>
            </select>
          </div>
          <div className="flex items-center gap-4 pt-6">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              <span>إلزامي</span>
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={showOnReceipt} onChange={(e) => setShowOnReceipt(e.target.checked)} />
              <span>يظهر في الإيصال</span>
            </label>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full text-xs">
              <Plus className="w-4 h-4" />
              <span>إضافة الحقل</span>
            </button>
          </div>
        </div>
        {type === 'select' && (
          <div>
            <label className="form-label">خيارات القائمة (خيار في كل سطر)</label>
            <textarea
              rows={3}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              className="form-input"
              placeholder="خيار 1&#10;خيار 2"
            />
          </div>
        )}
      </form>

      {/* Fields List */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head">
              <th className="px-4 py-3 text-right">اسم الحقل</th>
              <th className="px-4 py-3 text-right">النوع</th>
              <th className="px-4 py-3 text-right">القسم</th>
              <th className="px-4 py-3 text-center">الحالة</th>
              <th className="px-4 py-3 text-center">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-muted">
                  جارٍ التحميل...
                </td>
              </tr>
            ) : (
              fields.map((f) => (
                <tr key={f.id} className={f.deleted_at ? 'bg-slate-50 opacity-70' : ''}>
                  <td className="px-4 py-2.5">
                    <input
                      type="text"
                      defaultValue={f.label}
                      onBlur={(e) => updateLabel(f, e.target.value)}
                      className="form-input py-1 text-sm max-w-xs"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-brand-muted">{f.type}</td>
                  <td className="px-4 py-2.5 text-xs text-brand-muted">
                    {f.is_system ? 'أساسي' : 'مخصص'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        f.deleted_at ? 'bg-slate-200 text-slate-600' : 'bg-brand-success-bg text-brand-success'
                      }`}
                    >
                      {f.deleted_at ? 'مخفي' : 'نشط'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => toggleSoftDelete(f)}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      {f.deleted_at ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{f.deleted_at ? 'استعادة' : 'إخفاء'}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
