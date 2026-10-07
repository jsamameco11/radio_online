<?php

namespace App\Actions\Fortify;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Platform\PlatformSettings;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    public function __construct(private readonly PlatformSettings $settings) {}

    /**
     * Registers a listener account while registrations are open. Station teams and staff start as listeners too.
     *
     * @param  array<string, string>  $input
     *
     * @throws ValidationException
     */
    public function create(array $input): User
    {
        if (! $this->settings->get('registrations_open')) {
            throw ValidationException::withMessages(['email' => 'Por ahora no estamos creando cuentas nuevas. Vuelve a intentarlo más adelante.']);
        }

        Validator::make($input, [
            'name' => ['required', 'string', 'max:80'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique(User::class)],
            'password' => $this->passwordRules(),
            'terms' => ['accepted'],
        ], [], [
            'name' => 'nombre',
            'email' => 'correo',
            'password' => 'contraseña',
            'terms' => 'términos y condiciones',
        ])->validate();

        $user = User::query()->create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
        ]);

        $user->assignRole(PlatformRole::Listener->value);

        return $user;
    }
}
