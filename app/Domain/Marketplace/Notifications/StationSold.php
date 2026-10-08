<?php

namespace App\Domain\Marketplace\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Someone bought the seller's station; the platform will pay the seller. */
final class StationSold extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $listingId,
        public readonly string $station,
        public readonly string $price,
        public readonly string $fee,
        public readonly string $settled,
        public readonly string $payout,
        public readonly string $destination,
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
            ->subject("Vendiste {$this->station}")
            ->line("Vendimos {$this->station} por {$this->price}. La radio, su frecuencia, su audiencia y su contenido ya pertenecen a su nueva propietaria y tu equipo dejó de tener acceso.")
            ->line("Comisiones descontadas (pasarela de pago, plataforma e IGV): {$this->fee}. Saldo que tenía la radio: {$this->settled}.")
            ->line("Te pagaremos {$this->payout} a {$this->destination} y te avisaremos con la referencia de la operación.");
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'listing_id' => $this->listingId,
            'station' => $this->station,
            'price' => $this->price,
            'fee' => $this->fee,
            'settled' => $this->settled,
            'payout' => $this->payout,
            'destination' => $this->destination,
        ];
    }
}
