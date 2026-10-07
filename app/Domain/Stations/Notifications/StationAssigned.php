<?php

namespace App\Domain\Stations\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform opened a station for this user directly from the dial. */
final class StationAssigned extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $stationId,
        public readonly string $stationName,
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
            ->subject('Ya tienes tu propia radio')
            ->line("Te asignamos la emisora {$this->stationName}.")
            ->line('Desde tu estudio puedes armar tu perfil, subir tu música y salir al aire.')
            ->action('Entrar a mi estudio', $this->studioUrl);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return ['station_id' => $this->stationId, 'station' => $this->stationName, 'url' => $this->studioUrl];
    }
}
