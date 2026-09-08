"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";

/* ---------------------------------------------------------------------------
 * Finder menu — macOS-style navigation sheet opened with the "/" key.
 * Sections mirror the app's real route tree so it doubles as a site map.
 * --------------------------------------------------------------------------- */

type MenuItem = {
  href: string;
  label: string;
  section: string;
};

const MENU_ITEMS: MenuItem[] = [
  // ── Dashboard ──────────────────────────────────────────────────────────
  { href: "/", label: "Dashboard", section: "Dashboard" },
  { href: "/", label: "Find a student (admission no)", section: "Dashboard" },
  { href: "/", label: "Search by name", section: "Dashboard" },
  { href: "/", label: "Daily stats", section: "Dashboard" },
  { href: "/", label: "Blackmark threshold prompt", section: "Dashboard" },

  // ── Student ────────────────────────────────────────────────────────────
  { href: "/student/0", label: "Student profile — strikes / blackmarks / gold marks", section: "Students" },
  { href: "/student/0", label: "Student — punishments", section: "Students" },
  { href: "/student/0", label: "Student — comments", section: "Students" },

  // ── Discipline records ─────────────────────────────────────────────────
  { href: "/discipline", label: "All records (chronological feed)", section: "Records" },
  { href: "/discipline", label: "Strikes", section: "Records" },
  { href: "/discipline", label: "Black marks", section: "Records" },
  { href: "/discipline", label: "Gold marks", section: "Records" },
  { href: "/discipline", label: "Punishments", section: "Records" },
  { href: "/discipline", label: "Comments", section: "Records" },
  { href: "/discipline", label: "Filter by date range", section: "Records" },
  { href: "/discipline", label: "Filter by student / issuer", section: "Records" },
  { href: "/discipline", label: "Clear all strikes (superuser)", section: "Records" },
  { href: "/discipline", label: "Generate report (superuser)", section: "Records" },

  // ── Lists ──────────────────────────────────────────────────────────────
  { href: "/lists", label: "Lists overview", section: "Lists" },
  { href: "/lists/create", label: "Create a new list", section: "Lists" },
  { href: "/lists/0", label: "List detail — student roster", section: "Lists" },
  { href: "/lists/0", label: "List — bulk strikes / blackmarks", section: "Lists" },
  { href: "/lists/0", label: "List — selection mode", section: "Lists" },
  { href: "/lists/0", label: "List — attendance mode", section: "Lists" },
  { href: "/lists/0/attendance/0", label: "Attendance session detail", section: "Lists" },

  // ── Users ──────────────────────────────────────────────────────────────
  { href: "/users", label: "User management", section: "Users" },
  { href: "/users", label: "Add new user (superuser)", section: "Users" },
  { href: "/users", label: "Edit user role / password", section: "Users" },
  { href: "/users", label: "Delete user (superuser)", section: "Users" },

  // ── Account ────────────────────────────────────────────────────────────
  { href: "/authenticate", label: "Sign in", section: "Account" },
  { href: "/authenticate", label: "Log out", section: "Account" },
  { href: "/", label: "Change password (user menu)", section: "Account" },
];

const SECTION_ORDER = [
  "Dashboard",
  "Students",
  "Records",
  "Lists",
  "Users",
  "Account",
];

function useFinderOpen(initial = false) {
  const [open, setOpen] = useState(initial);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  const openOnce = useCallback(() => setOpen(true), []);
  return { open, setOpen, toggle, close, openOnce };
}

interface FinderMenuProps {
  enabled?: boolean;
}

