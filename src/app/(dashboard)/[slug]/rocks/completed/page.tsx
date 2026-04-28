import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RockLinkItem } from "@/components/rocks/rock-link-item";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import { getCurrentQuarter } from "@/lib/quarter";

interface PageProps {
  params: { slug: string };
  searchParams: { q?: string; year?: string };
}

export default async function CompletedBusinessRocksPage({ params, searchParams }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
  });
  if (!business) notFound();

  const { quarter: defaultQ, year: defaultYear } = getCurrentQuarter();
  const selectedQ = parseInt(searchParams.q ?? String(defaultQ), 10) || defaultQ;
  const selectedYear = parseInt(searchParams.year ?? String(defaultYear), 10) || defaultYear;

  const rocks = await prisma.rock.findMany({
    where: { businessId: business.id, quarter: selectedQ, year: selectedYear, done: true },
    include: { owner: true, owners: { select: { name: true } }, todos: { select: { id: true, done: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/${params.slug}/rocks?q=${selectedQ}&year=${selectedYear}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Rocks
        </Link>
        <h1 className="text-3xl font-bold tracking-tight gradient-text flex items-center gap-2">
          <CheckCircle2Icon className="h-7 w-7 text-green-600" />
          Completed Rocks
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {business.name} &middot; Q{selectedQ} {selectedYear} &middot; {rocks.length} completed
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {rocks.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">No completed rocks for Q{selectedQ} {selectedYear}.</p>
        )}
        {rocks.map((rock) => (
          <RockLinkItem
            key={rock.id}
            rockId={rock.id}
            href={`/${params.slug}/rocks/${rock.id}`}
            title={rock.title}
            ownerName={rock.owners.length > 0 ? rock.owners.map((o) => o.name).join(", ") : rock.owner.name}
            done={rock.done}
            todoDone={rock.todos.filter((t) => t.done).length}
            todoTotal={rock.todos.length}
          />
        ))}
      </div>
    </div>
  );
}
