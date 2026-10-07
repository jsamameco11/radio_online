<?php

namespace App\Domain\Growth\Enums;

enum StreakState: string
{
    /** Never had an active day. */
    case Fresh = 'fresh';
    /** Today already counts. */
    case Active = 'active';
    /** Yesterday counted, today not yet: the streak lives until midnight. */
    case AtRisk = 'at_risk';
    /** Had a streak before, lost it. */
    case Broken = 'broken';
}
