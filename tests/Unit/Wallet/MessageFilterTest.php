<?php

namespace Tests\Unit\Wallet;

use App\Domain\Gifts\Support\MessageFilter;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class MessageFilterTest extends TestCase
{
    #[Test]
    public function blocked_words_are_masked_as_whole_words_regardless_of_case(): void
    {
        $result = MessageFilter::apply('Eres un TONTO, tontolín', ['tonto']);

        $this->assertSame('Eres un *****, tontolín', $result['text']);
        $this->assertTrue($result['flagged']);
    }

    #[Test]
    public function clean_messages_are_left_untouched(): void
    {
        $result = MessageFilter::apply('¡Saludos a toda la cabina!', ['tonto', ' ']);

        $this->assertSame('¡Saludos a toda la cabina!', $result['text']);
        $this->assertFalse($result['flagged']);
    }

    #[Test]
    public function accented_words_are_matched(): void
    {
        $this->assertSame('qué ******* día', MessageFilter::apply('qué MALDÍTO día', ['maldíto'])['text']);
    }
}
