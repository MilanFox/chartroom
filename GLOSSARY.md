# Chartroom

A self-hostable issue tracker, one instance per project, that agents running the Matt Pocock skillset use instead of the client's Jira/GitLab/GitHub. It keeps agent-generated maps, specs and tickets out of the client's tracker.

## Language

**Link**:
A typed pointer attached to an issue, in the role of Resource or Artifact. Its type says what it points at: a branch, a file, a preview, a doc, or something external.
_Avoid_: Attachment, reference, URL field

**Resource**:
A Link to something read or used while working an Effort, map, spec or ticket, such as a brief, a design file or a client doc.
_Avoid_: Reference, source, input

**Artifact**:
A Link to something created while working an Effort, map, spec or ticket, such as a prototype branch, a research file or a deployed preview. The things a team hands to testers and clients.
_Avoid_: Output, deliverable, attachment

**Environment**:
A named, instance-wide place the project runs, such as staging or production, with its URL. A preview deployment is an Artifact, not an Environment.
_Avoid_: Stage, target, deployment

**Credential pointer**:
An instance-wide note saying which account to use for an Environment and where its secret is kept. Never the secret itself.
_Avoid_: Credential, login, secret

**Adapter**:
The agent-side piece that teaches the skillset to use this tracker: the `docs/agents/issue-tracker.md` doc plus whatever CLI backs it.
_Avoid_: Integration, plugin, connector

**Instance**:
One running Chartroom serving exactly one project: its Efforts, Token holders, Environments, Credential pointers and settings. Nothing is shared between instances.
_Avoid_: Server, deployment, tenant, workspace

**Snapshot**:
A consistent copy of the Instance's store taken while it runs, kept beside it so a human can restore the Instance to that moment. The tracker takes one by itself before it changes the store's shape; an Admin can take one at any time.
_Avoid_: Backup file, dump, export

**Effort**:
The unit of work a dashboard shows: a typed issue grouping at most one map, any number of specs, and their tickets. Can be empty. Named by a short slug-shaped handle, the same one the skills use for folders and branches. The only kind an instance may show under a different display name.
_Avoid_: Feature, project, epic, initiative, container, dashboard

**Parent**:
The single containment link from a map or spec to its Effort, or from a ticket to its map, spec, or straight to an Effort. Every issue except an Effort has at most one.
_Avoid_: Part of, epic link, sub-issue

**Kind**:
Which of the four shapes an issue has: Effort, Map, Spec, or Ticket. Fixed at creation; decides what the issue may have as its Parent.
_Avoid_: Type, issue type, category

**Label group**:
A named set of labels of which an issue carries at most one, such as the triage state. Adding one member removes the others.
_Avoid_: Label category, exclusive labels, status field

**Claim**:
Assigning an issue to a Token holder, which signals to other sessions that it is being worked. An issue claimed by someone else cannot be claimed.
_Avoid_: Lock, checkout, assignment

**Token holder**:
A named identity, human or agent, that owns one active secret and is recorded as the actor on everything it creates, claims, comments or links. Revoked holders keep their name and history.
_Avoid_: User, account, token, API key, principal

**Viewer**:
Whoever opens the frontend with the shared viewer password: read-only, no identity, meant for clients and testers.
_Avoid_: Guest, anonymous, public user

**Admin**:
A Viewer or Token holder session that has entered the admin password and, for a limited time, may manage Token holders, Environments, Credential pointers and instance settings. Changes are recorded as the elevated Token holder, or as `admin` when a Viewer elevated.
_Avoid_: Owner, superuser, root, admin account, admin login

**Resolution**:
The comment that answers a ticket, posted in the same act as closing it.
_Avoid_: Answer, closing note, outcome

**System comment**:
A comment the tracker writes itself to record a change, such as a re-parenting or a removed Link. Nobody can edit it.
_Avoid_: Audit entry, activity, event

**Origin**:
Whether a write came through a Token holder's UI session or through the API. Recorded on every issue, comment and Link so human input stands out among agent-written content.
_Avoid_: Source, channel, manual flag, AI flag

**Frontier**:
The tickets under a map that are open, unclaimed and have no open blocker: the decisions a session can take next. The same set under a spec is called takeable, not frontier.
_Avoid_: Ready tickets, next up, available, unblocked list

**Saved view**:
One of a fixed set of named filters over the instance-wide issue list, such as the Frontier or My stuff. Picking one replaces every other filter.
_Avoid_: Smart list, preset, dashboard

**Display label**:
The instance-configured word shown in place of a fixed id: the name an Effort goes by, or what a triage role is called. Changes how humans and the adapter doc say it, never what the API and CLI call it.
_Avoid_: Alias, custom name, label text, rename
