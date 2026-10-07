<?php

namespace App\Domain\Studio\Library;

use App\Domain\Studio\Broadcast\Autopilot;
use App\Domain\Studio\Broadcast\Timeline;

/** What listeners hear is cached: every change to an audio or a playlist starts it over. */
final class PlayoutCaches
{
    public function __construct(
        private readonly Autopilot $autopilot,
        private readonly Timeline $timeline,
    ) {}

    public function flush(): void
    {
        $this->autopilot->flush();
        $this->timeline->flush();
    }
}
