import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '../lib/api';
import { dayWord, slashDate } from '../lib/dates';
import { useToast } from '../lib/toast';
import { SendingFrom, useGmail } from './GmailConnect';
import { AddressField, MailBody } from './MailParts';
import { Button, Dialog, FormError, SelectField, TextInput } from './ui';

const PLACEHOLDER = '[reason]';

const SESSIONS = [
  ['full', 'Full day'],
  ['first', 'First half'],
  ['second', 'Second half'],
];

// What the form needs before it can show without anything moving: the leave
// types, who the mail goes to with the signature, and the Gmail line.
const useFormData = () => ({
  types: useQuery({ queryKey: ['leave-types'], queryFn: () => api.get('/leave-types') }),
  compose: useQuery({ queryKey: ['compose'], queryFn: () => api.get('/me/compose') }),
  gmail: useGmail(),
});

// The same shape as the form, shown for the moment its data is still coming,
// so the panel opens at its full height and nothing jumps when it fills in.
function FormSkeleton() {
  const bar = 'animate-pulse rounded-lg bg-sunken motion-reduce:animate-none';
  return (
    <div className="space-y-5" aria-hidden="true">
      {/* Heights of the form's own parts: type, dates, duration, days, mail, message. */}
      {[91, 66, 72, 44, 219, 455].map((height) => (
        <div key={height} style={{ height }} className={bar} />
      ))}
    </div>
  );
}

