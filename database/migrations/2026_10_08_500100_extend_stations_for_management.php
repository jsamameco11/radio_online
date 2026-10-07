<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Station management: profile avatar and banner, frequency requests that move
 * an existing station to another frequency, and closed (soft deleted)
 * stations no longer blocking their frequency, so it can be released and
 * handed to a new station.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stations', function (Blueprint $table) {
            $table->string('avatar_path')->nullable()->after('cover_path');
            $table->string('banner_path')->nullable()->after('avatar_path');
        });

        Schema::table('stations', function (Blueprint $table) {
            $table->index('frequency_id');
            $table->dropUnique(['frequency_id']);
        });

        Schema::table('frequency_requests', function (Blueprint $table) {
            $table->string('kind', 20)->default('new_station')->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('frequency_requests', function (Blueprint $table) {
            $table->dropColumn('kind');
        });

        Schema::table('stations', function (Blueprint $table) {
            $table->unique('frequency_id');
            $table->dropIndex(['frequency_id']);
        });

        Schema::table('stations', function (Blueprint $table) {
            $table->dropColumn(['avatar_path', 'banner_path']);
        });
    }
};
