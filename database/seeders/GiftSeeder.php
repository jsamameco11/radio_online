<?php

namespace Database\Seeders;

use App\Models\Gift;
use Illuminate\Database\Seeder;

/** The starting gift catalog. Prices and order are managed from the control panel afterwards. */
class GiftSeeder extends Seeder
{
    /** @var list<array{0: string, 1: string, 2: string, 3: int, 4: string|null}> name, slug, emoji, cents, animation */
    private const CATALOG = [
        ['Margarita', 'margarita', '🌼', 100, 'float'],
        ['Rosa', 'rosa', '🌹', 100, 'float'],
        ['Tulipán', 'tulipan', '🌷', 200, 'float'],
        ['Girasol', 'girasol', '🌻', 200, 'float'],
        ['Corazón', 'corazon', '❤️', 300, 'pulse'],
        ['Hibisco', 'hibisco', '🌺', 300, 'float'],
        ['Ramo de flores', 'ramo', '💐', 500, 'bloom'],
        ['Regalo', 'regalo', '🎁', 500, 'bounce'],
        ['Micrófono de oro', 'microfono-de-oro', '🎙️', 800, 'shine'],
        ['Diamante', 'diamante', '💎', 1000, 'shine'],
        ['Trofeo', 'trofeo', '🏆', 1500, 'shine'],
        ['Corona', 'corona', '👑', 2500, 'crown'],
        ['Cohete', 'cohete', '🚀', 5000, 'launch'],
        ['Estrella fugaz', 'estrella-fugaz', '🌠', 10000, 'launch'],
    ];

    public function run(): void
    {
        foreach (self::CATALOG as $order => [$name, $slug, $emoji, $cents, $animation]) {
            Gift::query()->updateOrCreate(
                ['slug' => $slug],
                ['name' => $name, 'emoji' => $emoji, 'price_cents' => $cents, 'animation' => $animation, 'sort_order' => $order],
            );
        }
    }
}
