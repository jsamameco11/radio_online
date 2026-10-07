<?php

namespace App\Domain\Frequencies\Notifications;

use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform turned a request down, with the reason. */
final class FrequencyRequestRejected extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $requestId,
        public readonly FrequencyRequestKind $kind,
        public readonly string $frequency,
        public readonly string $note,
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
            ->subject('Revisamos tu solicitud de frecuencia')
            ->line($this->kind === FrequencyRequestKind::NewStation
                ? "Por ahora no podemos asignarte la frecuencia {$this->frequency}."
                : "Por ahora no podemos mudar tu radio a la frecuencia {$this->frequency}.")
            ->line("Motivo: {$this->note}")
            ->line('Puedes enviar una nueva solicitud cuando quieras.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'request_id' => $this->requestId,
            'kind' => $this->kind->value,
            'frequency' => $this->frequency,
            'note' => $this->note,
        ];
    }
}
