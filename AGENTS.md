# Architecture rules

- Keep lottery event metadata in a shared event registry and expose each event on its own detail route; the lottery hall lists events without executing rewards, allowing more campaigns without coupling their prize pools.
- Interpret equipped badge slots as zero-based (0–2) across profile and shared battle cards; this keeps battle display aligned with stored equipment.