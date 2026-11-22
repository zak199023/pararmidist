import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);
    const authHeader = req.headers.get("Authorization") ?? "";
    let customerUserId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const { data: authData } = await admin.auth.getUser(token);
      customerUserId = authData.user?.id ?? null;
    }
    const body = await req.json();
    const c = body.customer ?? {};
    const rawItems = body.items ?? [];

    if (!c.customer_name?.trim() || !c.phone?.trim() || !c.city?.trim() || !c.address?.trim())
      return Response.json({ error: "Nom, téléphone, ville et adresse sont obligatoires." }, { status: 400, headers: cors });
    if (!Array.isArray(rawItems) || rawItems.length < 1 || rawItems.length > 40)
      return Response.json({ error: "Panier invalide." }, { status: 400, headers: cors });

    const quantities = new Map<string, number>();
    for (const item of rawItems) {
      const id = String(item.product_id ?? "");
      const qty = Number(item.quantity);
      if (!id || !Number.isInteger(qty) || qty < 1 || qty > 50)
        return Response.json({ error: "Article ou quantité invalide." }, { status: 400, headers: cors });
      quantities.set(id, (quantities.get(id) ?? 0) + qty);
    }

    const ids = [...quantities.keys()];
    const { data: products, error: productError } = await admin
      .from("products").select("id,name,sku,price,promo_price,stock,published").in("id", ids);
    if (productError) throw productError;
    if (!products || products.length !== ids.length)
      return Response.json({ error: "Un produit du panier est introuvable." }, { status: 400, headers: cors });

    let subtotal = 0;
    const items = [];
    for (const p of products) {
      const quantity = quantities.get(p.id)!;
      if (!p.published) return Response.json({ error: `Produit indisponible : ${p.name}` }, { status: 400, headers: cors });
      
      const unit_price = Number(p.promo_price ?? p.price);
      subtotal += unit_price * quantity;
      items.push({ product_id: p.id, name: p.name, sku: p.sku, quantity, unit_price });
    }

    const orderNumber = `PRD-${Date.now()}`;
    const order = {
      user_id: customerUserId, customer_name: c.customer_name.trim(), phone: c.phone.trim(),
      email: c.email?.trim() || null, city: c.city.trim(), address: c.address.trim(),
      notes: c.notes?.trim() || null, items, subtotal,
      shipping_fee: 0, total: subtotal, payment_method: "cash_on_delivery",
      status: "pending"
    };
    const { data: saved, error: insertError } = await admin.from("orders").insert(order).select("*").single();
    if (insertError) throw insertError;
    return Response.json({ order: { ...saved, order_number: orderNumber } }, { status: 200, headers: cors });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Impossible d'enregistrer la commande." }, { status: 500, headers: cors });
  }
});
