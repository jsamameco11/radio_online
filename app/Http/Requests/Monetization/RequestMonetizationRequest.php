<?php

namespace App\Http\Requests\Monetization;

use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Stations\Support\CurrentStation;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Estudio > Monetización > Solicitar: only the station owner. Staff who can
 * enter any studio may look at the page but never act for the station.
 */
class RequestMonetizationRequest extends FormRequest
{
    public function authorize(CurrentStation $current): bool
    {
        return $this->user()->canInStation($current->get(), StationPermission::WithdrawEarnings);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [];
    }
}
