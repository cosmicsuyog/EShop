import { redirect } from 'next/navigation';

export const redirectToSellerApp = (path: string): never => {
  const baseUrl = (
    process.env.NEXT_PUBLIC_SELLER_UI_URL ?? 'http://localhost:3001'
  ).replace(/\/+$/, '');
  redirect(`${baseUrl}${path}`);
};
