import './global.css';

export const metadata = {
  title: 'EShop Seller',
  description: 'Manage your EShop seller account, products and payouts.',
};

export default function SellerRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
