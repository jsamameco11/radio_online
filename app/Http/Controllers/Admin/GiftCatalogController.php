<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Gifts\Actions\RemoveGift;
use App\Domain\Gifts\Actions\SaveGift;
use App\Http\Controllers\Controller;
use App\Http\Requests\Gifts\SaveGiftRequest;
use App\Http\Resources\GiftResource;
use App\Models\Gift;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** /admin/regalos: the gift catalog listeners choose from. */
class GiftCatalogController extends Controller
{
    public function index(Request $request): Response
    {
        $gifts = Gift::query()
            ->withCount('transactions')
            ->withSum('transactions', 'total_cents')
            ->orderBy('sort_order')
            ->orderBy('price_cents')
            ->get();

        return Inertia::render('Admin/Gifts/Index', [
            'gifts' => $gifts->map(fn (Gift $gift) => [
                ...GiftResource::make($gift)->resolve($request),
                'sent_count' => (int) $gift->transactions_count,
                'sent_total_cents' => (int) $gift->transactions_sum_total_cents,
            ])->values(),
            'animations' => SaveGiftRequest::ANIMATIONS,
            'minPriceCents' => SaveGiftRequest::MIN_PRICE_CENTS,
        ]);
    }

    public function store(SaveGiftRequest $request, SaveGift $save): RedirectResponse
    {
        $gift = $save->handle(null, $request->gift(), $request->user());

        return back()->with('success', "Agregamos «{$gift->name}» al catálogo.");
    }

    public function update(SaveGiftRequest $request, Gift $gift, SaveGift $save): RedirectResponse
    {
        $save->handle($gift, $request->gift(), $request->user());

        return back()->with('success', "Guardamos «{$gift->name}».");
    }

    public function destroy(Request $request, Gift $gift, RemoveGift $remove): RedirectResponse
    {
        if (! $remove->handle($gift, $request->user())) {
            return back()->with('error', 'Este regalo ya fue enviado: desactívalo en lugar de eliminarlo.');
        }

        return back()->with('success', "Eliminamos «{$gift->name}» del catálogo.");
    }
}
