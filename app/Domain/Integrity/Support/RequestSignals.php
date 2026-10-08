<?php

namespace App\Domain\Integrity\Support;

use Illuminate\Http\Request;

/**
 * What a request tells about who sends it: the network it comes from (the IP, or the /64 of an
 * IPv6 address, keyed with the app key so no address is stored) and whether the client
 * announces itself as an automated program instead of a browser.
 */
final readonly class RequestSignals
{
    private const AUTOMATED = '/bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|webdriver|curl|wget|python|httpie|http-client|httpclient|okhttp|java\/|go-http|node-fetch|axios|undici|guzzle|libwww|scrapy|postman|insomnia|powershell/i';

    public function __construct(
        public string $network,
        public bool $automated,
    ) {}

    public static function from(Request $request): self
    {
        $agent = trim((string) $request->userAgent());

        return new self(
            network: self::network((string) $request->ip()),
            automated: $agent === '' || preg_match(self::AUTOMATED, $agent) === 1 || trim((string) $request->header('Accept-Language')) === '',
        );
    }

    public static function network(string $ip): string
    {
        $packed = @inet_pton($ip);
        $key = $packed !== false && strlen($packed) === 16
            ? bin2hex(substr($packed, 0, 8))
            : $ip;

        return substr(hash_hmac('sha256', $key, (string) config('app.key')), 0, 16);
    }
}
