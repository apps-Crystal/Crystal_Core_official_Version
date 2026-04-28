# Crystal Core

Universal authentication & access-control for the Crystal Group system family
(Procurement, Warehouse Management, Hiring, Reports, …).

One account, one set of credentials, one place to grant or revoke access.
Every downstream system trusts a JWT issued by Crystal Core.

---

## High-level shape

```
┌──────────────┐  signup / login        ┌────────────────────────────┐
│  Browser UI  │ ─────────────────────► │  Next.js (App Router)      │
└──────────────┘                        │  /api/auth/* + middleware  │
                                        └─────────────┬──────────────┘
                                                      │ HTTPS + secret
                                                      ▼
                                        ┌────────────────────────────┐
                                        │  Apps Script Web App       │
                                        │  reads/writes USERS sheet  │
                                        └────────────────────────────┘
                                                      │
              ┌───────────────────────┐               │
              │ WMS / Procurement /   │ verify(JWT)   │
              │ Hiring …              │ ──────────────┘
              └───────────────────────┘  /api/auth/verify
```

* **No service-account JSON in Next.js.** Only the Apps Script knows the sheet.
* **Sheets is hidden behind one repository file** (`src/lib/users.ts`).
  Migrate to Postgres later by reimplementing that file.

---

## Quick start

```bash
cp .env.local.example .env.local   # then fill in the secrets
npm install
npm run dev
```

Open <http://localhost:3000>.

### Bootstrap your first developer

The signup endpoint creates accounts in the `pending` state — you need a
developer to approve them, but you don't have a developer yet. Use the
bootstrap env var **once**:

```env
BOOTSTRAP_DEVELOPER_EMAILS=you@crystalgroup.in
```

Sign up with that email; the account is auto-approved as `developer`. Then
**unset the variable** and redeploy.

---

## Required environment

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | HS256 signing key. Min 32 chars. Generate with `openssl rand -base64 48`. |
| `JWT_EXPIRY` | jose duration string (e.g. `8h`, `1d`). Default `8h`. |
| `APPS_SCRIPT_URL` | Web App `/exec` URL from Apps Script deployment. |
| `APPS_SCRIPT_SHARED_SECRET` | Same value you set as `SCRIPT_SHARED_SECRET` in Apps Script. |
| `BCRYPT_COST` | Defaults to 12. |
| `BOOTSTRAP_DEVELOPER_EMAILS` | Comma-separated emails auto-approved as `developer` (bootstrap only). |

---

## Apps Script setup

The script is at [`apps-script/Code.gs`](apps-script/Code.gs).

1. Open the spreadsheet → **Extensions → Apps Script**.
2. Replace `Code.gs` with the contents of `apps-script/Code.gs`.
3. **Project Settings → Script properties** → add
   `SCRIPT_SHARED_SECRET` (must match `APPS_SCRIPT_SHARED_SECRET` in Next.js).
4. **Deploy → New deployment → Web app**
   * Execute as: **Me**
   * Who has access: **Anyone**
5. Copy the `/exec` URL into `APPS_SCRIPT_URL`.

The sheet must be named **USERS** and the first row must be exactly:

```
user_id | email | name | Phone | is_active | created_at | updated_at | last_login_at | Password | Access | Role | Status
```

---

## Roles

| Role | Default systems | Notes |
|---|---|---|
| `developer`  | all                              | Can approve users + manage roles. |
| `manager`    | procurement, wms, reports        | Limited admin. |
| `supervisor` | wms, procurement                 | Operational. |
| `security`   | wms                              | Restricted view. |
| `admin`      | crystal_core                     | Configurable per user by a developer. |

Per-user `Access` overrides the role default — the developer can grant or
revoke individual systems from the Approvals dashboard.

---

## API surface

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/signup`  | Create account in `pending` state. |
| POST | `/api/auth/login`   | Returns JWT, sets `crystal_core_session` cookie. |
| POST | `/api/auth/logout`  | Clears the cookie. |
| GET  | `/api/auth/me`      | Returns the current session user. |
| POST/GET | `/api/auth/verify` | **The integration endpoint.** Other systems call this. |

### Admin (developer only)

| Method | Path | Description |
|---|---|---|
| GET   | `/api/admin/users[?status=pending]` | List users. |
| GET   | `/api/admin/users/:userId`          | Get one user. |
| PATCH | `/api/admin/users/:userId`          | Approve / reject / suspend / change role / change systems. |

### How other systems use Crystal Core

```ts
// Inside WMS / Procurement / etc.
const res = await fetch("https://core.crystalgroup.in/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: bearerFromUser, system: "wms" }),
});
const { ok, data } = await res.json();
if (!ok || !data.allowed) throw new Response("Forbidden", { status: 403 });
// data.user → { userId, email, name }
// data.role → "supervisor"
// data.systemsAccess → ["wms", "procurement"]
```

---

## Security notes

* Passwords are hashed with **bcrypt** (cost 12 by default).
* JWTs are signed with **HS256** via `jose`. Keep `JWT_SECRET` long and random.
* The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in prod.
* Login + signup endpoints are rate limited per IP (in-memory bucket — swap
  for Redis in multi-instance deployments).
* `/api/auth/verify` re-checks the live USERS row, so a deactivated user can't
  keep using their unexpired JWT.

---

## Migrating off Google Sheets

When Sheets stops scaling:

1. Implement a new `src/lib/users.ts` against your real DB (Postgres,
   Firestore, whatever) — keep the exported function signatures identical.
2. Delete `src/lib/apps-script.ts`.
3. Done. Routes, middleware, and the UI don't change.
