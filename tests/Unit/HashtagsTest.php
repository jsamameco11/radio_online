<?php

namespace Tests\Unit;

use App\Domain\Discovery\Hashtags;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class HashtagsTest extends TestCase
{
    #[Test]
    public function it_normalizes_hashtags_without_accents_or_spaces(): void
    {
        $this->assertSame(['name' => 'FutbolPeruano', 'slug' => 'futbolperuano'], Hashtags::normalize('#Fútbol peruano'));
        $this->assertSame(['name' => 'Peru', 'slug' => 'peru'], Hashtags::normalize('  #perú '));
        $this->assertNull(Hashtags::normalize('#  '));
        $this->assertNull(Hashtags::normalize('¡¿?!'));
    }
}
