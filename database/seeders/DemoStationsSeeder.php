<?php

namespace Database\Seeders;

use App\Domain\Discovery\Hashtags;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Domain\Stations\Actions\OpenStation;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Models\Category;
use App\Models\CurrentTopic;
use App\Models\Frequency;
use App\Models\Station;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Fictional stations to develop and demo with (local environment only).
 * Every demo account uses the password "password".
 */
class DemoStationsSeeder extends Seeder
{
    /** @var list<array{0: string, 1: string, 2: list<string>, 3: list<string>, 4: string, 5: string|null}> */
    private const STATIONS = [
        ['89.30', 'Radio Aurora', ['Baladas', 'Romántica', 'Pop'], ['RadioAurora', 'Romantica', 'Baladas'], 'La música que acompaña tu día.', 'Clásicos románticos para empezar la mañana'],
        ['101.70', 'Radio Urbana', ['Urbana', 'Reggaetón', 'Trap'], ['RadioUrbana', 'Reggaeton', 'Urbano'], 'Lo más sonado de la calle.', null],
        ['95.50', 'Pulso Noticias', ['Noticias', 'Actualidad', 'Política'], ['PulsoNoticias', 'Peru', 'Actualidad'], 'Información al minuto, sin rodeos.', 'Debate: las propuestas para Lima'],
        ['103.30', 'Gol Radio', ['Deportes', 'Fútbol', 'Entrevistas'], ['GolRadio', 'Futbol', 'LigaPeruana'], 'El fútbol se vive y se escucha aquí.', 'Previa: Perú vs Argentina'],
        ['92.10', 'Salsa Brava', ['Salsa', 'Tropical', 'Música Latina'], ['SalsaBrava', 'Salsa', 'SalsaDura'], 'Salsa de la buena, día y noche.', null],
        ['97.30', 'Frecuencia Andina', ['Música Andina', 'Huayno', 'Folklore'], ['FrecuenciaAndina', 'Huayno', 'Andes'], 'Desde los Andes para el mundo.', null],
        ['99.10', 'La Carcajada', ['Humor', 'Comedia', 'Entretenimiento'], ['LaCarcajada', 'Humor'], 'Risas garantizadas las 24 horas.', 'Las peores citas de los oyentes'],
        ['105.10', 'Clásica Nocturna', ['Música Clásica', 'Instrumental', 'Cultura'], ['ClasicaNocturna', 'Clasica'], 'Grandes obras para noches tranquilas.', null],
        ['91.70', 'Voces Universitarias', ['Universitaria', 'Educación', 'Debate'], ['VocesU', 'Universidades', 'Educacion'], 'La radio hecha por estudiantes.', 'Admisión 2027: lo que debes saber'],
        ['107.10', 'Tecno Beat', ['Electrónica', 'Lo-fi', 'Juvenil'], ['TecnoBeat', 'Electronica'], 'Beats sin pausa.', null],
        ['93.50', 'Raíces Criollas', ['Música Criolla', 'Boleros', 'Retro'], ['RaicesCriollas', 'Criolla', 'Peru'], 'Valses, polkas y marineras de siempre.', null],
        ['100.50', 'Emprende FM', ['Emprendimiento', 'Negocios', 'Podcast'], ['EmprendeFM', 'Negocios', 'Startups'], 'Ideas que se convierten en empresas.', 'Cómo vender por internet en 2026'],
    ];

    public function run(): void
    {
        $open = app(OpenStation::class);

        foreach (self::STATIONS as $index => [$label, $name, $categories, $hashtags, $tagline, $topic]) {
            if (Station::query()->where('name', $name)->exists()) {
                continue;
            }

            $owner = User::query()->firstOrCreate(
                ['email' => Str::slug($name, '.').'@demo.turadioonline.test'],
                ['name' => 'Equipo '.$name, 'password' => 'password', 'email_verified_at' => now()],
            );

            $frequency = Frequency::query()->where('label', $label)->where('status', FrequencyStatus::Available->value)->first()
                ?? Frequency::query()->available()->onDial()->firstOrFail();

            $station = $open->handle(
                $owner,
                $frequency,
                $name,
                Category::query()->whereIn('name', $categories)->pluck('id')->all(),
                $hashtags,
                $tagline,
            );

            $live = $topic !== null;
            $listeners = $live ? random_int(40, 2400) : random_int(0, 120);
            $station->forceFill([
                'tagline' => $tagline,
                'stream_status' => $live ? StreamStatus::Live : ($index % 3 === 0 ? StreamStatus::Offline : StreamStatus::Online),
                'listener_count' => $listeners,
                'peak_listener_count' => $listeners + random_int(10, 600),
                'follower_count' => random_int(30, 9000),
                'last_heartbeat_at' => now(),
                'went_live_at' => $live ? now()->subMinutes(random_int(5, 180)) : null,
            ])->save();

            if ($topic !== null) {
                $current = CurrentTopic::query()->create([
                    'station_id' => $station->id,
                    'title' => $topic,
                    'created_by' => $owner->id,
                    'started_at' => now()->subMinutes(random_int(2, 40)),
                ]);
                Hashtags::sync($current->hashtags(), array_slice($hashtags, 1), (int) config('platform.stations.max_topic_hashtags'));
                $station->forceFill(['current_topic_id' => $current->id])->save();
            }
        }
    }
}
