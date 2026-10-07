<?php

namespace Tests\Feature\Studio;

use App\Domain\Discovery\Events\CurrentTopicChanged;
use App\Domain\Stations\Enums\StationRole;
use App\Models\Station;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TopicTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function hosts_publish_edit_and_end_the_current_topic(): void
    {
        Event::fake([CurrentTopicChanged::class]);
        $station = Station::factory()->create();
        $host = $this->teamMember($station, StationRole::Host);

        $this->actingAs($host)
            ->post($this->studioUrl($station, '/tema'), ['title' => 'Elecciones 2026', 'hashtags' => ['#Elecciones', 'peru']])
            ->assertSessionHasNoErrors();

        $topic = $station->fresh()->currentTopic;
        $this->assertSame('Elecciones 2026', $topic->title);
        Event::assertDispatched(CurrentTopicChanged::class);

        $this->actingAs($host)
            ->put($this->studioUrl($station, '/tema'), ['title' => 'Elecciones 2026: debate', 'hashtags' => ['elecciones']])
            ->assertSessionHasNoErrors();

        $this->assertSame('Elecciones 2026: debate', $topic->fresh()->title);

        $this->actingAs($host)
            ->delete($this->studioUrl($station, '/tema'))
            ->assertSessionHasNoErrors();

        $this->assertNull($station->fresh()->current_topic_id);
    }

    #[Test]
    public function the_hashtag_limit_is_enforced(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($station->owner)
            ->post($this->studioUrl($station, '/tema'), ['title' => 'Muchos temas', 'hashtags' => ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8', 'i9', 'j10', 'k11']])
            ->assertSessionHasErrors('hashtags');
    }

    #[Test]
    public function editors_cannot_publish_topics(): void
    {
        $station = Station::factory()->create();

        $this->actingAs($this->teamMember($station, StationRole::Editor))
            ->post($this->studioUrl($station, '/tema'), ['title' => 'Sin permiso'])
            ->assertForbidden();
    }
}
