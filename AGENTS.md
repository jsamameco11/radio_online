# Tu Radio Online — project guide

Internet radio platform: every station owns a channel number ("89.30 · Radio Aurora", never with FM/AM), runs a professional studio (live console, autopilot, schedule, library, episodes, audio editor) and receives gifts from listeners through a wallet.

## Hosts

| Host | Purpose | Route files |
|---|---|---|
| `PUBLIC_HOST` (`turadioonline.miacademiapreu.com`) | Listeners: discover, listen, follow, gifts, wallet, "Obtén tu frecuencia" | `routes/public/*.php` |
| `STUDIO_HOST` (`consola-fullradio.miacademiapreu.com`) | Creators' console: station teams (and staff with `studios.enter`) run each studio at `/{frequency}/*` (`/89-30/consola`) | `routes/studio/*.php` |
| `CONTROL_HOST` (`control-turadioonline.miacademiapreu.com`) | Platform staff only: admin (`/admin/*`); old `/estudio/*` links redirect 301 to the console | `routes/control/*.php` |

`App\Domain\Platform\PlatformHost` tells which host answered and builds absolute URLs (`PlatformHost::Studio->url('89-30')`); the frontend gets it as `app.host` / `app.urls`. Links to another host are plain `<a href>`, never Inertia `<Link>`. Each host keeps its own session cookie: build those links with `useAppUrl()` (frontend) or `SessionHandoff::link()` (backend) so the session goes along between the public site and the console (single-use pass through `/ir/{escuchar|consola}` → `/acceso/{pass}`); the control host never accepts one.

`routes/account.php` (profile, security) and `routes/auth.php` are registered on every host; `routes/webhooks.php` has no session middleware. Routing is wired in `bootstrap/app.php` — add routes to the file of your area, never to `bootstrap/app.php`.

Locally: `turadioonline.localhost:8000`, `consola-fullradio.localhost:8000` and `control-turadioonline.localhost:8000` (`php artisan serve`).

## Architecture

- **Laravel is the control plane, never the audio transport.** Listeners play files from storage (Wasabi) following the server-computed program; live voice travels over WebRTC; Laravel only signals, schedules and records metadata.
- `app/Domain/<Area>/` holds business logic: `Actions/` (one public `handle()` per use case), services, `Enums/`, `Events/`, `Listeners/`, `Support/`. Areas: Access, Audit, Discovery, Frequencies, Gifts, Integrity, Moderation, Payments, Stations, Storage, Stories, Streaming, Studio, Wallet.
- Controllers are thin: validate with a Form Request (`app/Http/Requests/<Area>/`), authorize, call an Action/service, return an Inertia page or redirect. Controllers live in `app/Http/Controllers/{Public,Account,Admin,Studio,Webhooks}/`.
- API-shaped data for Inertia goes through `app/Http/Resources/*Resource` and is passed with `->resolve()`; always eager load what the resource reads (lazy loading throws outside production).
- Jobs in `app/Jobs/`, broadcast events implement `ShouldBroadcast` on the channels defined in `routes/channels.php`.

### Multi-station tenancy

- Station-owned models use `App\Models\Concerns\BelongsToStation`: they are filtered by `CurrentStation` and get `station_id` filled automatically. Use `Model::acrossStations()` only in admin code.
- `App\Domain\Stations\Support\CurrentStation` is set by the `ResolveStudioStation` middleware for every `/{frequency}` route of the console host (the `studio` route parameter is removed, so controllers do not receive it). Background jobs must call `$current->within($station, fn () => ...)`.
- Cache keys of station data: `$current->key('timeline')` → `station:{id}:timeline`.

### Authorization

- Platform roles/permissions (spatie): `App\Domain\Access\Enums\{PlatformRole, Permission}`. Super admin passes every Gate. Check permissions (`$user->can(Permission::UsersManage->value)`), never role names or `is_admin` flags.
- Sign-in: listeners and creators only use "Continuar con Google" (`SignInWithGoogle`); there is no registration form. The staff signs in to the control host with a username and password (`AuthenticateStaff`, wired in `FortifyServiceProvider`); credentials are set from Admin > Usuarios, the first super admin comes from `SUPERADMIN_*` in `.env`.
- Listening is public (guests get a player session token); following, reporting, chat posts, the wallet and gifts require a signed-in, verified account.
- Station team roles live in `station_members`: `App\Domain\Stations\Enums\{StationRole, StationPermission}`. Protect studio routes with `->middleware('studio.can:library.manage')`; in code use `$user->canInStation($station, StationPermission::X)`.
- Use Policies (`app/Policies`) for model-level rules.

