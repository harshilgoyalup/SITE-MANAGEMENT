import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Site Management - Interior Costing',
  description: 'Record material, labour and expenses for every interior site and generate costing sheets.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
