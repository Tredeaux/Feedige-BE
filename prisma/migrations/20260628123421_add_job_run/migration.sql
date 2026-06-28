-- CreateTable
CREATE TABLE "job_run" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_name" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "items_processed" INTEGER NOT NULL DEFAULT 0,
    "detail" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_run_job_name_started_at_idx" ON "job_run"("job_name", "started_at" DESC);
