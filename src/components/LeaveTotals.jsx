import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Panel, PanelTitle } from './ui';

const number = (value) => (Number.isInteger(value) ? value : value.toFixed(1));

// Totals everyone can see: for the whole company and for each department
// (managers and assistant managers included), the days still available, the
// days applied for this year and the days taken this month.
export function LeaveTotals() {
  const { data } = useQuery({ queryKey: ['team-totals'], queryFn: () => api.get('/team/totals') });
  if (!data) return null;

  const stats = [
    ['People', data.company.people],
    ['Available balance', data.company.available],
    [`Applied in ${data.year}`, data.company.applied],
    [`Taken in ${data.month}`, data.company.takenThisMonth],
  ];

  return (
    <Panel>
      <PanelTitle>Leave totals, all departments</PanelTitle>
      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-4">
        {stats.map(([label, value], index) => (
          <div key={label} className="bg-surface px-4 py-3 sm:px-5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className={`mt-1 text-2xl font-semibold tabular-nums ${index === 1 ? 'text-accent' : ''}`}>{number(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-4 py-2 font-medium sm:px-5">Department</th>
              <th className="px-3 py-2 text-right font-medium">People</th>
              <th className="px-3 py-2 text-right font-medium">Available</th>
              <th className="px-3 py-2 text-right font-medium">Applied ({data.year})</th>
              <th className="px-4 py-2 text-right font-medium sm:px-5">Taken ({data.month})</th>
            </tr>
          </thead>
          <tbody>
            {data.departments.map((row) => (
              <tr key={row.name} className="border-t border-line">
                <td className="px-4 py-2 font-medium sm:px-5">{row.name}</td>
                <td className="px-3 py-2 text-right tabular-nums">{row.people}</td>
                <td className="px-3 py-2 text-right tabular-nums">{number(row.available)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{number(row.applied)}</td>
                <td className="px-4 py-2 text-right tabular-nums sm:px-5">{number(row.takenThisMonth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
