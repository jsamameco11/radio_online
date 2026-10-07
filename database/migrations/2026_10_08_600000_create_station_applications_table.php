<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The dossier ("expediente") behind every "Crear mi radio" request: who will
 * run the station, their documents and the station project. The request row
 * keeps the review workflow; this table keeps the applicant's data, one to one.
 *
 * The document number is stored encrypted; document_hash (HMAC of type and
 * number) lets the platform detect the same document across applications.
 * Files live in private media folders and only their keys are stored here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('station_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('frequency_request_id')->unique()->constrained()->cascadeOnDelete();

            $table->string('first_names', 80);
            $table->string('last_names', 80);
            $table->string('document_type', 20);
            $table->text('document_number');
            $table->char('document_hash', 64)->index();
            $table->char('nationality', 2);
            $table->date('birth_date');
            $table->string('phone', 20);
            $table->char('country', 2);
            $table->string('region', 80);
            $table->string('city', 80);
            $table->string('address', 200);

            $table->string('occupation', 100);
            $table->string('education_level', 16);
            $table->string('institution', 150)->nullable();
            $table->string('field_of_study', 150)->nullable();
            $table->unsignedTinyInteger('experience_years');
            $table->string('bio', 800);

            $table->string('photo_path')->nullable();
            $table->string('document_front_path')->nullable();
            $table->string('document_back_path')->nullable();
            $table->string('resume_path')->nullable();
            $table->json('certificate_paths')->nullable();
            $table->timestamp('documents_purged_at')->nullable();

            $table->json('content_types');
            $table->string('target_audience', 500);
            $table->unsignedTinyInteger('hours_per_week');
            $table->json('broadcast_days');
            $table->string('schedule_notes', 300)->nullable();
            $table->json('languages');
            $table->boolean('represents_organization')->default(false);
            $table->string('organization_name', 150)->nullable();
            $table->string('organization_tax_id', 20)->nullable();
            $table->string('organization_website')->nullable();
            $table->json('social_links')->nullable();
            $table->string('demo_url')->nullable();

            $table->timestamp('terms_accepted_at');
            $table->timestamp('truthfulness_declared_at');
            $table->timestamp('data_processing_consented_at');
            $table->string('consent_ip', 45);
            $table->string('consent_user_agent')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('station_applications');
    }
};
