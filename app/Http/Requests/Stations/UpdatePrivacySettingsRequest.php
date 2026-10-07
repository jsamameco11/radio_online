<?php

namespace App\Http\Requests\Stations;

/** Estudio > Configuración > Privacidad. */
class UpdatePrivacySettingsRequest extends UpdatePreferencesRequest
{
    public function group(): string
    {
        return 'privacy';
    }
}
