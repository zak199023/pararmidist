# ParaRmi-Dist — version professionnelle V6

Boutique web ParaRmi-Dist (Netlify) connectée à Supabase. Cette version est construite à partir de la dernière archive V5 et conserve les tables et commandes existantes.

## Nouveautés V6
- Remise générale de 5 % calculée côté serveur, non cumulable avec `promo_price`.
- Paramètres de campagne modifiables par l'administrateur (activation, taux, dates).
- Panier et récapitulatif de commande affichant sous-total, remise et total estimatif.
- Tableau de bord : chiffre d'affaires livré/payé, commandes, clients identifiés et produits publiés.
- Gestion des commandes avec recherche et mise à jour du statut.
- Fichier clients CRM dans `public.customers`, importé depuis les commandes historiques et synchronisé avec les nouvelles commandes (téléphone comme clé de regroupement, y compris les invités).
- Gestion catalogue : ajout, modification et suppression de produits.
- Rapports par période, meilleurs produits vendus et impression/enregistrement PDF.
- Bannière promotionnelle simplifiée sans photo ni appel à rejoindre WhatsApp ; le bouton WhatsApp flottant reste un accès « Plus d’informations ».
- Ajustements responsive pour limiter les textes qui débordent.

## Ce qui n'est PAS changé
- Aucune table existante n'est supprimée ou recréée.
- Les commandes, profils, utilisateurs et produits existants ne sont pas effacés.
- Les rôles existants restent `admin` et `customer`.
- Le paiement CMI demeure une préparation technique non activée tant que le contrat marchand et la documentation officielle ne sont pas disponibles.

## Installation obligatoire
1. Sauvegardez votre projet Supabase et gardez le déploiement Netlify précédent disponible comme retour arrière.
2. Dans Supabase SQL Editor, exécutez uniquement `supabase/migrations/20261122_professional_commerce.sql` pour cette mise à jour V6. Les migrations historiques V5 ne doivent pas être rejouées sur une base déjà à jour.
3. Redéployez la fonction `create-order` mise à jour : `supabase functions deploy create-order`.
4. Vérifiez que les secrets Edge Functions `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont configurés. Ne les placez jamais dans `app.js`.
5. Déployez le dossier `pararmidist-shop` sur Netlify (celui qui contient directement `index.html`, `app.js`, `styles.css` et `assets/`).
6. Connectez-vous à l'administration avec le compte qui possède déjà le rôle `admin` dans `public.profiles`.
7. Ouvrez l'onglet Promotions et vérifiez la période de campagne avant d'accepter les commandes.

## Règle de remise
- Un produit sans prix promotionnel reçoit le taux général configuré (5 % par défaut).
- Un produit avec `promo_price` utilise ce prix et ne reçoit PAS une remise supplémentaire.
- Le navigateur affiche une estimation ; l'Edge Function recharge les prix depuis Supabase et recalcule la remise avant l'insertion de la commande.
- Les commandes enregistrent `subtotal_before_discount`, `discount_amount`, `discount_rate`, `subtotal`, `total` et le détail des lignes dans `items`.

## Où sont stockées les données ?
- `public.orders` : commandes, coordonnées fournies au checkout, lignes de produits, quantités, totaux, remises, statut et moyen de paiement.
- `auth.users` : comptes d'authentification des clients inscrits.
- `public.profiles` : profil et rôle (`admin` ou `customer`).
- `public.customers` : fichier client CRM, regroupé par téléphone normalisé ; la migration importe les clients déjà présents dans `orders` et un trigger synchronise les nouvelles commandes et changements de statut.
- `public.products` : catalogue.
- `public.promotion_settings` : paramètres de la campagne 5 %.

Les clients invités sont également enregistrés dans `public.customers` à partir des coordonnées de commande. Leurs informations reflètent ce qu'ils ont communiqué au moment de commander ; les comptes inscrits restent dans `auth.users` et `profiles`.

## Limites à connaître
- Le tableau de bord charge jusqu'à 2 000 commandes récentes, 5 000 clients et 1 000 produits ; pour une activité à très gros volume, il faudra ajouter pagination et agrégations serveur.
- Les coûts d'achat ne sont pas stockés dans `products` : la marge nette et la rentabilité réelle ne peuvent donc pas être calculées honnêtement à ce stade.
- Les rapports peuvent être imprimés ou enregistrés en PDF via le navigateur ; aucun export Excel n'est inclus dans cette version.
- Les clients invités ne disposent pas d'un espace historique personnel tant qu'ils ne créent pas de compte. Leurs commandes restent visibles dans l'administration.
- Les données historiques ne sont pas réécrites pour inventer des remises passées : les nouveaux champs de remise des anciennes commandes sont initialisés à zéro.

## Test après installation
- Ajouter une commande avec un produit normal : vérifier la remise de 5 %.
- Ajouter un produit avec prix promotionnel : vérifier qu'il ne reçoit pas les 5 % supplémentaires.
- Commander un panier mixte : vérifier que seule la ligne sans promotion reçoit la remise générale.
- Vérifier la ligne dans `public.orders` : sous-total, remise et total.
- Modifier un statut de commande depuis l'administration.
- Vérifier que le client apparaît dans l'onglet Clients après une commande.
- Imprimer un rapport PDF.

Coordonnées : ParaRmi-Dist · Casablanca, Maroc · +212 660-622369 · pararmidist@gmail.com · devise MAD.


## Impression et partage des commandes
Dans Administration > Commandes, les actions Imprimer, Gmail et WhatsApp produisent un bon de commande ou un message prérempli à partir des données de la commande. L'administrateur valide lui-même l'impression ou l'envoi. Aucun ajout SQL n'est requis.
