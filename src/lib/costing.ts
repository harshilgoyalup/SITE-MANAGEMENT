// Site Costing module: data model, local storage and calculations
// for interior sites (material, labour and other expenses).

export type SiteStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';

export interface Site {
  id: string;
  name: string;
  clientName: string;
  clientPhone?: string;
  location: string;
  startDate: string;
  contractValue: number; // amount agreed with client (0 if not fixed yet)
  status: SiteStatus;
  notes?: string;
  createdAt: string;
}

export interface MaterialEntry {
  id: string;
  siteId: string;
  date: string;
  item: string;
  category: string;
  vendor?: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number; // quantity * rate
  paid: boolean;
  billNo?: string;
  notes?: string;
}

export type LabourPayType = 'DAILY' | 'CONTRACT';

export interface LabourEntry {
  id: string;
  siteId: string;
  date: string;
  workerName: string;
  trade: string;
  payType: LabourPayType;
  days: number; // used for DAILY (can be fractional e.g. 0.5)
  rate: number; // per day for DAILY, lump sum for CONTRACT
  amount: number;
  paid: boolean;
  notes?: string;
}

export interface ExpenseEntry {
  id: string;
  siteId: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paid: boolean;
}

export interface Payment {
  id: string;
  siteId: string;
  date: string;
  amount: number;
  mode: string;
  notes?: string;
}

export interface CostingData {
  version: 1;
  businessName?: string;
  sites: Site[];
  materials: MaterialEntry[];
  labour: LabourEntry[];
  expenses: ExpenseEntry[];
  payments: Payment[];
}

export const MATERIAL_CATEGORIES = [
  'Plywood / Board',
  'Laminate / Veneer',
  'Hardware & Fittings',
  'Glass & Mirror',
  'Paint & Polish',
  'Tiles & Stone',
  'Electrical',
  'Lighting',
  'Plumbing & Sanitary',
  'False Ceiling / Gypsum',
  'Adhesive & Consumables',
  'Fabric & Upholstery',
  'Other',
];

export const MATERIAL_UNITS = ['Nos', 'Sheet', 'Sq.ft', 'R.ft', 'Kg', 'Ltr', 'Box', 'Bag', 'Set', 'Mtr', 'Lot'];

export const LABOUR_TRADES = [
  'Carpenter',
  'Painter / Polisher',
  'Electrician',
  'Plumber',
  'Mason / Tiler',
  'POP / Ceiling',
  'Fabricator / Welder',
  'Helper',
  'Supervisor',
  'Other',
];

export const EXPENSE_CATEGORIES = [
  'Transport',
  'Loading / Unloading',
  'Tools & Machinery',
  'Site Cleaning',
  'Food & Tea',
  'Design / Drawing',
  'Misc',
];

export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];

const STORAGE_KEY = 'interior_costing_data_v1';

export function emptyData(): CostingData {
  return { version: 1, sites: [], materials: [], labour: [], expenses: [], payments: [] };
}

export function loadData(): CostingData {
  if (typeof window === 'undefined') return emptyData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    return normalizeData(JSON.parse(raw));
  } catch {
    return emptyData();
  }
}

export function saveData(data: CostingData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or blocked – ignore, user can still export a backup
  }
}

