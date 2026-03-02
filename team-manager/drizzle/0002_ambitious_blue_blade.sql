ALTER TABLE "oauth_tokens" DROP CONSTRAINT "oauth_tokens_user_id_team_members_id_fk";
--> statement-breakpoint
ALTER TABLE "oauth_tokens" ADD CONSTRAINT "oauth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;