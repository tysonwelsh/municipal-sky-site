# Database schema

`schema.sql` contains the `CREATE TABLE` statements for the O*NET 29.2 database
that powers the underworld-occupations dashboard. Schema only — no data.

The live data is loaded into MySQL on the production server. Full dumps are not
in this repo (~270 MB) and are publicly available from O*NET:
https://www.onetcenter.org/database.html

## Regenerating after an O*NET version bump

With the dump files in a sibling folder `../db_29_2_mysql/` (one `.sql` per table),
extract just the `CREATE TABLE` portions:

```bash
{
  echo "-- O*NET schema"
  for f in ../db_29_2_mysql/*.sql; do
    echo "-- ─── $(basename "$f") ─────"
    awk '/^INSERT INTO/{exit} {print}' "$f"
    echo ""
  done
} > schema.sql
```
