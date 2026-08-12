# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server, fixed port 3000 (strictPort — fails if taken, doesn't fall back)
npm run build             # production build
npm run preview           # serve the production build
npm run lint               # eslint . — see "ESLint only covers .ts/.tsx" below before trusting this
npm test                   # jest (all tests)
npm run test:watch
npm run test:coverage
npm run test:unit          # jest --testPathPattern=unit
npm run test:integration   # jest --testPathPattern=integration
npm run test:performance   # jest --testPathPattern=performance
npx jest path/to/file.test.js              # single test file
npx jest -t "test name substring"          # single test by name
```

Tests live centrally under `src/tests/` (components/, services/, integration/, performance/), not colocated next to source files. Only a handful exist today.

## Before writing new code

Before adding a new component, modal, or data-fetching function, check whether one already exists and reuse/wire it in rather than writing a parallel one-off. This codebase has repeatedly grown duplicate inline versions of things that already exist as shared components/services (e.g. `src/components/rendez-vous/NewAppointmentModal.jsx` is the one "Nouveau rendez-vous" modal — several pages used to each carry their own inline copy). Grep for the feature name/domain term first (component name, service name, table name) before implementing.

## Architecture

**Stack**: React 19 + Vite, Tailwind, Supabase (Postgres + Auth + Realtime), react-router-dom v7 with **`HashRouter`** — every in-app route is `#/...`. Entry point is `src/main.tsx` → `src/App.jsx` (there is also an `App.optimized.jsx` in `src/` — it is *not* wired up anywhere and can be ignored/removed; the live one is `App.jsx`).

**Auth is two-step, not a single login.** `src/contexts/AuthContext.jsx` is the only auth context actually used (the repo also has `HybridAuthContext`, `OptimizedAuthContext`, `SimpleAuthContext` — all unused legacy). The flow:
1. `login(username, password)` in `AuthContext` resolves `username` → `email` via the `get_user_by_username` RPC, then calls `supabase.auth.signInWithPassword`.
2. After that first login, `src/pages/CabinetWelcome.jsx` shows every staff member (`users` row) belonging to that tenant. Picking one and entering **their own password** calls `login()` again — this is a full second Supabase Auth sign-in as a *different* `users` row, not a lightweight role switch. Each staff member has their own separate password; there is no shared "cabinet password". (The `Login.jsx` "connexion rapide" panel, toggled with Ctrl+Shift+E, only knows a shared password for **admin** quick-login accounts, via `getQuickLoginPassword()` — it does not help for doctor/secretary/cashier accounts.)

**Roles & route guards**: `ROLES` in `src/utils/permissions.js` (`admin`, `doctor`, `secretary`, `accounting`, `caissier` — `cashier` is a legacy alias, normalize to `caissier`). Routes are wrapped in `<ProtectedRoute allowedRoles={[...]}>` in `App.jsx`.

**Finance/comptabilité navigation** has one source of truth: `src/config/financeNavigation.js` (`FINANCE_ROUTES`). Both `App.jsx` route guards (via `getAllowedRoles(path)`) and the sidebar menu (via `getFinanceRoutesForRole(role)`) read from it. Add a new caisse/comptabilité/facturation page's roles here, not separately in both places — that's the bug this file's header comment says it was created to prevent.

**Facture / paiement domain model** (the trickiest part of the schema):
- `factures.type` is `'patient'` or `'couverture'`, with a self-referencing `facture_parent_id`. When a facture has insurance coverage, the insurer's share is **not** a field on the same row — it's split into a separate child facture (`type = 'couverture'`, `facture_parent_id = <parent id>`, `numero_facture = '<parent numero>-C'`). The parent's own `montant_ttc` must be reduced to just the patient's share once this split happens, and it must happen **exactly once** per facture — recomputing the split on every reopen re-shares the insurer's portion with the patient (a real overbilling bug fixed in this codebase; see `src/pages/secretary/Caisse.jsx`, `handleOpenModal`/`handlePaiementSubmit`, for the "already split? check for an existing couverture child first" pattern before touching this logic again).
- `factures.montant_restant` and `lignes_facture.montant_ligne` are DB **generated** columns (`GENERATED ALWAYS AS (...) STORED`) — never insert/update them. Note the actual column is `montant_ligne`, not `montant_total`; a stray `.montant_total` read on a fetched `lignes_facture` row is a silent bug (renders `0`) rather than a crash, so check for it if a displayed amount looks wrong.
- `src/services/paiementService.js` → `enregistrerPaiement()` is the single funnel for all payment writes (updates `factures` + inserts into `paiements` together). It's shared by `Caisse.jsx` (guichet) and `EncaissementFactures.jsx` (corrections comptables) — don't write ad hoc payment inserts elsewhere.
- FCFA has no decimal subunit: always format money with `formatMontant()` / `formatMontantDecimal()` from `src/utils/currency.js` (0 decimal places), never `toFixed(2)`-style formatting.

**UI convention**: any table/list that can exceed 10 rows must be paginated, or — when each row's content is itself variable-length (e.g. a debtor's list of invoices) — shown inside a `max-h-* overflow-y-auto` panel or its own detail page, rather than growing the page unboundedly. See `src/pages/comptabilite/ImpayesRelances.jsx` (collapsible cards) and `AssuranceCreanceDetail.jsx` (dedicated detail table) for the pattern.

**ESLint only covers `.ts/.tsx`.** `eslint.config.js`'s `files` glob is `**/*.{ts,tsx}` — since nearly the entire app is `.jsx`/`.js`, `npm run lint` and `npx eslint some/file.jsx` silently do nothing useful for those files (you'll see "File ignored because no matching configuration was supplied", or nothing at all with `--no-warn-ignored`). Don't treat a clean eslint run on a `.jsx` file as verification. To check JS/JSX changes, rely on the Vite dev server compiling without error and on manual/browser testing.

**Database migrations**: the real schema source of truth is `supabase/migrations/` (Supabase CLI migrations). The `supabase/` directory root also contains ~80 loose, ad hoc SQL scripts (`fix-*.sql`, `check-*.sql`, `cleanup-*.sql`, etc.) plus a separate top-level `migrations/` folder — these are historical one-off debugging/patch scripts run manually against a live database, not a tracked/reapplied migration chain. Don't assume anything in them is currently applied without checking the live schema.
