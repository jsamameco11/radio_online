<?php

namespace App\Domain\Payments\Exceptions;

use App\Domain\Wallet\Exceptions\WalletException;

/**
 * The card issuer asks the payer to confirm the purchase (3-D Secure). Nothing
 * was charged: the browser runs the challenge and sends the same token again.
 */
final class AuthenticationRequired extends WalletException
{
    public function __construct(?string $message = null)
    {
        parent::__construct($message ?: 'Tu banco necesita que confirmes esta compra. Sigue las instrucciones de la ventana de verificación.');
    }

    public function reason(): string
    {
        return 'authentication_required';
    }
}
