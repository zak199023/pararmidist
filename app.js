/* ParaRmi-Dist storefront. Configure Supabase in this file before launch. */
const CONFIG = { supabaseUrl: "https://hzosrdvaajjfenbzjxhg.supabase.co", supabaseAnonKey: "sb_publishable_AF7DhI63sGlRQXtnGZ3l-w_9EBLu1yQ", whatsapp: "212660622369" };
const money = n => new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD"}).format(Number(n||0));
const $ = s => document.querySelector(s);
let db = null, products = [], cart = JSON.parse(localStorage.getItem("prd-cart")||"[]"), isAdmin = false;
const sample = [
 {id:"demo-1",name:"Sérum éclat visage",brand:"Sélection beauté",category:"Cosmétiques & Beauté",description:"Un essentiel pour compléter votre routine beauté.",price:189,promo_price:null,stock:12,image_url:"",sku:"PRD-001",published:true},
 {id:"demo-2",name:"Crème hydratante",brand:"Soin quotidien",category:"Soins dermatologiques",description:"Une texture confortable pour le soin quotidien.",price:145,promo_price:129,stock:8,image_url:"",sku:"PRD-002",published:true},
 {id:"demo-3",name:"Gel nettoyant doux",brand:"Hygiène",category:"Parapharmacie",description:"Un geste simple dans votre routine d'hygiène.",price:99,promo_price:null,stock:20,image_url:"",sku:"PRD-003",published:true},
 {id:"demo-4",name:"Soin douceur bébé",brand:"Bébé & Maman",category:"Bébé & Maman",description:"Un produit douceur pour les petits moments.",price:119,promo_price:null,stock:6,image_url:"",sku:"PRD-004",published:true}
];
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function configured(){return !!(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey)}
if(configured()&&window.supabase){db=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey)}
async function loadProducts(){
 if(db){const {data,error}=await db.from("products").select("*").eq("published",true).order("created_at",{ascending:false});if(error){console.error(error);toast("Impossible de charger le catalogue.");products=[]}else products=data||[]}
 else products=sample;
 renderProducts();
}
function renderProducts(){
 const q=$("#search").value.toLowerCase(),cat=$("#category-filter").value,sort=$("#sort").value;
 let list=products.filter(p=>(!q||[p.name,p.brand,p.category,p.sku].join(" ").toLowerCase().includes(q))&&(!cat||p.category===cat));
 if(sort==="price-asc")list.sort((a,b)=>(a.promo_price||a.price)-(b.promo_price||b.price));
 if(sort==="price-desc")list.sort((a,b)=>(b.promo_price||b.price)-(a.promo_price||a.price));
 if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name,"fr"));
 $("#product-total").textContent=`${list.length} produit(s)`;
 $("#products").innerHTML=list.length?list.map(p=>`<article class="product-card"><div class="product-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="product-placeholder">✿</div>`}</div>${p.promo_price?'<span class="badge-sale">OFFRE</span>':''}<div class="product-info"><div class="product-brand">${esc(p.brand||"ParaRmi-Dist")}</div><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc(p.category||"")}</div><div class="product-buy"><div class="price">${money(p.promo_price||p.price)} ${p.promo_price?`<span class="old-price">${money(p.price)}</span>`:""}</div><button class="mini-btn" data-add="${esc(p.id)}" >Ajouter +</button></div></div></article>`).join(""):'<div class="empty">Aucun produit trouvé. Contactez-nous pour un conseil personnalisé.</div>';
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function saveCart(){localStorage.setItem("prd-cart",JSON.stringify(cart));renderCart()}
function addCart(id){const p=products.find(x=>x.id===id);if(!p)return;const line=cart.find(x=>x.id===id);if(line)line.qty++;else cart.push({id,qty:1});saveCart();toast("Produit ajouté au panier.")}
function renderCart(){
 const count=cart.reduce((s,x)=>s+x.qty,0);$("#cart-count").textContent=count;
 const lines=cart.map(x=>{const p=products.find(z=>z.id===x.id)||sample.find(z=>z.id===x.id);return p?{...p,qty:x.qty}:null}).filter(Boolean);
 $("#cart-lines").innerHTML=lines.length?lines.map(p=>`<div class="cart-line"><div><b>${esc(p.name)}</b><small>${money(p.promo_price||p.price)} · ${esc(p.sku||"")}</small><div class="qty-controls"><button data-qty="${esc(p.id)}" data-delta="-1">−</button><span>${p.qty}</span><button data-qty="${esc(p.id)}" data-delta="1">+</button><button data-remove="${esc(p.id)}">Retirer</button></div></div><strong>${money((p.promo_price||p.price)*p.qty)}</strong></div>`).join(""):'<div class="empty">Votre panier est encore vide.</div>';
 $("#cart-total").textContent=money(lines.reduce((s,p)=>s+(p.promo_price||p.price)*p.qty,0));
}
function drawer(open){$("#cart-drawer").classList.toggle("open",open);$("#drawer-backdrop").classList.toggle("open",open)}
function checkoutModal(open){
 const el=$("#checkout-modal"),back=$("#checkout-backdrop");
 if(el)el.classList.toggle("open",open);
 if(back)back.classList.toggle("open",open);
}
function orderWhatsApp(){
 if(!cart.length){toast("Votre panier est vide.");return}
 if(!db){toast("Configurez Supabase pour enregistrer les commandes.");return}
 checkoutModal(true);
}
async function submitOrder(){
 const form=$("#checkout-form");if(!form.reportValidity())return;
 const customer={customer_name:$("#c-name").value.trim(),phone:$("#c-phone").value.trim(),email:$("#c-email").value.trim(),city:$("#c-city").value.trim(),address:$("#c-address").value.trim(),notes:$("#c-notes").value.trim()};
 const items=cart.map(x=>({product_id:x.id,quantity:Number(x.qty)}));
 const btn=$("#place-order");btn.disabled=true;btn.textContent="Enregistrement…";
 try{
  const {data,error}=await db.functions.invoke("create-order",{body:{customer,items}});
  if(error)throw error;
  const o=data.order;
  const lines=(o.items||[]).map(i=>`• ${i.name} × ${i.quantity} — ${money(i.unit_price*i.quantity)}`).join("\\n");
  const msg=`Merci pour votre confiance auprès de ParaRmi-Dist !\\nCommande : ${o.order_number||o.id}\\n${lines}\\nSous-total : ${money(o.subtotal)}\\nLivraison : GRATUITE (0 MAD)\\nTotal : ${money(o.total)}\\nNous vous remercions pour votre achat.`;
  cart=[];saveCart();checkoutModal(false);drawer(false);toast("Commande enregistrée avec succès.");
  window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`,"_blank","noopener");
 }catch(err){console.error(err);toast("Commande non enregistrée : "+(err.message||"erreur Supabase."))}
 finally{btn.disabled=false;btn.textContent="Confirmer ma commande"}
}

