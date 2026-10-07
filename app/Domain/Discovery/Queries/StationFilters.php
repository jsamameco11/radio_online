<?php

namespace App\Domain\Discovery\Queries;

use App\Domain\Discovery\Enums\StationSort;

/** What a listener asked to see in a listing of stations. */
final readonly class StationFilters
{
    public function __construct(
        public ?string $text = null,
        public ?string $category = null,
        public ?string $hashtag = null,
        public bool $onAirOnly = false,
        public StationSort $sort = StationSort::Listeners,
    ) {}
}