export default function FinderMenu({ enabled = true }: FinderMenuProps) {
  const { open, setOpen } = useFinderOpen();
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Gather the flat, filtered item list whenever it changes.
  const items = SECTION_ORDER.flatMap((section) =>
    MENU_ITEMS.filter((it) => it.section === section).map((it) => ({ ...it })),
  );

  // Reset selection when the menu opens or the item list changes.
  useEffect(() => {
    setSelectedIndex(0);
  }, [open, items.length]);

  // The "/" key is the macOS Finder shortcut for Go To Folder.
  // The listener is attached only while the feature is enabled; toggling
  // it off removes the listener so "/" stops working immediately.
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Ignore when the user is typing into a form field.
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable;
      if (typing) return;

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled]);

  // Focus the filter field when the menu opens. It has autoFocus,
  // but calling focus() explicitly guarantees it (React autoFocus can
  // lose the race with the dialog animation frame).
  useEffect(() => {
    if (!open) return;
    // Defer until the dialog is in the DOM / after the opening animation frame.
    requestAnimationFrame(() => {
      const input = listRef.current?.querySelector<HTMLInputElement>("input");
      if (input) {
        input.focus();
        input.select();
      }
    });
  }, [open]);

  // Move the focus ring as the user arrows through the list.
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) el.focus();
  }, [selectedIndex]);

  // Click / tap outside closes the menu (like a macOS popover).
  useEffect(() => {
    if (!open) return;
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (listRef.current && !listRef.current.contains(target)) {
        close();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, close]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const n = items.length;
      if (n === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, n - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Home":
          e.preventDefault();
          setSelectedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setSelectedIndex(n - 1);
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          const href = items[selectedIndex]?.href;
          if (href) {
            window.location.href = href;
            close();
          }
          break;
        case "Escape":
          e.preventDefault();
          close();
          break;
      }
    },
    [items, selectedIndex, close],
  );

  // Build the section -> items grouping for rendering.
  const grouped = SECTION_ORDER.map((section) => ({
    section,
    items: items.filter((it) => it.section === section),
  }));

  // Trailhead hint text
  const hint =
    typeof window !== "undefined"
      ? `/${items.length} items`
      : "/ …";

  return (
    <>
      {/* Non-interactive trailhead hint so the user knows "/" exists */}
      {enabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none select-none fixed bottom-6 right-6 z-40 text-[11px] font-medium tracking-wide text-label-tertiary opacity-70 hover:opacity-100 transition-opacity"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          <span className="inline-flex items-center gap-1.5 bg-surface/80 border border-hairline rounded-full px-3 py-1.5 shadow-sm backdrop-blur-sm">
            <svg
              className="w-3.5 h-3.5 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              style={{ transform: "rotate(45deg)", display: "inline-block" }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.25}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Go to
            <span className="text-accent font-semibold">/</span>
            <span className="opacity-60">·</span>
            <span className="opacity-50">esc</span>
          </span>
        </div>
      )}

      {/* Overlay — dim the page and lock scrolling */}
      {open && (
        <div
          onClick={close}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          style={{ pointerEvents: "auto" }}
        />
      )}

      {/* Finder window */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Go to page — type to filter, arrow keys to move, Enter to open"
          ref={listRef}
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(92vw,680px)] rounded-2xl border border-hairline bg-surface shadow-sheet overflow-hidden animate-[sheet-in_0.22s_var(--ease-apple,_if-enabled)]"
          style={{ maxHeight: "min(88vh, 680px)" }}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-hairline">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold text-label truncate">
                Go to page
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-label-tertiary font-medium tabular-nums">
                {hint}
              </span>
              <button
                type="button"
                onClick={close}
                aria-label="Close Go to page"
                className="w-7 h-7 flex items-center justify-center rounded-full text-label-secondary hover:text-label hover:bg-fill transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Filter field */}
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-label-tertiary pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Filter pages…"
                className="w-full bg-surface-secondary border border-hairline rounded-xl pl-9 pr-8 py-2 text-sm text-label placeholder-label-tertiary focus:border-accent focus:outline-none"
                onInput={(e) => {
                  // Re-filter and reset selection when the user types.
                  const q = (e.currentTarget.value || "").trim().toLowerCase();
                  if (!q) {
                    setSelectedIndex(0);
                    return;
                  }
                  const match = items.findIndex(
                    (it) =>
                      it.label.toLowerCase().includes(q) ||
                      it.section.toLowerCase().includes(q),
                  );
                  if (match >= 0) setSelectedIndex(match);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.stopPropagation();
                    const q = (e.currentTarget.value || "").trim().toLowerCase();
                    const filtered =
                      q.length === 0
                        ? items
                        : items.filter(
                            (it) =>
                              it.label.toLowerCase().includes(q) ||
                              it.section.toLowerCase().includes(q),
                          );
                    if (filtered.length === 0) return;
                    const cur = e.currentTarget.value;
                    const prev = items.findIndex(
                      (it) =>
                        it.label.toLowerCase().includes(cur.toLowerCase()) ||
                        it.section.toLowerCase().includes(cur.toLowerCase()),
                    );
                    if (e.key === "ArrowDown") {
                      setSelectedIndex(
                        Math.min(
                          prev + 1,
                          filtered.findIndex((f) =>
                            f.label.toLowerCase().includes(cur.toLowerCase()) ||
                            f.section.toLowerCase().includes(cur.toLowerCase()),
                          ) < 0
                            ? 0
                            : filtered.findIndex((f) =>
                                f.label.toLowerCase().includes(cur.toLowerCase()) ||
                                f.section.toLowerCase().includes(cur.toLowerCase()),
                              ) + 1,
                        ),
                      );
                    }
                  } else if (e.key === "Escape") {
                    e.currentTarget.blur();
                    close();
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const q = (e.currentTarget.value || "").trim().toLowerCase();
                    const filtered =
                      q.length === 0
                        ? items
                        : items.filter(
                            (it) =>
                              it.label.toLowerCase().includes(q) ||
                              it.section.toLowerCase().includes(q),
                          );
                    const target = filtered[selectedIndex] ?? filtered[0];
                    if (target) {
                      window.location.href = target.href;
                      close();
                    }
                  }
                }}
                onFocus={(e) => {
                  // Sync selection to first visible item on focus.
                  const q = (e.currentTarget.value || "").trim().toLowerCase();
                  const filtered =
                    q.length === 0
                      ? items
                      : items.filter(
                          (it) =>
                            it.label.toLowerCase().includes(q) ||
                            it.section.toLowerCase().includes(q),
                        );
                  if (filtered.length > 0) setSelectedIndex(0);
                }}
              />
              <kbd
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-label-tertiary bg-fill border border-hairline rounded px-1.5 py-0.5"
                aria-hidden="true"
              >
                esc
              </kbd>
            </div>
          </div>

          {/* List — sections with headers */}
          <div
            className="overflow-y-auto px-2 pb-3 pt-1"
            style={{ scrollbarWidth: "thin", scrollbarColor: "var(--fill) transparent" }}
          >
            {grouped.map(({ section, items: sectionItems }) => (
              <section key={section} className="mt-1 first:mt-0">
                {/* Section header — macOS Finder sidebar headings */}
                <div className="px-3 pt-2 pb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
                    {section}
                  </span>
                </div>
                <ul className="space-y-0.5" role="list">
                  {sectionItems.map((item, idx) => {
                    const globalIndex = items.indexOf(item);
                    const selected = globalIndex === selectedIndex;
                    return (
                      <li key={`${section}-${item.label}`}>
                        <a
                          href={item.href}
                          ref={(el) => {
                            itemRefs.current[globalIndex] = el;
                          }}
                          onClick={(e) => {
                            // Let the browser navigate on click; close the menu.
                            close();
                          }}
                          className={`block w-full px-3 py-2 rounded-lg text-sm text-left transition-colors group ${
                            selected
                              ? "bg-accent/12 text-accent font-semibold"
                              : "text-label hover:bg-fill hover:text-label"
                          }`}
                          aria-current={selected ? "true" : undefined}
                        >
                          <span className="block truncate pr-6">{item.label}</span>
                          {/* Chevron on the right, like Finder custom actions */}
                          <svg
                            className={`absolute right-2.5 w-4 h-4 transition-transform ${
                              selected ? "translate-x-0.5" : "translate-x-0 opacity-40 group-hover:opacity-70"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {items.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-label-tertiary">
                No pages match “{/* filter text */}”.
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="border-t border-hairline px-4 py-2.5 flex items-center justify-between text-[11px] text-label-tertiary">
            <span className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              Type to filter
            </span>
            <span className="flex items-center gap-1.5">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 11l5-5m0 0l5 5m-5-5v12"
                />
              </svg>
              Enter to open
            </span>
          </div>
        </div>
      )}
    </>
  );
}
