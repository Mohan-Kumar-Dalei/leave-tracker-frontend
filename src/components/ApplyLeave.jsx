import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { dayWord, slashDate } from '../lib/dates';
import { useToast } from '../lib/toast';
import { Button, Dialog, SelectField, TextArea, TextInput } from './ui';

const SESSIONS = [
  ['full', 'Full day'],
  ['first', 'First half'],
  ['second', 'Second half'],
];

function ApplyForm({ today, preset, formId, onDone, onBusy }) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: typeData } = useQuery({ queryKey: ['leave-types'], queryFn: () => api.get('/leave-types') });
  const types = useMemo(() => (typeData?.items ?? []).filter((type) => type.isActive), [typeData]);

  const [leaveTypeId, setLeaveTypeId] = useState(preset?.leaveTypeId ?? '');
  const [from, setFrom] = useState(preset?.from ?? today);
  const [to, setTo] = useState(preset?.to ?? today);
  const [session, setSession] = useState('full');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const selectedId = leaveTypeId || types[0]?.id || '';
  const selected = types.find((type) => type.id === selectedId);
  const restricted = Boolean(selected?.restrictedHolidayOnly);
  const year = (from || today).slice(0, 4);

  const { data: holidayData } = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => api.get(`/holidays?year=${year}`),
    enabled: restricted,
  });
  const restrictedHolidays = (holidayData?.items ?? []).filter((holiday) => holiday.restricted);

  const singleDay = from === to;
  const usedSession = singleDay && !restricted ? session : 'full';

  // Asks the server what this leave would use, so the numbers match its rules.
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    setPreview(null);
    if (!selectedId || !from || !to) return undefined;

    let active = true;
    const timer = setTimeout(() => {
      api
        .post('/leaves/preview', { leaveTypeId: selectedId, from, to, session: usedSession })
        .then((result) => active && setPreview({ ...result, error: null }))
        .catch((issue) => active && setPreview({ error: issue.message }));
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedId, from, to, usedSession]);

  const submit = useMutation({
    mutationFn: () =>
      api.post('/leaves', { leaveTypeId: selectedId, from, to, session: usedSession, reason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Request sent', 'Your admin has been told by mail and on their dashboard.');
      onDone();
    },
    onError: (issue) => setError(issue.message),
  });

  useEffect(() => onBusy(submit.isPending), [submit.isPending, onBusy]);

  const onSubmit = (event) => {
    event.preventDefault();
    setError('');
    if (reason.trim().length < 3) {
      setError('Add a short reason for your admin.');
      return;
    }
    submit.mutate();
  };

  const pickHoliday = (date) => {
    setFrom(date);
    setTo(date);
  };

  return (
    <form id={formId} onSubmit={onSubmit} className="space-y-5">
      <SelectField
        label="Leave type"
        value={selectedId}
        hint={selected?.description}
        onChange={(event) => {
          setLeaveTypeId(event.target.value);
          setError('');
        }}
      >
        {types.map((type) => (
          <option key={type.id} value={type.id}>
            {type.name}
          </option>
        ))}
      </SelectField>

      {restricted ? (
        <SelectField
          label="Restricted holiday"
          value={from}
          hint="Restricted holidays are taken as one full day."
          onChange={(event) => pickHoliday(event.target.value)}
        >
          <option value="">Pick a holiday</option>
          {restrictedHolidays.map((holiday) => (
            <option key={holiday.id} value={holiday.date}>
              {holiday.name}, {slashDate(holiday.date)}
            </option>
          ))}
        </SelectField>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="From"
              type="date"
              required
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                if (event.target.value > to) setTo(event.target.value);
              }}
            />
            <TextInput label="To" type="date" required min={from} value={to} onChange={(event) => setTo(event.target.value)} />
          </div>

          {singleDay && (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Duration</legend>
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
                {SESSIONS.map(([value, label]) => (
                  <label
                    key={value}
                    className={`grid min-h-11 cursor-pointer place-items-center px-2 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent ${
                      session === value ? 'bg-accent-soft font-medium text-accent' : 'bg-surface text-ink hover:bg-bg'
                    }`}
                  >
                    <input
                      type="radio"
                      name="session"
                      value={value}
                      checked={session === value}
                      onChange={() => setSession(value)}
                      className="sr-only"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}

      <div aria-live="polite" className="min-h-11 rounded-lg bg-bg px-3 py-2.5 text-sm">
        {preview?.error && <p className="text-rejected">{preview.error}</p>}
        {preview && !preview.error && (
          <p>
            <span className="font-semibold tabular-nums">{preview.days}</span> working {dayWord(preview.days)}.
            {preview.tracksBalance
              ? ` ${preview.availableAfter} left after this.`
              : ' This leave is unpaid and does not use a balance.'}
          </p>
        )}
        {!preview && <p className="text-muted">Weekends and public holidays are not counted.</p>}
      </div>

      <TextArea
        label="Reason"
        required
        maxLength={500}
        value={reason}
        hint="Your admin reads this before deciding."
        onChange={(event) => setReason(event.target.value)}
      />

      {error && (
        <p role="alert" className="text-sm text-rejected">
          {error}
        </p>
      )}
    </form>
  );
}

export function ApplyLeaveDialog({ open, onClose, today, preset }) {
  const [busy, setBusy] = useState(false);
  const formId = 'apply-leave-form';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Apply for leave"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            Send request
          </Button>
        </>
      }
    >
      <ApplyForm key={preset?.from ?? 'blank'} today={today} preset={preset} formId={formId} onDone={onClose} onBusy={setBusy} />
    </Dialog>
  );
}
