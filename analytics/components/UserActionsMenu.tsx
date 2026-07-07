"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { User, isBanActive } from "@/lib/api";

export type UserAction =
  | { type: "ban"; permanent: boolean }
  | { type: "unban" }
  | { type: "delete" }
  | { type: "toggleVerified" }
  | { type: "toggleChef" }
  | { type: "toggleRole" };

const MENU_WIDTH = 224; // w-56

function MenuItem({
  label,
  danger,
  onClick,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm transition ${
        danger
          ? "text-red-400 hover:bg-red-950/50"
          : "text-gray-300 hover:bg-gray-800"
      }`}
    >
      {label}
    </button>
  );
}

export default function UserActionsMenu({
  user,
  onAction,
}: {
  user: User;
  onAction: (action: UserAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onScroll() {
      setOpen(false);
    }
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - MENU_WIDTH });
    }
    setOpen((o) => !o);
  }

  function pick(action: UserAction) {
    setOpen(false);
    onAction(action);
  }

  const banned = isBanActive(user);
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label={`Actions for @${user.username}`}
        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="fixed z-50 bg-gray-900 border border-gray-700 rounded-xl shadow-xl shadow-black/50 py-1.5 overflow-hidden"
        >
          <p className="px-4 py-1.5 text-xs text-gray-500 border-b border-gray-800 mb-1 truncate">
            @{user.username}
          </p>

          <MenuItem
            label={user.isVerified ? "Remove verification" : "Verify user"}
            onClick={() => pick({ type: "toggleVerified" })}
          />
          <MenuItem
            label={user.isFeaturedChef ? "Remove featured chef" : "Feature as chef"}
            onClick={() => pick({ type: "toggleChef" })}
          />
          <MenuItem
            label={isAdmin ? "Demote to user" : "Promote to admin"}
            onClick={() => pick({ type: "toggleRole" })}
          />

          <div className="border-t border-gray-800 my-1" />

          {banned ? (
            <MenuItem label="Unban user" onClick={() => pick({ type: "unban" })} />
          ) : (
            <>
              <MenuItem
                label="Ban temporarily…"
                danger
                onClick={() => pick({ type: "ban", permanent: false })}
              />
              <MenuItem
                label="Ban permanently…"
                danger
                onClick={() => pick({ type: "ban", permanent: true })}
              />
            </>
          )}

          <div className="border-t border-gray-800 my-1" />

          <MenuItem label="Delete user…" danger onClick={() => pick({ type: "delete" })} />
        </div>,
        document.body
      )}
    </>
  );
}
