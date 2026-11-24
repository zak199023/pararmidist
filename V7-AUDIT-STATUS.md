# ParaRmi-Dist — audit initial V7

Date: 2026-11-24
Source ZIP examined: ParaRmi-Dist-V7-clarification-prix-notification(3).zip
Repository: https://github.com/zak199023/pararmidist

## Verified
- The ZIP contains 30 entries and the storefront source, Supabase migrations, and Edge Functions.
- JavaScript syntax check: `node --check app.js` passes.
- The ZIP has a Supabase-backed order flow through the `create-order` Edge Function.
- The CSV import UI and batch processing are present in the ZIP.
- The order-success toast is present after the Edge Function confirms that the order was inserted.
- The promotion code supports a configurable general campaign and a per-product `promo_price`.

## Differences and missing requirements
- The GitHub `main` branch is older than the supplied V7 ZIP: its root `app.js` is 18,111 bytes, while the ZIP's `app.js` is 50,578 bytes. The root README on GitHub still describes the earlier reduced product form and says CSV import was removed.
- The ZIP's storefront has no favorites/wishlist implementation.
- The ZIP has no Best Sellers ranking or searched-products tracking.
- The ZIP has no eight configurable advertising slots.
- The admin product form has no cost-price field and the reports do not calculate product-level gross margin/profit.
- The product card prints a fixed “−38%” label whenever `promo_price` is set; it does not verify that the stored promotional price is exactly 38% below the original price.
- The general promotion defaults to 5% and is applied by the browser and server to products without `promo_price` when the campaign is active. This must be retained or changed only in line with the owner's final pricing rule.
- The order confirmation is a browser toast after server insertion; there is no separate durable customer notification delivery (email/SMS/WhatsApp API) in this ZIP.
- The CMI function is intentionally a fail-closed placeholder and does not process real payments.

## Safety decisions
- No Supabase migration has been executed.
- No production deployment has been triggered.
- No existing database rows, GitHub main files, or Netlify deployment have been changed.
- Work is isolated on branch `audit/v7-integration`; the main branch remains untouched.

## Next implementation work
1. Reconcile the V7 ZIP against the current GitHub main branch and preserve existing assets/configuration.
2. Implement favorites, Best Sellers, searched-products metrics, and eight admin-managed advertising slots.
3. Add admin-only cost, margin, and profit fields with RLS and server-side protection; never expose costs in public product queries.
4. Make the 38% label conditional on the actual price calculation and confirm the exact 5% campaign behavior.
5. Keep order success feedback tied to a confirmed server response; add external notifications only with configured provider credentials.
6. Run SQL/RLS, order, CSV, responsive UI, and deployment tests before merging or deploying.


## Correctifs de préparation ajoutés sur la branche (24 novembre 2026)
- Le flux de commande n'ouvre plus automatiquement WhatsApp après l'enregistrement : il affiche uniquement une notification de succès avec le numéro de commande et indique que l'équipe recontactera le client.
- La fonction `create-order` vérifie désormais la quantité disponible avant d'accepter chaque ligne de commande.
- La fonction enregistre explicitement `payment_status = 'unpaid'` et le numéro `order_number` dans la ligne `orders`.
- Vérification après commit : les trois changements sont présents dans la fonction Edge et l'ouverture automatique WhatsApp a disparu de `app.js`.

## Limites à résoudre avant mise en production
- Le contrôle de stock est une vérification préalable, pas encore une réservation atomique : deux commandes simultanées pourraient encore accepter le même dernier article. Il faudra une fonction SQL transactionnelle/RPC et un test de concurrence avant activation.
- La fonction Edge modifiée doit être redéployée dans Supabase avant que le site puisse en bénéficier. Ce redéploiement n'a pas été fait.
- La branche de préparation contient toujours le code storefront historique du dépôt ; la version ZIP V7 complète n'a pas encore été fusionnée dans cette branche. Les fonctions CSV et les autres fonctionnalités présentes uniquement dans le ZIP doivent donc être réintégrées et retestées avant de produire un paquet final.
- Aucun changement n'a été appliqué à Supabase ou à Netlify.


## Vente directe et coordonnées WhatsApp (24 novembre 2026)
- Suppression du contrôle de quantité disponible dans `create-order` : les commandes ne sont plus refusées selon la valeur de `products.stock`.
- La fonction de commande ne modifie pas le stock ; les ventes sont indépendantes de cette colonne.
- Le numéro WhatsApp est configuré en format international `212660622369`, correspondant au numéro local fourni `06 60 62 23 69`. Le numéro visible sur le site est harmonisé au format local ; le lien WhatsApp conserve le format international requis.
- Vérification après commit : aucun contrôle `p.stock`, aucune mise à jour de stock dans la fonction de commande, et aucune ouverture WhatsApp automatique après confirmation.
- Ces changements sont sur la branche de préparation uniquement. La fonction Edge doit être redéployée et le site publié pour être visibles en production ; rien n'a été déployé ici.
