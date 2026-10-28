import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  Bell,
  BrainCircuit,
  ChartNoAxesCombined,
  Clock3,
  Cpu,
  House,
  RefreshCw,
  ShieldCheck,
  UserRound,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { useTranslation } from "../utils/translate";
import PushSetup from "./PushSetup";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-mark">
        <Zap size={21} fill="currentColor" />
      </span>
      <span>
        Watt<span className="brand-light">Watcher</span>
      </span>
    </span>
  );
}

const destinations = [
  ["/", "home", House],
  ["/history", "history", Clock3],
  ["/analysis", "analysis", ChartNoAxesCombined],
  ["/insights", "insights", BrainCircuit],
  ["/profile", "profile", UserRound],
];
export function Navigation() {
  const { t } = useTranslation();
  const item = ([path, key, Icon]) => (
    <NavLink
      end={path === "/"}
      key={path}
      to={path}
      className={({ isActive }) => `nav-item ${isActive ? "is-active" : ""}`}
    >
      <Icon size={20} />
      <span>{t(key)}</span>
    </NavLink>
  );
  return (
    <>
      <aside className="sidebar">
        <Link to="/" aria-label="WattWatcher">
          <Brand />
        </Link>
        <p className="nav-caption">{t("workspace")}</p>
        <nav aria-label={t("mainNavigation")}>
          {destinations.map(item)}
          <div className="nav-divider" />
          {[
            ["/devices", "devices", Cpu],
            ["/alerts", "usageAlerts", Bell],
          ].map(item)}
        </nav>
      </aside>
      <nav className="bottom-nav" aria-label={t("mainNavigation")}>
        {destinations.map(item)}
      </nav>
    </>
  );
}

export function AppLayout({ children }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  const name =
    user?.appUser?.full_name || user?.firebaseUser?.displayName || t("profile");
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        {t("skipContent")}
      </a>
      <Navigation />
      <div className="app-body">
        <header className="topbar">
          <Link className="mobile-brand" to="/">
            <Brand />
          </Link>
          <span className="desktop-context">{t("energyWorkspace")}</span>
          <div className="topbar-actions">
            <Link
              to="/devices"
              className="icon-button"
              aria-label={t("devices")}
            >
              <Cpu size={20} />
            </Link>
            <Link
              to="/alerts"
              className="icon-button"
              aria-label={t("usageAlerts")}
            >
              <Bell size={20} />
            </Link>
            <Link to="/profile" className="avatar" aria-label={t("profile")}>
              {name.charAt(0).toUpperCase()}
            </Link>
          </div>
        </header>
        <main id="main-content" className="page-content" tabIndex={-1}>
          {children}
          <PushSetup />
        </main>
        <footer className="app-footer">
          <span>WattWatcher</span>
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="page-action">{action}</div>}
    </div>
  );
}
export function Card({ children, className = "", ...props }) {
  return (
    <section className={`panel ${className}`} {...props}>
      {children}
    </section>
  );
}
export function CardTitle({ icon: Icon, title, action }) {
  return (
    <div className="card-heading">
      <h2>
        {Icon && <Icon size={18} />}
        {title}
      </h2>
      {action}
    </div>
  );
}
export function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Stat({ label, value, hint, icon: Icon = Zap, tone = "blue" }) {
  return (
    <Card className="stat-card">
      <div className={`stat-icon tone-${tone}`}>
        <Icon size={19} />
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </Card>
  );
}
export function LoadingState() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("loadingData")} className="loading-grid">
      <span className="sr-only">{t("loadingData")}</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="panel skeleton-card">
          <div className="skeleton w-1/3" />
          <div className="skeleton h-10 w-2/3" />
          <div className="skeleton w-full" />
        </div>
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Activity,
}) {
  return (
    <Card className="empty-state">
      <span className="empty-icon">
        <Icon size={29} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </Card>
  );
}
export function ErrorState({ onRetry, message }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="error-state">
      <Activity size={20} />
      <div>
        <strong>{t("apiError")}</strong>
        <p>{message || t("retryHint")}</p>
      </div>
      {onRetry && (
        <button className="button secondary" onClick={onRetry}>
          <RefreshCw size={15} />
          {t("retry")}
        </button>
      )}
    </div>
  );
}
export function MeterSelect({ devices, value, onChange }) {
  const { t } = useTranslation();
  return devices.length ? (
    <label className="meter-select">
      <Cpu size={16} />
      <span className="sr-only">{t("selectMeter")}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.device_name}
          </option>
        ))}
      </select>
    </label>
  ) : null;
}
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={key === value}
          className={key === value ? "selected" : ""}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
