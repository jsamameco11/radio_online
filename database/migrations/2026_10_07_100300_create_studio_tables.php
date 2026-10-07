<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The broadcast studio of every station: its audio library, playlists,
 * timeline, episodes, console recordings and the live WebRTC handshakes.
 *
 * The music catalog (genres and artists) is shared by every station.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('genres', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 60);
            $table->string('slug', 80)->unique();
            $table->string('family', 20)->index();
            $table->json('aliases')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('custom')->default(false);
            $table->timestamps();
        });

        Schema::create('artists', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 120);
            $table->string('slug', 140)->unique();
            $table->json('aliases')->nullable();
            $table->string('kind', 12)->nullable();
            $table->char('country', 2)->nullable();
            $table->string('source', 12)->default('manual');
            $table->string('musicbrainz_id', 36)->nullable();
            $table->timestamps();
        });

        Schema::create('artist_genre', function (Blueprint $table) {
            $table->foreignUuid('artist_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('genre_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->primary(['artist_id', 'genre_id']);
        });

        Schema::create('tracks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 12);
            $table->string('title', 160);
            $table->string('artist', 120)->nullable();
            $table->json('featured')->nullable();
            $table->string('album', 160)->nullable();
            $table->unsignedSmallInteger('year')->nullable();
            $table->string('file_path');
            $table->string('mime', 80)->nullable();
            $table->unsignedBigInteger('size_bytes')->nullable();
            $table->string('original_path')->nullable();
            $table->float('original_duration')->nullable();
            $table->json('edit')->nullable();
            $table->string('edit_status', 20)->nullable();
            $table->string('edit_error', 300)->nullable();
            $table->timestamp('edited_at')->nullable();
            $table->string('cover_path')->nullable();
            $table->json('identity')->nullable();
            $table->timestamp('identified_at')->nullable();
            $table->decimal('duration', 8, 2);
            $table->boolean('rotation')->default(false);
            $table->boolean('duck')->default(false);
            $table->boolean('active')->default(true);
            $table->timestamp('file_checked_at')->nullable();
            $table->string('file_problem', 20)->nullable();
            $table->timestamp('file_problem_at')->nullable();
            $table->timestamps();
            $table->index(['station_id', 'kind', 'active']);
            $table->index(['station_id', 'active', 'file_problem']);
        });

        Schema::create('genre_track', function (Blueprint $table) {
            $table->foreignUuid('genre_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('track_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->primary(['genre_id', 'track_id']);
        });

        Schema::create('playlists', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('description', 240)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('playlist_track', function (Blueprint $table) {
            $table->foreignUuid('playlist_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('track_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('position')->default(0);
            $table->primary(['playlist_id', 'track_id']);
        });

        Schema::create('schedule_slots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->dateTime('starts_at', 3);
            $table->decimal('duration', 8, 2);
            $table->string('kind', 12);
            $table->unsignedTinyInteger('layer')->default(0);
            $table->foreignUuid('track_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignUuid('playlist_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 160);
            $table->string('note', 240)->nullable();
            $table->boolean('bed')->default(false);
            $table->boolean('shuffle')->default(true);
            $table->boolean('duck')->default(false);
            $table->unsignedTinyInteger('volume')->default(100);
            $table->timestamps();
            $table->index(['station_id', 'layer', 'starts_at']);
        });

        Schema::create('episodes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('track_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->string('program', 120)->nullable();
            $table->string('description', 2000)->nullable();
            $table->string('cover_path')->nullable();
            $table->unsignedSmallInteger('season')->nullable();
            $table->unsignedSmallInteger('number')->nullable();
            $table->string('status', 16)->default('draft');
            $table->date('aired_on');
            $table->timestamp('publish_at')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->index(['station_id', 'status', 'aired_on']);
            $table->index(['status', 'published_at']);
        });

        Schema::create('episode_hashtag', function (Blueprint $table) {
            $table->foreignUuid('episode_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hashtag_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->primary(['episode_id', 'hashtag_id']);
            $table->index('hashtag_id');
        });

        Schema::create('recordings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('session', 40);
            $table->string('status', 16)->default('recording');
            $table->string('path')->nullable();
            $table->string('extension', 8)->default('webm');
            $table->string('mime', 80)->default('audio/webm');
            $table->unsignedBigInteger('bytes')->default(0);
            $table->unsignedInteger('parts')->default(0);
            $table->decimal('duration', 8, 2)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->foreignUuid('track_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamps();
            $table->index(['station_id', 'user_id', 'status']);
            $table->index('session');
        });

        Schema::create('listener_peers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->string('session', 40)->nullable();
            $table->string('state', 12)->default('idle');
            $table->text('offer')->nullable();
            $table->text('answer')->nullable();
            $table->dateTime('last_seen');
            $table->dateTime('state_at')->nullable();
            $table->index(['station_id', 'last_seen']);
            $table->index(['station_id', 'session', 'state']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listener_peers');
        Schema::dropIfExists('recordings');
        Schema::dropIfExists('episode_hashtag');
        Schema::dropIfExists('episodes');
        Schema::dropIfExists('schedule_slots');
        Schema::dropIfExists('playlist_track');
        Schema::dropIfExists('playlists');
        Schema::dropIfExists('genre_track');
        Schema::dropIfExists('tracks');
        Schema::dropIfExists('artist_genre');
        Schema::dropIfExists('artists');
        Schema::dropIfExists('genres');
    }
};
