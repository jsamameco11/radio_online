<?php

namespace App\Domain\Frequencies\Notifications;

use App\Domain\Frequencies\Enums\FrequencyRequestKind;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** The platform approved a request: the station is on its (new) frequency. */
final class FrequencyRequestApproved extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public readonly int $requestId,
        public readonly FrequencyRequestKind $kind,
        public readonly string $stationName,
        public readonly string $studioUrl,
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
            ->subject($this->kind === FrequencyRequestKind::NewStation ? '¡Tu radio ya tiene frecuencia!' : 'Tu radio cambió de frecuencia')
            ->greeting('¡Buenas noticias!')
            ->line($this->kind === FrequencyRequestKind::NewStation
                ? "Aprobamos tu solicitud: {$this->stationName} ya está en el dial."
                : "Aprobamos el cambio: ahora transmites como {$this->stationName}.");

        if ($this->note) {
            $mail->line("Nota del equipo: {$this->note}");
        }

        return $mail->action('Entrar a mi estudio', $this->studioUrl);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'request_id' => $this->requestId,
            'kind' => $this->kind->value,
            'station' => $this->stationName,
            'url' => $this->studioUrl,
            'note' => $this->note,
        ];
    }
}
