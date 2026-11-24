# Installation finale — ParaRmi-Dist V5

Cette archive réunit :
- le formulaire produit simplifié ;
- les catégories prédéfinies ;
- la suppression de l'import CSV et de son modèle ;
- la préparation de la structure Supabase pour le futur paiement CMI.

## 1. Déploiement Netlify
1. Faites une sauvegarde du site actuellement publié et conservez l'ancienne version.
2. Décompressez cette archive.
3. Dans Netlify, ouvrez le site ParaRmi-Dist > Deploys.
4. Déployez le dossier `pararmidist-shop` (celui qui contient directement `index.html`, `app.js`, `styles.css` et `assets/`).
5. Vérifiez le site après publication avant de supprimer quoi que ce soit.

## 2. Formulaire produits
Le formulaire d'administration rend obligatoires uniquement :
- Nom du produit ;
- Catégorie ;
- Prix de vente supérieur à 0 MAD.

Les champs marque, SKU, prix promotionnel, URL de photo et description sont facultatifs.
Les catégories proposées dans l'interface sont :
- Cosmétiques & Beauté
- Soins dermatologiques
- Parapharmacie
- Bébé & Maman
- Bien-être

L'import CSV et le fichier modèle CSV ne sont plus inclus.

## 3. Supabase — formulaire simplifié
Aucune nouvelle migration SQL n'est requise pour le seul changement du formulaire, si la base existante utilise bien le schéma V5 fourni (`products.sku` nullable, `name`, `category` et `price` présents).
Ne réinitialisez pas le schéma et ne supprimez aucune table.
Les anciennes colonnes de suivi des prix concurrents sont laissées en place afin de préserver les données déjà enregistrées.

Si votre base a été créée avec une structure différente, comparez d'abord les colonnes de `public.products` avant tout changement.

## 4. Supabase — préparation CMI
La migration suivante est fournie :
`supabase/migrations/20261121_cmi_payment_preparation.sql`

Avant de l'exécuter :
1. Faites une sauvegarde de la base Supabase.
2. Vérifiez que `public.orders` est bien la table de commandes utilisée par le site.
3. Exécutez la migration une seule fois dans Supabase > SQL Editor.

Elle ajoute à `orders` :
- `payment_status` ;
- `payment_reference` ;
- `paid_at`.

Cette migration ne démarre aucun paiement bancaire et ne modifie pas les commandes existantes autrement que par l'ajout des colonnes avec le statut initial `unpaid`.

## 5. Fonction CMI — état actuel
Le point d'entrée `supabase/functions/cmi-create-payment/index.ts` est volontairement un verrou de sécurité (fail-closed). Il renvoie `503` et ne lance aucune transaction.
Il ne faut PAS le présenter comme une intégration CMI opérationnelle et ne pas l'activer pour les clients.

Le vrai raccordement exige :
- un contrat marchand actif auprès d'une banque/acquéreur partenaire ;
- la documentation technique officielle correspondant à ce contrat ;
- les URL de test et de production ;
- les paramètres de signature/authentification et le protocole de notification ;
- des identifiants de test délivrés par l'acquéreur.

Ne créez pas de secrets fictifs. Ne mettez jamais les secrets CMI dans `app.js` ou dans le navigateur. Ne passez jamais une commande à `paid` sur la seule base d'une page de retour navigateur : le serveur doit vérifier l'authenticité de la notification du prestataire.

## 6. Vérifications après déploiement
- Ouvrir l'administration et ajouter un produit avec seulement nom, catégorie et prix.
- Ajouter un produit en laissant SKU, marque, photo et description vides.
- Vérifier que les produits existants sont toujours visibles.
- Vérifier qu'une commande à la livraison continue de fonctionner.
- Vérifier dans Supabase que la migration CMI a ajouté les trois colonnes attendues.

Ne supprimez pas l'ancien site, les tables, les utilisateurs ou les données Supabase.
