# Foliyo Resume Spec

**Version:** 0.1.0  
**Schema URL:** `https://spec.foliyo.dev/resume/v1` (mirrored at `foliyo.dev/spec/resume/v1.json`)  
**Human docs:** `https://foliyo.dev/spec/resume`  
**File extension:** `.fio`  
**MIME type:** `application/vnd.foliyo.resume+zip`  
**Brand:** Foliyo (`foliyo.dev`) — not related to the FOLIO library platform.

An open, structured resume format any ATS or tool can consume without parsing a PDF.

## Three layers

1. **Data spec** — JSON document (`resume.json`) described by [schema/v1.json](./schema/v1.json)
2. **File format** — `.fio` ZIP package (JSON + signature + optional assets)
3. **Status API** — ATS → candidate application updates ([STATUS.md](./STATUS.md))

## Quick example

See [examples/sample.json](./examples/sample.json).

## `.fio` package layout

```
name.fio                  (ZIP)
├── manifest.json         # format version, generator, content hash
├── resume.json           # Foliyo Resume Spec document
└── signature.sig         # HMAC-SHA256 integrity signature (JSON)
```

Optional later: `resume.pdf`, `photo.jpg`.

## MIME / media types

| Artifact | Media type |
|----------|------------|
| Bare JSON document | `application/vnd.foliyo.resume+json` |
| `.fio` ZIP package | `application/vnd.foliyo.resume+zip` |

## Integrity

Signatures use `HMAC-SHA256` over the SHA-256 of canonical `resume.json` bytes, keyed by the issuer’s integrity secret (`FOLIYO_INTEGRITY_SECRET` in Foliyo).

Offline verify: `POST /v1/verify` with `{ resume, signature }`.  
Live verify: `GET /v1/verify/:share_token`.

## Status events

See [STATUS.md](./STATUS.md). Candidates can also track applications manually in Foliyo without any ATS.

## Versioning

- Spec versions are SemVer under `$version`
- Breaking JSON shape changes → new schema path (`/resume/v2`)
- `.fio` `manifest.format_version` tracks the package layout

## AI import (deferred)

Future PDF/DOCX import should emit **this same JSON shape**, then review → library write. Do not invent a parallel schema.

## License

This specification is published under MIT, same as Foliyo OSS.
