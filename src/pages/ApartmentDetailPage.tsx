import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Pencil, Printer, Trash2, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CollectPaymentModal } from '../components/CollectPaymentModal';
import { collectCasePayment, deleteApartment, getApartment } from '../lib/db';
import { formatEgp } from '../lib/format';
import { ApartmentRecord } from '../types/domain';

export const ApartmentDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, canEdit } = useAuth();
  const editable = canEdit('real_estate');

  const [apt, setApt] = useState<ApartmentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [collectOpen, setCollectOpen] = useState(false);

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    try {
      setApt(await getApartment(id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, [id]);

  const handleDelete = async () => {
    if (!profile || !apt) return;
    if (!window.confirm(`حذف الشقة "${apt.name_or_address}"؟`)) return;
    await deleteApartment(apt, { uid: profile.uid, name: profile.name });
    navigate('/real-estate');
  };

  if (loading) return <div className="card p-8 text-center text-brand-muted">جارٍ التحميل...</div>;
  if (!apt) return <div className="card p-8 text-center text-brand-muted">الشقة غير موجودة.</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/real-estate" className="btn-secondary text-xs px-3 py-1.5">
            <ArrowRight className="w-4 h-4" />
            <span>رجوع</span>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-brand-ink">{apt.name_or_address}</h1>
            <p className="text-xs text-brand-muted">الحالة: {apt.status} | رقم الفاتورة: {apt.invoice_number || '—'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/print/apartment/${apt.id}?size=a4`} target="_blank" className="btn-secondary text-xs">
            <Printer className="w-4 h-4" />
            <span>طباعة A4</span>
          </Link>
          <Link to={`/print/apartment/${apt.id}?size=a5`} target="_blank" className="btn-secondary text-xs">
            <Printer className="w-4 h-4" />
            <span>طباعة A5</span>
          </Link>
          {editable && (
            <>
              {(apt.remaining_piasters ?? 0) > 0 && (
                <button type="button" onClick={() => setCollectOpen(true)} className="btn-primary text-xs">
                  <Wallet className="w-4 h-4" />
                  <span>تحصيل متبقي</span>
                </button>
              )}
              <Link to={`/real-estate/apartments/${apt.id}/edit`} className="btn-secondary text-xs">
                <Pencil className="w-4 h-4" />
                <span>تعديل</span>
              </Link>
              <button type="button" onClick={handleDelete} className="btn-danger text-xs">
                <Trash2 className="w-4 h-4" />
                <span>حذف</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card p-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="flex justify-between py-1.5 border-b border-brand-border/50">
          <span className="text-brand-muted">السعر</span>
          <span className="font-bold">{formatEgp(apt.price_piasters)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-brand-border/50">
          <span className="text-brand-muted">نسبة الربح المسجلة</span>
          <span className="font-bold">{apt.profit_percentage ? `${apt.profit_percentage}%` : '—'}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-brand-border/50">
          <span className="text-brand-muted">المدفوع</span>
          <span className="font-bold text-brand-success">{formatEgp(apt.paid_piasters)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-brand-border/50">
          <span className="text-brand-muted">المتبقي</span>
          <span className="font-bold text-brand-accent">{formatEgp(apt.remaining_piasters)}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-brand-border/50">
          <span className="text-brand-muted">المشتري</span>
          <span>{apt.buyer_name || '—'}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-brand-border/50">
          <span className="text-brand-muted">هاتف المشتري</span>
          <span dir="ltr">{apt.buyer_phone || '—'}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-brand-border/50">
          <span className="text-brand-muted">تاريخ البيع</span>
          <span>{apt.sale_date || '—'}</span>
        </div>
        <div className="flex justify-between py-1.5 border-b border-brand-border/50">
          <span className="text-brand-muted">الموظف المسؤول</span>
          <span>{apt.responsible_employee_name || '—'}</span>
        </div>
      </div>

      {apt.notes && <div className="note-box text-sm">{apt.notes}</div>}

      <CollectPaymentModal
        target={
          collectOpen
            ? {
                kind: 'apartment',
                id: apt.id,
                clientName: apt.buyer_name || apt.name_or_address,
                reference: apt.invoice_number || apt.name_or_address,
                remainingPiasters: apt.remaining_piasters,
              }
            : null
        }
        onClose={() => setCollectOpen(false)}
        onConfirm={async ({ amountPiasters, paymentMethod, paymentDate, notes }) => {
          if (!profile) return;
          await collectCasePayment({
            kind: 'apartment',
            id: apt.id,
            amount_piasters: amountPiasters,
            payment_method: paymentMethod,
            payment_date: paymentDate,
            notes,
            actor: { uid: profile.uid, name: profile.name },
          });
          await reload();
        }}
      />
    </div>
  );
};
