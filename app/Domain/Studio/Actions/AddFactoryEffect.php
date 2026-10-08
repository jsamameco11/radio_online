<?php

namespace App\Domain\Studio\Actions;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Broadcast\BroadcastRejected;
use App\Domain\Studio\Broadcast\FactoryEffectMissing;
use App\Domain\Studio\Broadcast\LiveDesk;
use App\Domain\Studio\Broadcast\StationBroadcast;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;

/**
 * A factory effect of the console in the station library (filed under «Efectos de fábrica ·
 * category»), and optionally at the end of the pad bank.
 *
 * The browser renders each effect; its WAV is stored once for the whole platform under a key
 * made of the effect id and its content version, and every station's library audio points to
 * that same file. Only the first station that uses an effect uploads it.
 */
final class AddFactoryEffect
{
    public const ARTIST = 'Efectos de fábrica';

    /** Characters of an effect's content version (a 32-bit hash in hex, see effectVersion() in lib/radio/effects.ts). */
    public const VERSION_LENGTH = 8;

    public function __construct(
        private readonly StationBroadcast $broadcast,
        private readonly MediaStorage $storage,
        private readonly CurrentStation $current,
        private readonly AuditTrail $audit,
    ) {}

    public static function key(string $id, string $version): string
    {
        return MediaFolder::FactoryEffects->value.'/'.$id.'-'.$version.'.wav';
    }

    /**
     * @return array{track: Track, added: bool} added is false when the effect was already in the pad bank
     *
     * @throws BroadcastRejected 409 «audio» when the shared file is missing and no audio came
     */
    public function handle(string $id, string $version, string $title, string $category, float $duration, ?UploadedFile $audio, bool $pad): array
    {
        $artist = self::ARTIST.' · '.$category;
        $track = Track::query()->where('kind', TrackKind::Effect->value)
            ->where(fn (Builder $query) => $query
                ->where('file_path', 'like', self::key($id, str_repeat('_', self::VERSION_LENGTH)))
                ->orWhere(fn (Builder $named) => $named->where('title', $title)->where('artist', $artist)))
            ->first();

        $bank = $pad ? $this->broadcast->pads()->pluck('id')->all() : [];
        if ($pad && $track && in_array($track->id, $bank, true)) {
            return ['track' => $track, 'added' => false];
        }
        if ($pad && count($bank) >= LiveDesk::MAX_PADS) {
            throw new BroadcastRejected('La botonera tiene hasta '.LiveDesk::MAX_PADS.' botones. Quita uno con «Editar» para agregar este efecto.', 409);
        }

        if (! $track) {
            $key = $this->shared($id, $version, $audio);
            $track = Track::query()->create([
                'kind' => TrackKind::Effect,
                'title' => $title,
                'artist' => $artist,
                'file_path' => $key,
                'mime' => 'audio/wav',
                'size_bytes' => $this->storage->disk(MediaFolder::FactoryEffects)->size($key),
                'duration' => round($duration, 2),
                'rotation' => false,
                'duck' => false,
                'active' => true,
            ]);
        } elseif (! $track->active) {
            $track->update(['active' => true]);
        }

        if ($pad) {
            $this->broadcast->saveConfig(['pads' => [...$bank, $track->id], 'pads_offered' => true]);
        }

        return ['track' => $track, 'added' => $pad];
    }

    /** The platform-wide file of the effect: stored now from the audio that came when nobody stored it before. */
    private function shared(string $id, string $version, ?UploadedFile $audio): string
    {
        $key = self::key($id, $version);
        $disk = $this->storage->disk(MediaFolder::FactoryEffects);
        if ($disk->exists($key)) {
            return $key;
        }
        if (! $audio) {
            throw new FactoryEffectMissing;
        }
        if (! self::wave($audio)) {
            throw new BroadcastRejected('El audio del efecto no es válido. Recarga la página e inténtalo de nuevo.');
        }

        Cache::lock('factory-effect:'.$key, 15)->block(10, function () use ($disk, $key, $audio, $id) {
            if ($disk->exists($key)) {
                return;
            }
            $disk->put($key, (string) $audio->get());
            $this->audit->record('console.factory_effect_stored', $this->current->get(), ['effect' => $id, 'key' => $key]);
        });

        return $key;
    }

    /** A 16-bit PCM WAV like the ones the console renders. */
    private static function wave(UploadedFile $audio): bool
    {
        $handle = fopen((string) $audio->getRealPath(), 'rb');
        if ($handle === false) {
            return false;
        }
        $header = fread($handle, 44) ?: '';
        fclose($handle);

        return strlen($header) === 44
            && str_starts_with($header, 'RIFF')
            && substr($header, 8, 8) === 'WAVEfmt '
            && unpack('v', substr($header, 20, 2))[1] === 1
            && unpack('v', substr($header, 34, 2))[1] === 16;
    }
}
