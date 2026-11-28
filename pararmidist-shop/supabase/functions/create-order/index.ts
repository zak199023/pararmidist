import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Configuration serveur indisponible.");

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let customerUserId: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      if (token) {
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data.user) return json({ error: "Session client invalide. Reconnectez-vous." }, 401);
        customerUserId = data.user.id;
      }
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Corps de commande invalide." }, 400);
    }

    const customer = body?.customer;
    const items = body?.items;
    if (!customer || typeof customer !== "object" || Array.isArray(customer)) {
      return json({ error: "Informations client invalides." }, 400);
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 40) {
      return json({ error: "Le panier doit contenir entre 1 et 40 lignes." }, 400);
    }
    for (const item of items) {
      if (!item || typeof item !== "object"
        || typeof item.product_id !== "string"
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.product_id)
        || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
        return json({ error: "Un article ou une quantité du panier est invalide." }, 400);
      }
    }

    // Le RPC serveur recalcule prix, promotions et livraison, verrouille les stocks,
    // crée la commande et enregistre les mouvements de stock dans une seule transaction.
    const { data: order, error } = await admin.rpc("create_order_secure", {
      p_customer: customer,
      p_items: items,
      p_user_id: customerUserId,
    });

    if (error) {
      console.error("create_order_secure:", error);
      const businessError = error.code === "P0001" || error.code === "23514";
      return json({
        error: businessError
          ? error.message
          : "Impossible d’enregistrer la commande. Réessayez dans un instant.",
      }, businessError ? 400 : 500);
    }
    if (!order?.id) {
      console.error("create_order_secure n'a retourné aucune commande.");
      return json({ error: "La commande n’a pas pu être confirmée." }, 500);
    }

    return json({ order });
  } catch (error) {
    console.error("create-order:", error);
    return json({ error: "Une erreur serveur a empêché l’enregistrement de la commande." }, 500);
  }
});
