# Foliyo Resume Spec — Status API

**Version:** 0.1.0  
**Endpoint:** `POST /v1/status/notify`

Bidirectional application status between an ATS and the candidate’s Foliyo account. The `.fio` file stays portable; status updates keep the application **alive** in the dashboard.

## Authentication

Every request must include:

| Header | Purpose |
|--------|---------|
| `Authorization: Bearer <ats_api_key>` | Partner API key issued by Foliyo |
| `X-Foliyo-Signature` | `hex(HMAC-SHA256(raw_body, partner_hmac_secret))` |
| `X-Foliyo-Timestamp` | Unix seconds (reject if skew > 5 minutes) |

Unsigned or unknown keys → `401`.

## Request body

```json
{
  "resume_token": "r_abc123xyz",
  "event": "status_changed",
  "status": "shortlisted",
  "company": "Acme Corp",
  "role": "Senior Node.js Engineer",
  "job_id": "JOB_4521",
  "ats": "keka",
  "next_step": "technical_interview",
  "timestamp": "2026-06-13T09:00:00.000Z",
  "notes": null
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `resume_token` | yes | Foliyo resume `share_token` |
| `event` | yes | `application_received` \| `status_changed` |
| `status` | yes* | Required for `status_changed`; defaults to `application_received` for that event |
| `company` | recommended | Used to match/create application rows |
| `role` | recommended | |
| `job_id` | optional | Stable ATS job id for upsert |
| `ats` | recommended | Partner slug |
| `next_step` | optional | Free text / enum hint |
| `timestamp` | yes | ISO-8601 |
| `notes` | optional | |

## Standard status codes

| Status | Meaning |
|--------|---------|
| `application_received` | ATS accepted the application |
| `viewed` | Recruiter opened the resume |
| `shortlisted` | Moved forward |
| `interview_scheduled` | Interview booked |
| `offer_extended` | Offer made |
| `hired` | Candidate accepted |
| `rejected` | Not moving forward |
| `withdrawn` | Candidate withdrew |
| `on_hold` | Process paused |

## Response

```json
{
  "ok": true,
  "application_id": "…",
  "status": "shortlisted"
}
```

## Manual mode (no ATS)

Candidates can create and update the same statuses in Foliyo Dashboard → **Applications**. ATS notify is additive.

## Adoption note

Ship authenticated notify + one partner PoC before marketing as an open standard. Do not expose an unauthenticated public POST.
