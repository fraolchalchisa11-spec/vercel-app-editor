/**
 * Database types for YOUR Supabase project.
 *
 * Regenerate whenever your schema changes:
 *   npx supabase gen types typescript --project-id <your-project-ref> > src/integrations/supabase/database.types.ts
 *
 * Until then this permissive placeholder keeps queries compiling.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, any>;
        Insert: Record<string, any>;
        Update: Record<string, any>;
        Relationships: [];
      }
    >;
    Views: Record<string, { Row: Record<string, any> }>;
    Functions: Record<string, { Args: Record<string, any>; Returns: any }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, Record<string, any>>;
  };
};
