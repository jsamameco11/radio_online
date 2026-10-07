<?php

namespace App\Domain\Stations\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A station team added this user with a role. */
final class AddedToStationTeam extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $stationId,
        public readonly string $stationName,
        public readonly string $roleLabel,
        public readonly string $invitedBy,
        public readonly string $studioUrl,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Ahora formas parte de {$this->stationName}")
            ->line("{$this->invitedBy} te agregó al equipo de {$this->stationName} como {$this->roleLabel}.")
            ->action('Abrir el estudio', $this->studioUrl);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'station_id' => $this->stationId,
            'station' => $this->stationName,
            'role' => $this->roleLabel,
            'invited_by' => $this->invitedBy,
            'url' => $this->studioUrl,
        ];
    }
}
