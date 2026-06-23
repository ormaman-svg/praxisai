import Link from "next/link";

/**
 * Consistent page header used across the app.
 * eyebrow (optional) · title · subtitle on the start side, actions on the end.
 */
export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  children,
  className = "",
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  icon?: React.ElementType;
  children?: React.ReactNode; // action buttons
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div className="flex items-start gap-3.5">
        {Icon && (
          <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-white shadow-glow">
            <Icon size={20} />
          </div>
        )}
        <div>
          {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </div>
  );
}

/** A back link shown above a page title on detail pages. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-500 transition-colors hover:text-brand-700"
    >
      <span className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
      {label}
    </Link>
  );
}
