# The Token holder is the identity; the viewer and admin passwords are not principals

There are no user accounts. Every principal field in the tracker (creator, assignee, comment author, Link adder) references a named Token holder, never the secret itself, so a holder can rotate or be revoked without losing attribution and "my stuff" filters by holder across rotations. The two shared passwords deliberately do not create identities: the viewer password gives the UI read-only access with no actor, and the admin password gives a separate, short UI session whose actions are recorded under the reserved name `admin`. Writes therefore always have an accountable, revocable holder behind them, and neither shared password can impersonate one.

## Considered Options

- Token is the identity (principal fields hold the token name): breaks attribution on rotation, or forces rotation to be a rename.
- Person records that own several tokens: closer to accounts, which v1 rules out; the holder slug already gives per-person or per-machine attribution by choice.
- Frontend password grants write with a self-chosen holder name: anyone holding the shared password could write as anyone.
- Scoped tokens (read/write/admin): read-only is covered by the viewer password and admin by its own password, so scopes would add a second authorisation model for no new capability.

**Amended 2026-11-03.** The admin password no longer opens a separate login; it elevates the current viewer or holder session for a limited time. Admin actions are attributed to the elevated holder, or to `admin` when a viewer elevated. The viewer and admin passwords remain non-principals.
