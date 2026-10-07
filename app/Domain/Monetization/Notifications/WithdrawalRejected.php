<?php

namespace App\Domain\Monetization\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform could not pay a withdrawal: the amount is back in the station wallet. */
final class WithdrawalRejected extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $withdrawalId,
        public readonly string $station,
        public readonly string $amount,
        public readonly string $note,
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
            ->subject('No pudimos procesar tu retiro')
            ->line("El retiro de {$this->amount} de {$this->station} no se pudo pagar y el monto volvió al saldo de tu radio.")
            ->line("Motivo: {$this->note}")
            ->line('Revisa tus datos de cobro y solicita el retiro otra vez cuando quieras.')
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
            'note' => $this->note,
            'url' => $this->url,
        ];
    }
}
