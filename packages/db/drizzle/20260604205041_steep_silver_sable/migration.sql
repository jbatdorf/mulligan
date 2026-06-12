TRUNCATE TABLE "comparisons";--> statement-breakpoint
ALTER TABLE "comparisons" DROP CONSTRAINT "comparisons_loser_course_id_courses_id_fkey";--> statement-breakpoint
ALTER TABLE "comparisons" ADD COLUMN "course_a_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "comparisons" ADD COLUMN "course_b_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "comparisons" ADD COLUMN "tied" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "comparisons" DROP COLUMN "loser_course_id";--> statement-breakpoint
ALTER TABLE "comparisons" ALTER COLUMN "winner_course_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_course_a_id_courses_id_fkey" FOREIGN KEY ("course_a_id") REFERENCES "courses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "comparisons" ADD CONSTRAINT "comparisons_course_b_id_courses_id_fkey" FOREIGN KEY ("course_b_id") REFERENCES "courses"("id") ON DELETE CASCADE;