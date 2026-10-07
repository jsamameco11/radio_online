<?php

namespace App\Http\Requests\Stations;

use App\Domain\Stations\Support\CurrentStation;
use App\Http\Requests\Concerns\ValidatesStationDetails;
use Illuminate\Foundation\Http\FormRequest;

/** Estudio > Configuración > General: public name and visibility. */
class UpdateGeneralSettingsRequest extends FormRequest
{
    use ValidatesStationDetails;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return array_intersect_key(
            $this->stationDetailsRules(app(CurrentStation::class)->get()),
            array_flip(['name', 'visibility']),
        );
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return $this->stationDetailsMessages();
    }
}
