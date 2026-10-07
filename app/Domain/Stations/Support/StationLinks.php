<?php

namespace App\Domain\Stations\Support;

use App\Models\Station;

/** Absolute addresses of a station on both hosts. Load "frequency" first. */
final class StationLinks
{
    /** https://control-…/estudio/89-30 */
    public static function studio(Station $station): string
    {
        return rtrim((string) config('platform.urls.control'), '/').'/estudio/'.$station->frequency->slug;
    }

    /** https://turadioonline…/radio/89-30 */
    public static function listen(Station $station): string
    {
        return rtrim((string) config('platform.urls.public'), '/').'/radio/'.$station->frequency->slug;
    }
}
