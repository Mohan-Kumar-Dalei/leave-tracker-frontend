import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { api } from '../lib/api';
import { formError, rules, showServerError, useZodForm } from '../lib/forms';
import { EmployeeIdField } from './EmployeeIdField';
import { Button, Dialog, FormError, SelectField, TextInput } from './ui';

const schema = z.object({
  name: rules.name,
  email: rules.email,
  phone: rules.phone,
  designation: rules.text(80, 'The designation'),
  department: rules.required('Pick a department.'),
  lead: z.boolean(),
});
const FIELDS = ['name', 'email', 'phone', 'designation', 'department'];

// "Add employee", the same on Organisation and on Employees: name, work email,
// the next employee ID (shown, given automatically), phone, designation and
// department. The starting password is first name @ year, shown once at the
// end to pass on. A manager can also make them an assistant manager.
export function AddEmployeeDialog({ departments, defaultDepartment, canMakeAssistant = false, onClose }) {
  const form = useZodForm(schema, {
    name: '',
    email: '',
    phone: '',
    designation: '',
    department: defaultDepartment ?? departments[0]?.id ?? '',
    lead: false,
  });
  const { register, handleSubmit, control, formState, watch } = form;
  const { errors } = formState;
  const [created, setCreated] = useState(null);
  const queryClient = useQueryClient();
  const values = watch();
  const department = departments.find((item) => item.id === values.department);

  const create = useMutation({
    mutationFn: async (fields) => {
      const { lead, department: id, ...person } = fields;
      const body = Object.fromEntries(Object.entries(person).filter(([, value]) => value !== ''));
      const result = await api.post(`/departments/${id}/people`, body);
      if (lead && canMakeAssistant) await api.put(`/departments/${id}/assistant`, { user: result.person.id });
      return result;
    },
    onSuccess: (result) => {
      for (const key of ['organisation', 'team', 'employees', 'department', 'team-totals']) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setCreated(result);
    },
    onError: (issue) => showServerError(form, issue, FIELDS),
  });

  if (created) {
    return (
      <Dialog open onClose={onClose} kind="modal" title="Employee added" footer={<Button onClick={onClose}>Done</Button>}>
        <div className="space-y-4 text-sm">
          <p>
            <span className="font-medium">{created.person.name}</span> is now in {department?.name}
            {values.lead && canMakeAssistant ? ' as an assistant manager' : ''}.
          </p>
          <dl className="space-y-2 rounded-lg bg-sunken p-3">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Employee ID</dt>
              <dd className="font-medium">{created.person.employeeId}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Sign in with</dt>
              <dd className="truncate font-medium">{created.person.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Starting password</dt>
              <dd className="font-medium">{created.startingPassword}</dd>
            </div>
          </dl>
          <p className="text-[13px] text-muted">Share it with them; they can change it from their profile after signing in.</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add employee"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-person" loading={create.isPending}>
            Add employee
          </Button>
        </>
      }
    >
      <form id="add-person" noValidate className="space-y-4" onSubmit={handleSubmit((fields) => create.mutate(fields))}>
        <TextInput label="Full name" maxLength={80} error={errors.name?.message} {...register('name')} data-autofocus />
        <TextInput label="Work email" type="email" maxLength={160} error={errors.email?.message} {...register('email')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <EmployeeIdField />
          <TextInput label="Phone" maxLength={20} error={errors.phone?.message} {...register('phone')} />
        </div>
        <TextInput
          label="Designation"
          maxLength={80}
          placeholder="For example, Analyst"
          error={errors.designation?.message}
          {...register('designation')}
        />
        <Controller
          control={control}
          name="department"
          render={({ field, fieldState }) => (
            <SelectField label="Department" value={field.value} onChange={(event) => field.onChange(event.target.value)} error={fieldState.error?.message}>
              {departments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </SelectField>
          )}
        />
        {canMakeAssistant && (
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" {...register('lead')} className="mt-0.5 h-4 w-4 accent-accent" />
            <span>
              Make them an assistant manager
              <span className="block text-[13px] text-muted">They sit beside any assistant manager already there.</span>
            </span>
          </label>
        )}
        <p className="text-[13px] text-muted">
          Their starting password will be their first name and the year, for example Asha@{new Date().getFullYear()}.
        </p>
        <FormError>{formError(form)}</FormError>
      </form>
    </Dialog>
  );
}
