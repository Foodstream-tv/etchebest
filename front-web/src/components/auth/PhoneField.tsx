"use client";

import { ChevronDown, Phone } from "lucide-react";
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

type PhoneFieldProps = {
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  disabled?: boolean;
};

export default function PhoneField({
  country,
  onCountryChange,
  phone,
  onPhoneChange,
  disabled = false,
}: PhoneFieldProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  return (
    <div className="relative" ref={rootRef}>
      <div className="auth-field">
        <Phone className="auth-field-icon" />

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-gray-800 transition hover:bg-black/5 dark:text-gray-100 dark:hover:bg-white/10"
          aria-label="Choisir un indicatif"
          disabled={disabled}
        >
          <span className="text-base">{country.flag}</span>
          <span>{country.code}</span>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>

        <span className="mx-1 h-6 w-px bg-black/10 dark:bg-white/10" />

        <input
          className="auth-input"
          type="tel"
          inputMode="tel"
          placeholder="Numéro de téléphone"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          autoComplete="tel"
          required
          disabled={disabled}
        />
      </div>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-2xl border border-black/8 bg-white/95 shadow-[0_18px_50px_rgba(0,0,0,0.12)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/92 dark:shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
          <div className="no-scrollbar max-h-64 overflow-auto p-1.5">
            {COUNTRY_CODES.map((item, index) => {
              const selected =
                item.country === country.country &&
                item.code === country.code &&
                item.value === country.value;

              return (
                <button
                  key={`${item.country}-${item.code}-${index}`}
                  type="button"
                  onClick={() => {
                    onCountryChange(item);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                    selected
                      ? "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300"
                      : "text-gray-800 hover:bg-black/5 dark:text-gray-100 dark:hover:bg-white/10"
                  }`}
                >
                  <span className="text-lg">{item.flag}</span>
                  <span className="flex-1 font-medium">{item.country}</span>
                  <span className="text-xs opacity-80">{item.code}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { COUNTRY_CODES };