let currentUser = null;
async function refreshAuth(){
 if(!db)return;
 const {data}=await db.auth.getUser(); currentUser=data?.user||null;
 const b=$("#account-open");
 if(b){b.querySelector("small").textContent=currentUser?"Mon compte":"Compte";b.title=currentUser?`Connecté : ${currentUser.email}`:"Créer un compte / Se connecter";}
}
function accountPanel(){
 const host=$("#account-content");
 if(!db){host.innerHTML='<p class="admin-hint">La connexion Supabase est nécessaire pour créer un compte client.</p>';return}
 if(!currentUser){
  host.innerHTML=`<div class="admin-panel"><p class="admin-hint">Créez votre compte pour retrouver vos commandes à tout moment.</p><label>Nom complet</label><input id="acc-name" autocomplete="name"><label>E-mail</label><input id="acc-email" type="email" autocomplete="email"><label>Mot de passe</label><input id="acc-password" type="password" minlength="8" autocomplete="new-password"><div class="account-actions"><button class="btn btn-dark full" id="acc-signup">Créer mon compte</button><button class="btn btn-light full" id="acc-login">J'ai déjà un compte</button></div></div>`;
  $("#acc-signup").onclick=async()=>{const name=$("#acc-name").value.trim(),email=$("#acc-email").value.trim(),password=$("#acc-password").value;if(!name||!email||password.length<8){toast("Indiquez votre nom, un e-mail et un mot de passe de 8 caractères minimum.");return}const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name:name}}});if(error){toast("Inscription impossible : "+error.message);return}if(data.session){await refreshAuth();accountPanel();toast("Compte créé avec succès.")}else toast("Compte créé. Vérifiez votre e-mail pour confirmer l'inscription.")};
  $("#acc-login").onclick=async()=>{const email=$("#acc-email").value.trim(),password=$("#acc-password").value;if(!email||!password){toast("Saisissez votre e-mail et votre mot de passe.");return}const {error}=await db.auth.signInWithPassword({email,password});if(error){toast("Connexion refusée : "+error.message);return}await refreshAuth();accountPanel();toast("Bienvenue sur ParaRmi-Dist.")};
 }else{
  host.innerHTML=`<div class="admin-panel"><p class="admin-hint">Connecté avec ${esc(currentUser.email||"votre compte")}</p><h4>Mes commandes</h4><div id="customer-orders">Chargement…</div><button class="btn btn-light full" id="acc-logout">Me déconnecter</button></div>`;
  loadCustomerOrders();
  $("#acc-logout").onclick=async()=>{await db.auth.signOut();await refreshAuth();accountPanel();toast("Vous êtes déconnecté.")};
 }
 const adminLink=document.createElement("button");
 adminLink.className="admin-access-link";
 adminLink.type="button";
 adminLink.textContent="Accès administrateur";
 adminLink.onclick=()=>{document.querySelector("#account-modal").classList.remove("open");document.querySelector("#account-backdrop").classList.remove("open");modal(true);adminLogin()};
 host.appendChild(adminLink);
}
async function loadCustomerOrders(){
 const target=$("#customer-orders");if(!target||!currentUser)return;
 const {data,error}=await db.from("orders").select("id,customer_name,city,total,status,created_at,items").eq("user_id",currentUser.id).order("created_at",{ascending:false}).limit(50);
 if(error){target.textContent="Historique indisponible. Vérifiez la migration SQL et les règles de sécurité.";return}
 target.innerHTML=data?.length?data.map(o=>`<div class="admin-row"><span><b>Commande ${esc(String(o.id).slice(0,8).toUpperCase())}</b><br><small>${new Date(o.created_at).toLocaleDateString("fr-MA")} · ${esc(o.city)} · ${money(o.total)} · ${esc(o.status)}</small></span></div>`).join(""):"Vous n'avez pas encore de commande.";
}

