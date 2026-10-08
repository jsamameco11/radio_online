<?php

namespace App\Domain\Marketplace\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform staff took the seller's station off the market. */
final class ListingWithdrawn extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $listingId,
        public readonly string $station,
        public readonly ?string $reason,
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
        $mail = (new MailMessage)
            ->subject("Retiramos {$this->station} de las radios en venta")
            ->line("El equipo de la plataforma retiró la publicación de venta de {$this->station}.");

        if ($this->reason !== null) {
            $mail->line("Motivo: {$this->reason}");
        }

        return $mail->action('Ver la venta de mi radio', $this->url);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'listing_id' => $this->listingId,
            'station' => $this->station,
            'reason' => $this->reason,
            'url' => $this->url,
        ];
    }
}
