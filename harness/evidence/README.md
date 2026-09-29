# Evidence

Store durable evidence that materially supports completion claims.

Recommended naming:

```text
<task-id>/
  README.md
  screenshots/
  reports/
```

Evidence may also be a stable CI/PR URL recorded in `feature_list.json` when duplicating the artifact in git would add no value.

Do not store secrets, personal data, transient build folders or large generated artifacts here.
