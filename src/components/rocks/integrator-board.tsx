"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { RockToggle } from "@/components/rocks/rock-toggle";
import { IntegratorCalendar } from "@/components/rocks/integrator-calendar";
import { ChevronRightIcon, BuildingIcon, UserIcon, CalendarIcon } from "lucide-react";

type RockCard = {
  id: string;
  title: string;
  ownerName: string;
  businessName: string;
  status: string;
  done: boolean;
  todoDone: number;
  todoTotal: number;
  slug: string;
};

type BusinessColumn = {
  businessName: string;
  businessSlug: string;
  rocks: RockCard[];
};

const STATUS_COLORS: Record<string, string> = {
  "not-started": "bg-gray-100 text-gray-600",
  "in-progress": "bg-blue-100 text-blue-700",
  "at-risk": "bg-red-100 text-red-700",
  complete: "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  "not-started": "Not Started",
  "in-progress": "In Progress",
  "at-risk": "At Risk",
  complete: "Complete",
};

type CalendarRock = {
  id: string;
  title: string;
  ownerName: string;
  businessName: string;
  slug: string;
  targetDate: string;
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
  endDate: string;
  done: boolean;
};

export function IntegratorBoard({
  byBusiness,
  byOwner,
  quarters,
  selectedQ,
  selectedYear,
  totalRocks,
  doneRocks,
  calendarRocks,
  calendarMilestones,
}: {
  byBusiness: Record<string, BusinessColumn>;
  byOwner: Record<string, BusinessColumn>;
  quarters: { quarter: number; year: number }[];
  selectedQ: number;
  selectedYear: number;
  totalRocks: number;
  doneRocks: number;
  calendarRocks: CalendarRock[];
  calendarMilestones: CalendarMilestone[];
}) {
  const router = useRouter();
  const [groupBy, setGroupBy] = useState<"company" | "owner" | "calendar">("company");
  const columns = Object.values(groupBy === "company" ? byBusiness : byOwner);
  const HeaderIcon = groupBy === "company" ? BuildingIcon : groupBy === "owner" ? UserIcon : CalendarIcon;

  function handleQuarterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const [q, y] = e.target.value.split("-");
    router.push(`/integrator?q=${q}&year=${y}`);
  }

  const progress = totalRocks > 0 ? Math.round((doneRocks / totalRocks) * 100) : 0;

  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0 animate-fade-in-up">
      {/* Controls bar */}
      <div className="flex items-center gap-4 shrink-0">
        <select
          value={`${selectedQ}-${selectedYear}`}
          onChange={handleQuarterChange}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm font-medium"
        >
          {quarters.map((q) => (
            <option key={`${q.quarter}-${q.year}`} value={`${q.quarter}-${q.year}`}>
              Q{q.quarter} {q.year}
            </option>
          ))}
        </select>
        <div className="inline-flex rounded-md border bg-card p-0.5">
          <button
            onClick={() => setGroupBy("company")}
            className={`px-3 h-8 text-xs font-medium rounded ${
              groupBy === "company" ? "gradient-primary text-white" : "text-muted-foreground"
            }`}
          >
            By Company
          </button>
          <button
            onClick={() => setGroupBy("owner")}
            className={`px-3 h-8 text-xs font-medium rounded ${
              groupBy === "owner" ? "gradient-primary text-white" : "text-muted-foreground"
            }`}
          >
            By Owner
          </button>
          <button
            onClick={() => setGroupBy("calendar")}
            className={`px-3 h-8 text-xs font-medium rounded flex items-center gap-1 ${
              groupBy === "calendar" ? "gradient-primary text-white" : "text-muted-foreground"
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            Calendar
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {doneRocks}/{totalRocks} complete ({progress}%)
          </span>
          <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Calendar view */}
      {groupBy === "calendar" && (
        <IntegratorCalendar rocks={calendarRocks} milestones={calendarMilestones} />
      )}

      {/* Kanban board */}
      {groupBy !== "calendar" && (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-4 overflow-y-auto flex-1 min-h-0">
        {columns.length === 0 && (
          <p className="text-sm text-muted-foreground py-8">
            No rocks found for this quarter.
          </p>
        )}

        {columns.map((col) => {
          const colDone = col.rocks.filter((r) => r.done).length;
          return (
            <div
              key={col.businessSlug}
              className="flex flex-col h-[420px] bg-muted/30 rounded-lg border min-w-0"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b gradient-primary text-white rounded-t-lg">
                <HeaderIcon className="h-4 w-4 shrink-0" />
                <span className="font-semibold text-sm truncate">
                  {col.businessName}
                </span>
                <span className="ml-auto text-xs bg-white/20 px-2 py-0.5 rounded-full shrink-0">
                  {colDone}/{col.rocks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
                {col.rocks.map((rock) => (
                  <div
                    key={rock.id}
                    className={`rounded-lg border bg-card p-3 shrink-0 card-interactive ${
                      rock.done ? "opacity-60" : ""
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className="mt-0.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <RockToggle rockId={rock.id} done={rock.done} />
                      </div>
                      <Link
                        href={`/${rock.slug}/rocks/${rock.id}?from=integrator`}
                        className="flex-1 min-w-0"
                      >
                        <p
                          className={`text-sm font-medium leading-snug ${
                            rock.done
                              ? "line-through text-muted-foreground"
                              : ""
                          }`}
                        >
                          {rock.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {groupBy === "owner" ? rock.businessName : rock.ownerName}
                          </span>
                          {rock.todoTotal > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {rock.todoDone}/{rock.todoTotal} to-dos
                            </span>
                          )}
                        </div>
                      </Link>
                      <Link
                        href={`/${rock.slug}/rocks/${rock.id}?from=integrator`}
                        className="shrink-0 mt-0.5"
                      >
                        <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[rock.status] || STATUS_COLORS["not-started"]
                        }`}
                      >
                        {STATUS_LABELS[rock.status] || "Not Started"}
                      </span>
                      {rock.todoTotal > 0 && (
                        <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{
                              width: `${Math.round(
                                (rock.todoDone / rock.todoTotal) * 100
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
