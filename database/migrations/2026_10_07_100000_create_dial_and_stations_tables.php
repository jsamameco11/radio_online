<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The virtual FM dial and the stations that broadcast on it.
 *
 * A frequency exists before anybody owns it; a station is born when the
 * platform approves a request for an available frequency.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();
            $table->string('name', 60);
            $table->string('slug', 80)->unique();
            $table->string('group', 20)->index();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('frequencies', function (Blueprint $table) {
            $table->id();
            $table->decimal('frequency', 5, 2)->unique();
            $table->string('label', 6)->unique();
            $table->string('slug', 6)->unique();
            $table->string('band', 4)->default('FM');
            $table->string('status', 16)->default('available')->index();
            $table->timestamp('reserved_at')->nullable();
            $table->timestamp('activated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('stations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('frequency_id')->unique()->constrained()->restrictOnDelete();
            $table->foreignId('owner_id')->constrained('users')->restrictOnDelete();
            $table->string('name', 80);
            $table->string('tagline', 140)->nullable();
            $table->text('description')->nullable();
            $table->string('logo_path')->nullable();
            $table->string('cover_path')->nullable();
            $table->char('accent_color', 7)->nullable();
            $table->char('language', 2)->default('es');
            $table->char('country', 2)->nullable();
            $table->string('status', 16)->default('active')->index();
            $table->string('visibility', 16)->default('public');
            $table->string('stream_status', 16)->default('offline')->index();
            $table->string('external_stream_url', 500)->nullable();
            $table->unsignedBigInteger('current_topic_id')->nullable();
            $table->unsignedInteger('listener_count')->default(0);
            $table->unsignedInteger('peak_listener_count')->default(0);
            $table->unsignedInteger('follower_count')->default(0);
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->unsignedSmallInteger('bitrate_kbps')->nullable();
            $table->timestamp('went_live_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->string('suspension_reason', 300)->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'visibility', 'stream_status']);
        });

        Schema::create('station_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 16);
            $table->timestamps();
            $table->unique(['station_id', 'user_id']);
        });

        Schema::create('category_station', function (Blueprint $table) {
            $table->foreignId('category_id')->constrained()->cascadeOnDelete();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->primary(['category_id', 'station_id']);
        });

        Schema::create('station_settings', function (Blueprint $table) {
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->string('key', 60);
            $table->json('value')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->primary(['station_id', 'key']);
        });

        Schema::create('frequency_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('frequency_id')->constrained()->cascadeOnDelete();
            $table->string('station_name', 80);
            $table->string('pitch', 1000);
            $table->json('category_ids');
            $table->string('status', 16)->default('pending')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_note', 500)->nullable();
            $table->foreignId('station_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('frequency_requests');
        Schema::dropIfExists('station_settings');
        Schema::dropIfExists('category_station');
        Schema::dropIfExists('station_members');
        Schema::dropIfExists('stations');
        Schema::dropIfExists('frequencies');
        Schema::dropIfExists('categories');
    }
};
