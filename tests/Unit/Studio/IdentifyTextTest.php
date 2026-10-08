<?php

namespace Tests\Unit\Studio;

use App\Domain\Studio\Library\Identify\Text;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class IdentifyTextTest extends TestCase
{
    #[Test]
    public function keys_ignore_case_accents_and_punctuation(): void
    {
        $this->assertSame('vivir mi vida en vivo', Text::key('Vivir Mi Vida (En Vivo)'));
        $this->assertSame(Text::key('Simon and Garfunkel'), Text::key('Simon + Garfunkel'));
    }

    #[Test]
    public function titles_lose_credits_versions_and_video_labels(): void
    {
        $this->assertSame('Pedro Navaja', Text::cleanTitle('Pedro Navaja (feat. Willie Colón) [Official Video]'));
        $this->assertSame('La Camisa Negra', Text::cleanTitle('03. La Camisa Negra (Video Oficial)'));
    }

    #[Test]
    public function authors_lose_channel_labels_and_copy_marks(): void
    {
        $this->assertSame('Marc Anthony', Text::cleanArtist('Marc Anthony - Topic'));
        $this->assertSame('Juanes', Text::cleanArtist('Juanes (1)'));
    }

    #[Test]
    public function guests_come_out_of_the_title(): void
    {
        $this->assertSame(['Willie Colón'], Text::featuredIn('Pedro Navaja (feat. Willie Colón)'));
        $this->assertSame(['Rubén Blades', 'Willie Colón'], Text::splitNames('Rubén Blades & Willie Colón'));
        $this->assertSame(['Simon & Garfunkel'], Text::splitNames('Simon & Garfunkel', ['Simon & Garfunkel']));
    }

    #[Test]
    public function an_author_written_at_the_edge_of_the_title_is_taken_out(): void
    {
        $this->assertSame('La Camisa Negra', Text::withoutName('Juanes La Camisa Negra', 'Juanes'));
        $this->assertNull(Text::withoutName('Juanes', 'Juanes'));
        $this->assertNull(Text::withoutName('La Camisa Negra', 'Shakira'));
    }

    #[Test]
    public function handles_belong_to_the_names_they_spell(): void
    {
        $this->assertTrue(Text::isHandle('@losamigosoficial'));
        $this->assertTrue(Text::handleOf('@losamigosoficial', 'Los Amigos'));
        $this->assertFalse(Text::handleOf('@otrabanda', 'Los Amigos'));
    }

    #[Test]
    public function live_recordings_and_album_editions_are_recognized(): void
    {
        $this->assertTrue(Text::isLive('Vivir Mi Vida (En Vivo)'));
        $this->assertFalse(Text::isLive('Vivir Mi Vida'));
        $this->assertSame(Text::albumKey('Siembra'), Text::albumKey('Siembra (Deluxe Edition)'));
    }

    #[Test]
    public function title_similarity_respects_word_order_and_subtitles(): void
    {
        $this->assertSame(1.0, Text::titleSimilarity('Bohemian Rhapsody (Remastered 2011)', 'Bohemian Rhapsody'));
        $this->assertLessThan(0.9, Text::titleSimilarity('Yo y tú', 'Tú y yo'));
        $this->assertLessThan(0.9, Text::titleSimilarity('Amor Eterno Mío', 'Amor Eterno'));
        $this->assertGreaterThan(0.9, Text::similarity('Rubén Blades', 'Ruben Blades'));
    }

    #[Test]
    public function the_best_spelling_is_the_first_written_in_mixed_case(): void
    {
        $this->assertSame('Rubén Blades', Text::bestSpelling(['RUBÉN BLADES', 'rubén blades', 'Rubén Blades', 'Ruben Blades']));
        $this->assertSame('BONITA', Text::bestSpelling(['', null, 'BONITA']));
        $this->assertSame(['Rubén Blades'], Text::unique(['Rubén Blades', 'ruben blades', null, '']));
    }
}
