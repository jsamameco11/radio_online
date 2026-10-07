<?php

namespace App\Domain\Access\Enums;

enum GoogleSignInOutcome
{
    /** The browser is signed in. */
    case SignedIn;

    /** The account uses two-factor authentication: Fortify's challenge finishes the sign-in. */
    case TwoFactorChallenge;
}
