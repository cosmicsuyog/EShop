export type CustomerSessionStatus =
  | 'loading'
  | 'authenticated'
  | 'unauthenticated';

export const getAccountRouteRedirect = (
  status: CustomerSessionStatus
) =>
  status === 'unauthenticated' ? '/login?next=%2Faccount' : null;
