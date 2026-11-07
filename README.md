# Site Management – Interior Costing

Simple software for an interior business with multiple sites. For every site you can record:

- **Material** – item, category, vendor, quantity × rate, bill no., paid / pending
- **Labour** – daily wage (days × rate) or contract amount, trade, worker-wise account
- **Other expenses** – transport, loading, tools, food, etc.
- **Client payments** – money received and balance due

Each site has a **Costing Sheet**: cost breakdown by category, total cost, profit / margin against the
contract value, pending dues, and a quotation calculator (overhead %, profit %, GST %).
Print it / save as PDF, or download it as a CSV to open in Excel.

Data is stored in the browser on the device you use. Use **Backup** to download a copy and **Restore** to load it on another device.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000
