declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

declare module "jsr:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "jsr:@supabase/supabase-js@2/cors" {
  export * from "@supabase/supabase-js";
}

declare module "npm:zod" {
  export * from "zod";
}

declare module "npm:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "npm:@supabase/supabase-js@2/cors" {
  export * from "@supabase/supabase-js";
}
