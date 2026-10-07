<?php

namespace Tests\Feature\Admin;

use App\Domain\Frequencies\DialMap;
use App\Domain\Frequencies\Enums\FrequencyStatus;
use App\Models\Frequency;
use Database\Seeders\AccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FrequencyMapTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(AccessSeeder::class);
        $this->withoutVite();
    }

    #[Test]
    public function the_frequencies_page_shows_the_dial_usage_by_range_and_status(): void
    {
        Frequency::factory()->create(['frequency' => '87.70', 'label' => '87.70', 'slug' => '87-70']);
        Frequency::factory()->active()->create(['frequency' => '87.90', 'label' => '87.90', 'slug' => '87-90']);
        Frequency::factory()->create(['frequency' => '107.90', 'label' => '107.90', 'slug' => '107-90', 'status' => FrequencyStatus::Reserved]);

        $this->actingAs($this->staff())
            ->get($this->controlUrl('/admin/frecuencias'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Frequencies/Index')
                ->has('dial', DialMap::SEGMENTS)
                ->where('dial.0', ['from' => 87.7, 'to' => 88.21, 'total' => 2, 'used' => 1, 'on_air' => 1])
                ->where('dial.'.(DialMap::SEGMENTS - 1).'.to', 107.9)
                ->where('dial.'.(DialMap::SEGMENTS - 1).'.used', 1)
                ->where('statuses.0', ['value' => 'available', 'label' => FrequencyStatus::Available->label(), 'total' => 1])
                ->where('statuses.1.total', 1)
                ->where('statuses.2.total', 1));
    }

    #[Test]
    public function the_unfiltered_list_takes_its_total_from_the_dial_map(): void
    {
        Frequency::factory()->count(3)->create();
        $staff = $this->staff();
        DB::enableQueryLog();

        $this->actingAs($staff)
            ->get($this->controlUrl('/admin/frecuencias'))
            ->assertInertia(fn (Assert $page) => $page->where('frequencies.total', 3));

        $counts = collect(DB::getQueryLog())->filter(fn (array $query) => str_contains($query['query'], 'as "aggregate"'));
        $this->assertCount(0, $counts);
    }

    #[Test]
    public function filtering_reloads_only_the_table(): void
    {
        Frequency::factory()->count(3)->create();

        $this->actingAs($this->staff())
            ->get($this->controlUrl('/admin/frecuencias?status=available'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->reloadOnly(['frequencies', 'filters'], fn (Assert $reload) => $reload
                ->where('frequencies.total', 3)
                ->missing('dial')
                ->missing('statuses')));
    }
}
