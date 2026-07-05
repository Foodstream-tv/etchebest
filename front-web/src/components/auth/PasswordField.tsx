"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";

import AuthFieldShell from "@/components/auth/AuthFieldShell";

type PasswordFieldProps = Readonly<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
}>;

export default function PasswordField({
  value,
  onChange,
  placeholder = "Mot de passe",
  autoComplete = "current-password",
  required = true,
  disabled = false,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <AuthFieldShell
      icon={<Lock className="h-5 w-5" aria-hidden="true" />}
      trailing={
        <button
          type="button"
          onClick={() => setShow((prev) => !prev)}
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={show}
          disabled={disabled}
          className="rounded-lg p-1 text-gray-500 transition hover:bg-black/5 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-200"
        >
          {show ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      }
    >
      <input
        className="auth-input"
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
      />
    </AuthFieldShell>
  );
}