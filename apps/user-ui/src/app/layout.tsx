import './global.css';

export const metadata = {
  title: 'EShop | Product Catalog',
  description: 'Browse the EShop product catalog.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
