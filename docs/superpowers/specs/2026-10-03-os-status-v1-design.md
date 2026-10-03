# OCRE OS Status v1 — Design

Date: 2026-10-03
Status: proposed for implementation

## Purpose

Create a public, read-only operational diagnostic application at `apps.ocre.mx/os-status/` that remains available independently of the ThinkPad running OCRE-OS. Its purpose is to answer, at a glance and then progressively in technical detail, whether Core or Staging is reachable and which important subsystem is preventing normal access.

The application is also intended as a stable operational source for development/deployment verification, reducing repeated ad-hoc health commands without replacing feature-specific tests.

## Scope and constraints

- Hosted in the existing `ocre-os/apps` static site and visible as an app on its homepage.
- No database, persistence, cron, incident history, accounts, or private data in v1.
- Diagnostics run on demand in the browser and refresh every 10 seconds while the page is open.
- A manual **Comprobar ahora** action starts a fresh cycle immediately.
- Core and Staging are independent targets selected from the same UI.
- Failure to observe a component is represented as **UNKNOWN**, never inferred as failed.
- Status responses must expose no credentials, customer data, private addresses, stack traces, secrets, connection strings, user information, or tokens.
- No automatic failover/redirection from OCRE-OS in v1.

## Architecture

### External application

`apps.ocre.mx/os-status/` is static HTML/CSS/JavaScript served by the existing Apps hosting. It performs:

1. external reachability checks against the selected environment;
2. a request to a sanitized OCRE-OS health endpoint;
3. client-side status aggregation;
4. latency measurement from the observer's browser;
5. presentation in Normal Mode or Matrix Mode.

Because Apps is not served by the ThinkPad, the diagnostic UI remains available when the ThinkPad, WSL, Docker, Core, Staging, PostgreSQL, or their tunnels are unavailable.

### OCRE-OS diagnostic contract

Core and Staging expose the same unauthenticated, read-only sanitized endpoint dedicated to Status. The endpoint must permit CORS only as needed for `https://apps.ocre.mx`.

Suggested response shape:

```json
{
  "contract": "ocre-status-v1",
  "environment": "core",
  "observed_at": "2026-10-03T00:00:00Z",
  "overall": "healthy",
  "checks": {
    "api": {"status": "healthy"},
    "database": {"status": "healthy"},
    "schema": {"status": "healthy"},
    "worker": {"status": "healthy"},
    "storage": {"status": "healthy"}
  },
  "deployment": {
    "commit": "abcdef0",
    "version": "..."
  }
}
```

The exact implementation may omit a check until it can report it truthfully. Missing checks are UNKNOWN in the UI.

## Status semantics

Four states are allowed:

- **OPERATIVO / healthy** — all critical checks healthy and no degradable check is unhealthy.
- **DEGRADADO / degraded** — all critical checks healthy, but one or more degradable checks unhealthy.
- **FALLA / failed** — one or more critical checks explicitly unhealthy, or the environment itself is externally unreachable.
- **DESCONOCIDO / unknown** — the monitor cannot obtain current evidence for the component.

Critical checks:
- external access to the environment;
- Web;
- API;
- PostgreSQL;
- database schema/migration compatibility.

Degradable checks:
- notification worker;
- storage/files;
- email/notification capability where observable;
- PWA support endpoints.

Informational:
- deployed commit/version;
- uptime when safely available;
- request latency;
- observation timestamp.

A stale result must never remain green indefinitely. The UI displays observation age. A timed-out current request transitions the affected observation to UNKNOWN/FAILED according to whether it is an explicit external reachability check or an unobservable internal component.

## Normal Mode UX

Dark industrial/technical visual language, not a generic admin dashboard.

Hierarchy:
1. OCRE OS Status identity and Core/Staging segmented selector.
2. Large environment state hero: e.g. `CORE · OPERATIVO`.
3. Essential live metrics and observation age.
4. Progressive technical detail for Web, API, PostgreSQL, schema, worker, storage, PWA and deployment.
5. Expandable explanations/errors sanitized for administrators.
6. **Comprobar ahora** plus visible automatic refresh activity.

Motion communicates state rather than decorating it: scanning/progress movement during checks, smooth state transitions, restrained ambient motion while healthy, and distinct but non-alarming visual response to degradation/failure. Respect `prefers-reduced-motion`.

The page must be responsive and comfortable on mobile as well as desktop.

## Matrix Mode

Matrix Mode is an immersive full-screen alternate renderer of the exact same live telemetry.

- Dense vertical digital-rain field across effectively the entire viewport.
- Original generated characters/resources only; no copied movie assets.
- Small-to-medium glyphs, irregular column spacing, multiple depths/speeds, variable trails, bright heads, subtle bloom, scanlines, focus variation and digital noise.
- Decorative characters may be meaningless and intentionally visually chaotic.
- Real telemetry fragments (environment, service names, status, latency, timestamps, commit) are embedded into the character field rather than placed in conventional cards.
- Operational-looking values are never fabricated. Decorative noise may not masquerade as a status, timestamp, version or metric.
- Real failures/recoveries perturb the field and cause real event fragments to recur in the stream.
- A discreet but reliably discoverable control always exits Matrix Mode.
- Same accessibility/reduced-motion requirement; reduced-motion mode preserves the visual theme without high-motion rain.

Matrix Mode is intentionally harder to read than Normal Mode. Normal Mode remains the authoritative usability surface.

## Refresh and concurrency

- Initial check begins immediately on load.
- Automatic cycle: 10 seconds.
- Manual refresh starts a new cycle immediately.
- Requests use finite timeouts; no hanging fetches.
- A new cycle cancels or supersedes older in-flight results so stale responses cannot overwrite fresher observations.
- Core and Staging state are isolated; switching environment cannot leak the previous environment's status into the new view.

## Security

The endpoint is intentionally public but highly sanitized. It is read-only and performs bounded checks. It must not accept arbitrary targets or diagnostic commands.

CORS is restricted to the Apps origin where practical. No health response may include:
- host/private IP details;
- DB names/users/URLs;
- exception/stack details;
- filesystem paths;
- customer/user identifiers;
- secret configuration;
- authentication state.

Rate limiting may be added if public traffic becomes material; it is not required to add a new infrastructure dependency for v1.

## Failure behavior

Examples:

**ThinkPad unreachable:** external environment = FALLA; internal components = DESCONOCIDO because they cannot be observed.

**PostgreSQL down but API diagnostic endpoint responds:** database = FALLA; overall = FALLA; unrelated observable checks retain their own states.

**Worker down:** worker = DEGRADADO; overall = DEGRADADO if critical checks remain healthy.

**Status endpoint contract malformed:** diagnostic contract = DESCONOCIDO/invalid; external reachability remains independently reported.

## Apps integration

Add a visible `OCRE OS Status` card to the existing Apps homepage, versioned as v1, linking to `os-status/`.

Existing GitHub Actions FTPS deployment remains unchanged unless implementation proves an exclusion/path issue. No FTP credentials are moved into source control.

## Validation

Before publication:
- validate status aggregation with deterministic healthy/degraded/failed/unknown fixtures;
- verify finite timeout and stale-response protection;
- verify Core/Staging isolation;
- verify mobile and desktop layout;
- verify Matrix Mode enter/exit and reduced-motion behavior;
- verify endpoint output contains no sensitive fields;
- verify CORS from Apps;
- verify live Core and Staging results;
- verify Apps deployment does not disturb existing tools.

Production/Core changes require explicit approval under the existing OCRE operating protocol. Staging and reversible Apps publication can be used for validation first.
