<?php

namespace App\Domain\Access\Listeners;

use App\Domain\Audit\AuditTrail;
use App\Models\User;
use Illuminate\Auth\Events\Login;
use Illuminate\Http\Request;

use function Illuminate\Support\defer;

/** Keeps when and from where each account last signed in, and audits it, once the response is sent. */
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

        $user = $event->user;
        $ip = $this->request->ip();
        $host = $this->request->getHost();

        defer(function () use ($user, $ip, $host) {
            $user->forceFill(['last_login_at' => now(), 'last_login_ip' => $ip])->save();

            $this->audit->record('auth.login', $user, ['host' => $host], $user);
        });
    }
}
