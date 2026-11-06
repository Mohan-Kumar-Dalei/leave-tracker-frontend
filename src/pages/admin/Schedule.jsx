import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { EntryPanel, PAST_FILTERS, UPCOMING_FILTERS } from '../../components/EntryPanel';
import { IconButton, LoadError, PageHeading, Reveal } from '../../components/ui';
import { api, toQuery } from '../../lib/api';

export default function Schedule() {
  const [year, setYear] = useState(null);

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-schedule', year],
    queryFn: () => api.get(`/admin/schedule${toQuery({ year })}`),
    placeholderData: keepPreviousData,
  });

  if (isError && !data) return <LoadError error={error} onRetry={refetch} />;

  const shownYear = data?.year ?? new Date().getFullYear();

  return (
    <div className="space-y-4">
      <PageHeading
        title="Upcoming & past"
        actions={
          <div className="flex items-center rounded-lg border border-line bg-surface shadow-card">
            <IconButton label="Previous year" onClick={() => setYear(shownYear - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <p className="px-2 text-[13px] font-medium tabular-nums">{shownYear}</p>
            <IconButton label="Next year" onClick={() => setYear(shownYear + 1)}>
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
        }
      >
        Team leaves and holidays for the year.
      </PageHeading>

      <Reveal delay={0.04}>
        <EntryPanel label="Filter upcoming" filters={UPCOMING_FILTERS} entries={data?.upcoming ?? []} loading={isPending} />
      </Reveal>
      <Reveal delay={0.08}>
        <EntryPanel label="Filter past" filters={PAST_FILTERS} entries={data?.past ?? []} loading={isPending} scroll />
      </Reveal>
    </div>
  );
}
