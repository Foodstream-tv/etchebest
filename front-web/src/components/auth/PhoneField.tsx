"use client";

import { Phone, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type CountryCode = {
  code: string;
  country: string;
  flag: string;
  value: number;
};

const COUNTRY_CODES: CountryCode[] = [
  { code: "+33", country: "France", flag: "🇫🇷", value: 33 },
  { code: "+1", country: "États-Unis", flag: "🇺🇸", value: 1 },
  { code: "+1", country: "Canada", flag: "🇨🇦", value: 1 },
  { code: "+44", country: "Royaume-Uni", flag: "🇬🇧", value: 44 },
  { code: "+49", country: "Allemagne", flag: "🇩🇪", value: 49 },
  { code: "+34", country: "Espagne", flag: "🇪🇸", value: 34 },
  { code: "+39", country: "Italie", flag: "🇮🇹", value: 39 },
  { code: "+32", country: "Belgique", flag: "🇧🇪", value: 32 },
  { code: "+41", country: "Suisse", flag: "🇨🇭", value: 41 },
  { code: "+352", country: "Luxembourg", flag: "🇱🇺", value: 352 },
  { code: "+212", country: "Maroc", flag: "🇲🇦", value: 212 },
  { code: "+213", country: "Algérie", flag: "🇩🇿", value: 213 },
  { code: "+216", country: "Tunisie", flag: "🇹🇳", value: 216 },
];

export default function PhoneField({
  country,
  onCountryChange,
  phone,
  onPhoneChange,
}: {
  country: CountryCode;
  onCountryChange: (c: CountryCode) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="field focus-within:ring-2 focus-within:ring-amber-400" ref={ref}>
      <Phone className="h-5 w-5 text-gray-600" />

      {/* Country picker */}
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-gray-800 hover:bg-gray-100"
        aria-label="Choisir un indicatif"
      >
        <span className="text-base">{country.flag}</span>
        <span className="font-medium">{country.code}</span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      <span className="mx-1 h-6 w-px bg-gray-200" />

      {/* Phone input */}
      <input
        className="input"
        inputMode="tel"
        placeholder="Numéro de téléphone"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value)}
        autoComplete="tel"
        required
      />

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border bg-white shadow-lg">
          <div className="max-h-64 overflow-auto p-1">
            {COUNTRY_CODES.map((c, idx) => (
              <button
                key={`${c.value}-${idx}`}
                type="button"
                onClick={() => {
                  onCountryChange(c);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  c.value === country.value ? "bg-amber-50" : ""
                }`}
              >
                <span className="text-lg">{c.flag}</span>
                <span className="flex-1 font-medium text-gray-900">{c.country}</span>
                <span className="text-gray-600">{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { COUNTRY_CODES };
