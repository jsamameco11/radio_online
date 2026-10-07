<?php

namespace App\Domain\Applications\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/** Tells reviewers a new "Obtén tu frecuencia" dossier is waiting. Carries no personal data of the applicant. */
final class StationApplicationSubmitted extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $requestId,
        public readonly string $frequency,
        public readonly string $stationName,
        public readonly string $url,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'request_id' => $this->requestId,
            'frequency' => $this->frequency,
            'station_name' => $this->stationName,
            'url' => $this->url,
        ];
    }
}
