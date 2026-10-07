<?php

namespace App\Domain\Monetization\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform sent the money of a withdrawal. */
final class WithdrawalPaid extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $withdrawalId,
        public readonly string $station,
        public readonly string $amount,
        public readonly string $destination,
        public readonly string $reference,
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
            ->subject("Enviamos tu retiro de {$this->amount}")
            ->line("Pagamos el retiro de {$this->amount} de {$this->station} a {$this->destination}.")
            ->line("Referencia de la operación: {$this->reference}")
            ->action('Ver mis retiros', $this->url);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'withdrawal_id' => $this->withdrawalId,
            'station' => $this->station,
            'amount' => $this->amount,
            'destination' => $this->destination,
            'reference' => $this->reference,
            'url' => $this->url,
        ];
    }
}
