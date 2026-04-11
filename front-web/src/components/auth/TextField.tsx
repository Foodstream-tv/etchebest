"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import AuthFieldShell from "@/components/auth/AuthFieldShell";

type TextFieldProps = {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
};

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
    <AuthFieldShell icon={<Icon className="h-5 w-5" />}>
      <input
        className="auth-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
      />
    </AuthFieldShell>
  );
}