import React, { useEffect } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { X } from 'lucide-react';
import type { SignalGroupDetail } from '../../types/api';
import { getActionMeta, getAlertMeta, getMatchColor, getStatusMeta } from '../../utils/status';
import { featureLabel, SIGNAL_GROUPS } from '../../three/signals';

/* ------------------------------------------------------------------ brand */

/** The mark: one heartbeat whose last beat is a different person. */
export const PulseMark: React.FC<{ size?: number; beat?: string; className?: string }> = ({
  size = 22,
  beat = '#e11d48',
  className = '',
}) => (
  <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
    <path
      d="M2 17h7l2.5-6 4 13 3.5-10 2 3h3"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="26.5" cy="17" r="2.6" fill={beat} />
  </svg>
);

export const Wordmark: React.FC<{ className?: string; size?: 'sm' | 'md' | 'lg' }> = ({ className = '', size = 'md' }) => {
  const s = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-[17px]' : 'text-xl';
  const m = size === 'lg' ? 30 : size === 'sm' ? 18 : 22;
  return (
    <span className={`inline-flex items-center gap-2 text-paper ${className}`}>
      <PulseMark size={m} />
      <span className={`font-serif ${s} leading-none tracking-tight`}>
        Trust<span className="italic">pulse</span>
      </span>
    </span>
  );
};

/* ------------------------------------------------------------- typography */

export const Label: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`label ${className}`}>{children}</div>
);

export const PageHead: React.FC<{
  no: string;
  kicker: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  right?: React.ReactNode;
}> = ({ no, kicker, title, lede, right }) => (
  <header className="grid grid-cols-1 gap-6 border-b border-line pb-7 lg:grid-cols-[1fr_auto] lg:items-end">
    <div className="animate-rise">
      <div className="label flex items-center gap-3">
        <span className="text-paper">{no}</span>
        <span className="h-px w-8 bg-line-2" />
        <span>{kicker}</span>
      </div>
      <h1 className="mt-4 font-serif text-[44px] leading-[0.95] tracking-tight text-paper md:text-[64px]">{title}</h1>
      {lede && <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-paper-2">{lede}</p>}
    </div>
    {right && <div className="animate-rise [animation-delay:120ms]">{right}</div>}
  </header>
);

export const Section: React.FC<{
  label: string;
  title?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ label, title, right, className = '', children }) => (
  <section className={`border-t border-line pt-5 ${className}`}>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <Label>{label}</Label>
        {title && <h2 className="mt-1.5 font-serif text-[28px] leading-none text-paper">{title}</h2>}
      </div>
      {right}
    </div>
    {children}
  </section>
);

/* ---------------------------------------------------------------- numbers */

export const Stat: React.FC<{
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  color?: string;
  big?: boolean;
  className?: string;
}> = ({ label, value, unit, sub, color, big, className = '' }) => (
  <div className={className}>
    <Label>{label}</Label>
    <div
      className={`tnum mt-2 font-mono font-medium leading-none tracking-tight ${big ? 'text-[44px]' : 'text-[30px]'}`}
      style={{ color: color ?? 'var(--color-paper)' }}
    >
      {value}
      {unit && <span className="ml-1 text-[0.45em] text-mute">{unit}</span>}
    </div>
    {sub && <div className="mt-2 text-[12px] text-mute">{sub}</div>}
  </div>
);

/* ------------------------------------------------------------------- tags */

const Tagged: React.FC<{ hex: string; text: string; size?: 'sm' | 'md' | 'lg'; title?: string }> = ({ hex, text, size = 'sm', title }) => {
  const cls = size === 'lg' ? 'text-[13px] gap-2' : size === 'md' ? 'text-[11.5px] gap-1.5' : 'text-[10.5px] gap-1.5';
  const dot = size === 'lg' ? 'h-2.5 w-2.5' : 'h-2 w-2';
  return (
    <span title={title} className={`inline-flex items-center whitespace-nowrap font-mono uppercase tracking-[0.1em] ${cls}`} style={{ color: hex }}>
      <span className={`${dot} shrink-0 rounded-[1px]`} style={{ background: hex }} />
      {text}
    </span>
  );
};

