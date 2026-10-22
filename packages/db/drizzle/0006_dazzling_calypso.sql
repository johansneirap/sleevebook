UPDATE "card_instance" SET "condition" = 'NM' WHERE "condition" IS NULL;--> statement-breakpoint
UPDATE "card_instance" SET "language" = 'en' WHERE "language" IS NULL;--> statement-breakpoint
ALTER TABLE "card_instance" ALTER COLUMN "condition" SET DEFAULT 'NM';--> statement-breakpoint
ALTER TABLE "card_instance" ALTER COLUMN "condition" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "card_instance" ALTER COLUMN "language" SET DEFAULT 'en';--> statement-breakpoint
ALTER TABLE "card_instance" ALTER COLUMN "language" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "card_instance" ADD COLUMN "grading_company" text;--> statement-breakpoint
ALTER TABLE "card_instance" ADD COLUMN "grading_grade" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "card_instance" ADD COLUMN "purchase_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "card_instance" ADD COLUMN "purchase_currency" text DEFAULT 'usd' NOT NULL;--> statement-breakpoint
ALTER TABLE "card_instance" ADD COLUMN "value_usd" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "card_instance" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "card_instance" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;