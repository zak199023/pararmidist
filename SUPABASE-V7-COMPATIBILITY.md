# ParaRmi-Dist V7 — plan de compatibilité Supabase

## Périmètre et sécurité

Ce document est basé sur le diagnostic SQL transmis le 24 novembre 2026 et sur l'audit du ZIP V7.
La base Supabase actuelle est conservée. Aucune migration n'a été exécutée et aucune donnée n'a été modifiée.
Les changements restent isolés sur la branche `audit/v7-integration`. La branche `main` et le déploiement de production ne sont pas concernés.

## Schéma actuellement confirmé

### `products`
Colonnes confirmées : `id`, `sku`, `name`, `brand`, `category`, `description`, `price`, `promo_price`, `stock`, `image_url`, `published`, `created_at`, `updated_at`, `competitor_average_price`, `competitor_price_count`, `competitor_sources`, `source_url`, `price_formula`, `price_checked_at`.

RLS activé. Lecture publique limitée aux produits publiés (ou administrateur) ; écritures réservées à `is_admin()`.

### `orders`
Colonnes confirmées : `id`, `customer_name`, `phone`, `email`, `city`, `address`, `notes`, `items`, `subtotal`, `shipping_fee`, `total`, `payment_method`, `status`, `created_at`, `order_number`, `user_id`, `payment_status`, `payment_reference`, `paid_at`.

RLS activé. Les politiques SELECT visibles autorisent les administrateurs et les clients à lire leurs propres commandes. Aucune politique INSERT n'apparaît dans le résultat ; la création doit donc être vérifiée dans l'Edge Function serveur avant tout changement.

### `profiles`
Colonnes confirmées : `id`, `role`, `created_at`. RLS activé. L'identifiant est `id`, pas `user_id` : tout code V7 doit utiliser cette correspondance.

### `shipping_rates`
Colonnes confirmées : `city`, `shipping_fee`, `is_active`, `created_at`, `updated_at`. RLS activé. Lecture des tarifs actifs et gestion réservée aux administrateurs.

## Écarts fonctionnels à traiter

1. **Prix et promotions** — `promo_price` existe déjà. Le badge « -38 % » du ZIP ne doit être affiché que si le prix promotionnel correspond réellement à une réduction de 38 % par rapport au prix de référence. Le besoin exprimé est de barrer le prix initial et d'afficher « 38 % » à côté du prix affiché avant la remise additionnelle de 5 %. La formule exacte et l'ordre d'application doivent être alignés dans l'interface et côté serveur ; ne pas cumuler automatiquement des remises non confirmées.
2. **Coût, marge et bénéfice** — aucune colonne dédiée au coût d'achat ou à la marge n'est présente dans `products`. Concevoir une migration additive après confirmation des règles de calcul ; ne jamais remplacer les colonnes de prix existantes.
3. **Favoris, recherches et publicité** — aucune table correspondante n'apparaît dans le diagnostic. Les fonctionnalités de favoris, suivi des recherches et huit emplacements publicitaires ne sont donc pas confirmées dans la base actuelle. Concevoir des objets séparés et des politiques RLS adaptées avant activation.
4. **Commandes** — garder la création côté serveur via l'Edge Function `create-order` après vérification du code et des secrets. Ne pas ouvrir un INSERT public sur `orders` par commodité. La notification demandée doit rester une confirmation après commande ; ne pas prétendre qu'un email/SMS/WhatsApp est envoyé sans fournisseur configuré.
5. **CMI** — le connecteur de paiement est un placeholder selon l'audit ; ne pas afficher CMI comme moyen actif tant que les identifiants et tests marchand ne sont pas disponibles.

## Ordre de travail sûr

- Étape A : comparer le code V7 et les migrations avec les quatre tables ci-dessus.
- Étape B : corriger les correspondances de colonnes et les calculs côté interface et serveur.
- Étape C : proposer uniquement des migrations SQL additives, avec vérifications préalables et politiques RLS minimales.
- Étape D : tester sur environnement de préproduction ou avec données de test ; vérifier commandes, stock, prix, rôles et import CSV.
- Étape E : seulement après validation, préparer une fusion et un déploiement séparés.

## À ne pas faire

- Ne pas supprimer/recréer les tables existantes.
- Ne pas réinitialiser les comptes, produits ou commandes.
- Ne pas désactiver RLS ni ajouter de politique publique générale.
- Ne pas exécuter de migration ou déployer en production avant revue et tests.
