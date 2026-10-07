<?php

namespace App\Domain\Monetization\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform turned a monetization request down, with the reason. */
final class MonetizationRejected extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $stationId,
        public readonly string $station,
        public readonly string $url,
        public readonly string $note,
        public readonly int $retryAfterDays,
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
            ->subject('Revisamos tu solicitud de monetización')
            ->line("Por ahora no podemos aprobar la monetización de {$this->station}.")
            ->line("Motivo: {$this->note}")
            ->line("Podrás solicitarla otra vez en {$this->retryAfterDays} días. Tus ganancias siguen siendo tuyas y puedes retirarlas cuando quieras.")
            ->action('Ver mi progreso', $this->url);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'station_id' => $this->stationId,
            'station' => $this->station,
            'url' => $this->url,
            'note' => $this->note,
        ];
    }
}
