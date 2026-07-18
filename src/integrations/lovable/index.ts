import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      // The application now authenticates against its own Supabase project,
      // not the retired Lovable Cloud auth broker. Provider setup remains in
      // Supabase Auth and the browser is redirected back to this application.
      if (provider === 'lovable') {
        return { error: new Error('El proveedor Lovable ya no está disponible.') };
      }

      const supabaseProvider = provider === 'microsoft' ? 'azure' : provider;
      const { scope, ...queryParams } = opts?.extraParams ?? {};

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider,
        options: {
          redirectTo: opts?.redirect_uri ?? window.location.origin,
          scopes: scope,
          queryParams,
        },
      });

      return { data, error, redirected: Boolean(data.url) };
    },
  },
};
