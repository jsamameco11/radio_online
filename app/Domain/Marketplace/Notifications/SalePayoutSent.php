<?php

namespace App\Domain\Marketplace\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform paid the seller of a station. */
final class SalePayoutSent extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $listingId,
        public readonly string $station,
        public readonly string $amount,
        public readonly string $destination,
        public readonly string $reference,
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
            ->subject("Te pagamos la venta de {$this->station}")
            ->line("Enviamos {$this->amount} por la venta de {$this->station} a {$this->destination}.")
            ->line("Referencia de la operación: {$this->reference}");
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'listing_id' => $this->listingId,
            'station' => $this->station,
            'amount' => $this->amount,
            'destination' => $this->destination,
            'reference' => $this->reference,
        ];
    }
}
