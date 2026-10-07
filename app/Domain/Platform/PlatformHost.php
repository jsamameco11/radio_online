<?php

namespace App\Domain\Platform;

use Illuminate\Http\Request;

/**
 * The three applications of the platform, one per audience: listeners on the
 * public host, creators (station teams) on the console host and the platform
 * staff on the control host. Each one has its own sign-in session.
 */
enum PlatformHost: string
{
    case Public = 'public';
    case Studio = 'studio';
    case Control = 'control';

    public static function of(Request $request): self
    {
        $host = strtolower($request->getHost());

        foreach ([self::Studio, self::Control] as $candidate) {
            if ($host === strtolower($candidate->host())) {
                return $candidate;
            }
        }

        return self::Public;
    }

    /** "consola-fullradio.miacademiapreu.com" */
    public function host(): string
    {
        return (string) config("platform.hosts.{$this->value}");
    }

    /** Absolute address on this host: PlatformHost::Studio->url('/89-30/consola'). */
    public function url(string $path = '/'): string
    {
        return rtrim((string) config("platform.urls.{$this->value}"), '/').'/'.ltrim($path, '/');
    }
}