### Money

- Integer cents, currency `USD`. Never mutate a balance directly: every change is a `wallet_transactions` row with `balance_before_cents`, `balance_after_cents` and a unique `idempotency_key`, written inside a DB transaction with the wallet row locked.
- Minimum deposit and presets come from `config('platform.wallet')`. Every gift and highlighted chat message is split with `GiftFee::split()`: `processor_fee_percent` (card processor) + `platform_fee_percent` (platform) are deducted and the station is credited the rest. Stations only ever see the amount credited to them — never prices paid, percentages or deductions. Withdrawals start at `config('platform.monetization.min_withdrawal_cents')`. All financial validation happens in the backend.

### Audience integrity

- Subscribers and live audience are protected against bot farms (`App\Domain\Integrity`, `config('platform.integrity')`). Follow and unfollow only through `FollowStation` / `UnfollowStation`: a follow is `pending` until `Subscribers` qualifies its account, and `follower_count` only counts `counted` follows (`Subscribers::recount()` after bulk changes).
- The live count comes from `Audience::count()` only: suspect sessions never count, each account counts once, guests are capped per network. Statistics read `listener_sessions` with `suspect = false` and `follows` with `status = counted`.
- `IntegrityScanner` files `integrity_alerts` (Admin > Integridad); purging flags the accounts (`FlagAccounts`), which the staff can undo from the user page.

### Files

- Everything goes through `App\Domain\Storage\MediaStorage` with a `MediaFolder` (Wasabi in production, local disks when `WASABI_BUCKET` is empty). Store keys in the database, never file contents. Private folders (recordings, gift voice messages) are served with temporary URLs.

### Frequencies

- The dial is generated by `FrequencyDial` (seeded, nested: growing `DIAL_SIZE` never moves existing frequencies). Labels look like `89.30`, slugs like `89-30`. Always display a station with its frequency: `Station::displayName()` / `<FrequencyTitle>`.

## Frontend

- Inertia v3 + React 19 + TypeScript (strict) + Tailwind 4. Pages in `resources/js/Pages/<Area>/<Page>.tsx` (PascalCase); components in kebab-case files under `resources/js/Components/<area>/`.
- Use the UI kit (`Components/ui/*`), `Components/station/station-identity.tsx`, layouts `Layouts/{AdminLayout,StudioLayout}` (and `SiteLayout` for the public site). Studio pages use `useStudioUrl()` and `useStudioCan()`.
- Design tokens are in `resources/css/app.css` (`bg-surface`, `text-muted`, `text-signal`, `bg-onair-soft`…). Do not hard-code colors. The studio uses the dark theme.
- HTTP calls outside Inertia visits: `resources/js/lib/http.ts`. Realtime: `resources/js/lib/realtime.ts`. Formatting: `resources/js/lib/format.ts`.
- Browser audio: `resources/js/lib/radio/` (listener, live link, Opus tuning) and `resources/js/lib/dj/` (DJ engine; Web Audio nodes and effects in `audio/`, USB controllers in `midi/`). Their UI: `Components/studio/console/` and `Components/studio/dj/{deck,mixer,waveform,controls}/`.
- All UI copy and public URLs are in Spanish; code, identifiers, enum values and database columns are in English.

## Conventions

- PHP 8.3, Laravel 13: model attributes `#[Fillable]`, `casts()` method, backed enums with `label()` in Spanish.
- Morph map is enforced (`AppServiceProvider`): register new morph types there.
- Audit sensitive actions with `AuditTrail::record('area.verb', $subject, $meta)`.
- No dead code, no commented-out code, no debugging leftovers, no TODOs without an owner.
- Never commit secrets. Configuration comes from `.env` (documented, without values, in `.env.example`).

## Checks before finishing

```sh
php artisan test --compact
vendor/bin/pint --dirty
npx tsc --noEmit
npm run build
```

Tests: `tests/Unit` for pure logic, `tests/Feature/<Area>` for HTTP/authorization. `tests/TestCase.php` provides `publicUrl()`, `consoleUrl()`, `controlUrl()`, `studioUrl()` (a station's studio on the console), `staff()` and `teamMember()`.
