<?php

namespace App\Domain\Growth\Support;

use App\Domain\Growth\Enums\GoalMetric;

/** One milestone of the growth journey: reach $target on $metric. */
final readonly class Goal
{
    public function __construct(
        public string $key,
        public GoalMetric $metric,
        public int $target,
        public string $title,
        public string $description,
    ) {}
}