function ApplyForm({ today, preset, formId, onDone, onBusy, onCanSend }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const ready = useFormData();

  const { data: typeData } = useQuery({ queryKey: ['leave-types'], queryFn: () => api.get('/leave-types') });
  const types = useMemo(() => (typeData?.items ?? []).filter((type) => type.isActive), [typeData]);

  const [leaveTypeId, setLeaveTypeId] = useState(preset?.leaveTypeId ?? '');
  const [from, setFrom] = useState(preset?.from ?? today);
  const [to, setTo] = useState(preset?.to ?? today);
  const [session, setSession] = useState('full');
  const [message, setMessage] = useState('');
  const [mailTo, setMailTo] = useState(null);
  const [cc, setCc] = useState(null);
  const [subject, setSubject] = useState(null);
  // The problems, box by box, kept by react-hook-form; this form's values are
  // its own state (the To and CC chips, the letter that follows the dates).
  const { setError: flag, clearErrors, formState } = useForm();
  const { errors } = formState;
  const error = errors.root?.server?.message;
  const setError = (message) => (message ? flag('root.server', { type: 'server', message }) : clearErrors('root.server'));

  // Who the mail goes to, who is copied by default, and the signature.
  const { data: compose } = useQuery({ queryKey: ['compose'], queryFn: () => api.get('/me/compose') });
  // To starts with the admins and CC with the usual list. Both can be changed.
  const chosenTo = mailTo ?? compose?.to.map((person) => person.email) ?? [];
  const chosenCc = cc ?? compose?.defaultCc.map((contact) => contact.email) ?? [];
  const chosenSubject = subject ?? compose?.subject ?? 'Leave Application';
  const names = useMemo(
    () => Object.fromEntries((compose?.contacts ?? []).map((contact) => [contact.email, contact.name])),
    [compose],
  );

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

  // The letter starts from the server's draft. When the dates or type change,
  // only the sentence with the dates is swapped, so the rest of what the
  // employee typed stays.
  const lastSentence = useRef('');
  useEffect(() => {
    if (!preview?.sentence) return;
    const previous = lastSentence.current;
    setMessage((current) => {
      if (!current.trim()) return preview.draft;
      if (previous && current.includes(previous)) return current.replace(previous, preview.sentence);
      return current;
    });
    lastSentence.current = preview.sentence;
  }, [preview]);

  const submit = useMutation({
    mutationFn: () =>
      api.post('/leaves', {
        leaveTypeId: selectedId,
        from,
        to,
        session: usedSession,
        subject: chosenSubject.trim(),
        message: message.trim(),
        mailTo: chosenTo,
        cc: chosenCc,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success('Request sent', 'Your admin has been told by mail and on their dashboard.');
      onDone();
    },
    onError: (issue) => {
      const field = ['mailTo', 'cc', 'subject', 'message', 'from', 'to'].includes(issue.field) ? issue.field : null;
      if (field) flag(field, { type: 'server', message: issue.message });
      else setError(issue.message);
    },
  });

  useEffect(() => onBusy(submit.isPending), [submit.isPending, onBusy]);

  // Sending stays off until the server has accepted these dates.
  useEffect(() => onCanSend(Boolean(preview && !preview.error)), [preview, onCanSend]);

  // Every box is checked at once and each problem shows under its own box.
  const onSubmit = (event) => {
    event.preventDefault();
    clearErrors();
    const problems = {};
    if (restricted && !from) problems.from = 'Pick a restricted holiday.';
    if (!restricted && !from) problems.from = 'Pick the first day.';
    if (!restricted && !to) problems.to = 'Pick the last day.';
    if (!restricted && from && to && to < from) problems.to = 'The last day cannot be before the first.';
    if (chosenTo.length === 0) problems.mailTo = 'Add at least one person in To.';
    if (chosenSubject.trim().length < 3) problems.subject = 'Write a subject for the mail.';
    if (message.includes(PLACEHOLDER)) problems.message = `Write your reason in place of ${PLACEHOLDER} in the mail.`;
    else if (message.trim().length < 20) problems.message = 'Write a few lines for your admin.';
    const fields = Object.keys(problems);
    for (const field of fields) flag(field, { type: 'manual', message: problems[field] });
    if (fields.length) return;
    submit.mutate();
  };
  // A box's problem goes as soon as it is changed.
  const changed = (field) => errors[field] && clearErrors(field);

  const pickHoliday = (date) => {
    setFrom(date);
    setTo(date);
    changed('from');
  };

  if (ready.types.isPending || ready.compose.isPending || ready.gmail.isPending) return <FormSkeleton />;

  return (
    <form id={formId} onSubmit={onSubmit} noValidate className="space-y-5">
      <SelectField
        label="Leave type"
        value={selectedId}
        hint={selected?.description}
        onChange={(event) => {
          setLeaveTypeId(event.target.value);
          clearErrors();
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
          error={errors.from?.message}
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
              value={from}
              error={errors.from?.message}
              onChange={(event) => {
                setFrom(event.target.value);
                if (event.target.value > to) setTo(event.target.value);
                changed('from');
              }}
            />
            <TextInput
              label="To"
              type="date"
              min={from}
              value={to}
              error={errors.to?.message}
              onChange={(event) => {
                setTo(event.target.value);
                changed('to');
              }}
            />
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
        {!preview && <p className="text-muted">Sundays and public holidays are not counted.</p>}
      </div>

      <fieldset className="space-y-1 rounded-lg border border-line px-3 py-2">
        <legend className="px-1 text-[13px] font-medium">Leave Application mail</legend>
        <SendingFrom />
        <AddressField
          label="To"
          value={chosenTo}
          names={names}
          error={errors.mailTo?.message}
          onChange={(next) => {
            setMailTo(next);
            changed('mailTo');
          }}
        />
        <div className="border-t border-line" />
        <AddressField label="CC" value={chosenCc} names={names} error={errors.cc?.message} onChange={setCc} />
        <div className="pb-1 pt-2">
          <TextInput
            label="Subject"
            maxLength={150}
            value={chosenSubject}
            error={errors.subject?.message}
            onChange={(event) => {
              setSubject(event.target.value);
              changed('subject');
            }}
          />
        </div>
      </fieldset>

      <MailBody
        label="Message"
        maxLength={4000}
        value={message}
        signature={compose?.signature}
        error={errors.message?.message}
        hint={`Replace ${PLACEHOLDER} with your reason. The dates update by themselves.`}
        onChange={(event) => {
          setMessage(event.target.value);
          changed('message');
        }}
      />

      <FormError>{error}</FormError>
    </form>
  );
}

export function ApplyLeaveDialog({ open, onClose, today, preset }) {
  // Fetched as soon as the page shows, not when the panel opens, so the
  // panel opens with everything in place.
  useFormData();
  const [busy, setBusy] = useState(false);
  const [canSend, setCanSend] = useState(false);
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
          <Button type="submit" form={formId} loading={busy} disabled={!canSend}>
            Send request
          </Button>
        </>
      }
    >
      <ApplyForm key={preset?.from ?? 'blank'} today={today} preset={preset} formId={formId} onDone={onClose} onBusy={setBusy} onCanSend={setCanSend} />
    </Dialog>
  );
}
