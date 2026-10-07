<?php

namespace App\Domain\Monetization\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The station is now a "Radio monetizada". */
final class MonetizationApproved extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $stationId,
        public readonly string $station,
        public readonly string $url,
        public readonly ?string $note,
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
        $mail = (new MailMessage)
            ->subject('¡Tu radio ahora es Radio monetizada!')
            ->line("Aprobamos la monetización de {$this->station}. Desde hoy luce la distinción de Radio monetizada en la plataforma.");

        if (filled($this->note)) {
            $mail->line("Nota del equipo: {$this->note}");
        }

        return $mail->action('Ver mi radio', $this->url);
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
