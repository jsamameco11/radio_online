<?php

namespace App\Http\Requests\Stations;

/** Estudio > Configuración > Notificaciones. */
class UpdateNotificationSettingsRequest extends UpdatePreferencesRequest
{
    public function group(): string
    {
        return 'notifications';
    }
}