export const ActionTag: React.FC<{ action: string; size?: 'sm' | 'md' | 'lg' }> = ({ action, size }) => {
  const m = getActionMeta(action);
  return <Tagged hex={m.hex} text={m.label} size={size} title={m.plain} />;
};

export const StatusTag: React.FC<{ status: string; size?: 'sm' | 'md' | 'lg' }> = ({ status, size }) => {
  const m = getStatusMeta(status);
  return <Tagged hex={m.hex} text={m.label} size={size} />;
};

export const AlertTag: React.FC<{ type: string; size?: 'sm' | 'md' | 'lg' }> = ({ type, size }) => {
  const m = getAlertMeta(type);
  return <Tagged hex={m.hex} text={m.label} size={size} />;
};

/** Hairline gauge: a 1px track with a solid run and a tick at the value. */
export const Meter: React.FC<{ value: number | null | undefined; color?: string; className?: string; thick?: boolean }> = ({
  value,
  color = 'var(--color-paper)',
  className = '',
  thick,
}) => {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className={`relative ${thick ? 'h-[5px]' : 'h-[3px]'} w-full bg-line ${className}`}>
      {value != null && (
        <div className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out" style={{ width: `${v}%`, background: color }} />
      )}
    </div>
  );
};

/** Trust as a number + gauge, coloured by the decision it produced. */
export const TrustCell: React.FC<{ trust: number; action: string }> = ({ trust, action }) => {
  const hex = getActionMeta(action).hex;
  return (
    <div className="flex w-28 items-center gap-2.5">
      <span className="tnum w-7 text-right font-mono text-[13px] text-paper">{trust}</span>
      <Meter value={trust} color={hex} className="flex-1" />
    </div>
  );
};

/* ---------------------------------------------------------------- buttons */

type Variant = 'solid' | 'line' | 'ghost' | 'danger' | 'go';
const VARIANT: Record<Variant, string> = {
  solid: 'bg-paper text-ink hover:bg-white',
  line: 'border border-line-2 text-paper hover:border-paper',
  ghost: 'text-paper-2 hover:text-paper',
  danger: 'border border-review/60 text-[#ff6b86] hover:bg-review hover:text-white hover:border-review',
  go: 'border border-allow/60 text-allow hover:bg-allow hover:text-ink hover:border-allow',
};
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-[3px] px-4 py-2.5 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35';

export const Btn: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }> = ({
  variant = 'line',
  className = '',
  ...rest
}) => <button {...rest} className={`${btnBase} ${VARIANT[variant]} ${className}`} />;

export const LinkBtn: React.FC<LinkProps & { variant?: Variant }> = ({ variant = 'line', className = '', ...rest }) => (
  <Link {...rest} className={`${btnBase} ${VARIANT[variant]} ${className}`} />
);

/** Inline text link with an arrow that moves. */
export const Arrow: React.FC<LinkProps> = ({ children, className = '', ...rest }) => (
  <Link {...rest} className={`group inline-flex items-center gap-1.5 text-[13px] text-paper-2 transition hover:text-paper ${className}`}>
    <span className="border-b border-line-2 pb-px group-hover:border-paper">{children}</span>
    <span className="transition-transform group-hover:translate-x-0.5">→</span>
  </Link>
);

/* ----------------------------------------------------------------- states */

export const Loading: React.FC<{ message?: string }> = ({ message = 'Loading' }) => (
  <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5">
    <svg width="180" height="40" viewBox="0 0 180 40" className="text-paper" aria-hidden>
      <path
        d="M0 22h50l6-12 9 24 8-18 5 6h102"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="220"
        className="[animation:dash_1.6s_linear_infinite]"
      />
      <style>{'@keyframes dash{from{stroke-dashoffset:440}to{stroke-dashoffset:0}}'}</style>
    </svg>
    <div className="label">{message}</div>
  </div>
);

