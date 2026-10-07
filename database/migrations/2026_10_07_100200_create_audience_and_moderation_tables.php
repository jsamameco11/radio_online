<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who listens and follows, every broadcast session of a station, and the
 * moderation and audit trail of the platform.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('follows', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();
            $table->primary(['user_id', 'station_id']);
            $table->index('station_id');
        });

        Schema::create('listener_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('token', 40)->unique();
            $table->char('country', 2)->nullable();
            $table->string('device', 16)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('last_seen_at');
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('seconds')->default(0);
            $table->index(['station_id', 'started_at']);
            $table->index(['station_id', 'ended_at', 'last_seen_at']);
            $table->index(['user_id', 'started_at']);
        });

        Schema::create('stream_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignId('host_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('source', 16);
            $table->string('title', 160)->nullable();
            $table->timestamp('started_at');
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('peak_listeners')->default(0);
            $table->timestamps();
            $table->index(['station_id', 'started_at']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reporter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reportable_type', 60);
            $table->string('reportable_id', 36);
            $table->string('reason', 30);
            $table->string('details', 1000)->nullable();
            $table->string('status', 16)->default('open')->index();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->string('resolution_note', 500)->nullable();
            $table->timestamps();
            $table->index(['reportable_type', 'reportable_id']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 80)->index();
            $table->string('subject_type', 60)->nullable();
            $table->string('subject_id', 36)->nullable();
            $table->foreignId('station_id')->nullable()->constrained()->nullOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 255)->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->index();
            $table->index(['subject_type', 'subject_id']);
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('reports');
        Schema::dropIfExists('stream_sessions');
        Schema::dropIfExists('listener_sessions');
        Schema::dropIfExists('follows');
    }
};
