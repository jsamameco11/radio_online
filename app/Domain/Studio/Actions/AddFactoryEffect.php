<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\LiveDesk;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\AudioUploads;
use App\Models\Track;
use Illuminate\Http\UploadedFile;

/**
 * A factory effect of the pad bank, rendered in the browser: stored once in the library (filed
 * under «Efectos de fábrica · category») and added at the end of the pad bank.
 */
final class AddFactoryEffect
{
    public const ARTIST = 'Efectos de fábrica';

    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly AudioUploads $uploads,
    ) {}

    public function handle(string $title, string $category, float $duration, ?UploadedFile $audio): Track
    {
        $pads = $this->broadcast->pads()->pluck('id')->all();
        $artist = self::ARTIST.' · '.$category;
        $track = Track::query()->where('kind', TrackKind::Effect->value)->where('title', $title)->where('artist', $artist)->first();
        if ($track && in_array($track->id, $pads, true)) {
            throw new BroadcastRejected("«{$title}» ya está en la botonera.", 409);
        }
        if (count($pads) >= LiveDesk::MAX_PADS) {
            throw new BroadcastRejected('La botonera tiene hasta '.LiveDesk::MAX_PADS.' botones. Quita uno con «Editar» para agregar este efecto.', 409);
        }

        if (! $track) {
            if (! $audio) {
                throw new BroadcastRejected('No llegó el audio del efecto. Inténtalo de nuevo.');
            }
            $track = Track::query()->create([
                'kind' => TrackKind::Effect,
                'title' => $title,
                'artist' => $artist,
                'file_path' => $this->uploads->store($audio, TrackKind::Effect),
                'mime' => 'audio/wav',
                'size_bytes' => $audio->getSize(),
                'duration' => round($duration, 2),
                'rotation' => false,
                'duck' => false,
                'active' => true,
            ]);
        } elseif (! $track->active) {
            $track->update(['active' => true]);
        }
        $this->broadcast->saveConfig(['pads' => [...$pads, $track->id]]);

        return $track;
    }
}
