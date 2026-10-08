<?php

namespace App\Http\Resources\Admin;

use App\Domain\Integrity\Enums\AlertKind;
use App\Models\IntegrityAlert;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * An integrity alert for Admin > Integridad. Reads station.frequency and resolver.
 *
 * @mixin IntegrityAlert
 */
class IntegrityAlertResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => ['value' => $this->kind->value, 'label' => $this->kind->label(), 'description' => $this->kind->description()],
            'concerns_accounts' => $this->kind->concernsAccounts(),
            'purgeable' => $this->kind->purgeable(),
            'severity' => ['value' => $this->severity->value, 'label' => $this->severity->label()],
            'status' => ['value' => $this->status->value, 'label' => $this->status->label()],
            'figures' => $this->figures(),
            'accounts' => count($this->userIds()),
            'station' => $this->station === null ? null : [
                'id' => $this->station->id,
                'display_name' => $this->station->displayName(),
                'status' => $this->station->status->value,
                'follower_count' => $this->station->follower_count,
            ],
            'since' => $this->evidence['since'] ?? null,
            'detected_at' => $this->detected_at->toIso8601String(),
            'last_detected_at' => $this->last_detected_at->toIso8601String(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolver' => $this->resolver?->name,
            'note' => $this->note,
        ];
    }

    /** @return list<array{label: string, value: string}> */
    private function figures(): array
    {
        $evidence = $this->evidence;
        $number = fn (string $key) => number_format((float) ($evidence[$key] ?? 0), is_float($evidence[$key] ?? 0) ? 1 : 0, '.', ',');

        return match ($this->kind) {
            AlertKind::FollowCluster => [
                ['label' => 'Suscripciones', 'value' => $number('follows')],
                ['label' => 'Redes', 'value' => $number('network_count')],
                ['label' => 'Máximo desde una red', 'value' => $number('largest')],
            ],
            AlertKind::FreshAccountWave => [
                ['label' => 'Suscripciones', 'value' => $number('follows')],
                ['label' => 'De cuentas nuevas', 'value' => $number('fresh')],
                ['label' => 'Proporción', 'value' => $number('share').' %'],
            ],
            AlertKind::FollowSpike => [
                ['label' => 'Suscripciones', 'value' => $number('follows')],
                ['label' => 'Lo habitual', 'value' => $number('baseline')],
                ['label' => 'Nunca la escucharon', 'value' => $number('silent').' ('.$number('share').' %)'],
            ],
            AlertKind::AudienceSwarm => [
                ['label' => 'Reproductores', 'value' => $number('sessions')],
                ['label' => 'Redes', 'value' => $number('network_count')],
                ['label' => 'Máximo desde una red', 'value' => $number('largest')],
            ],
            AlertKind::BlockedPlayers => [
                ['label' => 'Reproductores bloqueados', 'value' => $number('sessions')],
            ],
        };
    }
}
