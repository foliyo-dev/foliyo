# Foliyo Core API — Bruno collection

API tests for `apps/core` (Hono + MeshQL).

## Setup

1. Install [Bruno](https://www.usebruno.com/downloads)
2. **Open Collection** → select this `bruno/` folder
3. Choose environment **local** or **production**
4. Run **Auth → Login** — saves `token` to the environment
5. Run any protected request

## Environments

| Variable | local default |
|----------|----------------|
| `baseUrl` | `http://localhost:8080` |
| `adminEmail` | `admin@localhost` |
| `adminPassword` | `changeme` |
| `token` | set by Login (secret) |

Start the API:

```bash
cd apps/core
export FOLIYO_ADMIN_EMAIL=admin@localhost
export FOLIYO_ADMIN_PASSWORD=changeme
go run ./cmd/server
```

## Auth

Opaque Bearer tokens — `Authorization: Bearer {{token}}`. No cookies.
