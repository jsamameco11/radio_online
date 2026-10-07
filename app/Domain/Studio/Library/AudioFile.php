<?php

namespace App\Domain\Studio\Library;

use App\Domain\Storage\MediaFolder;
use App\Domain\Studio\Enums\TrackKind;

/** Audio files a station library accepts and where each kind of audio is kept. */
final class AudioFile
{
    public const TYPES = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'webm', 'flac'];

    public const WRONG_TYPE = 'El archivo debe ser de audio: MP3, M4A, AAC, OGG, OPUS, WAV, WEBM o FLAC.';

    public const COVER_TYPES = ['jpg', 'jpeg', 'png', 'webp'];

    private const CONTENT_TYPES = [
        'mp3' => 'audio/mpeg',
        'm4a' => 'audio/mp4',
        'aac' => 'audio/aac',
        'ogg' => 'audio/ogg',
        'oga' => 'audio/ogg',
        'opus' => 'audio/ogg',
        'wav' => 'audio/wav',
        'webm' => 'audio/webm',
        'flac' => 'audio/flac',
    ];

    public static function folder(TrackKind $kind): MediaFolder
    {
        return match ($kind) {
            TrackKind::Song => MediaFolder::Music,
            TrackKind::Jingle => MediaFolder::Jingles,
            TrackKind::Effect => MediaFolder::Effects,
            TrackKind::Commercial => MediaFolder::Commercials,
            TrackKind::Program => MediaFolder::Programs,
        };
    }

    /** The type players need to stream the file as soon as it starts arriving. */
    public static function contentType(string $extension): string
    {
        return self::CONTENT_TYPES[strtolower($extension)] ?? 'application/octet-stream';
    }

    /** Whether a type read from the content of a file is one a browser can play as audio. */
    public static function looksLikeAudio(string $mime): bool
    {
        return preg_match('#^(audio/|video/(mp4|webm|ogg)|application/(ogg|octet-stream))#', $mime) === 1;
    }

    /** Largest audio accepted, in megabytes: files sent straight to Wasabi may be far bigger. */
    public static function maxMegabytes(bool $direct): int
    {
        return (int) config($direct ? 'platform.media.max_direct_upload_mb' : 'platform.media.max_form_upload_mb');
    }

    public static function maxDuration(): int
    {
        return (int) config('platform.media.max_duration');
    }
}
