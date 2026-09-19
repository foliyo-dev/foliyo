# Skill ontology seed packs

CSV packs upsert into `global_skills` / `skill_aliases` on API boot.
Runtime matching always reads the **DB**, not these files.

## Layout

```
seed/
  manifest.json
  packs/
    tech_v1/         # Wave 1 — engineering / tech
    knowledge_v1/    # Wave 2 — product, design, data, ops, leadership
    business_v1/     # Wave 3 — marketing, sales, HR, finance
```

Each pack has:

- `global_skills.csv` — `normalized_key,canonical_name,category`
- `skill_aliases.csv` — `alias,normalized_key`

## Waves

| Pack | Wave | Focus |
|------|------|--------|
| `tech_v1` | 1 | Languages, frameworks, cloud, DevOps, ML, APIs |
| `knowledge_v1` | 2 | Product, design, analytics, ops, leadership/soft skills |
| `business_v1` | 3 | Marketing, sales, HR, finance |

## Add a pack

1. Create `packs/<id>/` with the two CSV files.
2. Append `"<id>"` to `manifest.json` → `packs` (order = load order; first pack wins on alias conflicts).
3. Restart the API (upsert inserts missing rows only; does not overwrite admin edits).

## Rules

- `alias` values must be unique across **all** loaded packs.
- Every `skill_aliases.normalized_key` must exist in **that pack’s** `global_skills.csv`.
- Prefer lowercase `normalized_key` / `alias` (loader lowercases and collapses spaces).