export const ErrorBlock: React.FC<{ title?: string; message: string; onRetry?: () => void }> = ({
  title = 'Engine not reachable',
  message,
  onRetry,
}) => (
  <div className="mx-auto my-16 max-w-xl border-l-2 border-review pl-6">
    <Label className="!text-review">Signal lost</Label>
    <h2 className="mt-2 font-serif text-4xl text-paper">{title}</h2>
    <p className="mt-3 font-mono text-[13px] text-paper-2">{message}</p>
    <p className="mt-2 text-[13px] text-mute">
      Is the backend running? <code className="font-mono text-paper-2">python start.py</code> starts both halves.
    </p>
    {onRetry && (
      <Btn variant="line" className="mt-6" onClick={onRetry}>
        Try again
      </Btn>
    )}
  </div>
);

export const Empty: React.FC<{ title: string; children?: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
  <div className={`flex flex-col items-center justify-center py-16 text-center ${className}`}>
    <svg width="120" height="24" viewBox="0 0 120 24" className="text-line-2" aria-hidden>
      <path d="M0 12h120" stroke="currentColor" strokeWidth="1.5" />
    </svg>
    <div className="mt-5 font-serif text-2xl text-paper">{title}</div>
    {children && <div className="mt-2 max-w-sm text-[13px] text-mute">{children}</div>}
  </div>
);

/* ----------------------------------------------------------------- overlays */

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  side?: 'center' | 'right';
  width?: string;
  children: React.ReactNode;
  label?: string;
}> = ({ open, onClose, side = 'center', width = 'max-w-2xl', children, label }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`fixed inset-0 z-50 flex bg-ink/80 backdrop-blur-[3px] ${side === 'right' ? 'justify-end' : 'items-center justify-center p-4'}`}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full ${width} overflow-y-auto border-line-2 bg-ink-2 ${
          side === 'right' ? 'h-full border-l animate-[rise_.35s_ease-out]' : 'max-h-[92vh] border animate-rise'
        }`}
      >
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 z-10 p-1 text-mute hover:text-paper">
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        {children}
      </div>
    </div>
  );
};

export const Confirm: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, message, confirmLabel, destructive, busy, onConfirm, onCancel }) => (
  <Modal open={open} onClose={onCancel} width="max-w-md" label={title}>
    <div className="p-7">
      <Label className={destructive ? '!text-review' : ''}>{destructive ? 'Irreversible' : 'Confirm'}</Label>
      <h3 className="mt-2 pr-6 font-serif text-3xl leading-tight text-paper">{title}</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-paper-2">{message}</p>
      <div className="mt-7 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Btn>
        <Btn variant={destructive ? 'danger' : 'go'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working' : confirmLabel}
        </Btn>
      </div>
    </div>
  </Modal>
);

/* ---------------------------------------------------------- signal readout */

/** Per-signal behaviour match, with the feature that drifted most. */
export const SignalReadout: React.FC<{ signals?: Record<string, SignalGroupDetail>; large?: boolean }> = ({ signals, large }) => (
  <div className={large ? 'space-y-4' : 'space-y-3.5'}>
    {SIGNAL_GROUPS.map((g) => {
      const s = signals?.[g.id];
      const m = s?.match;
      const top = s?.top?.[0];
      return (
        <div key={g.id}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className={large ? 'text-[17px] text-paper' : 'text-[13px] text-paper'}>{g.label}</span>
            <span className={`tnum font-mono ${large ? 'text-[15px]' : 'text-[12px]'}`} style={{ color: m == null ? 'var(--color-dim)' : getMatchColor(m) }}>
              {m == null ? 'no data' : `${m}%`}
            </span>
          </div>
          <Meter value={m} color={getMatchColor(m)} thick={large} />
          {top && m != null && m < 60 && (
            <div className="mt-1 font-mono text-[11px] text-mute">
              furthest: {featureLabel(top[0])} {Number(top[1]).toFixed(1)}σ
            </div>
          )}
        </div>
      );
    })}
  </div>
);

/** Two-column key/value rows separated by hairlines. */
export const KV: React.FC<{ rows: [string, React.ReactNode][]; className?: string }> = ({ rows, className = '' }) => (
  <dl className={`divide-y divide-line border-y border-line ${className}`}>
    {rows.map(([k, v]) => (
      <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
        <dt className="label">{k}</dt>
        <dd className="text-right font-mono text-[12.5px] text-paper">{v}</dd>
      </div>
    ))}
  </dl>
);
