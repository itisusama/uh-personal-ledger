# Usama Hassan Account Statement

A private money notebook that runs entirely in the browser. It uses plain HTML, CSS and JavaScript, with no backend, database or login.

**Record → Review → Plus/Minus → Backup as Markdown → Restore when needed.**

## Use it

Open `index.html` in any modern browser. Nothing needs to be installed or built.

- **Add Transaction**: date, description, amount (PKR), account/source, and Credit (money in) or Debit (money out).
- **Month view**: use ← / → or the month dropdown, or choose **All Time**. Credit, Debit, Net, the transaction list and the account summary all follow the selected month.
- **Filters**: account, type and search (description or account) work together. Tap an account name in *Accounts* to filter by it.
- **Backup & Data**:
  - **Download Markdown** / **Copy Markdown** produce the same text, for either All Time or only the selected month.
  - **Import Markdown** reads a file exported earlier and shows how many transactions it found. You then choose **Replace** or **Merge**. Merge skips duplicates by ID, or by date + description + amount + account + type when a row has no ID.
  - **Clear All Data** asks for confirmation first and offers to download a backup.

## Storage

- Live data is kept in Local Storage under the key `usamaHassanAccountStatement`.
- Local Storage belongs to one browser on one device. Keep the downloaded `.md` file somewhere safe; it is the portable record.
- On the first visit, five sample transactions (marked **Sample**) are loaded. Remove them with **Clear sample data**.

## Files

```
index.html   markup
style.css    styles (responsive; transactions become cards on mobile)
app.js       storage, calculations, rendering, Markdown export/import
```
