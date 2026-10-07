<?php

namespace Tests\Feature\Access;

use App\Domain\Access\AccountSessions;
use App\Domain\Access\Support\CachedDatabaseSessionHandler;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CachedSessionsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config(['session.driver' => 'database']);
    }

    private function handler(): CachedDatabaseSessionHandler
    {
        $handler = $this->app['session']->driver('database')->getHandler();
        $this->assertInstanceOf(CachedDatabaseSessionHandler::class, $handler);

        return $handler;
    }

    /** A fresh handler, as the next request gets it. */
    private function nextRequest(): CachedDatabaseSessionHandler
    {
        $this->app['session']->forgetDrivers();

        return $this->handler();
    }

    #[Test]
    public function an_unchanged_session_is_served_without_touching_the_database(): void
    {
        $this->handler()->write('session-a', 'payload');
        $this->assertDatabaseHas('sessions', ['id' => 'session-a', 'payload' => base64_encode('payload')]);

        DB::enableQueryLog();
        $handler = $this->nextRequest();
        $this->assertSame('payload', $handler->read('session-a'));
        $handler->write('session-a', 'payload');

        $this->assertSame([], DB::getQueryLog());
    }

    #[Test]
    public function a_new_session_is_stored_with_a_single_insert(): void
    {
        DB::enableQueryLog();
        $this->handler()->write('session-new', 'payload');

        $this->assertCount(1, DB::getQueryLog());
        $this->assertStringStartsWith('insert', DB::getQueryLog()[0]['query']);
        $this->assertDatabaseHas('sessions', ['id' => 'session-new', 'payload' => base64_encode('payload')]);
    }

    #[Test]
    public function a_session_written_elsewhere_meanwhile_is_updated_instead_of_duplicated(): void
    {
        DB::table('sessions')->insert(['id' => 'session-a', 'payload' => base64_encode('other'), 'last_activity' => now()->timestamp]);

        $this->handler()->write('session-a', 'payload');

        $this->assertSame(1, DB::table('sessions')->where('id', 'session-a')->count());
        $this->assertDatabaseHas('sessions', ['id' => 'session-a', 'payload' => base64_encode('payload')]);
    }

    #[Test]
    public function a_changed_session_is_written_to_the_database(): void
    {
        $this->handler()->write('session-a', 'payload');

        $handler = $this->nextRequest();
        $handler->read('session-a');
        $handler->write('session-a', 'changed');

        $this->assertDatabaseHas('sessions', ['id' => 'session-a', 'payload' => base64_encode('changed')]);
        $this->assertSame('changed', $this->nextRequest()->read('session-a'));
    }

    #[Test]
    public function an_unchanged_session_still_refreshes_its_last_activity_every_few_minutes(): void
    {
        $this->handler()->write('session-a', 'payload');
        $this->travel(6)->minutes();

        $handler = $this->nextRequest();
        $handler->read('session-a');
        $handler->write('session-a', 'payload');

        $this->assertSame(now()->timestamp, (int) DB::table('sessions')->where('id', 'session-a')->value('last_activity'));
    }

    #[Test]
    public function sessions_stored_before_the_cache_keep_working(): void
    {
        DB::table('sessions')->insert(['id' => 'session-a', 'payload' => base64_encode('stored'), 'last_activity' => now()->timestamp]);

        $this->assertSame('stored', $this->handler()->read('session-a'));
    }

    #[Test]
    public function ending_the_sessions_of_an_account_signs_every_browser_out(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $this->handler()->write('current', 'here');
        $this->nextRequest()->write('elsewhere', 'there');

        app(AccountSessions::class)->end($user, 'current');

        $handler = $this->nextRequest();
        $this->assertSame('here', $handler->read('current'));
        $this->assertSame('', $handler->read('elsewhere'));
        $this->assertDatabaseMissing('sessions', ['id' => 'elsewhere']);
    }

    #[Test]
    public function a_destroyed_session_is_gone_from_the_cache_too(): void
    {
        $this->handler()->write('session-a', 'payload');

        $this->nextRequest()->destroy('session-a');

        $this->assertSame('', $this->nextRequest()->read('session-a'));
    }
}