export function normalizeData(input: unknown): CostingData {
  const d = (input ?? {}) as Partial<CostingData>;
  return {
    version: 1,
    businessName: typeof d.businessName === 'string' ? d.businessName : '',
    sites: Array.isArray(d.sites) ? d.sites : [],
    materials: Array.isArray(d.materials) ? d.materials : [],
    labour: Array.isArray(d.labour) ? d.labour : [],
    expenses: Array.isArray(d.expenses) ? d.expenses : [],
    payments: Array.isArray(d.payments) ? d.payments : [],
  };
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function today(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function labourAmount(payType: LabourPayType, days: number, rate: number): number {
  return round2(payType === 'DAILY' ? days * rate : rate);
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export function money(n: number): string {
  return inr.format(Number.isFinite(n) ? n : 0);
}

export interface SiteSummary {
  material: number;
  labour: number;
  expenses: number;
  totalCost: number;
  unpaid: number; // pending dues to vendors / workers
  received: number; // payments received from client
  contractValue: number;
  profit: number; // contractValue - totalCost (only meaningful if contractValue > 0)
  marginPct: number;
  labourDays: number;
  materialByCategory: Record<string, number>;
  labourByTrade: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

function addTo(map: Record<string, number>, key: string, val: number) {
  map[key] = round2((map[key] ?? 0) + val);
}

export function summarize(data: CostingData, siteId: string): SiteSummary {
  const site = data.sites.find((s) => s.id === siteId);
  const mats = data.materials.filter((m) => m.siteId === siteId);
  const labs = data.labour.filter((l) => l.siteId === siteId);
  const exps = data.expenses.filter((e) => e.siteId === siteId);
  const pays = data.payments.filter((p) => p.siteId === siteId);

  const materialByCategory: Record<string, number> = {};
  const labourByTrade: Record<string, number> = {};
  const expensesByCategory: Record<string, number> = {};
  let unpaid = 0;
  let labourDays = 0;

  mats.forEach((m) => {
    addTo(materialByCategory, m.category, m.amount);
    if (!m.paid) unpaid += m.amount;
  });
  labs.forEach((l) => {
    addTo(labourByTrade, l.trade, l.amount);
    if (!l.paid) unpaid += l.amount;
    if (l.payType === 'DAILY') labourDays += l.days;
  });
  exps.forEach((e) => {
    addTo(expensesByCategory, e.category, e.amount);
    if (!e.paid) unpaid += e.amount;
  });

  const material = round2(mats.reduce((s, m) => s + m.amount, 0));
  const labour = round2(labs.reduce((s, l) => s + l.amount, 0));
  const expenses = round2(exps.reduce((s, e) => s + e.amount, 0));
  const totalCost = round2(material + labour + expenses);
  const contractValue = site?.contractValue ?? 0;
  const profit = round2(contractValue - totalCost);
  const marginPct = contractValue > 0 ? round2((profit / contractValue) * 100) : 0;

  return {
    material,
    labour,
    expenses,
    totalCost,
    unpaid: round2(unpaid),
    received: round2(pays.reduce((s, p) => s + p.amount, 0)),
    contractValue,
    profit,
    marginPct,
    labourDays: round2(labourDays),
    materialByCategory,
    labourByTrade,
    expensesByCategory,
  };
}

/** Build a CSV costing sheet for one site (opens fine in Excel / Google Sheets). */
export function siteCsv(data: CostingData, siteId: string): string {
  const site = data.sites.find((s) => s.id === siteId);
  if (!site) return '';
  const s = summarize(data, siteId);
  const esc = (v: unknown) => {
    const str = String(v ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const rows: unknown[][] = [];
  rows.push([data.businessName ? `${data.businessName} - COSTING SHEET` : 'COSTING SHEET']);
  rows.push(['Site', site.name]);
  rows.push(['Client', site.clientName]);
  rows.push(['Location', site.location]);
  rows.push(['Start Date', site.startDate]);
  rows.push(['Contract Value', site.contractValue]);
  rows.push([]);
  rows.push(['MATERIAL']);
  rows.push(['Date', 'Item', 'Category', 'Vendor', 'Qty', 'Unit', 'Rate', 'Amount', 'Bill No', 'Paid']);
  data.materials
    .filter((m) => m.siteId === siteId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((m) =>
      rows.push([m.date, m.item, m.category, m.vendor, m.quantity, m.unit, m.rate, m.amount, m.billNo, m.paid ? 'Yes' : 'No']),
    );
  rows.push(['', '', '', '', '', '', 'Total', s.material]);
  rows.push([]);
  rows.push(['LABOUR']);
  rows.push(['Date', 'Worker', 'Trade', 'Type', 'Days', 'Rate', 'Amount', 'Paid']);
  data.labour
    .filter((l) => l.siteId === siteId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((l) =>
      rows.push([l.date, l.workerName, l.trade, l.payType === 'DAILY' ? 'Daily' : 'Contract', l.payType === 'DAILY' ? l.days : '', l.rate, l.amount, l.paid ? 'Yes' : 'No']),
    );
  rows.push(['', '', '', '', '', 'Total', s.labour]);
  rows.push([]);
  rows.push(['OTHER EXPENSES']);
  rows.push(['Date', 'Category', 'Description', 'Amount', 'Paid']);
  data.expenses
    .filter((e) => e.siteId === siteId)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((e) => rows.push([e.date, e.category, e.description, e.amount, e.paid ? 'Yes' : 'No']));
  rows.push(['', '', 'Total', s.expenses]);
  rows.push([]);
  rows.push(['SUMMARY']);
  rows.push(['Material', s.material]);
  rows.push(['Labour', s.labour]);
  rows.push(['Other Expenses', s.expenses]);
  rows.push(['Total Cost', s.totalCost]);
  rows.push(['Contract Value', s.contractValue]);
  rows.push(['Profit / Loss', s.profit]);
  rows.push(['Margin %', s.marginPct]);
  rows.push(['Received from Client', s.received]);
  rows.push(['Balance from Client', round2(s.contractValue - s.received)]);
  rows.push(['Pending Dues (vendors/workers)', s.unpaid]);
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
