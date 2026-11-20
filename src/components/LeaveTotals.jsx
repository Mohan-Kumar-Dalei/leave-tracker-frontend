import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { MonthlyBars } from './MonthlyBars';
import { LoadError, PageHeading, Panel, PanelTitle, Reveal, RowsSkeleton, SelectBox, StickyTop } from './ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const number = (value) => (Number.isInteger(value) ? value : value.toFixed(1));

function Stat({ label, value, accent = false }) {
  return (
    <div className="bg-surface px-4 py-4 sm:px-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-[28px] font-semibold leading-9 tabular-nums ${accent ? 'text-accent' : ''}`}>{number(value)}</dd>
    </div>
  );
}

// The Leave Tracker's "Leave totals" page. A manager picks any department (or
// all of them); everyone else sees their own department. Any month of the
// year can be chosen for "Taken". Managers and assistant managers also see
// each person's figures when one department is chosen.
export function LeaveTotalsPage() {
  const [department, setDepartment] = useState('all');
  const [month, setMonth] = useState(null);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['team-totals', department, month],
    queryFn: () => {
      const params = new URLSearchParams();
      if (department !== 'all') params.set('department', department);
      if (month) params.set('month', String(month));
      return api.get(`/team/totals${params.size ? `?${params}` : ''}`);
    },
    placeholderData: keepPreviousData,
  });
  const shownMonth = month ?? data?.month;
  const scope = data ? (data.department === 'all' ? 'All departments' : data.department) : '';

  return (
    <div>
      <StickyTop>
        <PageHeading
          title="Leave totals"
          actions={
            data && (
              <>
                {data.canChooseDepartment && (
                  <SelectBox
                    aria-label="Department"
                    className="w-56"
                    value={department}
                    onChange={(event) => setDepartment(event.target.value)}
                  >
                    <option value="all">All departments</option>
                    {data.departments.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </SelectBox>
                )}
                <SelectBox
                  aria-label="Month"
                  className="w-44"
                  value={String(shownMonth ?? '')}
                  onChange={(event) => setMonth(Number(event.target.value))}
                >
                  {MONTHS.map((name, index) => (
                    <option key={name} value={String(index + 1)}>
                      {`${name} ${data.year}`}
                    </option>
                  ))}
                </SelectBox>
              </>
            )
          }
        >
          {data
            ? `${scope}: balance still available, leave applied in ${data.year} and taken in ${data.monthName}.`
            : ' '}
        </PageHeading>
      </StickyTop>

      {isPending && <RowsSkeleton rows={5} />}
      {isError && <LoadError error={error} onRetry={refetch} />}

      {data && (
        <div className="space-y-4">
          <Reveal>
            <Panel>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line lg:grid-cols-4">
                <Stat label="People" value={data.summary.people} />
                <Stat label="Available balance" value={data.summary.available} accent />
                <Stat label={`Applied in ${data.year}`} value={data.summary.applied} />
                <Stat label={`Taken in ${data.monthName}`} value={data.summary.takenInMonth} />
              </dl>
            </Panel>
          </Reveal>

          {/* Full width, one under the other, so no card is left with an
              empty bottom beside a longer one. */}
          <Reveal delay={0.04}>
            <Panel>
              <PanelTitle>Taken month by month, {data.year}</PanelTitle>
              <MonthlyBars months={data.months} />
            </Panel>
          </Reveal>

          {data.rows.length > 0 && (
            <Reveal delay={0.08}>
              <Panel>
                <PanelTitle>{data.rowKind === 'person' ? `People in ${data.department}` : 'By department'}</PanelTitle>
                {(
                  <div className="max-h-[460px] overflow-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="sticky top-0 bg-surface">
                        <tr className="text-left text-xs text-muted">
                          <th className="px-4 py-2 font-medium sm:px-5">{data.rowKind === 'person' ? 'Person' : 'Department'}</th>
                          {data.rowKind === 'department' && <th className="px-3 py-2 text-right font-medium">People</th>}
                          <th className="px-3 py-2 text-right font-medium">Available</th>
                          <th className="px-3 py-2 text-right font-medium">Applied ({data.year})</th>
                          <th className="px-4 py-2 text-right font-medium sm:px-5">Taken ({data.monthName})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row) => (
                          <tr key={row.employeeId ?? row.name} className="border-t border-line">
                            <td className="px-4 py-2 sm:px-5">
                              {data.rowKind === 'department' && data.canChooseDepartment ? (
                                <button
                                  type="button"
                                  onClick={() => setDepartment(row.name)}
                                  className="font-medium text-accent hover:underline underline-offset-4"
                                >
                                  {row.name}
                                </button>
                              ) : (
                                <span className="font-medium">{row.name}</span>
                              )}
                              {row.employeeId && (
                                <span className="block text-xs text-muted">{`${row.employeeId} · ${row.designation}`}</span>
                              )}
                            </td>
                            {data.rowKind === 'department' && <td className="px-3 py-2 text-right tabular-nums">{row.people}</td>}
                            <td className="px-3 py-2 text-right tabular-nums">{number(row.available)}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{number(row.applied)}</td>
                            <td className="px-4 py-2 text-right tabular-nums sm:px-5">{number(row.takenInMonth)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </Reveal>
          )}
        </div>
      )}
    </div>
  );
}
