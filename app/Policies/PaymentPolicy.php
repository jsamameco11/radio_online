<?php

namespace App\Policies;

use App\Domain\Access\Enums\Permission;
use App\Models\Payment;
use App\Models\User;

class PaymentPolicy
{
    /** Listeners see their own top-ups; finance staff see every one. */
    public function view(User $user, Payment $payment): bool
    {
        return $payment->user_id === $user->id || $user->can(Permission::ViewPayments->value);
    }

    /** Only the listener who opened a top-up pays it. */
    public function pay(User $user, Payment $payment): bool
    {
        return $payment->user_id === $user->id;
    }

    public function refund(User $user, Payment $payment): bool
    {
        return $user->can(Permission::RefundPayments->value);
    }
}
