import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Forms check themselves with react-hook-form and these rules (the same ones
// the server uses), and show what is wrong in red under each box, instead of
// the browser's own pop-up messages (every form has noValidate). A box is
// checked when you leave it, and again as you type once it has an error.

export const rules = {
  email: z
    .string()
    .trim()
    .min(1, 'Enter the email address.')
    .max(160, 'Keep the email under 160 characters.')
    .email('Enter a valid email address, like name@company.com.'),
  // A new password, as the server requires it.
  newPassword: z
    .string()
    .min(10, 'Use at least 10 characters.')
    .max(72, 'Use at most 72 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
  // A password being typed to sign in (or confirm): just not empty.
  password: z.string().min(1, 'Enter the password.').max(200, 'That password is too long.'),
  name: z.string().trim().min(2, 'Write the full name.').max(80, 'Keep the name under 80 characters.'),
  phone: z
    .string()
    .trim()
    .max(20, 'Keep the phone number under 20 characters.')
    .regex(/^[+0-9 ()-]*$/, 'Use digits, spaces and + only.'),
  text: (max, label = 'This') => z.string().trim().max(max, `${label} can be at most ${max} characters.`),
  required: (message) => z.string().trim().min(1, message),
  // A Gmail App Password: 16 letters (Google shows them in groups of four).
  appPassword: z
    .string()
    .min(1, 'Paste the App Password from Google.')
    .refine((value) => /^[a-z]{16}$/i.test(value.replace(/\s+/g, '')), 'An App Password is 16 letters, shown by Google in four groups of four.'),
};

// `schema` may be a function returning the rules, for forms whose rules
// depend on something loaded after the form was made.
export function useZodForm(schema, defaultValues, options = {}) {
  return useForm({
    resolver: typeof schema === 'function' ? (...args) => zodResolver(schema())(...args) : zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
    reValidateMode: 'onChange',
    ...options,
  });
}

// Puts an error from the server under the box it is about (the server names
// the field, or the message is about the email), or else above the buttons.
export function showServerError(form, error, fields = []) {
  const named = error?.field && fields.includes(error.field) ? error.field : null;
  const emailish = !named && fields.includes('email') && /email|account/i.test(error?.message ?? '') ? 'email' : null;
  const field = named ?? emailish;
  const message = error?.message ?? 'Something went wrong. Please try again.';
  if (field) form.setError(field, { type: 'server', message }, { shouldFocus: true });
  else form.setError('root.server', { type: 'server', message });
}

// The error for the whole form, if any.
export const formError = (form) => form.formState.errors.root?.server?.message;
