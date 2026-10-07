<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Admin > Configuración. */
class UpdatePlatformSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'registrations_open' => ['required', 'boolean'],
            'frequency_requests_open' => ['required', 'boolean'],
            'maintenance_banner' => ['nullable', 'string', 'max:300'],
            'max_pending_requests' => ['required', 'integer', 'between:1,10'],
            'stale_heartbeat_seconds' => ['required', 'integer', 'between:30,900'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'registrations_open.*' => 'Indica si los registros están abiertos.',
            'frequency_requests_open.*' => 'Indica si se aceptan solicitudes de frecuencia.',
            'maintenance_banner.*' => 'El aviso puede tener como máximo 300 caracteres.',
            'max_pending_requests.*' => 'Indica entre 1 y 10 solicitudes pendientes por usuario.',
            'stale_heartbeat_seconds.*' => 'Indica entre 30 y 900 segundos.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function settings(): array
    {
        $banner = trim((string) $this->validated('maintenance_banner'));

        return [
            'registrations_open' => $this->boolean('registrations_open'),
            'frequency_requests_open' => $this->boolean('frequency_requests_open'),
            'maintenance_banner' => $banner === '' ? null : $banner,
            'max_pending_requests' => (int) $this->validated('max_pending_requests'),
            'stale_heartbeat_seconds' => (int) $this->validated('stale_heartbeat_seconds'),
        ];
    }
}
