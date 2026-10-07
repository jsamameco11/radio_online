<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\ValidatesStationDetails;
use App\Models\Station;
use Illuminate\Foundation\Http\FormRequest;

/** Admin > Radios > Editar: the public details of a station. */
class UpdateStationRequest extends FormRequest
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
        /** @var Station $station */
        $station = $this->route('station');

        return $this->stationDetailsRules($station);
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return $this->stationDetailsMessages();
    }
}
