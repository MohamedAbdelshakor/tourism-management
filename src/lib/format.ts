export function toPiasters(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function fromPiasters(piasters: number | undefined): string {
  return ((piasters ?? 0) / 100).toFixed(2);
}

export function formatEgp(piasters: number | undefined): string {
  const val = (piasters ?? 0) / 100;
  return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}

export function formatCurrency(minor: number, currency: string): string {
  const val = minor / 100;
  return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function maskNationalId(plain: string | null | undefined): string {
  if (!plain) return '—';
  const trimmed = plain.trim();
  if (trimmed.length <= 4) return '•'.repeat(trimmed.length);
  return '•'.repeat(trimmed.length - 4) + trimmed.slice(-4);
}

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export function arabicWeekday(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return '';
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return ARABIC_DAYS[d.getDay()] ?? '';
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}
