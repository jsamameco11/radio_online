<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('station_stories', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignId('posted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('kind', 10);
            $table->string('media_key')->nullable();
            $table->string('poster_key')->nullable();
            $table->string('text', 250)->nullable();
            $table->string('background', 20)->nullable();
            $table->unsignedInteger('duration_ms');
            $table->unsignedInteger('views_count')->default(0);
            $table->timestamp('expires_at')->index();
            $table->timestamps();

            $table->index(['station_id', 'expires_at']);
        });

        Schema::create('station_story_views', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('story_id')->constrained('station_stories')->cascadeOnDelete();
            $table->string('viewer_key', 64);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->unique(['story_id', 'viewer_key']);
            $table->index('viewer_key');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('station_story_views');
        Schema::dropIfExists('station_stories');
    }
};
