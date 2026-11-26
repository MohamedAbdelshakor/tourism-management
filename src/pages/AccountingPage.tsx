import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, Wallet } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CollectPaymentModal, CollectTarget } from '../components/CollectPaymentModal';
import {
  addCommission,
  addDebt,
  addExpense,
  addPayment,
  collectCasePayment,
  deleteCommission,
  deleteDebt,
  deleteExpense,
  deletePayment,
  deleteSupplier,
  listApartments,
  listBookings,
  listCommissions,
  listDebts,
  listExpenses,
  listPayments,
  listSuppliers,
  listUsers,
  listVisaCases,
  saveSupplier,
  updateDebtPaid,
} from '../lib/db';
import { formatCurrency, formatEgp, todayIsoDate, toPiasters } from '../lib/format';
import {
  ApartmentRecord,
  BookingRecord,
  CommissionRecord,
  DebtRecord,
  ExpenseRecord,
  PAYMENT_METHODS,
  PaymentMethod,
  PaymentRecord,
  SupplierRecord,
  UserProfile,
  VisaCaseRecord,
} from '../types/domain';

type Period = 'daily' | 'weekly' | 'monthly' | 'all';
type Tab = 'reports' | 'payments' | 'debts' | 'suppliers' | 'expenses' | 'commissions' | 'balances';

