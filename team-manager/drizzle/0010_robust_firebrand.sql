CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_name" text NOT NULL,
	"client_email" text NOT NULL,
	"service_type" text NOT NULL,
	"details" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
