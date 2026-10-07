<?php

use Laravel\Fortify\Features;

return [

    'guard' => 'web',

    'passwords' => 'users',

    'username' => 'email',

    'email' => 'email',

    'lowercase_usernames' => true,

    // Both hosts land on "/": listeners on the public home, staff and station teams on their control home.
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
        'register' => '/registro',
        'password.request' => '/recuperar-clave',
        'password.email' => '/recuperar-clave',
        'password.reset' => '/restablecer-clave/{token}',
        'password.update' => '/restablecer-clave',
        'verification.notice' => '/verificar-correo',
        'verification.verify' => '/verificar-correo/{id}/{hash}',
        'verification.send' => '/verificar-correo/reenviar',
        'password.confirm' => '/cuenta/confirmar-clave',
        'password.confirmation' => '/cuenta/confirmar-clave/estado',
        'two-factor.login' => '/verificacion-en-dos-pasos',
        'user-profile-information.update' => '/cuenta/perfil',
        'user-password.update' => '/cuenta/clave',
        'two-factor.enable' => '/cuenta/dos-pasos',
        'two-factor.confirm' => '/cuenta/dos-pasos/confirmar',
        'two-factor.disable' => '/cuenta/dos-pasos',
        'two-factor.qr-code' => '/cuenta/dos-pasos/qr',
        'two-factor.secret-key' => '/cuenta/dos-pasos/clave-secreta',
        'two-factor.recovery-codes' => '/cuenta/dos-pasos/codigos',
    ],

    'features' => [
        Features::registration(),
        Features::resetPasswords(),
        Features::emailVerification(),
        Features::updateProfileInformation(),
        Features::updatePasswords(),
        Features::twoFactorAuthentication([
            'confirm' => true,
            'confirmPassword' => true,
        ]),
    ],

];
