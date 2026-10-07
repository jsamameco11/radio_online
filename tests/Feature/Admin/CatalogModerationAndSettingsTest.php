<?php

namespace Tests\Feature\Admin;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Discovery\Enums\CategoryGroup;
use App\Domain\Moderation\Enums\ReportReason;
use App\Domain\Moderation\Enums\ReportStatus;
use App\Domain\Platform\PlatformSettings;
use App\Domain\Stations\Enums\StationStatus;
use App\Models\Category;
use App\Models\Report;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CatalogModerationAndSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
    }

    #[Test]
    public function admins_create_rename_and_delete_categories(): void
    {
        $admin = $this->staff(PlatformRole::Admin);

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/categorias'), ['name' => 'Cumbia', 'group' => CategoryGroup::Music->value, 'active' => true])
            ->assertSessionHasNoErrors();

        $category = Category::query()->where('name', 'Cumbia')->firstOrFail();

        $this->actingAs($admin)
            ->post($this->controlUrl('/admin/categorias'), ['name' => 'cumbia', 'group' => CategoryGroup::Music->value, 'active' => true])
            ->assertSessionHasErrors('name');

        $this->actingAs($admin)
            ->put($this->controlUrl("/admin/categorias/{$category->slug}"), ['name' => 'Cumbia peruana', 'group' => CategoryGroup::Music->value, 'active' => false])
            ->assertSessionHasNoErrors();

        $category->refresh();
        $this->assertSame('Cumbia peruana', $category->name);

        $this->actingAs($admin)
            ->delete($this->controlUrl("/admin/categorias/{$category->slug}"))
            ->assertSessionHasNoErrors();

        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    }

    #[Test]
    public function moderators_resolve_reports_and_can_suspend_the_reported_station(): void
    {
        $station = Station::factory()->create();
        $report = $this->report($station);
        $moderator = $this->staff(PlatformRole::Moderator);

        $this->actingAs($moderator)
            ->get($this->controlUrl('/admin/moderacion'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Moderation/Index')->has('reports.data', 1));

        $this->actingAs($moderator)
            ->post($this->controlUrl("/admin/moderacion/{$report->id}/resolver"), ['outcome' => ReportStatus::Dismissed->value])
            ->assertSessionHasNoErrors();

        $this->assertSame(ReportStatus::Dismissed, $report->fresh()->status);

        $this->actingAs($moderator)
            ->post($this->controlUrl("/admin/moderacion/{$this->report($station)->id}/suspender-radio"), ['reason' => 'Contenido ofensivo reiterado'])
            ->assertForbidden();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->post($this->controlUrl("/admin/moderacion/{$this->report($station)->id}/suspender-radio"), ['reason' => 'Contenido ofensivo reiterado'])
            ->assertSessionHasNoErrors();

        $this->assertSame(StationStatus::Suspended, $station->fresh()->status);
    }

    #[Test]
    public function super_admins_update_platform_settings(): void
    {
        $this->actingAs($this->staff())
            ->put($this->controlUrl('/admin/configuracion'), [
                'registrations_open' => true,
                'frequency_requests_open' => false,
                'maintenance_banner' => 'Mantenimiento el domingo a las 3:00.',
                'max_pending_requests' => 2,
                'stale_heartbeat_seconds' => 120,
            ])
            ->assertSessionHasNoErrors();

        $settings = app(PlatformSettings::class);
        $this->assertFalse((bool) $settings->get('frequency_requests_open'));
        $this->assertSame(2, (int) $settings->get('max_pending_requests'));
    }

    #[Test]
    public function the_audit_log_requires_audit_view(): void
    {
        $this->actingAs($this->staff(PlatformRole::Moderator))
            ->get($this->controlUrl('/admin/auditoria'))
            ->assertForbidden();

        $this->actingAs($this->staff(PlatformRole::Admin))
            ->get($this->controlUrl('/admin/auditoria?accion=station.'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Admin/Audit/Index'));
    }

    private function report(Station $station): Report
    {
        return Report::query()->create([
            'reporter_id' => User::factory()->create()->id,
            'reportable_type' => 'station',
            'reportable_id' => $station->id,
            'reason' => ReportReason::Harassment,
            'status' => ReportStatus::Open,
        ]);
    }
}
