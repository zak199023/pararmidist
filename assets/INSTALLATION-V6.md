# Installation de ParaRmi-Dist V6 — remise et administration professionnelle

## Avant de commencer
- Faites une sauvegarde du projet Supabase.
- Gardez l'ancien déploiement Netlify disponible comme retour arrière.
- Ne lancez jamais `supabase/schema.sql` sur une base déjà utilisée : ce fichier est destiné à une installation neuve.

## Étapes d'installation
1. Vérifiez que la base V5 est en place : `public.orders`, `public.products`, `public.profiles` et la fonction `public.is_admin()`. Si les comptes clients sont utilisés, vérifiez aussi la migration `20261119_customer_accounts.sql`.
2. Dans Supabase > SQL Editor, exécutez une seule fois `supabase/migrations/20261122_professional_commerce.sql`.
3. Vérifiez la création de `public.promotion_settings`, `public.customers` et des colonnes de remise et de rattachement client dans `orders`.
4. Redéployez l'Edge Function mise à jour avec Supabase CLI, sur le bon projet : `supabase functions deploy create-order`.
5. Vérifiez les secrets Edge Functions `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. Ne copiez jamais la clé service role dans `app.js`.
6. Déployez le contenu du dossier `pararmidist-shop` sur le site Netlify existant.
7. Connectez-vous avec le compte ayant déjà le rôle `admin` dans `public.profiles`.
8. Ouvrez l'onglet Promotions et confirmez le taux et les dates de campagne.

## Règle de remise
- 5 % sur les produits sans prix promotionnel, uniquement lorsque la campagne est active.
- Si `products.promo_price` est renseigné, ce prix s'applique seul : aucune remise générale supplémentaire.
- Le navigateur affiche une estimation, mais `create-order` recharge les prix dans Supabase et recalcule le total côté serveur.
- Chaque nouvelle commande enregistre les lignes tarifaires, le sous-total, le montant de remise et le total.

## Données et conservation
- Aucune table ou commande existante n'est supprimée.
- Les clients historiques sont importés depuis `orders` vers `public.customers`, regroupés par numéro de téléphone normalisé.
- Un trigger synchronise `public.customers` lors des nouvelles commandes et des changements de statut.
- Les clients invités sont aussi conservés dans le fichier clients.
- `auth.users` et `public.profiles` continuent à gérer les comptes et les rôles.

## Tests après déploiement
- Produit sans promotion : vérifier que 5 % sont déduits.
- Produit déjà en promotion : vérifier qu'aucune deuxième remise ne s'applique.
- Panier mixte : seule la ligne sans prix promotionnel reçoit 5 %.
- Vérifier dans `orders` les champs `subtotal_before_discount`, `discount_amount`, `discount_rate`, `total`.
- Vérifier que la commande crée ou met à jour la fiche correspondante dans `customers`.
- Modifier le statut d'une commande et vérifier que le CA client se recalcule.
- Imprimer un rapport en PDF depuis l'onglet Rapports.

## Limites actuelles
- Le tableau de bord charge les 2 000 commandes les plus récentes, 5 000 clients et 1 000 produits. Une activité à très gros volume demandera pagination et agrégations côté serveur.
- La marge bénéficiaire n'est pas calculée : le coût d'achat des produits n'est pas encore stocké.
- Les rapports sont imprimables/enregistrables en PDF depuis le navigateur ; l'export Excel n'est pas inclus.
- Le paiement CMI reste non activé sans contrat marchand, documentation officielle et identifiants du prestataire.


## Impression et envoi des commandes (ajout V6)
- Dans Administration > Commandes, chaque ligne comporte trois actions : Imprimer, Gmail et WhatsApp.
- Imprimer ouvre un bon de commande avec les coordonnées du client, les articles, quantités, prix, remise, total, mode de paiement et statut.
- Gmail ouvre un brouillon Gmail prérempli avec l'adresse e-mail du client et le récapitulatif complet. L'envoi reste à confirmer par l'administrateur dans Gmail.
- WhatsApp ouvre une conversation avec le numéro du client enregistré et un message prérempli. L'envoi reste à confirmer par l'administrateur dans WhatsApp.
- Si l'adresse e-mail ou le téléphone manque dans la fiche commande, l'action correspondante est désactivée.
- Aucun message n'est envoyé automatiquement et aucun secret Gmail/WhatsApp n'est stocké dans le site.
- Ces ajouts ne nécessitent aucune migration Supabase. Ils utilisent les coordonnées déjà stockées dans `orders`.
