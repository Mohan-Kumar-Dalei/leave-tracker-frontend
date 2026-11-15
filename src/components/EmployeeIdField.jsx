import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { TextInput } from './ui';

// The employee ID a new person gets: the next number in the company's CON
// series. Shown read-only on the forms that add people; the server gives it
// when the account is made (on approval, for requests that need one).
export function EmployeeIdField({ hint }) {
  const { data } = useQuery({
    queryKey: ['next-employee-id'],
    queryFn: () => api.get('/join/next-id'),
    staleTime: 0,
  });
  return <TextInput label="Employee ID" value={data?.employeeId ?? '...'} hint={hint} disabled readOnly />;
}
