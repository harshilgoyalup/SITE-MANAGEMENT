'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CostingData,
  ExpenseEntry,
  LabourEntry,
  LabourPayType,
  MaterialEntry,
  Payment,
  Site,
  SiteStatus,
  EXPENSE_CATEGORIES,
  LABOUR_TRADES,
  MATERIAL_CATEGORIES,
  MATERIAL_UNITS,
  PAYMENT_MODES,
  downloadFile,
  emptyData,
  labourAmount,
  loadData,
  money,
  newId,
  normalizeData,
  round2,
  saveData,
  siteCsv,
  summarize,
  today,
} from '../lib/costing';

type Tab = 'sheet' | 'material' | 'labour' | 'expenses' | 'payments';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200';
const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';
const btnPrimary =
  'rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50';
const btnGhost =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';
const btnDanger = 'rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50';
const btnSmall = 'rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100';

const STATUS_LABEL: Record<SiteStatus, string> = { ACTIVE: 'Active', ON_HOLD: 'On Hold', COMPLETED: 'Completed' };
const STATUS_CLS: Record<SiteStatus, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  ON_HOLD: 'bg-amber-100 text-amber-800',
  COMPLETED: 'bg-slate-200 text-slate-700',
};

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export default function CostingPage() {
  const [data, setData] = useState<CostingData>(emptyData);
  const [loaded, setLoaded] = useState(false);
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [showSiteForm, setShowSiteForm] = useState<Site | 'new' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser storage once on mount
    setData(loadData());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveData(data);
  }, [data, loaded]);

  const update = (fn: (d: CostingData) => CostingData) => setData((d) => fn(d));

  const saveSite = (site: Site) => {
    update((d) => {
      const exists = d.sites.some((s) => s.id === site.id);
      return { ...d, sites: exists ? d.sites.map((s) => (s.id === site.id ? site : s)) : [...d.sites, site] };
    });
    setShowSiteForm(null);
    setActiveSiteId(site.id);
  };

  const deleteSite = (id: string) => {
    const site = data.sites.find((s) => s.id === id);
    if (!site) return;
    if (!window.confirm(`Delete site "${site.name}" and ALL its entries? This cannot be undone.`)) return;
    update((d) => ({
      ...d,
      sites: d.sites.filter((s) => s.id !== id),
      materials: d.materials.filter((m) => m.siteId !== id),
      labour: d.labour.filter((l) => l.siteId !== id),
      expenses: d.expenses.filter((e) => e.siteId !== id),
      payments: d.payments.filter((p) => p.siteId !== id),
    }));
    setActiveSiteId(null);
  };

  const editBusinessName = () => {
    const name = window.prompt('Your business / firm name (shown on costing sheets):', data.businessName ?? '');
    if (name !== null) update((d) => ({ ...d, businessName: name.trim() }));
  };

  const exportBackup = () => {
    downloadFile(`costing-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
  };

  const importBackup = async (file: File) => {
    try {
      const parsed = normalizeData(JSON.parse(await file.text()));
      if (!window.confirm(`Restore backup with ${parsed.sites.length} site(s)? Current data will be replaced.`)) return;
      setData(parsed);
      setActiveSiteId(null);
    } catch {
      window.alert('Could not read this file. Please choose a backup .json exported from this app.');
    }
  };

  const activeSite = data.sites.find((s) => s.id === activeSiteId) ?? null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <button onClick={() => setActiveSiteId(null)} className="flex items-center gap-2 text-left">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 font-black text-white">₹</span>
            <span>
              <span className="block text-base font-bold leading-tight">{data.businessName || 'Site Costing'}</span>
              <span className="block text-xs text-slate-500">Material · Labour · Costing Sheets</span>
            </span>
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <button className={btnGhost} onClick={exportBackup}>Backup</button>
            <button className={btnGhost} onClick={() => fileRef.current?.click()}>Restore</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBackup(f);
                e.target.value = '';
              }}
            />
            <button className={btnGhost} onClick={editBusinessName}>Business name</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {!loaded ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : activeSite ? (
          <SiteView
            key={activeSite.id}
            site={activeSite}
            data={data}
            update={update}
            onBack={() => setActiveSiteId(null)}
            onEdit={() => setShowSiteForm(activeSite)}
            onDelete={() => deleteSite(activeSite.id)}
          />
        ) : (
          <Dashboard data={data} onOpen={setActiveSiteId} onNew={() => setShowSiteForm('new')} />
        )}
      </main>

      {showSiteForm && (
        <SiteForm
          initial={showSiteForm === 'new' ? null : showSiteForm}
          onCancel={() => setShowSiteForm(null)}
          onSave={saveSite}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Dashboard */

function Dashboard({ data, onOpen, onNew }: { data: CostingData; onOpen: (id: string) => void; onNew: () => void }) {
  const [filter, setFilter] = useState<SiteStatus | 'ALL'>('ALL');
  const rows = useMemo(
    () => data.sites.map((s) => ({ site: s, sum: summarize(data, s.id) })),
    [data],
  );
  const shown = rows.filter((r) => filter === 'ALL' || r.site.status === filter);
  const totals = rows.reduce(
    (t, r) => ({
      material: t.material + r.sum.material,
      labour: t.labour + r.sum.labour,
      expenses: t.expenses + r.sum.expenses,
      cost: t.cost + r.sum.totalCost,
      unpaid: t.unpaid + r.sum.unpaid,
      due: t.due + Math.max(0, r.sum.contractValue - r.sum.received),
    }),
    { material: 0, labour: 0, expenses: 0, cost: 0, unpaid: 0, due: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Sites" value={String(data.sites.length)} />
        <Stat label="Material" value={money(totals.material)} />
        <Stat label="Labour" value={money(totals.labour)} />
        <Stat label="Other Exp." value={money(totals.expenses)} />
        <Stat label="Pending to pay" value={money(totals.unpaid)} tone="warn" />
        <Stat label="To receive" value={money(totals.due)} tone="good" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 className="text-lg font-bold">My Sites</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as SiteStatus | 'ALL')}>
              <option value="ALL">All sites</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <button className={btnPrimary} onClick={onNew}>+ Add Site</button>
          </div>
        </div>

        {data.sites.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-base font-semibold">No sites yet</p>
            <p className="mt-1 text-sm text-slate-500">Add your first site, then record material, labour and expenses against it.</p>
            <button className={btnPrimary + ' mt-4'} onClick={onNew}>+ Add your first site</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Site</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Material</th>
                  <th className="px-4 py-2 text-right">Labour</th>
                  <th className="px-4 py-2 text-right">Total Cost</th>
                  <th className="px-4 py-2 text-right">Contract</th>
                  <th className="px-4 py-2 text-right">Profit</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ site, sum }) => (
                  <tr key={site.id} className="cursor-pointer border-t border-slate-100 hover:bg-amber-50" onClick={() => onOpen(site.id)}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{site.name}</div>
                      <div className="text-xs text-slate-500">{[site.clientName, site.location].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={site.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(sum.material)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(sum.labour)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(sum.totalCost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sum.contractValue ? money(sum.contractValue) : '—'}</td>
                    <td className={`px-4 py-3 text-right font-semibold tabular-nums ${sum.profit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {sum.contractValue ? `${money(sum.profit)} (${sum.marginPct}%)` : '—'}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No sites with this status.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Data is saved on this device/browser. Use <b>Backup</b> regularly to download a copy, and <b>Restore</b> to load it on another device.
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warn' | 'good' | 'bad' }) {
  const toneCls = tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-lg font-bold tabular-nums ${toneCls}`}>{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: SiteStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[status]}`}>{STATUS_LABEL[status]}</span>;
}

/* ---------------------------------------------------------------- Site form */

function SiteForm({ initial, onCancel, onSave }: { initial: Site | null; onCancel: () => void; onSave: (s: Site) => void }) {
  const [f, setF] = useState({
    name: initial?.name ?? '',
    clientName: initial?.clientName ?? '',
    clientPhone: initial?.clientPhone ?? '',
    location: initial?.location ?? '',
    startDate: initial?.startDate ?? today(),
    contractValue: initial ? String(initial.contractValue || '') : '',
    status: initial?.status ?? ('ACTIVE' as SiteStatus),
    notes: initial?.notes ?? '',
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    onSave({
      id: initial?.id ?? newId(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      name: f.name.trim(),
      clientName: f.clientName.trim(),
      clientPhone: f.clientPhone.trim(),
      location: f.location.trim(),
      startDate: f.startDate,
      contractValue: num(f.contractValue),
      status: f.status,
      notes: f.notes.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onCancel}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
      >
        <h3 className="mb-4 text-lg font-bold">{initial ? 'Edit Site' : 'Add New Site'}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelCls}>Site name *</label>
            <input className={inputCls} value={f.name} onChange={set('name')} placeholder="e.g. Sharma Residence – 3BHK" required autoFocus />
          </div>
          <div>
            <label className={labelCls}>Client name</label>
            <input className={inputCls} value={f.clientName} onChange={set('clientName')} />
          </div>
          <div>
            <label className={labelCls}>Client phone</label>
            <input className={inputCls} value={f.clientPhone} onChange={set('clientPhone')} inputMode="tel" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Location / address</label>
            <input className={inputCls} value={f.location} onChange={set('location')} />
          </div>
          <div>
            <label className={labelCls}>Start date</label>
            <input type="date" className={inputCls} value={f.startDate} onChange={set('startDate')} />
          </div>
          <div>
            <label className={labelCls}>Contract / quoted value (₹)</label>
            <input type="number" min="0" step="any" className={inputCls} value={f.contractValue} onChange={set('contractValue')} placeholder="0" />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={f.status} onChange={set('status')}>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Notes / scope of work</label>
            <textarea className={inputCls} rows={2} value={f.notes} onChange={set('notes')} />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={btnGhost} onClick={onCancel}>Cancel</button>
          <button type="submit" className={btnPrimary}>{initial ? 'Save' : 'Add Site'}</button>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- Site view */

interface SiteViewProps {
  site: Site;
  data: CostingData;
  update: (fn: (d: CostingData) => CostingData) => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SiteView({ site, data, update, onBack, onEdit, onDelete }: SiteViewProps) {
  const [tab, setTab] = useState<Tab>('sheet');
  const sum = useMemo(() => summarize(data, site.id), [data, site.id]);

  const counts = {
    material: data.materials.filter((m) => m.siteId === site.id).length,
    labour: data.labour.filter((l) => l.siteId === site.id).length,
    expenses: data.expenses.filter((e) => e.siteId === site.id).length,
    payments: data.payments.filter((p) => p.siteId === site.id).length,
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'sheet', label: 'Costing Sheet' },
    { id: 'material', label: `Material (${counts.material})` },
    { id: 'labour', label: `Labour (${counts.labour})` },
    { id: 'expenses', label: `Other Exp. (${counts.expenses})` },
    { id: 'payments', label: `Client Payments (${counts.payments})` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div>
          <button onClick={onBack} className="mb-1 text-sm text-slate-500 hover:text-slate-900">← All sites</button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{site.name}</h1>
            <StatusBadge status={site.status} />
          </div>
          <p className="text-sm text-slate-500">
            {[site.clientName, site.clientPhone, site.location, site.startDate && `Started ${site.startDate}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={onEdit}>Edit site</button>
          <button className={btnGhost + ' text-red-600'} onClick={onDelete}>Delete</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 print:hidden">
        <Stat label="Total Cost" value={money(sum.totalCost)} />
        <Stat label="Contract Value" value={sum.contractValue ? money(sum.contractValue) : 'Not set'} />
        <Stat label="Profit / Loss" value={sum.contractValue ? money(sum.profit) : '—'} tone={sum.profit < 0 ? 'bad' : 'good'} />
        <Stat label="Pending to pay" value={money(sum.unpaid)} tone="warn" />
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 print:hidden">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
              tab === t.id ? 'border-amber-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sheet' && <CostingSheet site={site} data={data} />}
      {tab === 'material' && <MaterialTab siteId={site.id} data={data} update={update} />}
      {tab === 'labour' && <LabourTab siteId={site.id} data={data} update={update} />}
      {tab === 'expenses' && <ExpenseTab siteId={site.id} data={data} update={update} />}
      {tab === 'payments' && <PaymentTab siteId={site.id} data={data} update={update} />}
    </div>
  );
}

/* ---------------------------------------------------------------- Costing sheet */

function CostingSheet({ site, data }: { site: Site; data: CostingData }) {
  const sum = summarize(data, site.id);
  const [overheadPct, setOverheadPct] = useState('10');
  const [profitPct, setProfitPct] = useState('20');
  const [gstPct, setGstPct] = useState('18');

  const overhead = round2(sum.totalCost * (num(overheadPct) / 100));
  const costWithOh = round2(sum.totalCost + overhead);
  const profit = round2(costWithOh * (num(profitPct) / 100));
  const beforeTax = round2(costWithOh + profit);
  const gst = round2(beforeTax * (num(gstPct) / 100));
  const quote = round2(beforeTax + gst);

  const breakdown = (title: string, map: Record<string, number>, total: number) => (
    <div>
      <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">{title}</h4>
      <table className="w-full text-sm">
        <tbody>
          {Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => (
              <tr key={k} className="border-b border-slate-100">
                <td className="py-1.5">{k}</td>
                <td className="py-1.5 text-right tabular-nums">{money(v)}</td>
                <td className="w-14 py-1.5 text-right text-xs text-slate-500 tabular-nums">{total ? Math.round((v / total) * 100) : 0}%</td>
              </tr>
            ))}
          {Object.keys(map).length === 0 && (
            <tr><td className="py-1.5 text-slate-400" colSpan={3}>No entries yet</td></tr>
          )}
          <tr className="font-bold">
            <td className="pt-2">Total</td>
            <td className="pt-2 text-right tabular-nums">{money(total)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button className={btnPrimary} onClick={() => window.print()}>Print / Save as PDF</button>
        <button
          className={btnGhost}
          onClick={() => downloadFile(`costing-${site.name.replace(/[^a-z0-9]+/gi, '-')}-${today()}.csv`, siteCsv(data, site.id), 'text/csv')}
        >
          Download Excel (CSV)
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 print:border-0 print:p-0">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-amber-600">{data.businessName ? `${data.businessName} · ` : ''}Costing Sheet</div>
            <h2 className="text-xl font-bold">{site.name}</h2>
            <p className="text-sm text-slate-600">{[site.clientName, site.clientPhone].filter(Boolean).join(' · ')}</p>
            <p className="text-sm text-slate-600">{site.location}</p>
          </div>
          <div className="text-sm text-slate-600 sm:text-right">
            <div>Date: {today()}</div>
            {site.startDate && <div>Started: {site.startDate}</div>}
            <div>Status: {STATUS_LABEL[site.status]}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 print:grid-cols-3">
          {breakdown('Material', sum.materialByCategory, sum.material)}
          {breakdown('Labour', sum.labourByTrade, sum.labour)}
          {breakdown('Other Expenses', sum.expensesByCategory, sum.expenses)}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 print:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-4">
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Actual Cost Summary</h4>
            <SumRow label="Material" value={sum.material} />
            <SumRow label="Labour" value={sum.labour} sub={sum.labourDays ? `${sum.labourDays} man-days` : undefined} />
            <SumRow label="Other expenses" value={sum.expenses} />
            <SumRow label="Total cost" value={sum.totalCost} bold />
            <div className="my-2 border-t border-slate-200" />
            <SumRow label="Contract value" value={sum.contractValue} />
            <SumRow
              label={sum.profit < 0 ? 'Loss' : 'Profit'}
              value={sum.profit}
              bold
              cls={sum.profit < 0 ? 'text-red-600' : 'text-emerald-700'}
              sub={sum.contractValue ? `${sum.marginPct}% margin` : 'set contract value'}
            />
            <div className="my-2 border-t border-slate-200" />
            <SumRow label="Received from client" value={sum.received} />
            <SumRow label="Balance to receive" value={round2(sum.contractValue - sum.received)} />
            <SumRow label="Pending dues (vendors / workers)" value={sum.unpaid} cls="text-amber-700" />
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-amber-800">Quotation Calculator</h4>
            <div className="mb-3 grid grid-cols-3 gap-2 print:hidden">
              <div>
                <label className={labelCls}>Overhead %</label>
                <input type="number" step="any" className={inputCls} value={overheadPct} onChange={(e) => setOverheadPct(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Profit %</label>
                <input type="number" step="any" className={inputCls} value={profitPct} onChange={(e) => setProfitPct(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>GST %</label>
                <input type="number" step="any" className={inputCls} value={gstPct} onChange={(e) => setGstPct(e.target.value)} />
              </div>
            </div>
            <SumRow label="Base cost" value={sum.totalCost} />
            <SumRow label={`Overhead (${num(overheadPct)}%)`} value={overhead} />
            <SumRow label={`Profit (${num(profitPct)}%)`} value={profit} />
            <SumRow label="Amount before tax" value={beforeTax} bold />
            <SumRow label={`GST (${num(gstPct)}%)`} value={gst} />
            <SumRow label="Suggested quote" value={quote} bold cls="text-amber-900 text-base" />
          </div>
        </div>

        <DetailTables site={site} data={data} />
      </div>
    </div>
  );
}

function SumRow({ label, value, bold, cls, sub }: { label: string; value: number; bold?: boolean; cls?: string; sub?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1 text-sm ${bold ? 'font-bold' : ''} ${cls ?? ''}`}>
      <span>
        {label}
        {sub && <span className="ml-1 text-xs font-normal text-slate-500">({sub})</span>}
      </span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}

/** Full itemised list – visible on screen under a toggle and always in print. */
function DetailTables({ site, data }: { site: Site; data: CostingData }) {
  const [open, setOpen] = useState(false);
  const mats = data.materials.filter((m) => m.siteId === site.id).sort((a, b) => a.date.localeCompare(b.date));
  const labs = data.labour.filter((l) => l.siteId === site.id).sort((a, b) => a.date.localeCompare(b.date));
  const exps = data.expenses.filter((e) => e.siteId === site.id).sort((a, b) => a.date.localeCompare(b.date));
  const th = 'px-2 py-1 text-left text-xs font-semibold text-slate-500';
  const td = 'px-2 py-1';

  return (
    <div className="mt-6">
      <button className={btnGhost + ' print:hidden'} onClick={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'} itemised details
      </button>
      <div className={`${open ? 'block' : 'hidden'} mt-4 space-y-5 print:block`}>
        <div className="overflow-x-auto">
          <h4 className="mb-1 text-sm font-bold">Material details</h4>
          <table className="w-full min-w-[600px] text-xs">
            <thead><tr className="border-b border-slate-200"><th className={th}>Date</th><th className={th}>Item</th><th className={th}>Vendor</th><th className={th}>Qty</th><th className={th}>Rate</th><th className={th + ' text-right'}>Amount</th></tr></thead>
            <tbody>
              {mats.map((m) => (
                <tr key={m.id} className="border-b border-slate-100">
                  <td className={td}>{m.date}</td><td className={td}>{m.item} <span className="text-slate-400">({m.category})</span></td><td className={td}>{m.vendor}</td>
                  <td className={td}>{m.quantity} {m.unit}</td><td className={td}>{money(m.rate)}</td><td className={td + ' text-right tabular-nums'}>{money(m.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <h4 className="mb-1 text-sm font-bold">Labour details</h4>
          <table className="w-full min-w-[600px] text-xs">
            <thead><tr className="border-b border-slate-200"><th className={th}>Date</th><th className={th}>Worker</th><th className={th}>Trade</th><th className={th}>Days / Type</th><th className={th}>Rate</th><th className={th + ' text-right'}>Amount</th></tr></thead>
            <tbody>
              {labs.map((l) => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className={td}>{l.date}</td><td className={td}>{l.workerName}</td><td className={td}>{l.trade}</td>
                  <td className={td}>{l.payType === 'DAILY' ? `${l.days} day(s)` : 'Contract'}</td><td className={td}>{money(l.rate)}</td><td className={td + ' text-right tabular-nums'}>{money(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="overflow-x-auto">
          <h4 className="mb-1 text-sm font-bold">Other expense details</h4>
          <table className="w-full min-w-[500px] text-xs">
            <thead><tr className="border-b border-slate-200"><th className={th}>Date</th><th className={th}>Category</th><th className={th}>Description</th><th className={th + ' text-right'}>Amount</th></tr></thead>
            <tbody>
              {exps.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className={td}>{e.date}</td><td className={td}>{e.category}</td><td className={td}>{e.description}</td><td className={td + ' text-right tabular-nums'}>{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Entry tabs */

interface TabProps {
  siteId: string;
  data: CostingData;
  update: (fn: (d: CostingData) => CostingData) => void;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-base font-bold">{title}</h3>
      {children}
    </div>
  );
}

function PaidToggle({ paid, onToggle }: { paid: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
      title="Click to change"
    >
      {paid ? 'Paid' : 'Pending'}
    </button>
  );
}

/* Material */

function MaterialTab({ siteId, data, update }: TabProps) {
  const blank = { date: today(), item: '', category: MATERIAL_CATEGORIES[0], vendor: '', quantity: '', unit: MATERIAL_UNITS[0], rate: '', billNo: '', paid: false, notes: '' };
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const amount = round2(num(f.quantity) * num(f.rate));
  const rows = data.materials
    .filter((m) => m.siteId === siteId)
    .filter((m) => !search || `${m.item} ${m.vendor} ${m.category}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));
  const vendors = Array.from(new Set(data.materials.map((m) => m.vendor).filter(Boolean))) as string[];
  const items = Array.from(new Set(data.materials.map((m) => m.item)));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.item.trim()) return;
    const entry: MaterialEntry = {
      id: editId ?? newId(),
      siteId,
      date: f.date,
      item: f.item.trim(),
      category: f.category,
      vendor: f.vendor.trim(),
      quantity: num(f.quantity),
      unit: f.unit,
      rate: num(f.rate),
      amount,
      billNo: f.billNo.trim(),
      paid: f.paid,
      notes: f.notes.trim(),
    };
    update((d) => ({
      ...d,
      materials: editId ? d.materials.map((m) => (m.id === editId ? entry : m)) : [...d.materials, entry],
    }));
    setF({ ...blank, date: f.date, category: f.category, vendor: editId ? '' : f.vendor });
    setEditId(null);
  };

  const startEdit = (m: MaterialEntry) => {
    setEditId(m.id);
    setF({ date: m.date, item: m.item, category: m.category, vendor: m.vendor ?? '', quantity: String(m.quantity), unit: m.unit, rate: String(m.rate), billNo: m.billNo ?? '', paid: m.paid, notes: m.notes ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const total = rows.reduce((s, m) => s + m.amount, 0);

  return (
    <div className="space-y-4">
      <Card title={editId ? 'Edit material entry' : 'Add material'}>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="col-span-2 md:col-span-1">
            <label className={labelCls}>Item *</label>
            <input list="mat-items" className={inputCls} value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} placeholder="e.g. 18mm BWP Ply" required />
            <datalist id="mat-items">{items.map((i) => <option key={i} value={i} />)}</datalist>
          </div>
          <div><label className={labelCls}>Category</label><select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{MATERIAL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div>
            <label className={labelCls}>Vendor / shop</label>
            <input list="mat-vendors" className={inputCls} value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} />
            <datalist id="mat-vendors">{vendors.map((v) => <option key={v} value={v} />)}</datalist>
          </div>
          <div><label className={labelCls}>Quantity</label><input type="number" step="any" min="0" className={inputCls} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
          <div><label className={labelCls}>Unit</label><select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>{MATERIAL_UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
          <div><label className={labelCls}>Rate (₹ / unit)</label><input type="number" step="any" min="0" className={inputCls} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
          <div><label className={labelCls}>Bill no.</label><input className={inputCls} value={f.billNo} onChange={(e) => setF({ ...f, billNo: e.target.value })} /></div>
          <div className="col-span-2 md:col-span-2"><label className={labelCls}>Notes</label><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> Paid to vendor</label>
          <div className="flex items-center justify-between gap-2 md:justify-end">
            <span className="text-sm font-bold tabular-nums">{money(amount)}</span>
            <div className="flex gap-2">
              {editId && <button type="button" className={btnGhost} onClick={() => { setEditId(null); setF(blank); }}>Cancel</button>}
              <button type="submit" className={btnPrimary}>{editId ? 'Save' : 'Add'}</button>
            </div>
          </div>
        </form>
      </Card>

      <Card title={`Material entries · ${money(total)}`}>
        <input className={inputCls + ' mb-3'} placeholder="Search item, vendor or category…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Date</th><th>Item</th><th>Vendor</th><th className="text-right">Qty × Rate</th><th className="text-right">Amount</th><th className="text-center">Status</th><th /></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="py-2 whitespace-nowrap">{m.date}</td>
                    <td><div className="font-medium">{m.item}</div><div className="text-xs text-slate-500">{m.category}{m.billNo ? ` · Bill ${m.billNo}` : ''}</div></td>
                    <td>{m.vendor}</td>
                    <td className="text-right tabular-nums whitespace-nowrap">{m.quantity} {m.unit} × {money(m.rate)}</td>
                    <td className="text-right font-semibold tabular-nums">{money(m.amount)}</td>
                    <td className="text-center"><PaidToggle paid={m.paid} onToggle={() => update((d) => ({ ...d, materials: d.materials.map((x) => (x.id === m.id ? { ...x, paid: !x.paid } : x)) }))} /></td>
                    <td className="text-right whitespace-nowrap">
                      <button className={btnSmall} onClick={() => startEdit(m)}>Edit</button>
                      <button className={btnDanger} onClick={() => window.confirm('Delete this entry?') && update((d) => ({ ...d, materials: d.materials.filter((x) => x.id !== m.id) }))}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* Labour */

function LabourTab({ siteId, data, update }: TabProps) {
  const blank = { date: today(), workerName: '', trade: LABOUR_TRADES[0], payType: 'DAILY' as LabourPayType, days: '1', rate: '', paid: false, notes: '' };
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const [view, setView] = useState<'entries' | 'workers'>('entries');
  const amount = labourAmount(f.payType, num(f.days), num(f.rate));
  const all = data.labour.filter((l) => l.siteId === siteId);
  const rows = [...all].sort((a, b) => b.date.localeCompare(a.date));
  const workers = Array.from(new Set(data.labour.map((l) => l.workerName)));

  // remember last rate/trade for a worker to speed up daily entry
  const pickWorker = (name: string) => {
    const last = [...data.labour].reverse().find((l) => l.workerName.toLowerCase() === name.toLowerCase());
    setF((prev) => (last && !editId ? { ...prev, workerName: name, trade: last.trade, payType: last.payType, rate: String(last.rate) } : { ...prev, workerName: name }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.workerName.trim()) return;
    const entry: LabourEntry = {
      id: editId ?? newId(),
      siteId,
      date: f.date,
      workerName: f.workerName.trim(),
      trade: f.trade,
      payType: f.payType,
      days: f.payType === 'DAILY' ? num(f.days) : 0,
      rate: num(f.rate),
      amount,
      paid: f.paid,
      notes: f.notes.trim(),
    };
    update((d) => ({ ...d, labour: editId ? d.labour.map((l) => (l.id === editId ? entry : l)) : [...d.labour, entry] }));
    setF({ ...blank, date: f.date });
    setEditId(null);
  };

  const startEdit = (l: LabourEntry) => {
    setEditId(l.id);
    setF({ date: l.date, workerName: l.workerName, trade: l.trade, payType: l.payType, days: String(l.days || 1), rate: String(l.rate), paid: l.paid, notes: l.notes ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const byWorker = Object.values(
    all.reduce<Record<string, { name: string; trade: string; days: number; total: number; pending: number }>>((acc, l) => {
      const k = l.workerName.toLowerCase();
      acc[k] ??= { name: l.workerName, trade: l.trade, days: 0, total: 0, pending: 0 };
      acc[k].days += l.payType === 'DAILY' ? l.days : 0;
      acc[k].total += l.amount;
      if (!l.paid) acc[k].pending += l.amount;
      return acc;
    }, {}),
  ).sort((a, b) => b.total - a.total);

  const markWorkerPaid = (name: string) => {
    if (!window.confirm(`Mark all pending entries of ${name} at this site as paid?`)) return;
    update((d) => ({
      ...d,
      labour: d.labour.map((l) => (l.siteId === siteId && l.workerName.toLowerCase() === name.toLowerCase() ? { ...l, paid: true } : l)),
    }));
  };

  const total = all.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-4">
      <Card title={editId ? 'Edit labour entry' : 'Add labour'}>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div className="col-span-2 md:col-span-1">
            <label className={labelCls}>Worker / contractor *</label>
            <input list="lab-workers" className={inputCls} value={f.workerName} onChange={(e) => pickWorker(e.target.value)} required />
            <datalist id="lab-workers">{workers.map((w) => <option key={w} value={w} />)}</datalist>
          </div>
          <div><label className={labelCls}>Trade</label><select className={inputCls} value={f.trade} onChange={(e) => setF({ ...f, trade: e.target.value })}>{LABOUR_TRADES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div>
            <label className={labelCls}>Payment type</label>
            <select className={inputCls} value={f.payType} onChange={(e) => setF({ ...f, payType: e.target.value as LabourPayType })}>
              <option value="DAILY">Daily wage (dihadi)</option>
              <option value="CONTRACT">Contract / lump sum</option>
            </select>
          </div>
          {f.payType === 'DAILY' && (
            <div><label className={labelCls}>Days (0.5 = half day)</label><input type="number" step="0.5" min="0" className={inputCls} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} /></div>
          )}
          <div><label className={labelCls}>{f.payType === 'DAILY' ? 'Rate per day (₹)' : 'Contract amount (₹)'}</label><input type="number" step="any" min="0" className={inputCls} value={f.rate} onChange={(e) => setF({ ...f, rate: e.target.value })} /></div>
          <div className="col-span-2 md:col-span-1"><label className={labelCls}>Notes / work done</label><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> Paid</label>
          <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-4 md:justify-end">
            <span className="text-sm font-bold tabular-nums">{money(amount)}</span>
            <div className="flex gap-2">
              {editId && <button type="button" className={btnGhost} onClick={() => { setEditId(null); setF(blank); }}>Cancel</button>}
              <button type="submit" className={btnPrimary}>{editId ? 'Save' : 'Add'}</button>
            </div>
          </div>
        </form>
      </Card>

      <Card title={`Labour · ${money(total)}`}>
        <div className="mb-3 flex gap-2">
          <button className={view === 'entries' ? btnPrimary : btnGhost} onClick={() => setView('entries')}>Entries</button>
          <button className={view === 'workers' ? btnPrimary : btnGhost} onClick={() => setView('workers')}>Worker-wise hisaab</button>
        </div>
        {rows.length === 0 ? <Empty /> : view === 'entries' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Date</th><th>Worker</th><th>Trade</th><th className="text-right">Days × Rate</th><th className="text-right">Amount</th><th className="text-center">Status</th><th /></tr></thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="py-2 whitespace-nowrap">{l.date}</td>
                    <td><div className="font-medium">{l.workerName}</div>{l.notes && <div className="text-xs text-slate-500">{l.notes}</div>}</td>
                    <td>{l.trade}</td>
                    <td className="text-right tabular-nums whitespace-nowrap">{l.payType === 'DAILY' ? `${l.days} × ${money(l.rate)}` : 'Contract'}</td>
                    <td className="text-right font-semibold tabular-nums">{money(l.amount)}</td>
                    <td className="text-center"><PaidToggle paid={l.paid} onToggle={() => update((d) => ({ ...d, labour: d.labour.map((x) => (x.id === l.id ? { ...x, paid: !x.paid } : x)) }))} /></td>
                    <td className="text-right whitespace-nowrap">
                      <button className={btnSmall} onClick={() => startEdit(l)}>Edit</button>
                      <button className={btnDanger} onClick={() => window.confirm('Delete this entry?') && update((d) => ({ ...d, labour: d.labour.filter((x) => x.id !== l.id) }))}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Worker</th><th>Trade</th><th className="text-right">Days</th><th className="text-right">Total</th><th className="text-right">Pending</th><th /></tr></thead>
              <tbody>
                {byWorker.map((w) => (
                  <tr key={w.name} className="border-t border-slate-100">
                    <td className="py-2 font-medium">{w.name}</td>
                    <td>{w.trade}</td>
                    <td className="text-right tabular-nums">{round2(w.days)}</td>
                    <td className="text-right tabular-nums">{money(w.total)}</td>
                    <td className={`text-right font-semibold tabular-nums ${w.pending ? 'text-amber-700' : 'text-emerald-700'}`}>{money(w.pending)}</td>
                    <td className="text-right">{w.pending > 0 && <button className={btnSmall} onClick={() => markWorkerPaid(w.name)}>Mark all paid</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* Other expenses */

function ExpenseTab({ siteId, data, update }: TabProps) {
  const blank = { date: today(), category: EXPENSE_CATEGORIES[0], description: '', amount: '', paid: true };
  const [f, setF] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const rows = data.expenses.filter((e) => e.siteId === siteId).sort((a, b) => b.date.localeCompare(a.date));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!num(f.amount)) return;
    const entry: ExpenseEntry = { id: editId ?? newId(), siteId, date: f.date, category: f.category, description: f.description.trim(), amount: round2(num(f.amount)), paid: f.paid };
    update((d) => ({ ...d, expenses: editId ? d.expenses.map((x) => (x.id === editId ? entry : x)) : [...d.expenses, entry] }));
    setF({ ...blank, date: f.date });
    setEditId(null);
  };

  const total = rows.reduce((s, x) => s + x.amount, 0);

  return (
    <div className="space-y-4">
      <Card title={editId ? 'Edit expense' : 'Add other expense'}>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><label className={labelCls}>Category</label><select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="col-span-2"><label className={labelCls}>Description</label><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. Tempo for ply delivery" /></div>
          <div><label className={labelCls}>Amount (₹) *</label><input type="number" step="any" min="0" className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.paid} onChange={(e) => setF({ ...f, paid: e.target.checked })} /> Paid</label>
          <div className="col-span-1 flex justify-end gap-2 md:col-span-4">
            {editId && <button type="button" className={btnGhost} onClick={() => { setEditId(null); setF(blank); }}>Cancel</button>}
            <button type="submit" className={btnPrimary}>{editId ? 'Save' : 'Add'}</button>
          </div>
        </form>
      </Card>
      <Card title={`Other expenses · ${money(total)}`}>
        {rows.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Date</th><th>Category</th><th>Description</th><th className="text-right">Amount</th><th className="text-center">Status</th><th /></tr></thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.id} className="border-t border-slate-100">
                    <td className="py-2 whitespace-nowrap">{x.date}</td>
                    <td>{x.category}</td>
                    <td>{x.description}</td>
                    <td className="text-right font-semibold tabular-nums">{money(x.amount)}</td>
                    <td className="text-center"><PaidToggle paid={x.paid} onToggle={() => update((d) => ({ ...d, expenses: d.expenses.map((y) => (y.id === x.id ? { ...y, paid: !y.paid } : y)) }))} /></td>
                    <td className="text-right whitespace-nowrap">
                      <button className={btnSmall} onClick={() => { setEditId(x.id); setF({ date: x.date, category: x.category, description: x.description, amount: String(x.amount), paid: x.paid }); }}>Edit</button>
                      <button className={btnDanger} onClick={() => window.confirm('Delete this entry?') && update((d) => ({ ...d, expenses: d.expenses.filter((y) => y.id !== x.id) }))}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

/* Client payments */

function PaymentTab({ siteId, data, update }: TabProps) {
  const blank = { date: today(), amount: '', mode: PAYMENT_MODES[0], notes: '' };
  const [f, setF] = useState(blank);
  const rows = data.payments.filter((p) => p.siteId === siteId).sort((a, b) => b.date.localeCompare(a.date));
  const sum = summarize(data, siteId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!num(f.amount)) return;
    const entry: Payment = { id: newId(), siteId, date: f.date, amount: round2(num(f.amount)), mode: f.mode, notes: f.notes.trim() };
    update((d) => ({ ...d, payments: [...d.payments, entry] }));
    setF({ ...blank, date: f.date });
  };

  return (
    <div className="space-y-4">
      <Card title="Record payment received from client">
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div><label className={labelCls}>Date</label><input type="date" className={inputCls} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
          <div><label className={labelCls}>Amount (₹) *</label><input type="number" step="any" min="0" className={inputCls} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></div>
          <div><label className={labelCls}>Mode</label><select className={inputCls} value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>{PAYMENT_MODES.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div><label className={labelCls}>Notes</label><input className={inputCls} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="e.g. 2nd advance" /></div>
          <div className="flex items-end justify-end"><button type="submit" className={btnPrimary}>Add</button></div>
        </form>
      </Card>
      <Card title={`Received ${money(sum.received)}${sum.contractValue ? ` of ${money(sum.contractValue)} · Balance ${money(sum.contractValue - sum.received)}` : ''}`}>
        {rows.length === 0 ? <Empty /> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-2">Date</th><th>Mode</th><th>Notes</th><th className="text-right">Amount</th><th /></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="py-2">{p.date}</td><td>{p.mode}</td><td>{p.notes}</td>
                  <td className="text-right font-semibold tabular-nums">{money(p.amount)}</td>
                  <td className="text-right"><button className={btnDanger} onClick={() => window.confirm('Delete this payment?') && update((d) => ({ ...d, payments: d.payments.filter((x) => x.id !== p.id) }))}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Empty() {
  return <p className="py-6 text-center text-sm text-slate-500">No entries yet.</p>;
}
