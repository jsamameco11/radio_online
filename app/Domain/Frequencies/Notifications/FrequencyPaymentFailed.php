<?php

namespace App\Domain\Frequencies\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The staff approved a priced frequency but the applicant's card was declined. */
final class FrequencyPaymentFailed extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $requestId,
        public readonly string $frequency,
        public readonly string $amount,
        public readonly string $reason,
        public readonly string $payUrl,
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
            ->subject("Tu pago de {$this->frequency} no se completó")
            ->greeting('¡Aprobamos tu solicitud!')
            ->line("Revisamos tu expediente y aprobamos la frecuencia {$this->frequency}, pero tu banco rechazó el cobro de {$this->amount}.")
            ->line("Motivo: {$this->reason}")
            ->line('Paga con otra tarjeta y tu radio se abrirá en ese momento. Mientras no completes el pago, la frecuencia no queda asegurada.')
            ->action('Completar el pago', $this->payUrl);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'request_id' => $this->requestId,
            'frequency' => $this->frequency,
            'amount' => $this->amount,
            'reason' => $this->reason,
            'url' => $this->payUrl,
        ];
    }
}
