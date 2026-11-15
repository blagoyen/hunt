import React from "react";
import { Icon } from "./icons";

export function Label({ children }: { children: React.ReactNode }) {
  return <div className="label">{children}</div>;
}

export function Brand({ size = 15 }: { size?: number }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Icon name="target" size={size * 0.85} sw={1.8} />
      </span>
      <span className="brand-word">
        hunt<span className="brand-dot">.</span>
      </span>
    </span>
  );
}

export function Badge({
  children,
  variant,
}: {
  children: React.ReactNode;
  variant?: "solid" | "outline" | "risk";
}) {
  const cls = variant === "solid" ? "badge badge--solid" : variant === "outline" ? "badge badge--outline" : "badge badge--risk";
  return <span className={cls}>{children}</span>;
}

export function Button({
  children,
  onClick,
  variant,
  size,
  disabled,
  className,
  type,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost";
  size?: "sm";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const cls = ["btn", variant === "primary" ? "btn--primary" : "", size === "sm" ? "btn--sm" : "", className ?? ""]
    .join(" ")
    .trim();
  return (
    <button type={type ?? "button"} className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <span className={`toggle${on ? " is-on" : ""}`} onClick={() => onChange(!on)}>
      <span className="toggle-track">
        <i />
      </span>
      {label}
    </span>
  );
}

export function SourceChip({ source }: { source: string }) {
  return (
    <span className="src" data-source={source}>
      <span className="src-dot" />
      {source === "kp" ? "KP" : source === "halo" ? "Halo" : "Limundo"}
    </span>
  );
}

export function Empty({
  title,
  sub,
  action,
}: {
  title: string;
  sub: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <b>{title}</b>
      <span>{sub}</span>
      {action}
    </div>
  );
}
