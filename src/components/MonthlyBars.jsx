const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Days of leave used per month. One series, so the title names it and each
// month with a value carries its own label.
export function MonthlyBars({ months }) {
  const max = Math.max(1, ...months);

  return (
    <>
      <div className="grid h-40 grid-cols-12 items-end gap-1 px-3 pb-2 pt-5 sm:gap-3 sm:px-5" aria-hidden="true">
        {months.map((days, index) => (
          <div
            key={MONTHS[index]}
            title={`${MONTHS[index]}: ${days} ${days === 1 ? 'day' : 'days'}`}
            className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5"
          >
            {days > 0 && <span className="text-xs font-medium tabular-nums">{days}</span>}
            <div
              className={`w-full max-w-9 rounded-t ${days > 0 ? 'bg-accent' : 'bg-sunken'}`}
              style={{ height: days > 0 ? `${(days / max) * 72}%` : '2px' }}
            />
            <span className="text-[11px] text-muted max-sm:text-[10px]">{MONTHS[index]}</span>
          </div>
        ))}
      </div>
      <table className="sr-only">
        <caption>Leave days used per month</caption>
        <tbody>
          {months.map((days, index) => (
            <tr key={MONTHS[index]}>
              <th scope="row">{MONTHS[index]}</th>
              <td>{days}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
