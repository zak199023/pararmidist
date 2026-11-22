# ParaRmi-Dist — boutique en ligne

Ce projet est un **socle de boutique prêt à configurer**, avec interface responsive, catalogue, recherche/filtres, panier local et commande WhatsApp préremplie. Il inclut le schéma SQL Supabase pour la base de données et l'authentification administrateur.

## Aperçu immédiat
1. Décompressez le ZIP.
2. Ouvrez `index.html` dans un navigateur.
3. Sans configuration, le site affiche quatre produits d'exemple. Le panier et la commande WhatsApp sont utilisables en mode aperçu. Les produits d'exemple ne sont pas des produits réellement vendus par ParaRmi-Dist.

## Connecter une base de données et activer l'administration
1. Créez un projet gratuit sur https://supabase.com/.
2. Dans le SQL Editor, exécutez `supabase/schema.sql`.
3. Dans Authentication > Users, créez votre compte administrateur.
4. Récupérez l'UUID de ce compte puis exécutez la dernière instruction commentée du fichier SQL en remplaçant `UUID_DE_VOTRE_UTILISATEUR`.
5. Dans Project Settings > API, copiez Project URL et anon/public key.
6. Ouvrez `app.js` et renseignez `supabaseUrl` et `supabaseAnonKey` dans `CONFIG`.
7. Hébergez les fichiers sur un hébergeur statique (par exemple Netlify ou Vercel, offres gratuites sous conditions). Le site n'est pas publié automatiquement par ce ZIP.

## Administration actuelle
Après configuration Supabase et attribution du rôle `admin`, l'icône ♙ ouvre une connexion administrateur. L'admin peut ajouter et supprimer des produits. Le catalogue public lit les produits publiés dans Supabase. Pour l'instant, l'interface ne comprend pas encore l'édition complète, les commandes administrables avancées, les variantes, les rôles multiples ou les statistiques.

## Points à finaliser avant une vraie ouverture commerciale
- Ajouter un formulaire de commande serveur (Edge Function), validation de stock et de prix côté serveur, anti-spam et stockage des commandes. Le bouton actuel prépare une commande WhatsApp; il ne crée pas de commande dans la base.
- Configurer les tarifs et délais de livraison par zone : aucune valeur n'est inventée ici.
- Ajouter les pages légales adaptées au Maroc (CGV, confidentialité, retours) et faire vérifier leur conformité.
- Ajouter les galeries et variantes, l'édition produit, la gestion des commandes, les sauvegardes et les journaux.
- Vérifier les droits d'utilisation des photos officielles des fabricants. Les images d'exemple ne sont pas incluses.
- Ajouter un domaine personnalisé si souhaité (un domaine est généralement payant).
- Ne jamais mettre la clé `service_role` Supabase dans le navigateur. Seule la clé `anon/public` est utilisée ici; les règles RLS protègent les tables.

## Coordonnées configurées
ParaRmi-Dist · 2, rue Essanawbar (ex-Preignac), 20500 Casablanca, Maroc  
Téléphone / WhatsApp : +212 660-622369  
E-mail : pararmidist@gmail.com  
Devise : MAD

## Gratuité
Le code est fourni sans frais. Les offres gratuites de services tiers ont des limites, peuvent changer et ne garantissent pas une exploitation commerciale illimitée. Nom de domaine, e-mail professionnel, services de livraison, publicité et certains paiements peuvent engendrer des coûts.


## Version 2 — commandes enregistrées
Cette version ajoute un formulaire de commande, l'enregistrement par Edge Function `create-order`,
la livraison gratuite (0 MAD) et l'affichage des commandes récentes dans l'espace administrateur.
La fonction serveur vérifie les produits publiés, les prix provenant de Supabase et le stock disponible.

### Activation Supabase
1. Vérifiez d'abord que l'URL et la clé publique dans `app.js` correspondent à votre projet.
2. Dans Supabase SQL Editor, exécutez `supabase/migrations/20261118_orders_admin.sql`.
3. Déployez la fonction : `supabase functions deploy create-order`.
4. Vérifiez que les secrets standards `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont configurés côté Edge Functions. Ne placez jamais la clé service role dans `app.js`.
5. Testez une commande avec un produit réel et une adresse e-mail client.

### Limites actuelles à connaître
- L'e-mail de facture PDF n'est pas encore envoyé automatiquement : il faut connecter un fournisseur d'e-mail transactionnel et configurer ses secrets.
- WhatsApp s'ouvre avec le récapitulatif prérempli ; l'envoi automatique exige l'API WhatsApp Business.
- Cette première version vérifie le stock mais ne le décrémente pas et ne réserve pas les unités. Confirmez les commandes et gérez le stock depuis l'administration avant expédition.
- La création de la commande est active seulement après déploiement de l'Edge Function et exécution de la migration SQL.


## Version 2 — identité visuelle rose & bordeaux

Cette version actualise la présentation du site selon les maquettes ParaRmi-Dist fournies :
- palette rose, bordeaux, blanc et doré ;
- en-tête, navigation, bannière d'accueil et catégories remaniés ;
- cartes produits, espace contact et bouton WhatsApp restylés ;
- adaptation mobile conservée.

Les paramètres d'intégration et les fichiers de fonctionnement ont été conservés : `app.js`, schéma SQL, migration et Edge Function `create-order` n'ont pas été modifiés. Les images du logo et de la bannière ont été ajoutées dans `assets/`.


## Version 5 — compte client et panier
- Ajout d'une icone Compte client et d'un espace inscription/connexion.
- Un client connecté peut consulter uniquement les commandes liées à son compte.
- Le passage de commande reste possible en mode invité; si le client est connecté, la commande est associée à son compte.
- Le panier reste local au navigateur.
- Le suivi d'historique nécessite la migration `supabase/migrations/20261119_customer_accounts.sql` et le redéploiement de `create-order`.

### Installation V5
1. Sauvegardez votre projet Supabase.
2. Exécutez `supabase/migrations/20261119_customer_accounts.sql` dans SQL Editor.
3. Vérifiez dans Edge Function Secrets que `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` et une clé publique (`SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEY`) sont disponibles.
4. Redéployez `create-order` avec `supabase functions deploy create-order`.
5. Redéployez le dossier du site sur Netlify.
6. Testez avec un compte client de test et une commande de faible montant.

### Gestion sans stock
Le catalogue et la fonction de commande ne bloquent plus l'achat selon la colonne stock. Le champ stock est conservé dans la base pour une activation ultérieure, mais n'est pas utilisé pour limiter les commandes dans cette version. Vérifiez votre capacité réelle à fournir chaque produit avant de confirmer une commande.


## Mise à jour — formulaire produit simplifié
L’import CSV et le modèle CSV ont été retirés de l’interface et du paquet du site. Le formulaire d’administration demande uniquement le nom, la catégorie prédéfinie et le prix. Les autres champs sont facultatifs. Les anciennes colonnes SQL de prix concurrents sont conservées sans être utilisées, afin de préserver les données existantes.


## Préparation du paiement CMI — état non activé
Consultez `CMI-ET-INSTALLATION.md` avant toute opération Supabase.
La migration `supabase/migrations/20261121_cmi_payment_preparation.sql` ajoute les champs de suivi des paiements.
La fonction `cmi-create-payment` est un verrou temporaire qui refuse toute transaction tant que la documentation officielle et les accès marchands ne sont pas fournis. Le paiement CMI réel n'est pas encore disponible dans cette archive.
