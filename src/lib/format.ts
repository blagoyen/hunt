export function eur(n: number, digits = 0): string {
  const v = n;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  const whole = digits > 0 ? abs.toFixed(digits) : Math.round(abs).toString();
  return `${sign}€${whole}`;
}

export function eurMoney(n: number): string {
  return `${Math.round(n).toString().padStart(2, "0")}€`;
}

export function pct(n: number, digits = 0): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const v = (abs * 100).toFixed(digits);
  return `${sign}${v}%`;
}

export function days(n: number): string {
  if (n < 1) return "<1";
  if (n < 2) return "1";
  if (n < 30) return `${Math.round(n)}d`;
  if (n < 60) return `${Math.round(n / 30)}m`;
  return `${Math.round(n / 365)}y`;
}

export function dateStr(iso: string): string {
  const d = new Date(iso);
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mo}-${da}`;
}
