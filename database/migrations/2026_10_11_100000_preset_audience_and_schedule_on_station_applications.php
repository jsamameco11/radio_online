<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| The audience and the planned schedule of an application stop being free text:
| ages and audience tags come from fixed lists (AudienceAge, AudienceTag) and the
| schedule is a start and an end hour (0–23; the end may be past midnight).
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('station_applications', function (Blueprint $table) {
            $table->json('audience_ages')->default('[]')->after('content_types');
            $table->json('audience_tags')->default('[]')->after('audience_ages');
            $table->unsignedTinyInteger('schedule_start_hour')->nullable()->after('broadcast_days');
            $table->unsignedTinyInteger('schedule_end_hour')->nullable()->after('schedule_start_hour');
        });

        Schema::table('station_applications', function (Blueprint $table) {
            $table->dropColumn(['target_audience', 'schedule_notes']);
        });
    }

    public function down(): void
    {
        Schema::table('station_applications', function (Blueprint $table) {
            $table->string('target_audience', 500)->default('');
            $table->string('schedule_notes', 300)->nullable();
        });

        Schema::table('station_applications', function (Blueprint $table) {
            $table->dropColumn(['audience_ages', 'audience_tags', 'schedule_start_hour', 'schedule_end_hour']);
        });
    }
};
