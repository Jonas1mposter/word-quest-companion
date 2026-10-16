# Architecture rules
- Keep multiplayer answer-bearing words in service-role-only match secrets and issue one persisted four-option question per player; transactional server submissions enforce ordering, idempotency and atomic scoring so client and Realtime payloads cannot reveal future answers.

- Keep lottery event metadata in a shared event registry and expose each event on its own detail route; the lottery hall lists events without executing rewards, allowing more campaigns without coupling their prize pools.
- Interpret equipped badge slots as zero-based (0–2) across profile and shared battle cards; this keeps battle display aligned with stored equipment.
- Resolve ticket purchases, per-pool quotas and promotional pity inside transactional SQL using profile-first locks; UI reads server policy and progress so alternate draw entry points cannot bypass limits.
- Grant all coins (狄邦豆) server-side only — edge functions and RPCs compute and award them, applying the weekend (Beijing Sat/Sun) double-coin multiplier inside the server code; the client only displays returned rewards and never computes or sends coin amounts, so alternate entry points cannot bypass the rules.- Learning-level rewards require a server-issued `level_sessions` row (start-level → complete-level, single use, server-timed); client-sent durations and counts alone never unlock payouts.
