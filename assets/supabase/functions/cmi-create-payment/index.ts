// Point d’entrée préparé pour CMI. Ne pas activer avant réception de la documentation
// officielle de l’acquéreur et implémentation/validation de la signature et du protocole.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: cors });

  // Fail closed: aucune URL CMI ni signature ne sont inventées.
  const required = ["CMI_MERCHANT_ID", "CMI_SECRET_KEY", "CMI_GATEWAY_URL"];
  const missing = required.filter((key) => !Deno.env.get(key));
  return Response.json({
    error: "Paiement CMI non activé. Les accès marchands et la documentation officielle sont requis.",
    missing_configuration: missing,
    payment_started: false,
  }, { status: 503, headers: cors });
});
