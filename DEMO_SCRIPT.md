# GRC Platform Demo Script

*~12–15 minutes. Click cues in [brackets]. Written to be spoken, not read verbatim — make it yours.*

---

## Opening: the problem (2 min)

*[Nothing on screen yet, or the sign-in page]*

Before I show you anything, let me describe how this work gets done today — not just here, everywhere.

Somebody runs a security assessment against a framework like NIST CSF. The results land in a spreadsheet. The risks that come out of it land in a different spreadsheet. The remediation work gets tracked in email, or Jira, or someone's head. The evidence — the screenshots, the policies, the scan reports that prove we actually do what we say we do — lives in a shared drive folder that made sense to whoever created it three years ago.

Then an audit happens, or leadership asks "where are we on security," and someone spends two weeks reassembling the story from all those pieces. And the moment they finish, it's out of date.

That's the actual problem GRC tools exist to solve. Governance, risk, and compliance isn't paperwork for its own sake — it's the discipline of being able to answer three questions at any moment: What are we protecting and how? What could go wrong and how bad would it be? And what are we doing about the gaps? For an institution like ours — patron data, public trust, systems that people depend on every day — those questions aren't optional.

Commercial platforms that do this — Archer, ServiceNow, Vanta — run tens of thousands of dollars a year and take months to implement. What I'm about to show you was built in-house, matches our workflow exactly, and connects every one of those pieces in one place.

---

## Dashboard (2 min)

*[Sign in → Executive Dashboard]*

This is the first thing you see, and it's deliberately built for the person with the least time: leadership.

Top row — four numbers. Critical open risks. Controls implemented. Open remediations, with anything overdue flagged. And our NIST CSF compliance score from the most recent assessment. Every one of these is clickable and takes you to the detail behind it.

*[Point to the Control Risk Posture panel]*

This panel is one I want to spend a second on. Every control we operate has a criticality — how much it matters — and a maturity level, zero through five, using the standard CMMI scale. This gauge combines them into a single control risk score. A critical control we haven't matured yet drives the number up; a well-run control drives it down. So this isn't a feel-good metric — it points at the exact controls where effort pays off most. You can see the five riskiest ones ranked right here.

*[Scroll: heatmap, NIST function charts, burndown]*

Below that: the risk heatmap — likelihood against impact, every risk plotted. Per-function NIST scores, so we can see we're stronger in, say, Protect than in Recover. And the remediation burndown showing whether we're closing work faster than we're finding it.

The point: this page answers "where are we?" in thirty seconds, and it's never stale, because it reads live from the same data everything else writes to.

---

## Controls Library (2–3 min)

*[Sidebar → Controls Library]*

This is the foundation. Every internal control we operate lives here — one list, mapped once, reused everywhere.

*[Click one of the status cards up top]*

The summary cards are filters — click "Implemented" and the table filters down. Every column header filters too: category, status, criticality, owner, framework.

*[Click a row]*

Click any control and you get the full record: what it is, how it's actually implemented — not just a status dropdown, an actual written account — its criticality, its maturity, who owns it, and its framework mappings. This is the "map once, comply many" idea: one MFA control satisfies requirements in NIST CSF and CIS at the same time. When we add another framework later, we map the same controls — we don't rebuild the program.

*[Close drawer, expand a row with the chevron]*

One more thing here that auditors will love. Every control tells you what evidence would prove it works — an enrollment report, a policy document, a scan export — and you can upload that evidence directly against the control, right here. No more "where do I put this?"

---

## Assessments (1–2 min)

*[Sidebar → Assessments → click into one]*

Assessments are where the compliance score comes from. We upload results — CSV straight from an assessment workbook — and the platform scores it.

*[Point to the calculation box]*

And it shows its math. Compliant items get full credit, partials get half, and here's the exact formula with our actual numbers. Nothing's a black box — when someone asks "why are we at 68%," the answer is on the screen, requirement by requirement, grouped by NIST function.

---

## Risk Register (2–3 min)

*[Sidebar → Risk Register]*

