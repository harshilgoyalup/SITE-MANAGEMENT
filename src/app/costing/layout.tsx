import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Site Costing - Material, Labour & Costing Sheets',
  description: 'Record material, labour and expenses for every interior site and generate costing sheets.',
};

export default function CostingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
