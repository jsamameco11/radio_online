<?php

namespace App\Domain\Marketplace\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The buyer now owns the station they paid for. */
final class StationPurchased extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $listingId,
        public readonly string $station,
        public readonly string $price,
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
            ->subject("{$this->station} ya es tuya")
            ->line("Compraste {$this->station} por {$this->price}. Ahora eres su única propietaria o propietario: su frecuencia, su audiencia, su biblioteca y sus episodios son tuyos.")
            ->line('Arma tu equipo y sal al aire desde la consola.')
            ->action('Ir a mi consola', $this->url);
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
            'url' => $this->url,
        ];
    }
}
