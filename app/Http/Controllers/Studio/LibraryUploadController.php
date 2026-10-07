<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Enums\StationPermission;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\AudioUploads;
use App\Domain\Studio\Library\StudioAccess;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\LibraryUploadRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** Direct uploads of audio files from the browser to storage, in parts. */
class LibraryUploadController extends Controller
{
    public function store(LibraryUploadRequest $request, AudioUploads $uploads, StudioAccess $access): JsonResponse
    {
        $kind = TrackKind::from($request->validated('kind'));
        if ($kind !== TrackKind::Program) {
            $access->authorize($request->user(), StationPermission::ManageLibrary);
        }

        return response()->json($uploads->begin($request->user(), (string) $request->validated('name'), (int) $request->validated('size'), $kind));
    }

    public function destroy(Request $request, string $token, AudioUploads $uploads): Response
    {
        $uploads->cancel($request->user(), $token);

        return response()->noContent();
    }
}
