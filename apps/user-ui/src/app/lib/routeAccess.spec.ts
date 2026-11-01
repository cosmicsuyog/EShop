import { getAccountRouteRedirect } from './routeAccess';

describe('customer route access', () => {
  it('redirects unauthenticated customers to sign in and back to their account', () => {
    expect(getAccountRouteRedirect('unauthenticated')).toBe(
      '/login?next=%2Faccount'
    );
  });

  it.each(['loading', 'authenticated'] as const)(
    'does not redirect while the session is %s',
    (status) => {
      expect(getAccountRouteRedirect(status)).toBeNull();
    }
  );
});
