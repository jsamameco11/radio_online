<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\LiveSwitch;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Models\Playlist;

/** «Volver a la música»: closes the live cut at once, optionally with another playlist or order. */
final class ReturnToMusic
{
    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly LiveSwitch $switch,
        private readonly SwitchAutomaticMusic $switchMusic,
    ) {}

    /**
     * @param  bool  $changeSource  whether $playlist and $shuffle choose a new source
     * @return string what the team is told
     */
    public function handle(bool $changeSource, ?Playlist $playlist, bool $shuffle): string
    {
        $message = $changeSource
            ? $this->switchMusic->handle($playlist, $shuffle, immediately: true)
            : 'De vuelta a la música automática.';
        $this->switch->resume();
        $this->broadcast->syncPresence();

        return $message;
    }
}
