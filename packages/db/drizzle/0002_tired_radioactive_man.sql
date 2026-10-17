CREATE TABLE "pocket_listing" (
	"id" uuid PRIMARY KEY NOT NULL,
	"binder_id" uuid NOT NULL,
	"pocket_code" text NOT NULL,
	"status" text DEFAULT 'disponible' NOT NULL,
	"price" numeric(12, 2),
	"currency" text DEFAULT 'usd' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"base" text DEFAULT 'usd' NOT NULL,
	"quote" text NOT NULL,
	"rate" numeric(14, 6) NOT NULL,
	"source" text NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "binder" ADD COLUMN "mode" text DEFAULT 'collection' NOT NULL;--> statement-breakpoint
ALTER TABLE "binder" ADD COLUMN "seller_contact" jsonb;--> statement-breakpoint
ALTER TABLE "binder" ADD COLUMN "currency" text DEFAULT 'usd' NOT NULL;--> statement-breakpoint
ALTER TABLE "pocket_listing" ADD CONSTRAINT "pocket_listing_binder_id_binder_id_fk" FOREIGN KEY ("binder_id") REFERENCES "public"."binder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pocket_listing_binder_pocket_idx" ON "pocket_listing" USING btree ("binder_id","pocket_code");--> statement-breakpoint
CREATE INDEX "exchange_rate_quote_captured_idx" ON "exchange_rate" USING btree ("quote","captured_at" desc);