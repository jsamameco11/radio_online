<?php

namespace App\Domain\Access\Exceptions;

use Illuminate\Http\RedirectResponse;
use RuntimeException;

/**
 * Google answered, but the platform will not sign this person in. The message
 * is shown as is on the sign-in page of the host that started the attempt.
 */
final class GoogleSignInRefused extends RuntimeException
{
    public static function unavailable(): self
    {
        return new self('El ingreso con Google no está disponible en este momento. Usa tu correo y contraseña.');
    }

    public static function failed(): self
    {
        return new self('No pudimos completar el ingreso con Google. Inténtalo de nuevo.');
    }

    public static function cancelled(): self
    {
        return new self('Cancelaste el ingreso con Google.');
    }

    public static function unverifiedEmail(): self
    {
        return new self('Tu cuenta de Google no tiene el correo verificado. Verifícalo en Google o crea tu cuenta con correo y contraseña.');
    }

    public static function linkedElsewhere(): self
    {
        return new self('Tu cuenta ya está vinculada con otra cuenta de Google. Ingresa con esa cuenta o con tu contraseña.');
    }

    public static function registrationsClosed(): self
    {
        return new self('Por ahora no estamos creando cuentas nuevas. Vuelve a intentarlo más adelante.');
    }

    public static function suspended(): self
    {
        return new self('Tu cuenta está suspendida. Escríbenos si crees que es un error.');
    }

    public function render(): RedirectResponse
    {
        return redirect('/ingresar')->with('error', $this->getMessage());
    }
}