Findings become risks, and this is where risks live.

*[Click the Critical card]*

Same pattern — cards filter, headers filter. Each risk is scored on likelihood times impact, one to twenty-five, and we track it twice: inherent, before controls, and residual, after. The gap between those two numbers is literally the value our controls are delivering. Hover any of these column headers and it explains the scale — nobody has to memorize the methodology.

Every risk carries its source — did it come from the NIST review, a pen test, a vulnerability scan, self-identification — plus an owner who's accountable and a lead who's actually driving the work. Two different people, two different jobs, both tracked.

*[Open a risk, scroll to the exception section]*

Two things inside a risk worth showing. First: exceptions. Sometimes the right business decision is to accept a risk. Fine — but accepted doesn't mean forgotten. An exception here requires a justification, an approver, and a review cadence. If the review date passes, it flags itself, on this page and on the executive report. Nothing quietly slides.

*[Point to Linked Remediations]*

Second: when a risk needs action, I create the remediation right here. It links itself to the risk, inherits its priority from the severity, and shows up in the tracker assigned to a real person. Finding to action in one step.

---

## Remediation + Timeline (2 min)

*[Sidebar → Remediation]*

The tracker: everything we're fixing, with priority, complexity, due date, assignee, and Jira keys where engineering work is involved. Click a row to edit anything; status changes right from the table.

*[Sidebar → Timeline]*

And this is the view I use for planning. Every remediation plotted on a calendar by target date. Red is overdue, yellow in progress, green done, gray scheduled. Filter by risk severity or owner. Click anything for context and mark it complete on the spot. Up top: open count, overdue count, and our on-time completion rate — which is the honest measure of whether the program is working, not just busy.

---

## Evidence Locker + Reports (2 min)

*[Sidebar → Evidence Locker]*

Every artifact — policies, screenshots, scan reports — organized in folders by review cycle or year, mapped to the control, risk, or remediation it supports. Evidence can expire, too: a firewall screenshot from 2023 doesn't prove anything about today, so items age out and flag themselves for refresh. And if something's uploaded but not yet mapped, it's flagged — nothing gets orphaned.

*[Sidebar → Reports]*

Finally, reporting — because the work only counts if we can communicate it. One click: an executive report, written for a board audience, print-to-PDF ready. One click: the technical report with every control, risk, and remediation for auditors. And CSV exports of the full risk register and remediation plan for anyone who wants the raw data.

The two weeks of assembling the story I mentioned at the start? That's now this button.

---

## Close (1 min)

Three things I want to leave you with.

One — everything you saw is one system. The assessment feeds the risks, the risks drive the remediations, the evidence backs the controls, and the dashboard and reports read it all live. Change a status anywhere and every view updates.

Two — this is ours. It matches how we actually work, we can extend it — there's a roadmap already: continuous control monitoring, policy management, vendor risk — and it costs us nothing in licensing.

Three — and this is the real point — this doesn't just document our security posture. It gives us a defensible, current answer to "how do you manage risk?" any day of the year, to any audience: leadership, auditors, or ourselves.

Happy to take questions — or better, tell me what you'd want to see on that dashboard, because now we can build it.

---

## Q&A prep — likely questions

**"What did this cost?"** — Staff time and a few dollars a month for the database. Comparable commercial platforms run $30K–$100K+ annually.

**"Who keeps the data current?"** — The workflow does. Assessments import in bulk, risks generate from findings, remediations update as work happens. The roadmap includes API integrations (Okta, endpoint management) to verify controls automatically.

**"Is patron/sensitive data in here?"** — No. It holds control descriptions, risk statements, and evidence metadata — about our security program, not patron records. Access is behind SSO with role-based permissions (admin / contributor / read-only viewer).

**"What about other frameworks — ISO, PCI?"** — The data model already supports them. Because controls map many-to-one, adding a framework means mapping existing controls to its requirements, not starting over.

**"What happens when you're on vacation?"** — It's standard technology (Next.js, Postgres), documented, in version control. Any web developer can maintain it — that's part of why it's built on boring, common tools.
