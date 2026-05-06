import React from "react";

export default function AuthFieldShell({
  icon,
  trailing,
  children,
  textarea = false,
}: {
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
  textarea?: boolean;
}) {
  return (
    <div className={`auth-field ${textarea ? "auth-field-textarea" : ""}`}>
      {icon ? <div className="auth-field-icon">{icon}</div> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}
