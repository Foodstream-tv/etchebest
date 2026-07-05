"use client";

import type { ComponentProps, ReactNode } from "react";

type Props = Readonly<
  ComponentProps<"input"> & {
    icon?: ReactNode;
    label?: string;
  }
>;

export default function Input({
  icon,
  label,
  id,
  className = "",
  ...props
}: Props) {
  return (
    <div className="block">
      {label ? (
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
      ) : null}

      <div className="field">
        {icon ? (
          <span aria-hidden="true">
            {icon}
          </span>
        ) : null}

        <input
          id={id}
          aria-label={!label ? props.placeholder : undefined}
          className={`input ${className}`}
          {...props}
        />
      </div>
    </div>
  );
}