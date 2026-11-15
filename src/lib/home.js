// Where each role starts after signing in: the owner in the organisation,
// admins in their overview, employees on their dashboard.
export const homeOf = (user) => (user.role === 'owner' ? '/organisation' : user.role === 'admin' ? '/admin' : '/');
