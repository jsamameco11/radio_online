<?php

namespace App\Domain\Access\Actions;

use App\Domain\Storage\MediaFolder;
use App\Domain\Storage\MediaStorage;
use App\Models\User;
use Illuminate\Http\UploadedFile;

/** Replaces (or removes, without a file) the profile picture of an account. */
final class ChangeAvatar
{
    public function __construct(private readonly MediaStorage $storage) {}

    public function handle(User $user, ?UploadedFile $file): void
    {
        $previous = $user->avatar_path;
        $key = $file === null ? null : $this->storage->store($file, MediaFolder::Avatars, $user->id);

        $user->forceFill(['avatar_path' => $key])->save();

        if ($previous !== null && $previous !== $key) {
            $this->storage->delete($previous);
        }
    }
}
