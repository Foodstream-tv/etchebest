"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import AuthFieldShell from "@/components/auth/AuthFieldShell";

type TextAreaFieldProps = {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
  minRows?: number;
  maxLength?: number;
};

export default function TextAreaField({
  icon: Icon,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  minRows = 4,
  maxLength,
}: TextAreaFieldProps) {
  return (
    <AuthFieldShell icon={<Icon className="mt-0.5 h-5 w-5 self-start" />} textarea>
      <textarea
        className="auth-input min-h-[110px] resize-y py-0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={minRows}
        maxLength={maxLength}
      />
    </AuthFieldShell>
  );
}
