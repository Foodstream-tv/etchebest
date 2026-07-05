"use client";

import type { HTMLAttributes, HTMLInputTypeAttribute } from "react";
import type { LucideIcon } from "lucide-react";

import AuthFieldShell from "@/components/auth/AuthFieldShell";

type TextFieldProps = Readonly<{
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: HTMLInputTypeAttribute;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
}>;

export default function TextField({
  icon: Icon,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete,
  required = false,
  disabled = false,
  inputMode,
  maxLength,
}: TextFieldProps) {
  return (
    <AuthFieldShell
      icon={
        <Icon
          className="h-5 w-5"
          aria-hidden="true"
        />
      }
    >
      <input
        className="auth-input"
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
      />
    </AuthFieldShell>
  );
}