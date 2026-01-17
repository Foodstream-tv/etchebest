"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";

export default function PasswordField({
  value,
  onChange,
  placeholder = "Mot de passe",
  autoComplete = "current-password",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="field focus-within:ring-2 focus-within:ring-amber-400">
      <Lock className="h-5 w-5 text-gray-600" />
      <input
        className="input"
        type={show ? "text" : "password"}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        className="rounded p-1 text-gray-600 hover:bg-gray-100"
      >
        {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
      </button>
    </div>
  );
}
