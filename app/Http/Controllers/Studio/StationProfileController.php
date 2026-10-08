<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Discovery\Enums\CategoryGroup;
use App\Domain\Discovery\Hashtags;
use App\Domain\Stations\Actions\ReplaceStationImage;
use App\Domain\Stations\Actions\UpdateStationProfile;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\Locales;
use App\Domain\Stations\Support\StationPreferences;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stations\UpdateStationProfileRequest;
use App\Http\Requests\Stations\UploadStationImageRequest;
use App\Models\Category;
use App\Models\Hashtag;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Perfil de radio: what listeners see on the station page. */
class StationProfileController extends Controller
{
    private const SLOT_LABELS = ['logo' => 'el logo', 'cover' => 'la foto de portada'];

    public function __construct(private readonly CurrentStation $current) {}

    public function edit(StationPreferences $preferences): Response
    {
        $station = $this->current->get()->loadMissing(['frequency', 'categories', 'hashtags']);
        $categories = Category::query()->active()->orderBy('sort_order')->orderBy('name')->get(['id', 'name', 'slug', 'group']);

        return Inertia::render('Studio/Profile', [
            'profile' => [
                'tagline' => $station->tagline ?? '',
                'description' => $station->description ?? '',
                'accent_color' => $station->accent_color ?? '',
                'language' => $station->language ?? 'es',
                'country' => $station->country ?? '',
                'categories' => $station->categories->pluck('id')->all(),
                'hashtags' => $station->hashtags->map(fn (Hashtag $tag) => $tag->name)->values()->all(),
                'links' => array_map(fn (mixed $value) => $value ?? '', $preferences->get($station, 'profile')),
            ],
            'categoryGroups' => collect(CategoryGroup::cases())
                ->map(fn (CategoryGroup $group) => [
                    'value' => $group->value,
                    'label' => $group->label(),
                    'categories' => $categories
                        ->filter(fn (Category $category) => $category->group === $group)
                        ->map(fn (Category $category) => ['id' => $category->id, 'name' => $category->name])
                        ->values()
                        ->all(),
                ])
                ->filter(fn (array $group) => $group['categories'] !== [])
                ->values()
                ->all(),
            'languages' => Locales::options(Locales::LANGUAGES),
            'countries' => Locales::options(Locales::COUNTRIES),
            'limits' => [
                'categories' => (int) config('platform.stations.max_categories'),
                'description_min' => (int) config('platform.stations.description_min'),
                'description_max' => (int) config('platform.stations.description_max'),
                'hashtags' => (int) config('platform.stations.max_permanent_hashtags'),
                'hashtag_length' => Hashtags::MAX_LENGTH,
                'image_kb' => UploadStationImageRequest::MAX_KILOBYTES,
                'image_min' => UploadStationImageRequest::MIN_SIZE,
            ],
        ]);
    }

    public function update(UpdateStationProfileRequest $request, UpdateStationProfile $update): RedirectResponse
    {
        $update->handle($this->current->get(), $request->profile(), $request->user());

        return back()->with('success', 'Guardamos el perfil de tu radio.');
    }

    public function image(UploadStationImageRequest $request, string $slot, ReplaceStationImage $replace): RedirectResponse
    {
        $replace->handle($this->current->get(), $slot, $request->file('image'), $request->user());

        return back()->with('success', 'Actualizamos '.self::SLOT_LABELS[$slot].'.');
    }

    public function destroyImage(Request $request, string $slot, ReplaceStationImage $replace): RedirectResponse
    {
        $replace->handle($this->current->get(), $slot, null, $request->user());

        return back()->with('success', 'Quitamos '.self::SLOT_LABELS[$slot].'.');
    }
}
