import './global.css';
import { AuthProvider } from './components/AuthProvider';

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
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
