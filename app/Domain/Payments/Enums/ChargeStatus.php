<?php

namespace App\Domain\Payments\Enums;

/** What the provider answered to a charge. */
enum ChargeStatus: string
{
    case Succeeded = 'succeeded';
    case Declined = 'declined';
    case RequiresAuthentication = 'requires_authentication';
}
