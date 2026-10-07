<?php

namespace App\Domain\Access\Listeners;

use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Http\Request;

/** Keeps when and from where each account last signed in, and audits it. */
final class RecordSignIn
{
    public function __construct(
        private readonly Request $request,
        private readonly AuditTrail $audit,
    ) {}

    public function handle(Login $event): void
    {
        if (! $event->user instanceof User) {
            return;
        }

        $event->user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $this->request->ip(),
        ])->saveQuietly();

        $this->audit->record('auth.login', $event->user, ['host' => $this->request->getHost()], $event->user);
    }
}
