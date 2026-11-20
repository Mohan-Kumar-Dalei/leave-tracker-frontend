import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { MonthlyBars } from './MonthlyBars';
import { LoadError, PageHeading, Panel, PanelTitle, Reveal, RowsSkeleton, SelectBox, StickyTop } from './ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((name) => name.slice(0, 3));
const number = (value) => (Number.isInteger(value) ? value : value.toFixed(1));
// Months with no leave show 0.
const cell = (value) => number(value ?? 0);

function Stat({ label, value, accent = false }) {
  return (
    <div className="bg-surface px-4 py-4 sm:px-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 text-[28px] font-semibold leading-9 tabular-nums ${accent ? 'text-accent' : ''}`}>{number(value)}</dd>
    </div>
  );
}

// The team's tracker sheet, kept by the app: one line per person (or per
// department), their Leave Balance and Leave Availed for the year, the leave
// taken in each month, and a Total line. Casual/Sick leave by default, like
// the sheet; any other type, or all of them, can be chosen.
function SheetTable({ data, month, onDepartment }) {
  const people = data.rowKind === 'person';
  const totals = data.summary;
  const head = 'px-3 py-2 text-right font-medium';
  const monthHead = (index) => `${head} ${index === month - 1 ? 'bg-accent-soft text-accent' : ''}`;
  const monthCell = (index) => `px-3 py-2 text-right tabular-nums ${index === month - 1 ? 'bg-accent-soft/60' : ''}`;

  return (
    <div className="max-h-[520px] overflow-auto">
      <table className="w-full min-w-[960px] border-separate border-spacing-0 text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="text-xs text-muted">
            <th className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2 text-left font-medium sm:px-5">
              {people ? 'Name' : 'Department'}
            </th>
            {!people && <th className={`${head} border-b border-line`}>People</th>}
            <th className={`${head} border-b border-line`}>Leave Balance</th>
            <th className={`${head} border-b border-line`}>Leave Availed</th>
            {SHORT.map((name, index) => (
              <th key={name} className={`${monthHead(index)} border-b border-line`}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.employeeId ?? row.name} className="hover:bg-bg">
              <td className="sticky left-0 border-b border-line bg-surface px-4 py-2 sm:px-5">
                {!people && data.canChooseDepartment ? (
                  <button
                    type="button"
                    onClick={() => onDepartment(row.name)}
                    className="font-medium text-accent hover:underline underline-offset-4"
                  >
                    {row.name}
                  </button>
                ) : (
                  <span className="block whitespace-nowrap font-medium">{row.name}</span>
                )}
                {row.employeeId && <span className="block whitespace-nowrap text-xs text-muted">{row.employeeId}</span>}
              </td>
              {!people && <td className="border-b border-line px-3 py-2 text-right tabular-nums">{row.people}</td>}
              <td className="border-b border-line px-3 py-2 text-right font-medium tabular-nums">{number(row.balance)}</td>
              <td className="border-b border-line px-3 py-2 text-right font-medium tabular-nums">{number(row.availed)}</td>
              {row.months.map((days, index) => (
                <td key={SHORT[index]} className={`${monthCell(index)} border-b border-line`}>
                  {cell(days)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {/* The Total line, like the sheet's last row; it stays in view. */}
        <tfoot className="sticky bottom-0 bg-surface">
          <tr className="font-semibold">
            <td className="sticky left-0 border-t-2 border-line bg-surface px-4 py-2.5 sm:px-5">Total</td>
            {!people && <td className="border-t-2 border-line px-3 py-2.5 text-right tabular-nums">{totals.people}</td>}
            <td className="border-t-2 border-line px-3 py-2.5 text-right tabular-nums">{number(totals.balance)}</td>
            <td className="border-t-2 border-line px-3 py-2.5 text-right tabular-nums">{number(totals.availed)}</td>
            {totals.months.map((days, index) => (
              <td key={SHORT[index]} className={`${monthCell(index)} border-t-2 border-line`}>
                {number(days)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// The Leave Tracker's "Leave totals" page. A manager picks any department (or
// all of them); everyone else sees their own department. The leave type and
// the month can be chosen. Managers and assistant managers see the sheet
// person by person; employees see their department's totals.
export function LeaveTotalsPage() {
  const [department, setDepartment] = useState('all');
  const [month, setMonth] = useState(null);
  const [type, setType] = useState(null);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['team-totals', department, month, type],
    queryFn: () => {
      const params = new URLSearchParams();
      if (department !== 'all') params.set('department', department);
      if (month) params.set('month', String(month));
      if (type) params.set('type', type);
      return api.get(`/team/totals${params.size ? `?${params}` : ''}`);
    },
    placeholderData: keepPreviousData,
  });
  const shownMonth = month ?? data?.month;
  const scope = data ? (data.department === 'all' ? 'All departments' : data.department) : '';
  const typeName = data ? (data.type ? data.type.name : 'All leave types') : '';

  return (
    <div>
      <StickyTop>
        <PageHeading
          title="Leave totals"
          actions={
            data && (
              <>
                {data.canChooseDepartment && (
                  <SelectBox aria-label="Department" className="w-52" value={department} onChange={(event) => setDepartment(event.target.value)}>
                    <option value="all">All departments</option>
                    {data.departments.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </SelectBox>
                )}
                <SelectBox
                  aria-label="Leave type"
                  className="w-52"
                  value={type ?? data.type?.code ?? 'all'}
                  onChange={(event) => setType(event.target.value)}
                >
                  {data.types.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                  <option value="all">All leave types</option>
                </SelectBox>
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
          {data ? `${scope} · ${typeName} · ${data.year}` : ' '}
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
                <Stat label="Leave Balance" value={data.summary.balance} accent />
                <Stat label={`Leave Availed in ${data.year}`} value={data.summary.availed} />
                <Stat label={`Taken in ${data.monthName}`} value={data.summary.takenInMonth} />
              </dl>
            </Panel>
          </Reveal>

          {data.rows.length > 0 && (
            <Reveal delay={0.04}>
              <Panel>
                <PanelTitle>{data.rowKind === 'person' ? `${data.department}, person by person` : 'By department'}</PanelTitle>
                <SheetTable data={data} month={shownMonth} onDepartment={setDepartment} />
              </Panel>
            </Reveal>
          )}

          <Reveal delay={0.08}>
            <Panel>
              <PanelTitle>Taken month by month, {data.year}</PanelTitle>
              <MonthlyBars months={data.months} />
            </Panel>
          </Reveal>
        </div>
      )}
    </div>
  );
}
