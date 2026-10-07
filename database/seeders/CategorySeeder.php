<?php

namespace Database\Seeders;

use App\Domain\Discovery\Enums\CategoryGroup;
use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/** The starting catalog of station styles; administrators can add more from the control panel. */
class CategorySeeder extends Seeder
{
    /** @var array<string, list<string>> */
    private const CATALOG = [
        'music' => [
            'Pop', 'Rock', 'Rock en Español', 'Salsa', 'Cumbia', 'Reggaetón', 'Bachata', 'Merengue', 'Vallenato',
            'Electrónica', 'Jazz', 'Blues', 'Hip Hop', 'Rap', 'Trap', 'Indie', 'Metal', 'K-Pop', 'Reggae', 'Country',
            'Música Latina', 'Música Criolla', 'Folklore', 'Música Andina', 'Huayno', 'Chicha', 'Instrumental',
            'Música Clásica', 'Baladas', 'Boleros', 'Romántica', 'Tropical', 'Urbana', 'Retro', 'Oldies', 'Ochentas',
            'Lo-fi', 'Música Cristiana',
        ],
        'information' => [
            'Noticias', 'Política', 'Economía', 'Actualidad', 'Internacional', 'Local', 'Deportes', 'Fútbol',
            'Tecnología', 'Ciencia', 'Opinión', 'Debate', 'Entrevistas', 'Clima y Tránsito',
        ],
        'entertainment' => [
            'Entretenimiento', 'Humor', 'Comedia', 'Talk Show', 'Espectáculos', 'Farándula', 'Gaming', 'Lifestyle',
            'Cine y Series', 'Anime', 'Magazine', 'Misterio', 'Radioteatro',
        ],
        'education' => [
            'Educación', 'Universitaria', 'Preuniversitaria', 'Idiomas', 'Historia', 'Literatura', 'Cultura',
            'Filosofía', 'Documental',
        ],
        'specialized' => [
            'Religión', 'Espiritualidad', 'Motivación', 'Negocios', 'Emprendimiento', 'Salud', 'Bienestar',
            'Infantil', 'Juvenil', 'Comunitaria', 'Podcast', 'Gastronomía', 'Viajes', 'Autos', 'Mascotas',
            'Agro', 'Medio Ambiente',
        ],
    ];

    public function run(): void
    {
        foreach (self::CATALOG as $group => $names) {
            foreach ($names as $order => $name) {
                Category::query()->updateOrCreate(
                    ['slug' => Str::slug($name)],
                    ['name' => $name, 'group' => CategoryGroup::from($group), 'sort_order' => $order],
                );
            }
        }
    }
}
