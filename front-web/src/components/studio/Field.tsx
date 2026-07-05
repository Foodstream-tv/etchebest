"use client";

import React, { useId } from "react";

export default function Field({
  label,
  children,
}: Readonly<{
  label: string;
  children: React.ReactElement<{ id?: string }>;
}>) {
  const id = useId();

  return (
    <div className="space-y-2.5">
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-gray-800 dark:text-white/80"
      >
        {label}
      </label>

      {React.cloneElement(children, {
        id: children.props.id ?? id,
      })}
    </div>
  );
}

