'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSellerApiErrorMessage, logoutSeller } from '../lib/sellerApi';

export function SellerLogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');

  const signOut = async () => {
    setIsSigningOut(true);
    setError('');
    try {
      await logoutSeller();
      router.replace('/login?logout=success');
    } catch (requestError) {
      setError(getSellerApiErrorMessage(requestError));
      setIsSigningOut(false);
    }
  };

  return (
    <div className="seller-dashboard-signout">
      <button
        className="auth-secondary"
        disabled={isSigningOut}
        onClick={() => void signOut()}
        type="button"
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
