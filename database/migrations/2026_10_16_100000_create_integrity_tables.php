<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Audience integrity: subscriptions only count once the follower proves to be a real listener,
 * every follow and listening session remembers the (hashed) network it came from, accounts
 * can be marked as untrustworthy, and the scanner files alerts about bot farms per station.
 * Existing subscriptions keep counting.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('follows', function (Blueprint $table) {
            $table->string('status', 12)->default('counted');
            $table->char('network', 16)->nullable();
            $table->timestamp('counted_at')->nullable();
            $table->index(['station_id', 'status', 'created_at']);
            $table->index(['status', 'user_id']);
        });
        DB::table('follows')->update(['counted_at' => DB::raw('created_at')]);

        Schema::table('listener_sessions', function (Blueprint $table) {
            $table->char('network', 16)->nullable();
            $table->boolean('suspect')->default(false);
            $table->index(['station_id', 'network', 'started_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('flagged_at')->nullable();
            $table->string('flag_reason', 200)->nullable();
        });

        Schema::create('integrity_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 32);
            $table->string('severity', 10);
            $table->string('status', 12)->default('open');
            $table->json('evidence');
            $table->timestamp('detected_at');
            $table->timestamp('last_detected_at');
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->string('note', 500)->nullable();
            $table->timestamps();
            $table->index(['status', 'station_id', 'kind']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('integrity_alerts');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['flagged_at', 'flag_reason']);
        });

        Schema::table('listener_sessions', function (Blueprint $table) {
            $table->dropIndex(['station_id', 'network', 'started_at']);
            $table->dropColumn(['network', 'suspect']);
        });

        Schema::table('follows', function (Blueprint $table) {
            $table->dropIndex(['station_id', 'status', 'created_at']);
            $table->dropIndex(['status', 'user_id']);
            $table->dropColumn(['status', 'network', 'counted_at']);
        });
    }
};
