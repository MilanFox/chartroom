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
A Link to something created while working an Effort, map, spec or ticket, such as a prototype branch, a screenshot or a deployed preview. The things a team hands to testers and clients.
_Avoid_: Output, deliverable, attachment

**Research note**:
A Markdown text stored in the Instance and attached to exactly one issue of any Kind, addressed by that issue and a slug, such as `#3/local-transcription`. An issue may hold several. Research, audits and spike notes are all Research notes; the issue that produced one says what kind of work it was. Process material, not a result, and not an issue: it has no number, Claim, labels, comments or blockers.
_Avoid_: Document, finding, attachment, file

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
The unit of work a dashboard shows: a typed issue grouping at most one map, any number of specs, and their tickets. Can be empty. Addressed by its Slug. The only kind an instance may show under a different Display label.
_Avoid_: Feature, project, epic, initiative, container

**Slug**:
The short, unique, slug-shaped handle that addresses an Effort wherever its number would do; the skills use it for folders and branches. The published names stay: the API field `name`, the path parameter `{handle}`, the error field `handle` and `Instance.effortName`. A Token holder's own slug is the same kind of handle for a person, not a second term.
_Avoid_: Handle, reference, name

**Parent**:
The single containment link from a map or spec to its Effort, or from a ticket to its map, spec, or straight to an Effort. Every issue except an Effort has at most one.
_Avoid_: Part of, epic link, sub-issue

**Kind**:
Which of the four shapes an issue has: Effort, Map, Spec, or Ticket. Fixed at creation; decides what the issue may have as its Parent.
_Avoid_: Type, issue type, category

**Label group**:
A named set of labels of which an issue carries at most one, such as the triage state. Adding one member removes the others. Besides the seeded groups the skills rely on, an Admin may define more, such as a priority.
_Avoid_: Label category, exclusive labels, status field

**Member**:
One label of a Label group, with its own Display label. Adding it to an issue removes the issue's other Members of that group.
_Avoid_: Option, value, entry

**Free-form label**:
A label an issue carries that belongs to no Label group; any number can sit on one issue. An Admin can Promote one into a Label group.
_Avoid_: Ad-hoc label, plain label, loose tag

**Promote**:
To turn a Free-form label into a Member of a Label group, so issues already carrying it join the group without being retagged by hand.
_Avoid_: Convert, migrate, upgrade

**Tag**:
An Effort's labels as the Effort list and dashboard show them, for filtering and sorting Efforts. The same labels as on any issue, not a separate kind of label.
_Avoid_: Category, keyword

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

**State**:
The stored lifecycle value of an issue, `open` or `closed`. Written by people and agents.
_Avoid_: Status (which is computed), phase

**Status**:
What an issue is right now, computed from its State, Claim and blockers, never stored: `open`, `claimed`, `blocked` or `closed`.
_Avoid_: State (which is stored), stage, progress

**Decision ticket**:
A ticket under a map carrying a `wayfinder:<type>` label, asking for one decision that a session answers with a Resolution.
_Avoid_: Question, research ticket, wayfinder issue

**Resolution**:
The comment that answers a ticket, posted in the same act as closing it.
_Avoid_: Answer, closing note, outcome

**Change**:
A record the tracker keeps of one field of an issue being written: who wrote it, through which Origin, when, and the value before and after. Shown among the comments, never one of them.
_Avoid_: Audit entry, event, activity, history entry, system comment

**Origin**:
Whether a write came through a Token holder's UI session or through the API. Recorded on every issue, comment, Link and Change so human input stands out among agent-written content.
_Avoid_: Source, channel, manual flag, AI flag

**Frontier**:
The tickets under a map that are open, unclaimed and have no open blocker: the decisions a session can take next. The same set under a spec is called takeable, not frontier.
_Avoid_: Ready tickets, next up, available, unblocked list

**Saved view**:
One of a fixed set of named filters over the instance-wide issue list, such as the Frontier or My stuff. Picking one replaces every other filter.
_Avoid_: Smart list, preset

**Dashboard**:
The page showing one Effort: its map, specs and tickets in workflow order, with its Status, Artifacts and Research roll-ups. Neither the Effort nor a Saved view is the Dashboard.
_Avoid_: Overview, board, home

**Workbench**:
The search-first page over every issue of the Instance, open ones grouped by Effort, with Saved views and filters.
_Avoid_: Issue list, inbox, search page

**Shell**:
The frame around every page: the navigation, the Effort picker, the session menu and the notice of elevation or of an available update.
_Avoid_: Layout, chrome, header

**Roll-up**:
A figure computed over an Effort's subtree and never stored: the Status counts of its map, specs and tickets, the deduped Links of every issue below it, grouped by role, or the Research notes of every issue in it.
_Avoid_: Summary, aggregate, total

**Elevation**:
The hour for which an Admin session holds the admin password's powers, ended early by dropping it. A session in that time is Elevated.
_Avoid_: Admin login, sudo, unlock

**Display label**:
The instance-configured word shown in place of a fixed id: the name an Effort goes by, what a triage role is called, or what a Label group or one of its Members is called. Changes how humans and the adapter doc say it, never what the API and CLI call it. A Token holder's display name is a person's name, not a Display label.
_Avoid_: Alias, custom name, label text, rename, display name (for a Label group)
