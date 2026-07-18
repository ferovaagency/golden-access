// src/types/deno-globals.d.ts
declare const Deno: any;

// src/types/thirdparty-modules.d.ts
declare module "npm:@supabase/supabase-js@2" {
  const createClient: any;
  export default createClient;
  export { createClient };
}
declare module "npm:@supabase/supabase-js@2/cors" {
  const corsHeaders: any;
  export default corsHeaders;
  export { corsHeaders };
}
declare module "jsr:@supabase/supabase-js@2" {
  const createClient: any;
  export default createClient;
  export { createClient };
}
declare module "npm:cheerio@1" {
  const cheerio: any;
  export default cheerio;
}
declare module "npm:ai" {
  const ai: any;
  export default ai;
}
