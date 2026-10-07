<?php

namespace App\Domain\Stations\Support;

use App\Domain\Platform\PlatformHost;
use App\Models\Station;

/** Absolute addresses of a station on the creators' console and the public platform. Load "frequency" first. */
final class StationLinks
{
    /** https://consola-…/89-30 */
    public static function studio(Station $station): string
    {
        return PlatformHost::Studio->url($station->frequency->slug);
    }

    /** https://turadioonline…/radio/89-30 */
    public static function listen(Station $station): string
    {
        return PlatformHost::Public->url('radio/'.$station->frequency->slug);
    }
}
