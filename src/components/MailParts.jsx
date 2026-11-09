import { X } from 'lucide-react';
import { useId } from 'react';
import { SelectBox } from './ui';

// Pieces that show a leave mail before it goes: who it is to, who is copied,
// and the text with the sender's signature under it, like a mail app would.

const nameFor = (contacts, email) => contacts.find((contact) => contact.email === email)?.name ?? email;

export function Recipients({ label, people }) {
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 text-sm">
      <span className="w-8 shrink-0 text-[13px] font-medium text-muted">{label}</span>
      {people.length === 0 && <span className="text-muted">Nobody</span>}
      {people.map((person) => (
        <span key={person.email} title={person.email} className="rounded-md bg-sunken px-2 py-1 text-[13px]">
          {person.name}
        </span>
      ))}
    </div>
  );
}

// value is a list of addresses. Anyone can be removed, and anyone from the
// contact list can be added.
export function CcPicker({ contacts, value, onChange }) {
  const left = contacts.filter((contact) => !value.includes(contact.email));

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="w-8 shrink-0 text-[13px] font-medium text-muted">CC</span>
      {value.map((email) => (
        <span key={email} title={email} className="inline-flex items-center gap-1 rounded-md bg-sunken py-0.5 pl-2 pr-0.5 text-[13px]">
          {nameFor(contacts, email)}
          <button
            type="button"
            aria-label={`Remove ${nameFor(contacts, email)} from CC`}
            onClick={() => onChange(value.filter((item) => item !== email))}
            className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-line hover:text-ink"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
      {left.length > 0 && (
        <div className="mt-1 basis-full">
          <SelectBox
            aria-label="Add someone to CC"
            className="w-full"
            value=""
            onChange={(event) => event.target.value && onChange([...value, event.target.value])}
          >
            <option value="">Add someone to CC</option>
            {left.map((contact) => (
              <option key={contact.email} value={contact.email}>
                {contact.name === contact.email ? contact.email : `${contact.name} (${contact.email})`}
              </option>
            ))}
          </SelectBox>
        </div>
      )}
    </div>
  );
}

export function SignatureCard({ signature }) {
  if (!signature) return null;
  const link = 'text-[#1a73e8] hover:underline';

  return (
    <div className="flex items-center gap-4 font-[Arial,Helvetica,sans-serif]">
      <div className="shrink-0">
        {signature.logoUrl ? (
          <img src={signature.logoUrl} alt={signature.companyName} className="h-auto w-28 sm:w-[140px]" />
        ) : (
          <span className="text-xl font-bold tracking-tight text-[#1f2a44] sm:text-2xl">{signature.companyName}</span>
        )}
      </div>
      <div className="min-w-0 border-l border-[#dadce0] pl-4 text-[13px] leading-snug">
        <p className="text-[15px] text-[#202124]">{signature.name}</p>
        {signature.designation && <p className="mt-0.5 text-xs text-[#5f6368]">{signature.designation}</p>}
        <p className="mt-2 break-words text-[#5f6368]">
          {signature.phone && <>{signature.phone} &bull; </>}
          <span className="text-[#1a73e8]">{signature.email}</span>
        </p>
        <p className="mt-1.5">
          <a href={signature.trialUrl} target="_blank" rel="noopener noreferrer" className={link}>
            Free trial
          </a>
          <span className="text-[#5f6368]"> &bull; </span>
          <a href={signature.demoUrl} target="_blank" rel="noopener noreferrer" className={link}>
            Watch a demo
          </a>
        </p>
        <p className="mt-1.5 text-[#5f6368]">
          Follow us for the latest updates{' '}
          <a href={signature.linkedinUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#0a66c2] hover:underline">
            LinkedIn
          </a>
        </p>
      </div>
    </div>
  );
}

// A text box with the signature under it, inside one frame, the way a mail
// app shows a reply being written. The signature itself is not editable.
export function MailBody({ label, value, onChange, signature, error, hint, rows = 9, ...props }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">
        {label}
      </label>
      <div
        className={`overflow-hidden rounded-lg border bg-surface transition-shadow focus-within:ring-3 focus-within:ring-accent/15 ${
          error ? 'border-rejected' : 'border-line focus-within:border-accent'
        }`}
      >
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={onChange}
          className="block w-full resize-y bg-transparent px-3 py-2.5 text-base leading-relaxed text-ink focus:outline-none sm:text-sm"
          {...props}
        />
        <div className="border-t border-dashed border-line bg-bg/50 px-3 py-3">
          <p className="mb-2 text-xs text-muted">--</p>
          <SignatureCard signature={signature} />
        </div>
      </div>
      {hint && !error && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-rejected">
          {error}
        </p>
      )}
    </div>
  );
}
