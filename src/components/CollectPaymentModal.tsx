import React, { useEffect, useState } from 'react';
import { X, Wallet } from 'lucide-react';
import { formatEgp, fromPiasters, todayIsoDate, toPiasters } from '../lib/format';
import { PAYMENT_METHODS, PaymentMethod } from '../types/domain';

export interface CollectTarget {
  kind: 'booking' | 'visa' | 'apartment';
  id: string;
  clientName: string;
  reference: string;
  remainingPiasters: number;
}

interface Props {
  target: CollectTarget | null;
  onClose: () => void;
  onConfirm: (data: {
    amountPiasters: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    notes: string;
  }) => Promise<void>;
}

export const CollectPaymentModal: React.FC<Props> = ({ target, onClose, onConfirm }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [date, setDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setAmount(fromPiasters(target.remainingPiasters));
      setMethod('cash');
      setDate(todayIsoDate());
      setNotes('');
      setError(null);
    }
  }, [target]);

  if (!target) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = toPiasters(amount);
    if (amt <= 0) {
      setError('يجب إدخال مبلغ أكبر من صفر.');
      return;
    }
    if (amt > target.remainingPiasters) {
      setError(`لا يمكن تحصيل مبلغ أكبر من المتبقي (${formatEgp(target.remainingPiasters)}).`);
      return;
    }

    setSaving(true);
    try {
      await onConfirm({
        amountPiasters: amt,
        paymentMethod: method,
        paymentDate: date,
        notes: notes.trim(),
      });
      onClose();
    } catch {
      setError('حدث خطأ أثناء تسجيل التحصيل. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="bg-brand-sidebar text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-brand-sidebar-label" />
            <h2 className="text-sm font-bold">تحصيل دفعة من العميل</h2>
          </div>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="rounded-lg bg-brand-info border border-brand-border p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-brand-muted">العميل:</span>
              <span className="font-bold text-brand-ink">{target.clientName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">رقم الإيصال / الفاتورة:</span>
              <span className="font-semibold text-brand-accent">{target.reference || '—'}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-brand-border/60">
              <span className="text-brand-muted">المتبقي الحالي:</span>
              <span className="font-bold text-brand-accent">{formatEgp(target.remainingPiasters)}</span>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="form-label">المبلغ المحصّل الآن (ج.م)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={(target.remainingPiasters / 100).toFixed(2)}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="form-input font-semibold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="form-label">طريقة الدفع</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className="form-input"
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">تاريخ التحصيل</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div>
            <label className="form-label">ملاحظات (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: استكمال باقي الحجز"
              className="form-input"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">
              إلغاء
            </button>
            <button type="submit" disabled={saving} className="btn-primary text-xs">
              {saving ? 'جارٍ التسجيل...' : 'تأكيد التحصيل'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
