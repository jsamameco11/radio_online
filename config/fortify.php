<?php

use Laravel\Fortify\Features;

return [

    'guard' => 'web',

    'passwords' => 'users',

    // Only the platform staff signs in with a password, by username, on the control host (see FortifyServiceProvider).
    // Listeners and creators sign in with Google.
    'username' => 'username',

    'email' => 'email',

    'lowercase_usernames' => true,

    // Every host lands on "/": listeners on the public home, creators on their console, staff on the platform panel.
    'home' => '/',

    'prefix' => '',

    'domain' => null,

    'middleware' => ['web'],

    'limiters' => [
        'login' => 'login',
        'two-factor' => 'two-factor',
    ],

    // Pages are Inertia components registered in App\Providers\FortifyServiceProvider.
    'views' => true,

    'paths' => [
        'login' => '/ingresar',
        'logout' => '/salir',
        'password' => [
            'confirm' => '/cuenta/confirmar-clave',
            'confirmation' => '/cuenta/confirmar-clave/estado',
        ],
        'verification' => [
            'notice' => '/verificar-correo',
            'verify' => '/verificar-correo/{id}/{hash}',
            'send' => '/verificar-correo/reenviar',
        ],
        'two-factor' => [
            'login' => '/verificacion-en-dos-pasos',
            'enable' => '/cuenta/dos-pasos',
            'confirm' => '/cuenta/dos-pasos/confirmar',
            'disable' => '/cuenta/dos-pasos',
            'qr-code' => '/cuenta/dos-pasos/qr',
            'secret-key' => '/cuenta/dos-pasos/clave-secreta',
            'recovery-codes' => '/cuenta/dos-pasos/codigos',
        ],
        'user-profile-information' => [
            'update' => '/cuenta/perfil',
        ],
        'user-password' => [
            'update' => '/cuenta/clave',
        ],
    ],

    // Accounts are created by "Continuar con Google" (App\Domain\Access\Actions\SignInWithGoogle), not by a form.
    'features' => [
        Features::emailVerification(),
        Features::updateProfileInformation(),
        Features::updatePasswords(),
        Features::twoFactorAuthentication([
            'confirm' => true,
            'confirmPassword' => true,
        ]),
    ],

];
