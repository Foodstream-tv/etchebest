"use client";

import { ComponentProps, ReactNode } from "react";


type Props = ComponentProps<"input"> & { icon?: ReactNode };


export default function Input({ icon, className, ...props }: Props) {
    return (
        <label className="block">
        <div className="field">
        {icon}
        <input className={`input ${className ?? ""}`} {...props} />
        </div>
        </label>
    );
}
