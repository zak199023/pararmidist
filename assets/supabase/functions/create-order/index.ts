import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

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
    if (body.terms_accepted !== true) return Response.json({ error: "Veuillez accepter les Conditions Générales de Vente." }, { status: 400, headers: cors });
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
      const combined = (quantities.get(id) ?? 0) + qty;
      if (combined > 50) {
        return Response.json({ error: "La quantité maximale par produit est de 50." }, { status: 400, headers: cors });
      }
      quantities.set(id, combined);
    }

    const ids = [...quantities.keys()];
    const { data: products, error: productError } = await admin
      .from("products").select("id,name,sku,price,promo_price,published").in("id", ids);
    if (productError) throw productError;
    if (!products || products.length !== ids.length)
      return Response.json({ error: "Un produit du panier est introuvable." }, { status: 400, headers: cors });

    const { data: campaign, error: campaignError } = await admin
      .from("promotion_settings").select("active,discount_rate,starts_at,ends_at").eq("id", 1).maybeSingle();
    if (campaignError) throw campaignError;
    const now = Date.now();
    const campaignActive = !!campaign?.active
      && (!campaign.starts_at || now >= new Date(campaign.starts_at).getTime())
      && (!campaign.ends_at || now <= new Date(campaign.ends_at).getTime());
    const configuredRate = campaignActive ? Number(campaign.discount_rate || 0) : 0;

    let subtotalBeforeDiscount = 0;
    let discountAmount = 0;
    let discountedLines = 0;
    const items = [];
    for (const p of products) {
      const quantity = quantities.get(p.id)!;
      if (!p.published) return Response.json({ error: `Produit indisponible : ${p.name}` }, { status: 400, headers: cors });
      const hasProductPromotion = p.promo_price !== null && p.promo_price !== undefined && Number(p.promo_price) >= 0;
      const baseUnitPrice = Number(hasProductPromotion ? p.promo_price : p.price);
      const lineRate = hasProductPromotion ? 0 : configuredRate;
      const unitDiscount = round2(baseUnitPrice * lineRate / 100);
      const unitPrice = round2(baseUnitPrice - unitDiscount);
      const lineDiscount = round2(unitDiscount * quantity);
      const lineTotal = round2(unitPrice * quantity);
      subtotalBeforeDiscount += round2(baseUnitPrice * quantity);
      discountAmount += lineDiscount;
      if (lineRate > 0) discountedLines++;
      items.push({
        product_id: p.id,
        name: p.name,
        sku: p.sku,
        quantity,
        base_unit_price: baseUnitPrice,
        unit_price: unitPrice,
        discount_rate: lineRate,
        line_discount: lineDiscount,
        line_total: lineTotal,
        product_promotion_applied: hasProductPromotion,
      });
    }

    subtotalBeforeDiscount = round2(subtotalBeforeDiscount);
    discountAmount = round2(discountAmount);
    const merchandiseTotal = round2(Math.max(0, subtotalBeforeDiscount - discountAmount));
    const shippingFee = merchandiseTotal >= 243 ? 0 : 86;
    const total = round2(merchandiseTotal + shippingFee);
    const appliedRate = discountedLines > 0 ? configuredRate : 0;
    // Référence persistée en base, unique et lisible pour le client et l'administration.
    const orderNumber = `PRD-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const order = {
      order_number: orderNumber,
      user_id: customerUserId,
      customer_name: c.customer_name.trim(),
      phone: c.phone.trim(),
      email: c.email?.trim() || null,
      city: c.city.trim(),
      address: c.address.trim(),
      notes: c.notes?.trim() || null,
      terms_accepted: true,
      terms_accepted_at: new Date().toISOString(),
      items,
      subtotal: subtotalBeforeDiscount,
      subtotal_before_discount: subtotalBeforeDiscount,
      discount_amount: discountAmount,
      discount_rate: appliedRate,
      shipping_fee: shippingFee,
      total,
      payment_method: "cash_on_delivery",
      status: "pending",
    };
    const { data: saved, error: insertError } = await admin.from("orders").insert(order).select("*").single();
    if (insertError) throw insertError;
    return Response.json({ order: { ...saved, order_number: orderNumber } }, { status: 200, headers: cors });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Impossible d'enregistrer la commande." }, { status: 500, headers: cors });
  }
});