function modal(open){$("#admin-modal").classList.toggle("open",open);$("#modal-backdrop").classList.toggle("open",open)}
function adminLogin(){
 $("#admin-content").innerHTML=`<div class="admin-panel"><p class="admin-hint">${configured()?"Connectez-vous avec le compte administrateur créé dans Supabase.":"Mode aperçu : le catalogue affiché est une démonstration locale. Configurez Supabase pour activer l'administration sécurisée et la base de données."}</p>${configured()?`<label>E-mail administrateur</label><input id="admin-email" type="email"><label>Mot de passe</label><input id="admin-password" type="password"><button class="btn btn-dark full" id="admin-login">Se connecter</button>`:`<button class="btn btn-dark full" id="admin-ok">Fermer</button>`}</div>`;
 if(!configured())$("#admin-ok").onclick=()=>modal(false);
 else $("#admin-login").onclick=async()=>{const {data,error}=await db.auth.signInWithPassword({email:$("#admin-email").value,password:$("#admin-password").value});if(error){toast("Connexion refusée : "+error.message);return}const {data:profile}=await db.from("profiles").select("role").eq("id",data.user.id).single();if(profile?.role!=="admin"){await db.auth.signOut();toast("Ce compte n'a pas le rôle administrateur.");return}isAdmin=true;adminDashboard()};
}

