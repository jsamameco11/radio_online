<?php

namespace App\Domain\Monetization\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The station reached every monetization requirement: it can ask to become a "Radio monetizada". */
final class MonetizationReady extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $stationId,
        public readonly string $station,
        public readonly string $url,
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
            ->subject('¡Tu radio ya puede monetizar!')
            ->line("{$this->station} alcanzó los suscriptores y la audiencia en vivo que pide el programa de monetización.")
            ->line('Solicita la monetización desde tu estudio y conviértete en Radio monetizada.')
            ->action('Solicitar la monetización', $this->url);
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
        ];
    }
}
