# ParaRmi-Dist — version professionnelle V7

Boutique web ParaRmi-Dist (Netlify) connectée à Supabase. Cette version est construite à partir de la dernière archive V6 et conserve les tables et commandes existantes.

## Nouveautés V7
- Gestion réelle du stock : vérification de la disponibilité avant commande, décrémentation transactionnelle lors de la vente, et journal des mouvements.
- Administration du stock : ajout manuel, ajustements, retours, échanges et pertes avec historique. L’import CSV n’écrase jamais les quantités de stock.
- Les quantités de stock actuellement présentes sont des valeurs de test ; elles devront être remplacées par l’inventaire réel avant le lancement.
- Numéro WhatsApp commercial : 0660622369 (format international `212660622369`).
- Après la commande, le client reçoit uniquement une notification de confirmation sur le site ; aucun message WhatsApp automatique n’est envoyé.
- Les prix promotionnels sont gérés par produit. La campagne générale est configurable dans l’administration, inactive par défaut et réglée à 5 % ; elle ne se cumule pas avec un prix promotionnel produit.

## Fonctionnalités conservées de V6
- Remise générale de 5 % calculée côté serveur, non cumulable avec `promo_price`.
- Paramètres de campagne modifiables par l'administrateur (activation, taux, dates).
- Panier et récapitulatif de commande affichant sous-total, remise et total estimatif.
- Tableau de bord : chiffre d'affaires livré/payé, commandes, clients identifiés et produits publiés.
- Gestion des commandes avec recherche et mise à jour du statut.
- Fichier clients CRM dans `public.customers`, importé depuis les commandes historiques et synchronisé avec les nouvelles commandes (téléphone comme clé de regroupement, y compris les invités).
- Gestion catalogue : ajout manuel, modification et masquage des produits pour préserver l’historique des ventes et du stock. Import CSV en lots.
- Rapports par période, meilleurs produits vendus et impression/enregistrement PDF.
- Bannière promotionnelle simplifiée sans photo ni appel à rejoindre WhatsApp ; le bouton WhatsApp flottant reste un accès « Plus d’informations ».
- Ajustements responsive pour limiter les textes qui débordent.

## Ce qui n'est PAS changé
- Aucune table existante n'est supprimée ou recréée.
- Les commandes, profils, utilisateurs et produits existants ne sont pas effacés.
- Les rôles existants restent `admin` et `customer`.
- Le paiement CMI demeure une préparation technique non activée tant que le contrat marchand et la documentation officielle ne sont pas disponibles.

## Installation obligatoire
1. Les migrations SQL de sécurisation et de commerce listées dans l’historique du projet ont déjà été appliquées sur le projet Supabase configuré. Ne rejouez pas les anciennes migrations sans vérifier leur état.
2. La fonction Edge `create-order` est déjà active sur Supabase. Ses secrets serveur restent dans l’environnement Supabase et ne doivent jamais être copiés dans `app.js`.
3. Les modifications du site sont conservées sur la branche GitHub `prelaunch-commerce-fixes-20261128` et dans la PR de préparation. Elles ne sont pas publiées sur Netlify.
4. Avant le lancement, remplacer le stock de test par l’inventaire réel, activer la protection des mots de passe compromis dans Supabase Auth, puis effectuer les essais complets de commande et d’administration.
5. Ne déployez pas la branche en production avant validation explicite de tous les essais.

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
- Le tableau de bord et le catalogue administrateur chargent les données par pages afin de ne pas dépendre d’une seule limite de 1 000 lignes.
- Les coûts d'achat ne sont pas stockés dans `products` : la marge nette et la rentabilité réelle ne peuvent donc pas être calculées honnêtement à ce stade.
- Les rapports peuvent être imprimés ou enregistrés en PDF via le navigateur ; aucun export Excel n'est inclus dans cette version.
- Les clients invités ne disposent pas d'un espace historique personnel tant qu'ils ne créent pas de compte. Leurs commandes restent visibles dans l'administration.
- Les données historiques ne sont pas réécrites pour inventer des remises passées : les nouveaux champs de remise des anciennes commandes sont initialisés à zéro.

## Test après installation
- Ajouter une commande avec un produit en stock : vérifier la réservation/décrémentation transactionnelle du stock.
- Essayer une quantité supérieure au stock disponible : la commande doit être refusée.
- Ajouter un produit avec prix promotionnel : vérifier qu'il ne reçoit pas la remise générale supplémentaire.
- Commander un panier mixte : vérifier que seule la ligne sans promotion reçoit la remise générale.
- Vérifier la ligne dans `public.orders` : sous-total, remise et total.
- Modifier un statut de commande depuis l'administration.
- Vérifier que le client apparaît dans l'onglet Clients après une commande.
- Imprimer un rapport PDF.

Coordonnées : ParaRmi-Dist · Casablanca, Maroc · +212 660-622369 · pararmidist@gmail.com · devise MAD.


## Impression et partage des commandes
Dans Administration > Commandes, les actions Imprimer, Gmail et WhatsApp produisent un bon de commande ou un message prérempli à partir des données de la commande. L'administrateur valide lui-même l'impression ou l'envoi. Aucun ajout SQL n'est requis.
