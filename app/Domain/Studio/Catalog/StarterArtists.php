<?php

namespace App\Domain\Studio\Catalog;

/**
 * Well-known singers and groups the music catalog recognizes from the start,
 * across every style a station may play. Their genres classify a song when
 * the internet has nothing more precise; artists found while uploading are
 * learned on top of these.
 */
final class StarterArtists
{
    /**
     * [name, kind, country (ISO 3166-1), [genres], [other spellings]].
     *
     * @return list<array{0: string, 1: ArtistKind, 2: ?string, 3: list<string>, 4?: list<string>}>
     */
    public static function all(): array
    {
        $solo = ArtistKind::Solo;
        $group = ArtistKind::Group;

        return [
            // Pop latino y baladas
            ['Shakira', $solo, 'CO', ['Pop latino', 'Pop rock']],
            ['Luis Miguel', $solo, 'MX', ['Balada romántica', 'Bolero', 'Pop latino']],
            ['Juanes', $solo, 'CO', ['Pop latino', 'Rock en español']],
            ['Carlos Vives', $solo, 'CO', ['Vallenato', 'Tropipop', 'Pop latino']],
            ['Ricky Martin', $solo, 'PR', ['Pop latino', 'Dance pop']],
            ['Alejandro Sanz', $solo, 'ES', ['Pop latino', 'Balada romántica', 'Flamenco pop']],
            ['Laura Pausini', $solo, 'IT', ['Pop latino', 'Balada romántica', 'Pop italiano']],
            ['Ricardo Arjona', $solo, 'GT', ['Pop latino', 'Balada', 'Cantautor']],
            ['Camilo Sesto', $solo, 'ES', ['Balada romántica']],
            ['José José', $solo, 'MX', ['Balada romántica', 'Bolero']],
            ['Rocío Dúrcal', $solo, 'ES', ['Ranchera', 'Balada romántica']],
            ['Julio Iglesias', $solo, 'ES', ['Balada romántica', 'Pop latino']],
            ['Gian Marco', $solo, 'PE', ['Pop latino', 'Balada', 'Cantautor']],
            ['Eva Ayllón', $solo, 'PE', ['Música criolla', 'Música afroperuana', 'Vals peruano']],
            ['Chabuca Granda', $solo, 'PE', ['Música criolla', 'Vals peruano']],
            ['Susana Baca', $solo, 'PE', ['Música afroperuana', 'Landó']],
            ['Natalia Lafourcade', $solo, 'MX', ['Pop latino', 'Cantautor', 'Folclore latinoamericano']],
            ['Sin Bandera', $group, 'MX', ['Pop latino', 'Balada romántica']],
            ['Ha*Ash', $group, 'MX', ['Pop latino', 'Country pop'], ['Ha Ash', 'HaAsh']],
            ['Jesse & Joy', $group, 'MX', ['Pop latino', 'Pop acústico'], ['Jesse y Joy']],
            ['Morat', $group, 'CO', ['Pop latino', 'Pop rock']],
            ['Camila', $group, 'MX', ['Pop latino', 'Balada romántica']],

            // Rock
            ['Soda Stereo', $group, 'AR', ['Rock en español', 'New wave', 'Rock argentino']],
            ['Gustavo Cerati', $solo, 'AR', ['Rock en español', 'Rock argentino']],
            ['Maná', $group, 'MX', ['Rock en español', 'Pop rock'], ['Mana']],
            ['Caifanes', $group, 'MX', ['Rock en español', 'Rock mexicano']],
            ['Café Tacvba', $group, 'MX', ['Rock en español', 'Rock alternativo', 'Rock mexicano'], ['Cafe Tacuba', 'Café Tacuba']],
            ['Los Prisioneros', $group, 'CL', ['Rock en español', 'New wave']],
            ['Enanitos Verdes', $group, 'AR', ['Rock en español', 'Pop rock']],
            ['Los Fabulosos Cadillacs', $group, 'AR', ['Ska', 'Rock en español']],
            ['Libido', $group, 'PE', ['Rock en español', 'Rock peruano']],
            ['Pedro Suárez-Vértiz', $solo, 'PE', ['Rock en español', 'Rock peruano', 'Pop rock'], ['Pedro Suarez Vertiz']],
            ['Mar de Copas', $group, 'PE', ['Rock en español', 'Rock peruano']],
            ['The Beatles', $group, 'GB', ['Rock', 'Pop rock', 'Rock psicodélico'], ['Beatles']],
            ['Queen', $group, 'GB', ['Rock', 'Hard rock', 'Rock clásico']],
            ['The Rolling Stones', $group, 'GB', ['Rock', 'Rock and roll', 'Blues rock'], ['Rolling Stones']],
            ['Pink Floyd', $group, 'GB', ['Rock progresivo', 'Rock psicodélico']],
            ['Led Zeppelin', $group, 'GB', ['Hard rock', 'Blues rock']],
            ['Nirvana', $group, 'US', ['Grunge', 'Rock alternativo']],
            ['Coldplay', $group, 'GB', ['Pop rock', 'Rock alternativo']],
            ['U2', $group, 'IE', ['Rock', 'Rock alternativo']],
            ['Bon Jovi', $group, 'US', ['Hard rock', 'Rock melódico']],
            ['Guns N\' Roses', $group, 'US', ['Hard rock', 'Heavy metal'], ['Guns N Roses', 'Guns and Roses']],
            ['Linkin Park', $group, 'US', ['Nu metal', 'Rock alternativo', 'Rap rock']],
            ['Imagine Dragons', $group, 'US', ['Pop rock', 'Rock alternativo']],

            // Metal y punk
            ['Metallica', $group, 'US', ['Heavy metal', 'Thrash metal']],
            ['Iron Maiden', $group, 'GB', ['Heavy metal', 'NWOBHM']],
            ['AC/DC', $group, 'AU', ['Hard rock', 'Rock and roll'], ['ACDC', 'AC DC']],
            ['Rata Blanca', $group, 'AR', ['Heavy metal', 'Power metal']],
            ['Green Day', $group, 'US', ['Pop punk', 'Punk rock']],
            ['Blink-182', $group, 'US', ['Pop punk', 'Skate punk'], ['Blink 182']],

            // Pop internacional
            ['Michael Jackson', $solo, 'US', ['Pop', 'R&B', 'Dance pop']],
            ['Madonna', $solo, 'US', ['Pop', 'Dance pop']],
            ['Taylor Swift', $solo, 'US', ['Pop', 'Country pop']],
            ['Adele', $solo, 'GB', ['Pop soul', 'Pop']],
            ['Ed Sheeran', $solo, 'GB', ['Pop', 'Pop acústico']],
            ['Bruno Mars', $solo, 'US', ['Pop', 'R&B', 'Funk']],
            ['Dua Lipa', $solo, 'GB', ['Dance pop', 'Pop']],
            ['The Weeknd', $solo, 'CA', ['R&B contemporáneo', 'Pop', 'Synth-pop']],
            ['Billie Eilish', $solo, 'US', ['Pop alternativo', 'Electropop']],
            ['BTS', $group, 'KR', ['K-pop']],
            ['BLACKPINK', $group, 'KR', ['K-pop'], ['Blackpink']],
            ['ABBA', $group, 'SE', ['Europop', 'Pop', 'Disco']],

            // Urbano
            ['Bad Bunny', $solo, 'PR', ['Trap latino', 'Reguetón', 'Urbano latino']],
            ['Daddy Yankee', $solo, 'PR', ['Reguetón', 'Urbano latino']],
            ['J Balvin', $solo, 'CO', ['Reguetón', 'Urbano latino']],
            ['Karol G', $solo, 'CO', ['Reguetón', 'Urbano latino', 'Pop urbano']],
            ['Ozuna', $solo, 'PR', ['Reguetón', 'Trap latino']],
            ['Wisin & Yandel', $group, 'PR', ['Reguetón'], ['Wisin y Yandel']],
            ['Don Omar', $solo, 'PR', ['Reguetón']],
            ['Rauw Alejandro', $solo, 'PR', ['Reguetón', 'Pop urbano']],
            ['Feid', $solo, 'CO', ['Reguetón', 'Urbano latino']],
            ['Calle 13', $group, 'PR', ['Hip hop latino', 'Rap en español', 'Fusión latina']],
            ['Canserbero', $solo, 'VE', ['Rap en español', 'Rap consciente']],
            ['Eminem', $solo, 'US', ['Hip hop', 'Rap']],
            ['Drake', $solo, 'CA', ['Hip hop', 'R&B contemporáneo', 'Pop rap']],
            ['Kendrick Lamar', $solo, 'US', ['Hip hop', 'Rap consciente', 'West Coast hip hop']],
            ['Peso Pluma', $solo, 'MX', ['Corridos tumbados', 'Regional urbano']],

            // Tropical
            ['Marc Anthony', $solo, 'US', ['Salsa', 'Salsa romántica', 'Pop latino']],
            ['Celia Cruz', $solo, 'CU', ['Salsa', 'Guaracha cubana', 'Son cubano']],
            ['Héctor Lavoe', $solo, 'PR', ['Salsa'], ['Hector Lavoe']],
            ['Rubén Blades', $solo, 'PA', ['Salsa', 'Cantautor'], ['Ruben Blades']],
            ['Willie Colón', $solo, 'US', ['Salsa'], ['Willie Colon']],
            ['Grupo Niche', $group, 'CO', ['Salsa']],
            ['Gilberto Santa Rosa', $solo, 'PR', ['Salsa', 'Salsa romántica']],
            ['Juan Luis Guerra', $solo, 'DO', ['Merengue', 'Bachata', 'Pop latino'], ['Juan Luis Guerra 4.40']],
            ['Romeo Santos', $solo, 'US', ['Bachata', 'Bachata urbana']],
            ['Aventura', $group, 'US', ['Bachata', 'Bachata urbana']],
            ['Prince Royce', $solo, 'US', ['Bachata', 'Bachata urbana']],
            ['Grupo 5', $group, 'PE', ['Cumbia peruana', 'Cumbia']],
            ['Agua Marina', $group, 'PE', ['Cumbia peruana', 'Cumbia']],
            ['Corazón Serrano', $group, 'PE', ['Cumbia peruana', 'Cumbia'], ['Corazon Serrano']],
            ['Los Mirlos', $group, 'PE', ['Cumbia amazónica', 'Cumbia peruana']],
            ['Los Ángeles Azules', $group, 'MX', ['Cumbia mexicana', 'Cumbia sonidera'], ['Los Angeles Azules']],
            ['Diomedes Díaz', $solo, 'CO', ['Vallenato', 'Vallenato romántico'], ['Diomedes Diaz']],
            ['Silvestre Dangond', $solo, 'CO', ['Vallenato']],
            ['Buena Vista Social Club', $group, 'CU', ['Son cubano', 'Bolero']],

            // Regional mexicano
            ['Vicente Fernández', $solo, 'MX', ['Ranchera', 'Mariachi'], ['Vicente Fernandez']],
            ['Pedro Infante', $solo, 'MX', ['Ranchera', 'Bolero ranchero']],
            ['Los Tigres del Norte', $group, 'MX', ['Norteño', 'Corridos']],
            ['Banda MS', $group, 'MX', ['Banda'], ['Banda MS de Sergio Lizárraga']],
            ['Christian Nodal', $solo, 'MX', ['Regional mexicano', 'Mariachi']],
            ['Grupo Firme', $group, 'MX', ['Regional mexicano', 'Norteño-banda']],
            ['Selena', $solo, 'US', ['Tejano', 'Cumbia mexicana'], ['Selena Quintanilla']],

            // Andina y folclore
            ['Dina Páucar', $solo, 'PE', ['Huayno'], ['Dina Paucar']],
            ['Max Castro', $solo, 'PE', ['Huayno']],
            ['William Luna', $solo, 'PE', ['Música andina', 'Huayno']],
            ['Los Kjarkas', $group, 'BO', ['Música andina', 'Caporales', 'Saya']],
            ['Mercedes Sosa', $solo, 'AR', ['Folclore argentino', 'Nueva canción']],
            ['Violeta Parra', $solo, 'CL', ['Nueva canción', 'Cueca']],
            ['Carlos Gardel', $solo, 'AR', ['Tango']],
            ['Astor Piazzolla', $solo, 'AR', ['Tango', 'Jazz fusión']],
            ['Silvio Rodríguez', $solo, 'CU', ['Nueva trova', 'Cantautor'], ['Silvio Rodriguez']],
            ['Joan Manuel Serrat', $solo, 'ES', ['Cantautor', 'Canción protesta']],

            // Brasil
            ['Antônio Carlos Jobim', $solo, 'BR', ['Bossa nova', 'MPB'], ['Tom Jobim', 'Antonio Carlos Jobim']],
            ['Caetano Veloso', $solo, 'BR', ['MPB', 'Tropicália']],
            ['Anitta', $solo, 'BR', ['Funk carioca', 'Pop']],

            // Jazz, blues y soul
            ['Louis Armstrong', $solo, 'US', ['Jazz', 'Swing', 'Dixieland']],
            ['Ella Fitzgerald', $solo, 'US', ['Jazz vocal', 'Swing']],
            ['Miles Davis', $solo, 'US', ['Jazz', 'Cool jazz', 'Jazz modal']],
            ['B.B. King', $solo, 'US', ['Blues', 'Blues eléctrico'], ['BB King']],
            ['Aretha Franklin', $solo, 'US', ['Soul', 'R&B']],
            ['Stevie Wonder', $solo, 'US', ['Soul', 'Funk', 'Motown']],
            ['Bob Marley', $solo, 'JM', ['Reggae'], ['Bob Marley & The Wailers', 'Bob Marley and the Wailers']],

            // Electrónica
            ['Daft Punk', $group, 'FR', ['French house', 'Electrónica']],
            ['Avicii', $solo, 'SE', ['Progressive house', 'EDM']],
            ['David Guetta', $solo, 'FR', ['EDM', 'House', 'Dance pop']],
            ['Calvin Harris', $solo, 'GB', ['EDM', 'Dance pop', 'House']],

            // Clásica e instrumental
            ['Wolfgang Amadeus Mozart', $solo, 'AT', ['Clasicismo', 'Clásica'], ['Mozart', 'W. A. Mozart']],
            ['Ludwig van Beethoven', $solo, 'DE', ['Clasicismo', 'Romanticismo', 'Clásica'], ['Beethoven']],
            ['Johann Sebastian Bach', $solo, 'DE', ['Barroca', 'Clásica'], ['J. S. Bach', 'Bach']],
            ['Ludovico Einaudi', $solo, 'IT', ['Neoclásica', 'Piano']],
            ['Hans Zimmer', $solo, 'DE', ['Banda sonora', 'Orquestal']],

            // Country y del mundo
            ['Johnny Cash', $solo, 'US', ['Country', 'Outlaw country']],
            ['Dolly Parton', $solo, 'US', ['Country', 'Country pop']],
            ['Paco de Lucía', $solo, 'ES', ['Flamenco'], ['Paco de Lucia']],
            ['Rosalía', $solo, 'ES', ['Flamenco pop', 'Pop experimental', 'Reguetón'], ['Rosalia']],

            // Música cristiana
            ['Marcos Witt', $solo, 'MX', ['Adoración', 'Alabanza']],
            ['Jesús Adrián Romero', $solo, 'MX', ['Adoración', 'Balada cristiana'], ['Jesus Adrian Romero']],
            ['Marcela Gándara', $solo, 'MX', ['Adoración', 'Balada cristiana'], ['Marcela Gandara']],
            ['Alex Campos', $solo, 'CO', ['Pop cristiano', 'Balada cristiana']],
            ['Miel San Marcos', $group, 'GT', ['Adoración', 'Alabanza']],
            ['Barak', $group, 'DO', ['Adoración', 'Alabanza']],
            ['Redimi2', $solo, 'DO', ['Urbano cristiano', 'Rap cristiano']],
            ['Hillsong United', $group, 'AU', ['Adoración', 'Cristiana contemporánea (CCM)']],
            ['Elevation Worship', $group, 'US', ['Adoración', 'Cristiana contemporánea (CCM)']],
            ['Lauren Daigle', $solo, 'US', ['Cristiana contemporánea (CCM)', 'Pop cristiano']],
            ['Kirk Franklin', $solo, 'US', ['Gospel']],
            ['Mahalia Jackson', $solo, 'US', ['Gospel', 'Espirituales negros']],

            // Infantil
            ['Cantajuego', $group, 'ES', ['Música infantil'], ['CantaJuego']],
            ['Topa', $solo, 'AR', ['Música infantil']],
        ];
    }
}
