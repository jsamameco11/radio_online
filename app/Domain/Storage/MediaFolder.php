<?php

namespace App\Domain\Storage;

/**
 * Logical folders of the media bucket. Public folders hold what listeners
 * play or see; private folders are only served through signed URLs.
 */
enum MediaFolder: string
{
    case Music = 'music';
    case Episodes = 'episodes';
    case Effects = 'effects';
    case Jingles = 'jingles';
    case Commercials = 'commercials';
    case Programs = 'programs';
    case Recordings = 'recordings';
    case Logos = 'logos';
    case Covers = 'covers';
    case Avatars = 'avatars';
    case Gifts = 'gifts';
    case GiftMessages = 'gift-messages';
    case ApplicantPhotos = 'applicant-photos';
    case IdentityDocuments = 'identity-documents';
    case Resumes = 'resumes';
    case Certificates = 'certificates';

    public function isPrivate(): bool
    {
        return in_array($this, [
            self::Recordings,
            self::GiftMessages,
            self::ApplicantPhotos,
            self::IdentityDocuments,
            self::Resumes,
            self::Certificates,
        ], true);
    }
}
