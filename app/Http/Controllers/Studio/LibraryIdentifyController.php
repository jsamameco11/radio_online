<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Studio\Library\Duplicates;
use App\Domain\Studio\Library\Identify\Identifier;
use App\Domain\Studio\Library\Identify\SongQuery;
use App\Http\Controllers\Controller;
use App\Http\Requests\Studio\LibraryDuplicatesRequest;
use App\Http\Requests\Studio\LibraryIdentifyRequest;
use Illuminate\Http\JsonResponse;

/** What the upload form asks while the files are being prepared: who sings each song and whether it is already in the library. */
class LibraryIdentifyController extends Controller
{
    public function identify(LibraryIdentifyRequest $request, Identifier $identifier): JsonResponse
    {
        $data = $request->validated();
        $query = new SongQuery(
            (string) $data['title'],
            (string) ($data['artist'] ?? ''),
            $data['featured'] ?? [],
            isset($data['duration']) ? (float) $data['duration'] : null,
        );

        return response()->json($identifier->identify($query, $data['genre'] ?? null));
    }

    public function duplicates(LibraryDuplicatesRequest $request, Duplicates $duplicates): JsonResponse
    {
        return response()->json(['results' => (object) $duplicates->review($request->songs(), $request->validated('judge'))]);
    }
}
