import { useAuth } from '../lib/auth';
import { pathFor } from '../lib/home';

// Turns one of the app's plain addresses ('/admin/employees/<id>',
// '/departments/<id>', '/profile'...) into the signed-in person's own one, so
// a link goes straight there. Following the plain address works too, but it
// leaves the app's frame and rebuilds it on the way back, which is slow.
export function useAppPath() {
  const { user } = useAuth();
  return (address) => (user ? pathFor(user, address) ?? address : address);
}
