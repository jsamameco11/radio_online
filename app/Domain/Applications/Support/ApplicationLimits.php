<?php

namespace App\Domain\Applications\Support;

/** Limits of the "Obtén tu frecuencia" dossier, shared by the validation and the form. Sizes in kilobytes. */
final class ApplicationLimits
{
    public const MIN_AGE = 18;

    public const PHOTO_KB = 5 * 1024;

    public const PHOTO_MIN_PIXELS = 300;

    public const DOCUMENT_KB = 8 * 1024;

    public const RESUME_KB = 10 * 1024;

    public const CERTIFICATE_KB = 10 * 1024;

    public const MAX_CERTIFICATES = 3;

    public const BIO_MIN = 50;

    public const BIO_MAX = 800;

    public const PURPOSE_MIN = 100;

    public const PURPOSE_MAX = 1000;

    public const AUDIENCE_MIN = 20;

    public const AUDIENCE_MAX = 500;

    public const MAX_LANGUAGES = 5;

    public const SOCIAL_NETWORKS = ['facebook', 'instagram', 'tiktok', 'youtube', 'x'];

    /**
     * @return array<string, int>
     */
    public static function forForm(): array
    {
        return [
            'minAge' => self::MIN_AGE,
            'photoKb' => self::PHOTO_KB,
            'photoMinPixels' => self::PHOTO_MIN_PIXELS,
            'documentKb' => self::DOCUMENT_KB,
            'resumeKb' => self::RESUME_KB,
            'certificateKb' => self::CERTIFICATE_KB,
            'maxCertificates' => self::MAX_CERTIFICATES,
            'bioMin' => self::BIO_MIN,
            'bioMax' => self::BIO_MAX,
            'purposeMin' => self::PURPOSE_MIN,
            'purposeMax' => self::PURPOSE_MAX,
            'audienceMin' => self::AUDIENCE_MIN,
            'audienceMax' => self::AUDIENCE_MAX,
            'maxLanguages' => self::MAX_LANGUAGES,
        ];
    }
}
