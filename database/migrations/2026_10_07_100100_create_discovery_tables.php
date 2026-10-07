<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hashtags and the "what is on air right now" topic of every station.
 *
 * Hashtags attach to stations (permanent identity), current topics (what is
 * being talked about right now) and episodes, so a search for #Futbol finds
 * every station talking about football at this moment.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hashtags', function (Blueprint $table) {
            $table->id();
            $table->string('name', 40);
            $table->string('slug', 40)->unique();
            $table->unsignedInteger('uses_count')->default(0);
            $table->timestamps();
        });

        Schema::create('hashtag_station', function (Blueprint $table) {
            $table->foreignId('hashtag_id')->constrained()->cascadeOnDelete();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->primary(['hashtag_id', 'station_id']);
            $table->index('station_id');
        });

        Schema::create('current_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->string('title', 160);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            $table->index(['station_id', 'ended_at']);
        });

        Schema::create('current_topic_hashtag', function (Blueprint $table) {
            $table->foreignId('current_topic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('hashtag_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('position')->default(0);
            $table->primary(['current_topic_id', 'hashtag_id']);
            $table->index('hashtag_id');
        });

        Schema::table('stations', function (Blueprint $table) {
            $table->foreign('current_topic_id')->references('id')->on('current_topics')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('stations', function (Blueprint $table) {
            $table->dropForeign(['current_topic_id']);
        });
        Schema::dropIfExists('current_topic_hashtag');
        Schema::dropIfExists('current_topics');
        Schema::dropIfExists('hashtag_station');
        Schema::dropIfExists('hashtags');
    }
};
