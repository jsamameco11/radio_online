<?php

namespace App\Domain\Marketplace\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A member of a station's team lost access because the station was sold. */
final class StationTeamReleased extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public readonly string $station) {}

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
            ->subject("{$this->station} cambió de propietario")
            ->line("{$this->station} fue vendida y ya no formas parte de su equipo, así que dejaste de tener acceso a su consola.");
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return ['station' => $this->station];
    }
}
