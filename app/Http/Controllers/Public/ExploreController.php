<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Enums\StationSort;
use App\Domain\Discovery\Queries\CategoryCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\ExploreStationsRequest;
use App\Http\Resources\StationResource;
use App\Models\Station;
use Inertia\Inertia;
use Inertia\Response;

class ExploreController extends Controller
{
    public function __invoke(ExploreStationsRequest $request, StationDirectory $stations, CategoryCatalog $categories): Response
    {
        $filters = $request->filters();

        return Inertia::render('Public/Explore', [
            'stations' => $stations->search($filters)->through(fn (Station $station) => StationResource::make($station)->resolve($request)),
            'filters' => $request->applied($filters),
            'categories' => $categories->grouped(),
            'sorts' => array_map(fn (StationSort $sort) => ['value' => $sort->value, 'label' => $sort->label()], StationSort::cases()),
        ]);
    }
}