export function TextLink({ to, children }) {
  return (
    <Link className="text-link" to={to}>
      {children}
      <ArrowRight size={15} />
    </Link>
  );
}

export function EnergyGauge({ value, limit, format, label }) {
  const id = useId().replace(/:/g, "");
  const percent =
    limit > 0 ? Math.max(0, (Number(value) / Number(limit)) * 100) : 0;
  const circumference = 2 * Math.PI * 88;
  return (
    <div
      className="energy-gauge"
      role="img"
      aria-label={`${label}: ${format(value)}, ${percent.toFixed(1)}%`}
    >
      <svg viewBox="0 0 220 220" aria-hidden="true">
        <defs>
          <linearGradient id={id}>
            <stop stopColor="var(--primary)" />
            <stop
              offset="1"
              stopColor={
                percent >= 100
                  ? "#F87171"
                  : percent >= 80
                    ? "#FBBF24"
                    : "var(--violet)"
              }
            />
          </linearGradient>
        </defs>
        <circle className="gauge-outer" cx="110" cy="110" r="103" />
        <circle className="gauge-track" cx="110" cy="110" r="88" />
        <circle
          className="gauge-value"
          cx="110"
          cy="110"
          r="88"
          stroke={`url(#${id})`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(percent, 100) / 100)}
        />
      </svg>
      <div>
        <span>{label}</span>
        <strong>{format(value).split(" ")[0]}</strong>
        <small>{format(value).split(" ").slice(1).join(" ")}</small>
        <b>{percent.toFixed(1)}%</b>
      </div>
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  const ref = useRef(null),
    id = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const keydown = (e) => {
      if (e.key === "Escape") close.current();
      if (e.key !== "Tab") return;
      const controls = [
        ...ref.current.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select, a[href], [tabindex="0"]',
        ),
      ];
      const first = controls[0],
        last = controls.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, []);
  const { t } = useTranslation();
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className="modal-card"
      >
        <div className="card-heading">
          <h2 id={id}>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("close")}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}

export function AuthLayout({ children }) {
  const { t } = useTranslation();
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <h2>
            <span>{t("authHeadline")}</span>
            <span>{t("authHeadlineSecond")}</span>
          </h2>
          <p>{t("authDescription")}</p>
          <div className="auth-orbit" aria-hidden="true">
            <div>
              <Zap size={50} />
            </div>
            <span className="orbit-dot one" />
            <span className="orbit-dot two" />
          </div>
          <div className="auth-benefits">
            {[
              [Activity, "meterReadings"],
              [ChartNoAxesCombined, "usageTrends"],
              [Bell, "alertsLabel"],
            ].map(([Icon, key]) => (
              <span key={key}>
                <Icon size={18} />
                {t(key)}
              </span>
            ))}
          </div>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-card">{children}</div>
        <p className="auth-foot">
          <ShieldCheck size={15} />
          {t("authSecurity")}
        </p>
      </main>
    </div>
  );
}

export function AuthInput({ label, icon: Icon, error, action, ...props }) {
  const id = useId();
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        {Icon && <Icon size={17} />}
        <input
          id={id}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
        {action}
      </div>
      {error && (
        <p className="field-error" role="alert" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}