function adminDashboard(){
 const categories=["Cosmétiques & Beauté","Soins dermatologiques","Parapharmacie","Bébé & Maman","Bien-être"];
 const categoryOptions=categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
 $("#admin-content").innerHTML=`<div class="admin-panel"><p class="admin-hint">Connecté en tant qu'administrateur. Les modifications sont enregistrées dans la base de données.</p><h4>Ajouter un produit</h4><p class="admin-hint">Seuls le nom, la catégorie et le prix sont obligatoires. Les autres informations sont facultatives.</p><label for="p-name">Nom du produit *</label><input id="p-name" autocomplete="off" placeholder="Ex. Crème hydratante" required><label for="p-category">Catégorie *</label><select id="p-category" required>${categoryOptions}</select><label for="p-price">Prix de vente (MAD) *</label><input id="p-price" type="number" min="0.01" step="0.01" placeholder="Ex. 129" required><label for="p-brand">Marque (facultatif)</label><input id="p-brand" placeholder="Nom de la marque"><label for="p-sku">Référence / SKU (facultatif)</label><input id="p-sku" placeholder="Générée si laissée vide"><label for="p-promo">Prix promotionnel (facultatif)</label><input id="p-promo" type="number" min="0" step="0.01" placeholder="Laisser vide sans promotion"><label for="p-image">URL de la photo (facultatif)</label><input id="p-image" type="url" placeholder="https://…"><label for="p-desc">Description (facultatif)</label><textarea id="p-desc" placeholder="Description du produit"></textarea><button class="btn btn-dark full" id="p-save" type="button">Enregistrer le produit</button><h4>Catalogue (${products.length})</h4><div id="admin-list"></div><h4>Commandes récentes</h4><div id="admin-orders">Chargement…</div><button class="btn btn-light full" id="admin-logout">Déconnexion</button></div>`;
 $("#admin-list").innerHTML=products.map(p=>`<div class="admin-row"><span>${esc(p.name)} · ${money(p.price)}</span><button data-delete="${esc(p.id)}">Supprimer</button></div>`).join("");
 loadAdminOrders();
 $("#p-save").onclick=async()=>{
  const name=$("#p-name").value.trim();
  const category=$("#p-category").value;
  const price=Number($("#p-price").value);
  const promoRaw=$("#p-promo").value.trim();
  const promo=promoRaw===""?null:Number(promoRaw);
  if(!name){toast("Le nom du produit est obligatoire.");$("#p-name").focus();return}
  if(!categories.includes(category)){toast("Choisissez une catégorie proposée.");$("#p-category").focus();return}
  if(!Number.isFinite(price)||price<=0){toast("Saisissez un prix supérieur à 0 MAD.");$("#p-price").focus();return}
  if(promo!==null&&(!Number.isFinite(promo)||promo<0||promo>=price)){toast("Le prix promotionnel doit être inférieur au prix normal.");$("#p-promo").focus();return}
  const sku=$("#p-sku").value.trim()||null;
  const p={name,category,price,brand:$("#p-brand").value.trim()||null,sku,promo_price:promo,stock:0,image_url:$("#p-image").value.trim()||null,description:$("#p-desc").value.trim()||null,published:true};
  const btn=$("#p-save");btn.disabled=true;btn.textContent="Enregistrement…";
  const {error}=await db.from("products").insert(p);
  btn.disabled=false;btn.textContent="Enregistrer le produit";
  if(error){toast("Erreur : "+error.message);return}
  toast("Produit enregistré.");await loadProducts();adminDashboard();
 };
 $("#admin-logout").onclick=async()=>{await db.auth.signOut();isAdmin=false;adminLogin()};
}
async function loadAdminOrders(){
 const target=$("#admin-orders");if(!target||!db||!isAdmin)return;
 const {data,error}=await db.from("orders").select("*").order("created_at",{ascending:false}).limit(30);
 if(error){target.textContent="Commandes indisponibles : "+error.message;return}
 target.innerHTML=data.length?data.map(o=>`<div class="admin-row"><span><b>${esc(o.customer_name)}</b><br><small>${esc(o.phone)} · ${esc(o.city)} · ${money(o.total)} · ${esc(o.status)}</small></span></div>`).join(""):"Aucune commande pour le moment.";
}
document.addEventListener("click",async e=>{
 if(e.target.closest("#place-order")){await submitOrder();return}
 if(e.target.closest("#checkout-close")||e.target.id==="checkout-backdrop")checkoutModal(false);
 const add=e.target.closest("[data-add]");if(add)addCart(add.dataset.add);
 const qty=e.target.closest("[data-qty]");if(qty){const l=cart.find(x=>x.id===qty.dataset.qty);if(l){l.qty+=Number(qty.dataset.delta);if(l.qty<=0)cart=cart.filter(x=>x.id!==l.id);saveCart()}}
 const rem=e.target.closest("[data-remove]");if(rem){cart=cart.filter(x=>x.id!==rem.dataset.remove);saveCart()}
 const del=e.target.closest("[data-delete]");if(del&&db&&isAdmin){if(confirm("Supprimer ce produit ?")){const {error}=await db.from("products").delete().eq("id",del.dataset.delete);if(error)toast(error.message);else{await loadProducts();adminDashboard();toast("Produit supprimé.")}}}
 const cat=e.target.closest("[data-category]");if(cat){$("#category-filter").value=cat.dataset.category;renderProducts();$("#boutique").scrollIntoView()}
});
$("#search").addEventListener("input",renderProducts);$("#category-filter").addEventListener("change",renderProducts);$("#sort").addEventListener("change",renderProducts);
$("#cart-open").onclick=()=>drawer(true);$("#account-open").onclick=async()=>{await refreshAuth();$("#account-modal").classList.add("open");$("#account-backdrop").classList.add("open");accountPanel()};$("#account-backdrop").onclick=()=>{$("#account-modal").classList.remove("open");$("#account-backdrop").classList.remove("open")};$("#account-close").onclick=()=>{$("#account-modal").classList.remove("open");$("#account-backdrop").classList.remove("open")};$("#drawer-backdrop").onclick=()=>drawer(false);document.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>drawer(false));
$("#checkout").onclick=orderWhatsApp;$("#admin-open").onclick=()=>{modal(true);adminLogin()};$("#modal-backdrop").onclick=()=>modal(false);document.querySelectorAll("[data-modal-close]").forEach(x=>x.onclick=()=>modal(false));
$("#menu-toggle").onclick=()=>$("#main-nav").classList.toggle("show");document.querySelectorAll("#main-nav a").forEach(a=>a.onclick=()=>$("#main-nav").classList.remove("show"));
$("#year").textContent=new Date().getFullYear();loadProducts();renderCart();refreshAuth();if(db)db.auth.onAuthStateChange(()=>refreshAuth());
if(!configured())console.info("Mode aperçu local actif. Consultez README.md pour connecter Supabase.");
