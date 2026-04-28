"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, TargetIcon, MilestoneIcon } from "lucide-react";

type CalendarRock = {
  id: string;
  title: string;
  ownerName: string;
  businessName: string;
  slug: string;
  targetDate: string; // ISO date string
  status: string;
  done: boolean;
};

type CalendarMilestone = {
  id: string;
  title: string;
  rockTitle: string;
  rockId: string;
  slug: string;
  businessName: string;
  ownerName: string;
  endDate: string; // ISO date string
  done: boolean;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function IntegratorCalendar({
  rocks,
  milestones,
}: {
  rocks: CalendarRock[];
  milestones: CalendarMilestone[];
}) {
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function goToday() {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
  }

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay = new Date(viewYear, viewMonth + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  // Build a map: dateKey -> items
  const dateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const rocksByDate: Record<string, CalendarRock[]> = {};
  for (const r of rocks) {
    const d = new Date(r.targetDate + "T12:00:00");
    const key = dateKey(d);
    if (!rocksByDate[key]) rocksByDate[key] = [];
    rocksByDate[key].push(r);
  }

  const milestonesByDate: Record<string, CalendarMilestone[]> = {};
  for (const m of milestones) {
    const d = new Date(m.endDate + "T12:00:00");
    const key = dateKey(d);
    if (!milestonesByDate[key]) milestonesByDate[key] = [];
    milestonesByDate[key].push(m);
  }

  const todayKey = dateKey(today);

  // Build grid cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  // Pad to fill last row
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Month nav */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </button>
        <h2 className="text-lg font-semibold min-w-[180px] text-center">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h2>
        <button
          onClick={nextMonth}
          className="p-1.5 rounded-md hover:bg-accent transition-colors"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </button>
        <button
          onClick={goToday}
          className="text-xs font-medium px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
        >
          Today
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px shrink-0">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-xs font-semibold text-muted-foreground text-center py-2"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden flex-1 min-h-0">
        {cells.map((day, i) => {
          if (day === null) {
            return (
              <div key={`empty-${i}`} className="bg-muted/20 min-h-[100px]" />
            );
          }

          const cellDate = new Date(viewYear, viewMonth, day);
          const key = dateKey(cellDate);
          const isToday = key === todayKey;
          const cellRocks = rocksByDate[key] || [];
          const cellMilestones = milestonesByDate[key] || [];

          return (
            <div
              key={key}
              className={`bg-card min-h-[100px] p-1.5 flex flex-col gap-0.5 overflow-hidden ${
                isToday ? "ring-2 ring-primary ring-inset" : ""
              }`}
            >
              {/* Day number */}
              <span
                className={`text-xs font-medium self-end px-1.5 py-0.5 rounded-full ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {day}
              </span>

              {/* Rocks - emphasized */}
              {cellRocks.map((r) => (
                <Link
                  key={r.id}
                  href={`/${r.slug}/rocks/${r.id}?from=integrator`}
                  className={`block rounded px-1.5 py-1 text-xs font-bold transition-colors ${
                    r.status === "at-risk"
                      ? "bg-red-500 text-white"
                      : "bg-primary text-primary-foreground"
                  }`}
                  title={`Rock: ${r.title}\n${r.ownerName} · ${r.businessName}`}
                >
                  <span className="flex items-center gap-1">
                    <TargetIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{r.title}</span>
                  </span>
                  <span className="text-[9px] opacity-80 truncate block">
                    {r.ownerName} &middot; {r.businessName}
                  </span>
                </Link>
              ))}

              {/* Milestones - subdued */}
              {cellMilestones.map((m) => (
                <Link
                  key={m.id}
                  href={`/${m.slug}/rocks/${m.rockId}?from=integrator`}
                  className="block rounded px-1.5 py-0.5 text-[10px] transition-colors bg-muted text-muted-foreground hover:bg-accent"
                  title={`Milestone: ${m.title}\nRock: ${m.rockTitle}\n${m.ownerName} · ${m.businessName}`}
                >
                  <span className="flex items-center gap-1">
                    <MilestoneIcon className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{m.title}</span>
                  </span>
                  <span className="text-[9px] opacity-70 truncate block">
                    {m.ownerName} &middot; {m.businessName}
                  </span>
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 shrink-0 pt-1">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded bg-primary" />
          Rock Due Date
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded bg-red-500" />
          At Risk
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300" />
          Completed
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-block w-3 h-3 rounded bg-muted border" />
          Milestone
        </div>
      </div>
    </div>
  );
}
