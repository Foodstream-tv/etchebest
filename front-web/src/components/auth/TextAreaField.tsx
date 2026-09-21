"use client";

import type { LucideIcon } from "lucide-react";

import AuthFieldShell from "@/components/auth/AuthFieldShell";

type TextAreaFieldProps = Readonly<{
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  minRows?: number;
  maxLength?: number;
  hasError?: boolean;
}>;

export default function TextAreaField({
  icon: Icon,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  minRows = 4,
  maxLength,
  hasError = false,
}: TextAreaFieldProps) {
  return (
    <AuthFieldShell
      textarea
      hasError={hasError}
      icon={
        <Icon
          className="mt-0.5 h-5 w-5 self-start"
          aria-hidden="true"
        />
      }
    >
      <textarea
        className="auth-input min-h-[110px] resize-y py-0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        required={required}
        disabled={disabled}
        rows={minRows}
        maxLength={maxLength}
      />
    </AuthFieldShell>
  );
}