export const AccountingPage: React.FC = () => {
  const { profile, canEdit } = useAuth();
  const editable = canEdit('accounting');

  const [tab, setTab] = useState<Tab>('reports');
  const [period, setPeriod] = useState<Period>('monthly');
  const [loading, setLoading] = useState(true);
  const [collectTarget, setCollectTarget] = useState<CollectTarget | null>(null);
  const [onlyRemaining, setOnlyRemaining] = useState(false);

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [visaCases, setVisaCases] = useState<VisaCaseRecord[]>([]);
  const [apartments, setApartments] = useState<ApartmentRecord[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  // Forms
  const [pClient, setPClient] = useState('');
  const [pRef, setPRef] = useState('');
  const [pAmount, setPAmount] = useState('');
  const [pCurrency, setPCurrency] = useState('EGP');
  const [pRate, setPRate] = useState('');
  const [pMethod, setPMethod] = useState<PaymentMethod>('cash');
  const [pDate, setPDate] = useState(todayIsoDate());
  const [pNotes, setPNotes] = useState('');

  const [dDir, setDDir] = useState<'client_owes' | 'company_owes'>('client_owes');
  const [dParty, setDParty] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dTotal, setDTotal] = useState('');
  const [dPaid, setDPaid] = useState('0');
  const [dDate, setDDate] = useState(todayIsoDate());

  const [sName, setSName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sTotal, setSTotal] = useState('0');
  const [sPaid, setSPaid] = useState('0');

  const [eCat, setECat] = useState<'other' | 'visa'>('other');
  const [eDesc, setEDesc] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eDate, setEDate] = useState(todayIsoDate());

  const [cEmpUid, setCEmpUid] = useState('');
  const [cPct, setCPct] = useState('');
  const [cAmount, setCAmount] = useState('');
  const [cDate, setCDate] = useState(todayIsoDate());
  const [cNotes, setCNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [pay, dbt, sup, exp, com, bks, vcs, apts, usrs] = await Promise.all([
        listPayments(),
        listDebts(),
        listSuppliers(),
        listExpenses(),
        listCommissions(),
        listBookings(),
        listVisaCases(),
        listApartments(),
        listUsers(),
      ]);
      setPayments(pay);
      setDebts(dbt);
      setSuppliers(sup);
      setExpenses(exp);
      setCommissions(com);
      setBookings(bks);
      setVisaCases(vcs);
      setApartments(apts);
      setUsers(usrs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const inPeriod = (dateStr: string): boolean => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const today = todayIsoDate();
    if (period === 'daily') return dateStr === today;
    if (period === 'monthly') return dateStr.slice(0, 7) === today.slice(0, 7);
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 7;
  };

  // Merge manual/auto-synced payments with any older bookings/visas/apartments created before auto-sync
  const effectivePayments = useMemo<PaymentRecord[]>(() => {
    const existingIds = new Set(payments.map((p) => p.id));
    const merged: PaymentRecord[] = [...payments];

    for (const b of bookings) {
      if ((b.paid_piasters ?? 0) > 0 && !existingIds.has(`auto_booking_${b.id}`)) {
        merged.push({
          id: `legacy_booking_${b.id}`,
          client_name: b.client_name,
          reference: b.receipt_number,
          amount_minor: b.paid_piasters,
          currency: 'EGP',
          exchange_rate_on_receipt: null,
          payment_method: b.payment_method ?? 'cash',
          payment_date: b.booking_date || b.created_at?.slice(0, 10) || todayIsoDate(),
          notes: b.department === 'domestic_tourism' ? 'تحصيل تلقائي — سياحة داخلية' : 'تحصيل تلقائي — سياحة خارجية',
          source_type: 'booking',
          source_id: b.id,
          created_at: b.created_at,
        });
      }
    }

    for (const v of visaCases) {
      if ((v.paid_piasters ?? 0) > 0 && !existingIds.has(`auto_visa_${v.id}`)) {
        merged.push({
          id: `legacy_visa_${v.id}`,
          client_name: v.client_name,
          reference: v.invoice_number,
          amount_minor: v.paid_piasters,
          currency: 'EGP',
          exchange_rate_on_receipt: null,
          payment_method: v.payment_method ?? 'cash',
          payment_date: v.case_date || v.created_at?.slice(0, 10) || todayIsoDate(),
          notes: `تحصيل تلقائي — تأشيرات (${v.destination_name || 'عام'})`,
          source_type: 'visa',
          source_id: v.id,
          created_at: v.created_at,
        });
      }
    }

    for (const a of apartments) {
      if ((a.paid_piasters ?? 0) > 0 && !existingIds.has(`auto_apartment_${a.id}`)) {
        merged.push({
          id: `legacy_apartment_${a.id}`,
          client_name: a.buyer_name || a.name_or_address,
          reference: a.invoice_number || a.name_or_address,
          amount_minor: a.paid_piasters,
          currency: 'EGP',
          exchange_rate_on_receipt: null,
          payment_method: a.payment_method ?? 'cash',
          payment_date: a.sale_date || a.created_at?.slice(0, 10) || todayIsoDate(),
          notes: `تحصيل تلقائي — عقارات (${a.name_or_address})`,
          source_type: 'apartment',
          source_id: a.id,
          created_at: a.created_at,
        });
      }
    }

    return merged.sort((a, b) => String(b.payment_date ?? '').localeCompare(String(a.payment_date ?? '')));
  }, [payments, bookings, visaCases, apartments]);

  // All-time Treasury (الخزنة) balances by payment method (EGP)
  const treasury = useMemo(() => {
    const byMethod: Record<PaymentMethod, number> = { cash: 0, instapay: 0, vodafone_cash: 0 };
    for (const p of effectivePayments) {
      if (p.currency === 'EGP') {
        byMethod[p.payment_method] = (byMethod[p.payment_method] ?? 0) + p.amount_minor;
      }
    }
    const total = byMethod.cash + byMethod.instapay + byMethod.vodafone_cash;
    return { ...byMethod, total };
  }, [effectivePayments]);

  const report = useMemo(() => {
    const egpPayments = effectivePayments.filter((p) => p.currency === 'EGP' && inPeriod(p.payment_date));
    const egpCollected = egpPayments.reduce((s, p) => s + p.amount_minor, 0);
    const byMethod: Record<PaymentMethod, number> = { cash: 0, instapay: 0, vodafone_cash: 0 };
    for (const p of egpPayments) {
      byMethod[p.payment_method] = (byMethod[p.payment_method] ?? 0) + p.amount_minor;
    }

    // Foreign currency inventory (recorded per currency WITHOUT auto-conversion)
    const fxInventory: Record<string, number> = {};
    for (const p of effectivePayments) {
      if (p.currency !== 'EGP') {
        fxInventory[p.currency] = (fxInventory[p.currency] ?? 0) + p.amount_minor;
      }
    }

    const periodExpenses = expenses.filter((e) => inPeriod(e.expense_date)).reduce((s, e) => s + e.amount_piasters, 0);
    const periodCommissions = commissions
      .filter((c) => inPeriod(c.commission_date))
      .reduce((s, c) => s + c.commission_amount_piasters, 0);

    // Manual commissions are deducted from profit
    const netProfit = egpCollected - periodExpenses - periodCommissions;

    return { egpCollected, byMethod, fxInventory, periodExpenses, periodCommissions, netProfit };
  }, [effectivePayments, expenses, commissions, period]);

  const supplierSummaries = useMemo(() => {
    return suppliers.map((s) => {
      const linked = visaCases.filter((v) => v.supplier_id === s.id);
      const total = s.opening_total_piasters + linked.reduce((acc, v) => acc + (v.supplier_cost_piasters ?? 0), 0);
      const paid = s.opening_paid_piasters + linked.reduce((acc, v) => acc + (v.supplier_paid_piasters ?? 0), 0);
      return { supplier: s, total, paid, remaining: Math.max(0, total - paid), casesCount: linked.length };
    });
  }, [suppliers, visaCases]);

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const minor = toPiasters(pAmount);
    if (minor <= 0) return;
    const cur = pCurrency.trim().toUpperCase() || 'EGP';
    await addPayment(
      {
        client_name: pClient.trim(),
        reference: pRef.trim(),
        amount_minor: minor,
        currency: cur,
        exchange_rate_on_receipt: cur === 'EGP' ? null : pRate.trim() || null,
        payment_method: pMethod,
        payment_date: pDate,
        notes: pNotes.trim(),
      },
      { uid: profile.uid, name: profile.name },
    );
    setPClient('');
    setPRef('');
    setPAmount('');
    setPRate('');
    setPNotes('');
    await load();
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const tot = toPiasters(dTotal);
    const pd = toPiasters(dPaid);
    if (tot <= 0 || pd > tot) return;
    await addDebt(
      {
        direction: dDir,
        party_name: dParty.trim(),
        description: dDesc.trim(),
        total_piasters: tot,
        paid_piasters: pd,
        remaining_piasters: tot - pd,
        debt_date: dDate,
      },
      { uid: profile.uid, name: profile.name },
    );
    setDParty('');
    setDDesc('');
    setDTotal('');
    setDPaid('0');
    await load();
  };

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !sName.trim()) return;
    await saveSupplier(
      {
        name: sName.trim(),
        phone: sPhone.trim(),
        opening_total_piasters: toPiasters(sTotal),
        opening_paid_piasters: toPiasters(sPaid),
      },
      { uid: profile.uid, name: profile.name },
    );
    setSName('');
    setSPhone('');
    setSTotal('0');
    setSPaid('0');
    await load();
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !eDesc.trim()) return;
    const amt = toPiasters(eAmount);
    if (amt <= 0) return;
    await addExpense(
      {
        category: eCat,
        entity_type: eCat === 'visa' ? 'visa_general' : 'general',
        entity_id: null,
        description: eDesc.trim(),
        amount_piasters: amt,
        expense_date: eDate,
      },
      { uid: profile.uid, name: profile.name },
    );
    setEDesc('');
    setEAmount('');
    await load();
  };

  const handleAddCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !cEmpUid) return;
    const amt = toPiasters(cAmount);
    if (amt <= 0) return;
    const emp = users.find((u) => u.uid === cEmpUid);
    await addCommission(
      {
        employee_uid: cEmpUid,
        employee_name: emp?.name ?? '',
        commission_percentage: cPct.trim(),
        commission_amount_piasters: amt,
        commission_date: cDate,
        notes: cNotes.trim(),
      },
      { uid: profile.uid, name: profile.name },
    );
    setCPct('');
    setCAmount('');
    setCNotes('');
    await load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">الحسابات</h1>
        <p className="text-xs text-brand-muted mt-0.5">
          تقارير يومية/أسبوعية/شهرية، طرق الدفع (نقدي، إنستا باي، فودافون كاش)، العملات الأجنبية، المديونيات، الموردين، المصروفات والعمولات
        </p>
      </div>

      {/* الخزنة (Treasury Summary) */}
      <div className="card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-brand-accent">الخزنة (رصيد المتحصلات التراكمي — ج.م)</h2>
          <span className="text-[11px] text-brand-muted">يشمل كل التحصيلات من السياحة الداخلية والخارجية والتأشيرات والعقارات والدفعات اليدوية</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl border border-brand-border bg-brand-page p-4">
            <div className="text-xs text-brand-muted">نقدي (كاش)</div>
            <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(treasury.cash)}</div>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-page p-4">
            <div className="text-xs text-brand-muted">إنستا باي</div>
            <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(treasury.instapay)}</div>
          </div>
          <div className="rounded-xl border border-brand-border bg-brand-page p-4">
            <div className="text-xs text-brand-muted">فودافون كاش</div>
            <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(treasury.vodafone_cash)}</div>
          </div>
          <div className="rounded-xl border border-brand-primary/30 bg-brand-sidebar text-white p-4">
            <div className="text-xs text-brand-sidebar-label">إجمالي الخزنة</div>
            <div className="text-lg font-bold mt-1">{formatEgp(treasury.total)}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-brand-border pb-2 -mx-1 px-1">
        {(
          [
            ['reports', 'التقارير والعملات'],
            ['payments', 'التحصيلات والمدفوعات'],
            ['debts', 'المديونيات'],
            ['suppliers', 'الموردين'],
            ['expenses', 'المصروفات'],
            ['commissions', 'العمولات'],
            ['balances', 'أرصدة الحالات'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 whitespace-nowrap px-3.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === id ? 'bg-brand-primary text-white' : 'bg-white border border-brand-border text-brand-ink hover:bg-brand-info'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-8 text-center text-brand-muted">جارٍ تحميل البيانات المالية...</div>
      ) : (
        <>
          {tab === 'reports' && (
            <div className="space-y-5">
              <div className="flex gap-2">
                {(
                  [
                    ['daily', 'يومي'],
                    ['weekly', 'أسبوعي'],
                    ['monthly', 'شهري'],
                    ['all', 'الكل'],
                  ] as [Period, string][]
                ).map(([p, label]) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${
                      period === p ? 'bg-brand-sidebar text-white' : 'bg-white border border-brand-border text-brand-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="card p-4">
                  <div className="text-xs text-brand-muted">المتحصلات (ج.م)</div>
                  <div className="text-lg font-bold text-brand-success mt-1">{formatEgp(report.egpCollected)}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-brand-muted">المصروفات</div>
                  <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(report.periodExpenses)}</div>
                </div>
                <div className="card p-4">
                  <div className="text-xs text-brand-muted">العمولات (تُخصم من الربح)</div>
                  <div className="text-lg font-bold text-brand-ink mt-1">{formatEgp(report.periodCommissions)}</div>
                </div>
                <div className="card p-4 bg-brand-info">
                  <div className="text-xs text-brand-accent font-medium">صافي الربح (ج.م)</div>
                  <div className="text-lg font-bold text-brand-accent mt-1">{formatEgp(report.netProfit)}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="card p-5 space-y-3">
                  <h2 className="text-sm font-bold text-brand-accent">التحصيل حسب طريقة الدفع (ج.م)</h2>
                  {PAYMENT_METHODS.map((m) => (
                    <div key={m.value} className="flex justify-between text-sm py-1.5 border-b border-brand-border/50">
                      <span>{m.label}</span>
                      <span className="font-semibold">{formatEgp(report.byMethod[m.value])}</span>
                    </div>
                  ))}
                </div>

                <div className="card p-5 space-y-3">
                  <h2 className="text-sm font-bold text-brand-accent">مخزون العملات الأجنبية (بدون تحويل تلقائي)</h2>
                  {Object.keys(report.fxInventory).length === 0 ? (
                    <p className="text-xs text-brand-muted">لا توجد متحصلات بعملات أجنبية مسجلة.</p>
                  ) : (
                    Object.entries(report.fxInventory).map(([cur, amt]) => (
                      <div key={cur} className="flex justify-between text-sm py-1.5 border-b border-brand-border/50">
                        <span className="font-semibold">{cur}</span>
                        <span>{formatCurrency(amt, cur)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'payments' && (
            <div className="space-y-4">
              {editable && (
                <form onSubmit={handleAddPayment} className="card p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <input type="text" required value={pClient} onChange={(e) => setPClient(e.target.value)} placeholder="اسم العميل" className="form-input" />
                  <input type="text" value={pRef} onChange={(e) => setPRef(e.target.value)} placeholder="رقم الإيصال / المرجع" className="form-input" />
                  <input type="number" step="0.01" min="0.01" required value={pAmount} onChange={(e) => setPAmount(e.target.value)} placeholder="المبلغ" className="form-input" />
                  <select value={pMethod} onChange={(e) => setPMethod(e.target.value as PaymentMethod)} className="form-input">
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select value={pCurrency} onChange={(e) => setPCurrency(e.target.value)} className="form-input">
                    <option value="EGP">EGP — جنيه مصري</option>
                    <option value="USD">USD — دولار أمريكي</option>
                    <option value="EUR">EUR — يورو</option>
                    <option value="SAR">SAR — ريال سعودي</option>
                    <option value="AED">AED — درهم إماراتي</option>
                    <option value="GBP">GBP — جنيه إسترليني</option>
                  </select>
                  <input
                    type="text"
                    disabled={pCurrency === 'EGP'}
                    value={pRate}
                    onChange={(e) => setPRate(e.target.value)}
                    placeholder="سعر الصرف يوم الاستلام (تسجيل فقط)"
                    className="form-input disabled:bg-slate-100"
                  />
                  <input type="date" required value={pDate} onChange={(e) => setPDate(e.target.value)} className="form-input" />
                  <button type="submit" className="btn-primary text-xs">تسجيل دفعة</button>
                </form>
              )}

              <div className="card overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-3 text-right">التاريخ</th>
                      <th className="px-4 py-3 text-right">العميل</th>
                      <th className="px-4 py-3 text-right">المرجع</th>
                      <th className="px-4 py-3 text-right">المبلغ</th>
                      <th className="px-4 py-3 text-right">سعر الصرف المسجل</th>
                      <th className="px-4 py-3 text-right">طريقة الدفع</th>
                      {editable && <th className="px-4 py-3 text-center">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {effectivePayments.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2.5">{p.payment_date}</td>
                        <td className="px-4 py-2.5 font-medium">{p.client_name}</td>
                        <td className="px-4 py-2.5 text-xs text-brand-muted">
                          <div>{p.reference || '—'}</div>
                          {p.source_type && p.source_type !== 'manual' && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-brand-info text-brand-accent text-[10px] font-medium">
                              {p.is_installment
                                ? 'تحصيل متبقي'
                                : p.source_type === 'booking'
                                  ? 'تلقائي من الحجز'
                                  : p.source_type === 'visa'
                                    ? 'تلقائي من التأشيرات'
                                    : 'تلقائي من العقارات'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-semibold">{formatCurrency(p.amount_minor, p.currency)}</td>
                        <td className="px-4 py-2.5 text-xs">{p.exchange_rate_on_receipt || '—'}</td>
                        <td className="px-4 py-2.5 text-xs">
                          {PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label}
                        </td>
                        {editable && (
                          <td className="px-4 py-2.5 text-center">
                            {!p.id.startsWith('legacy_') ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!profile) return;
                                  await deletePayment(p, { uid: profile.uid, name: profile.name });
                                  await load();
                                }}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-[11px] text-brand-muted">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'debts' && (
            <div className="space-y-4">
              {editable && (
                <form onSubmit={handleAddDebt} className="card p-5 grid grid-cols-1 md:grid-cols-6 gap-3">
                  <select value={dDir} onChange={(e) => setDDir(e.target.value as 'client_owes' | 'company_owes')} className="form-input">
                    <option value="client_owes">مديونية للعميل على نفسه (لنا)</option>
                    <option value="company_owes">مديونية على الشركة (علينا)</option>
                  </select>
                  <input type="text" required value={dParty} onChange={(e) => setDParty(e.target.value)} placeholder="الطرف" className="form-input" />
                  <input type="text" value={dDesc} onChange={(e) => setDDesc(e.target.value)} placeholder="البيان" className="form-input" />
                  <input type="number" step="0.01" min="0.01" required value={dTotal} onChange={(e) => setDTotal(e.target.value)} placeholder="الإجمالي (ج.م)" className="form-input" />
                  <input type="number" step="0.01" min="0" value={dPaid} onChange={(e) => setDPaid(e.target.value)} placeholder="المدفوع (ج.م)" className="form-input" />
                  <button type="submit" className="btn-primary text-xs">إضافة مديونية</button>
                </form>
              )}

              <div className="card overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-3 text-right">النوع</th>
                      <th className="px-4 py-3 text-right">الطرف</th>
                      <th className="px-4 py-3 text-right">البيان</th>
                      <th className="px-4 py-3 text-right">الإجمالي</th>
                      <th className="px-4 py-3 text-right">المدفوع</th>
                      <th className="px-4 py-3 text-right">المتبقي</th>
                      {editable && <th className="px-4 py-3 text-center">إجراءات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {debts.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2.5 text-xs font-semibold">
                          {d.direction === 'client_owes' ? 'لنا (على العميل)' : 'علينا (على الشركة)'}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{d.party_name}</td>
                        <td className="px-4 py-2.5 text-xs text-brand-muted">{d.description || '—'}</td>
                        <td className="px-4 py-2.5">{formatEgp(d.total_piasters)}</td>
                        <td className="px-4 py-2.5 text-brand-success">{formatEgp(d.paid_piasters)}</td>
                        <td className="px-4 py-2.5 font-semibold text-brand-accent">{formatEgp(d.remaining_piasters)}</td>
                        {editable && (
                          <td className="px-4 py-2.5 text-center space-x-2 space-x-reverse">
                            {d.remaining_piasters > 0 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!profile) return;
                                  const extraStr = window.prompt('أدخل مبلغ السداد الإضافي (ج.م):', '0');
                                  if (!extraStr) return;
                                  const extra = toPiasters(extraStr);
                                  if (extra <= 0 || d.paid_piasters + extra > d.total_piasters) return;
                                  await updateDebtPaid(d, d.paid_piasters + extra, { uid: profile.uid, name: profile.name });
                                  await load();
                                }}
                                className="btn-secondary text-xs py-1 px-2"
                              >
                                سداد
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                if (!profile) return;
                                await deleteDebt(d, { uid: profile.uid, name: profile.name });
                                await load();
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'suppliers' && (
            <div className="space-y-4">
              {editable && (
                <form onSubmit={handleAddSupplier} className="card p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
                  <input type="text" required value={sName} onChange={(e) => setSName(e.target.value)} placeholder="اسم المورد" className="form-input" />
                  <input type="text" dir="ltr" value={sPhone} onChange={(e) => setSPhone(e.target.value)} placeholder="الهاتف" className="form-input text-left" />
                  <input type="number" step="0.01" min="0" value={sTotal} onChange={(e) => setSTotal(e.target.value)} placeholder="رصيد افتتاحي إجمالي" className="form-input" />
                  <input type="number" step="0.01" min="0" value={sPaid} onChange={(e) => setSPaid(e.target.value)} placeholder="مدفوع افتتاحي" className="form-input" />
                  <button type="submit" className="btn-primary text-xs">إضافة مورد</button>
                </form>
              )}

              <div className="card overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-3 text-right">المورد</th>
                      <th className="px-4 py-3 text-right">الهاتف</th>
                      <th className="px-4 py-3 text-right">ملفات التأشيرات</th>
                      <th className="px-4 py-3 text-right">الإجمالي</th>
                      <th className="px-4 py-3 text-right">المدفوع</th>
                      <th className="px-4 py-3 text-right">المتبقي للمورد</th>
                      {editable && <th className="px-4 py-3 text-center">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {supplierSummaries.map(({ supplier, total, paid, remaining, casesCount }) => (
                      <tr key={supplier.id}>
                        <td className="px-4 py-2.5 font-medium">{supplier.name}</td>
                        <td className="px-4 py-2.5" dir="ltr">{supplier.phone || '—'}</td>
                        <td className="px-4 py-2.5">{casesCount}</td>
                        <td className="px-4 py-2.5">{formatEgp(total)}</td>
                        <td className="px-4 py-2.5 text-brand-success">{formatEgp(paid)}</td>
                        <td className="px-4 py-2.5 font-semibold text-brand-accent">{formatEgp(remaining)}</td>
                        {editable && (
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!profile) return;
                                await deleteSupplier(supplier, { uid: profile.uid, name: profile.name });
                                await load();
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'expenses' && (
            <div className="space-y-4">
              {editable && (
                <form onSubmit={handleAddExpense} className="card p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
                  <select value={eCat} onChange={(e) => setECat(e.target.value as 'other' | 'visa')} className="form-input">
                    <option value="other">مصروفات أخرى</option>
                    <option value="visa">مصروفات تأشيرات</option>
                  </select>
                  <input type="text" required value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="البيان" className="form-input" />
                  <input type="number" step="0.01" min="0.01" required value={eAmount} onChange={(e) => setEAmount(e.target.value)} placeholder="المبلغ (ج.م)" className="form-input" />
                  <input type="date" required value={eDate} onChange={(e) => setEDate(e.target.value)} className="form-input" />
                  <button type="submit" className="btn-primary text-xs">إضافة مصروف</button>
                </form>
              )}

              <div className="card overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-3 text-right">التاريخ</th>
                      <th className="px-4 py-3 text-right">التصنيف</th>
                      <th className="px-4 py-3 text-right">البيان</th>
                      <th className="px-4 py-3 text-right">المبلغ</th>
                      {editable && <th className="px-4 py-3 text-center">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {expenses.map((exp) => (
                      <tr key={exp.id}>
                        <td className="px-4 py-2.5">{exp.expense_date}</td>
                        <td className="px-4 py-2.5 text-xs">{exp.category === 'visa' ? 'تأشيرات' : 'أخرى'}</td>
                        <td className="px-4 py-2.5">{exp.description}</td>
                        <td className="px-4 py-2.5 font-medium">{formatEgp(exp.amount_piasters)}</td>
                        {editable && (
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!profile) return;
                                await deleteExpense(exp, { uid: profile.uid, name: profile.name });
                                await load();
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'commissions' && (
            <div className="space-y-4">
              <div className="note-box text-xs text-brand-muted">
                يتم تسجيل مبلغ العمولة يدوياً بدون حساب تلقائي، ويُخصم مباشرة من صافي الربح في التقارير.
              </div>
              {editable && (
                <form onSubmit={handleAddCommission} className="card p-5 grid grid-cols-1 md:grid-cols-6 gap-3">
                  <select required value={cEmpUid} onChange={(e) => setCEmpUid(e.target.value)} className="form-input">
                    <option value="">— اختر الموظف —</option>
                    {users.map((u) => (
                      <option key={u.uid} value={u.uid}>{u.name}</option>
                    ))}
                  </select>
                  <input type="text" value={cPct} onChange={(e) => setCPct(e.target.value)} placeholder="النسبة % (اختياري)" className="form-input" />
                  <input type="number" step="0.01" min="0.01" required value={cAmount} onChange={(e) => setCAmount(e.target.value)} placeholder="مبلغ العمولة (ج.م)" className="form-input" />
                  <input type="date" required value={cDate} onChange={(e) => setCDate(e.target.value)} className="form-input" />
                  <input type="text" value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="ملاحظات" className="form-input" />
                  <button type="submit" className="btn-primary text-xs">تسجيل عمولة</button>
                </form>
              )}

              <div className="card overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="table-head">
                      <th className="px-4 py-3 text-right">التاريخ</th>
                      <th className="px-4 py-3 text-right">الموظف</th>
                      <th className="px-4 py-3 text-right">النسبة المسجلة</th>
                      <th className="px-4 py-3 text-right">مبلغ العمولة</th>
                      <th className="px-4 py-3 text-right">ملاحظات</th>
                      {editable && <th className="px-4 py-3 text-center">حذف</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-border">
                    {commissions.map((c) => (
                      <tr key={c.id}>
                        <td className="px-4 py-2.5">{c.commission_date}</td>
                        <td className="px-4 py-2.5 font-medium">{c.employee_name}</td>
                        <td className="px-4 py-2.5">{c.commission_percentage ? `${c.commission_percentage}%` : '—'}</td>
                        <td className="px-4 py-2.5 font-semibold">{formatEgp(c.commission_amount_piasters)}</td>
                        <td className="px-4 py-2.5 text-xs text-brand-muted">{c.notes || '—'}</td>
                        {editable && (
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!profile) return;
                                await deleteCommission(c, { uid: profile.uid, name: profile.name });
                                await load();
                              }}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'balances' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-brand-muted">
                  اضغط على زر «تحصيل» بجانب أي عميل لتسجيل دفعة جديدة بطريقتها وتاريخها وتحديث المتبقي والخزنة تلقائياً.
                </div>
                <label className="flex items-center gap-2 text-xs font-medium text-brand-ink cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyRemaining}
                    onChange={(e) => setOnlyRemaining(e.target.checked)}
                  />
                  <span>عرض من عليهم متبقي فقط</span>
                </label>
              </div>
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="table-head">
                        <th className="px-4 py-3 text-right">القسم</th>
                        <th className="px-4 py-3 text-right">رقم الإيصال / الفاتورة</th>
                        <th className="px-4 py-3 text-right">العميل</th>
                        <th className="px-4 py-3 text-right">الإجمالي</th>
                        <th className="px-4 py-3 text-right">المدفوع</th>
                        <th className="px-4 py-3 text-right">المتبقي</th>
                        {editable && <th className="px-4 py-3 text-center">تحصيل</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-border">
                      {bookings
                        .filter((b) => !onlyRemaining || (b.remaining_piasters ?? 0) > 0)
                        .map((b) => (
                          <tr key={`b-${b.id}`} className="hover:bg-brand-page/60">
                            <td className="px-4 py-2.5 text-xs">{b.department === 'domestic_tourism' ? 'سياحة داخلية' : 'سياحة خارجية'}</td>
                            <td className="px-4 py-2.5 font-semibold text-brand-accent">{b.receipt_number}</td>
                            <td className="px-4 py-2.5 font-medium">{b.client_name}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">{formatEgp(b.total_piasters)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-brand-success">{formatEgp(b.paid_piasters)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-brand-accent">
                              {formatEgp(b.remaining_piasters)}
                            </td>
                            {editable && (
                              <td className="px-4 py-2.5 text-center">
                                {(b.remaining_piasters ?? 0) > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCollectTarget({
                                        kind: 'booking',
                                        id: b.id,
                                        clientName: b.client_name,
                                        reference: b.receipt_number,
                                        remainingPiasters: b.remaining_piasters,
                                      })
                                    }
                                    className="btn-primary text-xs py-1 px-3"
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>تحصيل</span>
                                  </button>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-brand-success-bg text-brand-success font-medium">
                                    خالص
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      {visaCases
                        .filter((v) => !onlyRemaining || (v.remaining_piasters ?? 0) > 0)
                        .map((v) => (
                          <tr key={`v-${v.id}`} className="hover:bg-brand-page/60">
                            <td className="px-4 py-2.5 text-xs">تأشيرات</td>
                            <td className="px-4 py-2.5 font-semibold text-brand-accent">{v.invoice_number}</td>
                            <td className="px-4 py-2.5 font-medium">{v.client_name}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">{formatEgp(v.visa_price_piasters)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-brand-success">{formatEgp(v.paid_piasters)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-brand-accent">
                              {formatEgp(v.remaining_piasters)}
                            </td>
                            {editable && (
                              <td className="px-4 py-2.5 text-center">
                                {(v.remaining_piasters ?? 0) > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCollectTarget({
                                        kind: 'visa',
                                        id: v.id,
                                        clientName: v.client_name,
                                        reference: v.invoice_number,
                                        remainingPiasters: v.remaining_piasters,
                                      })
                                    }
                                    className="btn-primary text-xs py-1 px-3"
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>تحصيل</span>
                                  </button>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-brand-success-bg text-brand-success font-medium">
                                    خالص
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      {apartments
                        .filter((a) => a.buyer_name && (!onlyRemaining || (a.remaining_piasters ?? 0) > 0))
                        .map((a) => (
                          <tr key={`a-${a.id}`} className="hover:bg-brand-page/60">
                            <td className="px-4 py-2.5 text-xs">عقارات</td>
                            <td className="px-4 py-2.5 font-semibold text-brand-accent">{a.invoice_number || '—'}</td>
                            <td className="px-4 py-2.5 font-medium">{a.buyer_name}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap">{formatEgp(a.price_piasters)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap text-brand-success">{formatEgp(a.paid_piasters)}</td>
                            <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-brand-accent">
                              {formatEgp(a.remaining_piasters)}
                            </td>
                            {editable && (
                              <td className="px-4 py-2.5 text-center">
                                {(a.remaining_piasters ?? 0) > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCollectTarget({
                                        kind: 'apartment',
                                        id: a.id,
                                        clientName: a.buyer_name,
                                        reference: a.invoice_number || a.name_or_address,
                                        remainingPiasters: a.remaining_piasters,
                                      })
                                    }
                                    className="btn-primary text-xs py-1 px-3"
                                  >
                                    <Wallet className="w-3.5 h-3.5" />
                                    <span>تحصيل</span>
                                  </button>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] bg-brand-success-bg text-brand-success font-medium">
                                    خالص
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <CollectPaymentModal
        target={collectTarget}
        onClose={() => setCollectTarget(null)}
        onConfirm={async ({ amountPiasters, paymentMethod, paymentDate, notes }) => {
          if (!profile || !collectTarget) return;
          await collectCasePayment({
            kind: collectTarget.kind,
            id: collectTarget.id,
            amount_piasters: amountPiasters,
            payment_method: paymentMethod,
            payment_date: paymentDate,
            notes,
            actor: { uid: profile.uid, name: profile.name },
          });
          await load();
        }}
      />
    </div>
  );
};
