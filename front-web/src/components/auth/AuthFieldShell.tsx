import type { ReactNode } from "react";

type AuthFieldShellProps = Readonly<{
  icon?: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
  textarea?: boolean;
  hasError?: boolean;
}>;

export default function AuthFieldShell({
  icon,
  trailing,
  children,
  textarea = false,
  hasError = false,
}: AuthFieldShellProps) {
  return (
    <div
      className={`auth-field ${textarea ? "auth-field-textarea" : ""} ${
        hasError ? "!border-red-500/80 !ring-2 !ring-red-400/20" : ""
      }`}
    >
      {icon ? (
        <div className="auth-field-icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        {children}
      </div>

      {trailing ? (
        <div className="shrink-0">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}