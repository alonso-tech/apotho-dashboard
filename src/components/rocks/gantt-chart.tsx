"use client";

type Milestone = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  done: boolean;
};

type GanttTodo = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  done: boolean;
  killed: boolean;
  milestoneId: string | null;
};

// Parse any date string to a UTC midnight timestamp (strips time component)
function toUTCDay(dateStr: string): number {
  const d = new Date(dateStr);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function todayUTC(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

const MS_PER_DAY = 86400000;

export function GanttChart({
  milestones,
  todos = [],
  targetCompletionDate,
}: {
  milestones: Milestone[];
  todos?: GanttTodo[];
  targetCompletionDate: string | null;
}) {
  if (milestones.length === 0 && todos.length === 0) return null;

  const todayMs = todayUTC();

  // Collect all dates for range (as UTC day timestamps)
  const allDates: number[] = [todayMs];
  for (const m of milestones) {
    allDates.push(toUTCDay(m.startDate), toUTCDay(m.endDate));
  }
  for (const t of todos) {
    allDates.push(toUTCDay(t.startDate), toUTCDay(t.endDate));
  }
  if (targetCompletionDate) {
    allDates.push(toUTCDay(targetCompletionDate));
  }

  const rangeMin = Math.min(...allDates) - 3 * MS_PER_DAY;
  const rangeMax = Math.max(...allDates) + 3 * MS_PER_DAY;
  const totalDays = Math.max(1, Math.round((rangeMax - rangeMin) / MS_PER_DAY));

  function dayOffset(dateStr: string): number {
    return Math.round((toUTCDay(dateStr) - rangeMin) / MS_PER_DAY);
  }

  function todayOffsetDays(): number {
    return Math.round((todayMs - rangeMin) / MS_PER_DAY);
  }

  // Bi-monthly labels: 1st and 15th of each month
  const ticks: { label: string; offset: number }[] = [];
  const startD = new Date(rangeMin);
  let curYear = startD.getUTCFullYear();
  let curMonth = startD.getUTCMonth();
  while (true) {
    for (const day of [1, 15]) {
      const ts = Date.UTC(curYear, curMonth, day);
      if (ts > rangeMax) break;
      if (ts >= rangeMin) {
        const d = new Date(ts);
        const monthStr = d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
        ticks.push({
          label: `${monthStr} ${day}`,
          offset: Math.round((ts - rangeMin) / MS_PER_DAY),
        });
      }
    }
    const lastTick = Date.UTC(curYear, curMonth, 15);
    if (lastTick > rangeMax) break;
    curMonth++;
    if (curMonth > 11) { curMonth = 0; curYear++; }
  }

  const sorted = [...milestones].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );

  // Group todos by milestone
  const todosByMilestone: Record<string, GanttTodo[]> = {};
  const unlinkedTodos: GanttTodo[] = [];
  for (const t of todos) {
    if (t.milestoneId) {
      (todosByMilestone[t.milestoneId] ??= []).push(t);
    } else {
      unlinkedTodos.push(t);
    }
  }

  const labelWidth = 180;
  const pxPerDay = 4;
  const chartMinWidth = `${totalDays * pxPerDay}px`;

  function barColor(done: boolean, endDate: string, isTodo?: boolean, killed?: boolean) {
    const opacity = isTodo ? "/70" : "";
    if (killed) return `bg-red-400${opacity}`;
    if (done) return `bg-green-500${opacity}`;
    if (isTodo && toUTCDay(endDate) < todayMs) return `bg-amber-400${opacity}`;
    if (toUTCDay(endDate) < todayMs) return `bg-red-400${opacity}`;
    return `bg-blue-500${opacity}`;
  }

  function renderBar(item: { id: string; title: string; startDate: string; endDate: string; done: boolean; killed?: boolean }, isTodo: boolean) {
    const isKilled = !!item.killed;
    const start = dayOffset(item.startDate);
    const end = dayOffset(item.endDate);
    const width = Math.max(1, end - start);
    const pctLeft = (start / totalDays) * 100;
    const pctWidth = (width / totalDays) * 100;
    const barHeight = isTodo ? "h-5" : "h-7";
    const labelPad = isTodo ? "pl-4" : "";
    const barInner = isTodo ? "top-1.5 bottom-1.5" : "top-1 bottom-1";

    return (
      <div key={item.id} className={`flex items-center ${barHeight} gap-2`}>
        <div
          className={`shrink-0 truncate text-xs pr-2 text-right cursor-default ${labelPad} ${
            isKilled ? "line-through text-red-400/70" : isTodo ? "text-muted-foreground" : "font-medium"
          }`}
          style={{ width: `${labelWidth}px` }}
          title={item.title}
        >
          {isTodo && <span className="text-muted-foreground/50 mr-1">└</span>}
          {item.title}
        </div>
        <div
          className={`relative flex-1 ${barHeight} ${isTodo ? "bg-muted/20" : "bg-muted/30"} rounded`}
          style={{ minWidth: chartMinWidth }}
        >
          {/* Today marker */}
          <div
            className="absolute top-0 bottom-0 w-px bg-orange-400 z-10"
            style={{ left: `${(todayOffsetDays() / totalDays) * 100}%` }}
          />
          {/* Target marker */}
          {targetCompletionDate && !isTodo && (
            <div
              className="absolute top-0 bottom-0 w-px bg-red-400 z-10 border-dashed"
              style={{ left: `${(dayOffset(targetCompletionDate) / totalDays) * 100}%` }}
            />
          )}
          {/* Bar */}
          <div
            className={`absolute ${barInner} rounded-sm ${barColor(item.done, item.endDate, isTodo, isKilled)}`}
            style={{ left: `${pctLeft}%`, width: `${pctWidth}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 overflow-x-auto">
      {/* Timeline labels (1st & 15th) */}
      <div className="relative h-6" style={{ marginLeft: labelWidth, minWidth: chartMinWidth }}>
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute text-[10px] text-muted-foreground font-medium"
            style={{ left: `${(t.offset / totalDays) * 100}%` }}
          >
            {t.label}
          </span>
        ))}
      </div>

      {/* Milestone rows with nested todo sub-bars */}
      {sorted.map((m) => (
        <div key={m.id} className="flex flex-col">
          {renderBar(m, false)}
          {(todosByMilestone[m.id] || []).map((t) => renderBar(t, true))}
        </div>
      ))}

      {/* Unlinked todos with dates */}
      {unlinkedTodos.length > 0 && (
        <div className="flex flex-col mt-1 pt-1 border-t border-dashed border-muted">
          {unlinkedTodos.map((t) => renderBar(t, true))}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-muted-foreground" style={{ marginLeft: labelWidth }}>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-blue-500 rounded-sm inline-block" /> In Progress
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-green-500 rounded-sm inline-block" /> Complete
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-amber-400 rounded-sm inline-block" /> Overdue To-Do
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-red-400 rounded-sm inline-block" /> Overdue
        </span>
        {todos.length > 0 && (
          <>
            <span className="flex items-center gap-1">
              <span className="w-3 h-1.5 bg-blue-500/70 rounded-sm inline-block" /> To-Do
            </span>
            {todos.some((t) => t.killed) && (
              <span className="flex items-center gap-1">
                <span className="w-3 h-1.5 bg-red-400/70 rounded-sm inline-block" /> Killed
              </span>
            )}
          </>
        )}
        <span className="flex items-center gap-1">
          <span className="w-px h-3 bg-orange-400 inline-block" /> Today
        </span>
        {targetCompletionDate && (
          <span className="flex items-center gap-1">
            <span className="w-px h-3 bg-red-400 inline-block" /> Target
          </span>
        )}
      </div>
    </div>
  );
}
