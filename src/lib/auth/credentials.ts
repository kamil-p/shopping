import { z } from "zod";

/**
 * Shared validation for email + password, used by both the login flow
 * and the create-user script.
 */
export const credentialsSchema = z.object({
  email: z.email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
