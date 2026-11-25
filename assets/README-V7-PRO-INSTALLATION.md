# ParaRmi-Dist V7 PRO — état du paquet

Cette archive est basée sur le fichier `ParaRmi-Dist-V7-travail.zip` fourni par le propriétaire du projet.

## Éléments présents
- Boutique web responsive : `index.html`, `styles.css`, `app.js` et `assets/`.
- Connexion Supabase configurée dans le navigateur avec une clé publique publishable.
- Authentification client et espace de consultation des commandes du compte connecté.
- Administration : vue générale, commandes, clients, catalogue, promotions et rapports.
- Commandes traitées par l'Edge Function `create-order`.
- Préparation technique CMI côté serveur (non activée sans identifiants marchands).
- Frais de livraison : 86 MAD sous 243 MAD après remise ; livraison gratuite à partir de 243 MAD.
- Délai annoncé : 24 à 72 heures.
- Acceptation obligatoire des CGV lors de la commande.
- Historique des recherches enregistré dans `public.search_history`.
- Nouvel onglet **Recherches** dans l'administration : expressions les plus fréquentes, occurrences, résultats associés et date de dernière recherche.

## À faire dans Supabase avant publication
1. Sauvegarder la base de données.
2. Vérifier les migrations déjà appliquées. Ne pas rejouer les migrations historiques sur une base déjà à jour.
3. Appliquer `supabase/migrations/20261124_v7_checkout_delivery_search.sql` si elle n'a pas encore été appliquée.
4. Vérifier les secrets de l'Edge Function : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`.
5. Redéployer `create-order` depuis ce paquet.
6. Tester une commande réelle en environnement de test et vérifier les lignes dans `orders`, `customers` et `search_history`.

## Déploiement Netlify
- Publier le dossier `pararmidist-shop` (c'est le dossier qui contient directement `index.html`).
- Ne pas publier le dossier parent de l'archive.
- Pour GitHub, pousser le contenu du dossier `pararmidist-shop` dans le dépôt prévu, puis relier ce dépôt à Netlify si ce n'est pas déjà fait.

## Sécurité et limites
- Ne jamais mettre `SUPABASE_SERVICE_ROLE_KEY` ni un secret CMI dans `app.js`.
- La clé `sb_publishable_...` présente dans `app.js` est une clé destinée au navigateur ; les règles RLS et les Edge Functions doivent protéger les opérations.
- Les connexions GitHub, Supabase et Netlify ne sont pas effectuées par la création de cette archive. Aucun déploiement n'est déclaré comme réalisé.
- La page de CGV reste à faire valider avant publication.
- Les statistiques de recherche présentent au maximum les 1 000 enregistrements les plus récents chargés par le navigateur d'administration.
