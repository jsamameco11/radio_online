<?php

namespace Tests\Unit;

use App\Domain\Frequencies\FrequencyDial;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class FrequencyDialTest extends TestCase
{
    private function dial(): FrequencyDial
    {
        return new FrequencyDial(87.70, 107.90, 1983);
    }

    #[Test]
    public function it_draws_the_requested_number_of_unique_frequencies_inside_the_band(): void
    {
        $frequencies = $this->dial()->frequencies(500);

        $this->assertCount(500, $frequencies);
        $this->assertSame($frequencies, array_values(array_unique($frequencies)));
        $this->assertGreaterThanOrEqual(87.70, (float) $frequencies[0]);
        $this->assertLessThanOrEqual(107.90, (float) end($frequencies));
    }

    #[Test]
    public function it_prefers_frequencies_that_look_like_real_fm_stations(): void
    {
        $frequencies = $this->dial()->frequencies(500);
        $roundTenths = array_filter($frequencies, fn (string $label) => str_ends_with($label, '0'));

        $this->assertContains('89.30', $frequencies);
        $this->assertContains('101.70', $frequencies);
        $this->assertGreaterThan(190, count($roundTenths));
    }

    #[Test]
    public function growing_the_dial_never_moves_an_existing_frequency(): void
    {
        $small = $this->dial()->frequencies(500);
        $large = $this->dial()->frequencies(1000);

        $this->assertSame([], array_values(array_diff($small, $large)));
    }

    #[Test]
    public function it_is_deterministic_for_a_seed(): void
    {
        $this->assertSame($this->dial()->frequencies(500), $this->dial()->frequencies(500));
    }

    #[Test]
    public function it_normalizes_what_people_type(): void
    {
        $this->assertSame('89.30', FrequencyDial::normalize('89.3'));
        $this->assertSame('89.30', FrequencyDial::normalize('89-30'));
        $this->assertSame('101.70', FrequencyDial::normalize('101,7 FM'));
        $this->assertNull(FrequencyDial::normalize('Radio Aurora'));
        $this->assertSame('89-30', FrequencyDial::slug('89.30'));
    }
}
