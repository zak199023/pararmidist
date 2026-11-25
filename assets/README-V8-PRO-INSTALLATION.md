# ParaRmi-Dist V8 PRO — mise à jour

Cette version est construite à partir de l'archive V7 PRO fournie. Elle conserve le site statique et les migrations historiques ; elle n'efface aucune donnée.

## Améliorations V8
- Référence commerciale de commande (`order_number`) persistée dans `public.orders`.
- Les commandes anciennes reçoivent une référence de reprise lisible à partir de leur UUID.
- La référence est générée côté serveur et renvoyée au client après validation.
- Le message de confirmation remercie explicitement le client et affiche la référence.
- L'espace client et l'administration utilisent la référence commerciale au lieu d'afficher un extrait de l'identifiant technique.
- Validation renforcée des quantités : les lignes dupliquées d'un même produit sont additionnées et ne peuvent pas dépasser 50 unités au total.

## Structure
- `index.html`, `styles.css`, `app.js` : boutique.
- `supabase/schema.sql` : schéma initial uniquement, pour une nouvelle base.
- `supabase/migrations/` : migrations successives.
- `supabase/functions/create-order/index.ts` : fonction serveur de création de commande.
- `supabase/functions/cmi-create-payment/index.ts` : point d'entrée CMI désactivé tant que les identifiants et la documentation marchand ne sont pas fournis.

## Mise à jour d'une base Supabase déjà utilisée
1. Faites une sauvegarde de la base et gardez le site Netlify précédent disponible pour un retour arrière.
2. Dans Supabase SQL Editor, vérifiez que les migrations V5, V6 et V7 requises sont déjà appliquées. Ne les rejouez pas si la base est déjà à jour.
3. Exécutez une seule fois `supabase/migrations/20261125_v8_order_reference.sql`.
4. Redéployez la fonction `create-order` depuis ce paquet, après la migration :
   `supabase functions deploy create-order`
5. Vérifiez les secrets côté Edge Functions : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`. La clé service role ne doit jamais être copiée dans le navigateur.
6. Déployez le contenu du dossier `pararmidist-shop` sur Netlify (ce dossier contient directement `index.html`).
7. Testez une commande en environnement contrôlé et vérifiez que `orders.order_number` est bien rempli et unique.

## Configuration et comptes
- La configuration actuelle contient une URL Supabase et une clé publique publishable. Une clé publique peut être utilisée dans le navigateur ; la sécurité dépend aussi des politiques RLS et des Edge Functions.
- Ne placez jamais `SUPABASE_SERVICE_ROLE_KEY`, un mot de passe, un token GitHub ou un secret CMI dans `app.js`.
- Le paquet ne connecte pas automatiquement GitHub, Supabase ou Netlify. Aucun push GitHub, aucune migration distante, aucun déploiement Netlify n'est déclaré comme effectué.
- Les identifiants marchands CMI et la documentation d'intégration officielle sont requis avant d'activer le paiement par carte. Le paiement actuel reste à la livraison.

## Règles commerciales présentes dans le code V7 conservées
- Livraison : 86 MAD sous 243 MAD après remise ; offerte à partir de 243 MAD.
- Les prix et remises sont recalculés côté serveur au moment de la commande.
- Les prix promotionnels ne reçoivent pas une deuxième remise générale.
- Acceptation des CGV obligatoire à la commande.
- Les recherches saisies sont enregistrées dans `public.search_history` pour l'analyse administrateur.

## Contrôles effectués sur l'archive source
- Archive ouverte et inventaire des fichiers vérifié.
- Syntaxe JavaScript contrôlée avec `node --check` après modification.
- Contrôle statique des éléments de migration et de la fonction Edge.
- Aucun test réel sur Supabase ou Netlify n'a été exécuté depuis cette archive : cela nécessite un accès authentifié aux comptes et un environnement de test.
