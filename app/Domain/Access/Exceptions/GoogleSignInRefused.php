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
        return new self('El ingreso con Google no está disponible en este momento. Inténtalo de nuevo en unos minutos.');
    }

    public static function controlPanel(): self
    {
        return new self('El panel de administración se usa con tu usuario y contraseña.');
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
        return new self('Tu cuenta de Google no tiene el correo verificado. Verifícalo en Google y vuelve a intentarlo.');
    }

    public static function linkedElsewhere(): self
    {
        return new self('Tu correo ya está vinculado con otra cuenta de Google. Ingresa con esa cuenta.');
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
