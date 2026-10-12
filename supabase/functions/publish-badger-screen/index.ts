import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedPrototypeShuls = new Set([
  "e102b001-e0d4-4cd1-9a9f-2705b315f74a",
  "eb60b31d-0301-4f54-8b88-0765d490bcbd",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const shulId = String(body?.shul_id || "");
    const rawBase64 = String(body?.image_base64 || "");

    if (!allowedPrototypeShuls.has(shulId)) {
      return json({ error: "This prototype publisher is limited to the pilot shuls." }, 403);
    }
    if (!rawBase64) {
      return json({ error: "Missing image_base64." }, 400);
    }

    const base64 = rawBase64.includes(",") ? rawBase64.split(",", 2)[1] : rawBase64;
    let bytes: Uint8Array;
    try {
      const decoded = atob(base64);
      bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
    } catch {
      return json({ error: "Invalid base64 image." }, 400);
    }

    if (bytes.length < 8 || bytes.length > 500_000) {
      return json({ error: "Image size is invalid." }, 400);
    }

    const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!pngSignature.every((value, index) => bytes[index] === value)) {
      return json({ error: "Only PNG images are accepted." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Server configuration missing." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await admin.storage
      .from("screens")
      .upload("screen.png", bytes, {
        contentType: "image/png",
        cacheControl: "0",
        upsert: true,
      });

    if (error) {
      console.error("Badger screen upload failed", error);
      return json({ error: error.message }, 500);
    }

    return json({
      ok: true,
      path: "screen.png",
      public_url: `${supabaseUrl}/storage/v1/object/public/screens/screen.png`,
      bytes: bytes.length,
    });
  } catch (error) {
    console.error("publish-badger-screen failed", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
