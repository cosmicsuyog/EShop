import type { ReactNode } from 'react';
import { SellerLogoutButton } from '../../components/SellerLogoutButton';

export default function SellerDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="seller-dashboard-shell">
      <aside className="seller-dashboard-sidebar" aria-label="Seller menu">
        <p className="catalog-eyebrow">SELLER WORKSPACE</p>
        <nav>
          <a href="/dashboard">Overview</a>
          <a href="/dashboard/all-products">Products</a>
          <a href="/dashboard/create-product">Add a product</a>
          <a href="/dashboard/discount-codes">Discount codes</a>
          <a href="/dashboard/payments">Payouts</a>
        </nav>
        <SellerLogoutButton />
      </aside>
      <main className="seller-dashboard-main">{children}</main>
    </div>
  );
}
