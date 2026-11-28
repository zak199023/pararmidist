/* Rmi-Dist storefront. Configure Supabase in this file before launch. */
const CONFIG = { supabaseUrl: "https://hzosrdvaajjfenbzjxhg.supabase.co", supabaseAnonKey: "sb_publishable_AF7DhI63sGlRQXtnGZ3l-w_9EBLu1yQ", whatsapp: "212660622369" };
const money = n => new Intl.NumberFormat("fr-MA",{style:"currency",currency:"MAD"}).format(Number(n||0));
const $ = s => document.querySelector(s);
let db = null, products = [], cart = JSON.parse(localStorage.getItem("prd-cart")||"[]"), isAdmin = false;
let categories = [], subcategories = [], shippingRates = [];
let adminStockMovements = [], adminReturns = [], adminExchanges = [], adminLosses = [];
let promoConfig = {active:false, discount_rate:5, starts_at:null, ends_at:null};
let promoConfigLoaded = false;
let adminOrders = [], adminProducts = [], adminCustomers = [], adminPromo = null, adminPromoError = null, adminTab = "overview";
let csvImportRows = [], csvImportFileName = "", csvValidationErrors = [];
const sample = [
 {id:"demo-1",name:"Sérum éclat visage",brand:"Sélection beauté",category:"Cosmétiques & Beauté",description:"Un essentiel pour compléter votre routine beauté.",price:189,promo_price:null,image_url:"",sku:"PRD-001",published:true},
 {id:"demo-2",name:"Crème hydratante",brand:"Soin quotidien",category:"Soins dermatologiques",description:"Une texture confortable pour le soin quotidien.",price:145,promo_price:129,image_url:"",sku:"PRD-002",published:true},
 {id:"demo-3",name:"Gel nettoyant doux",brand:"Hygiène",category:"Parapharmacie",description:"Un geste simple dans votre routine d'hygiène.",price:99,promo_price:null,image_url:"",sku:"PRD-003",published:true},
 {id:"demo-4",name:"Soin douceur bébé",brand:"Bébé & Maman",category:"Bébé & Maman",description:"Un produit douceur pour les petits moments.",price:119,promo_price:null,image_url:"",sku:"PRD-004",published:true}
];
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function configured(){return !!(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey)}
if(configured()&&window.supabase){db=window.supabase.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey)}
function promoIsActive(){
 if(!promoConfig.active)return false;
 const now=Date.now();
 return (!promoConfig.starts_at||now>=new Date(promoConfig.starts_at).getTime())&&(!promoConfig.ends_at||now<=new Date(promoConfig.ends_at).getTime());
}
function priceInfo(p){
 const hasProductPromo=p.promo_price!==null&&p.promo_price!==undefined&&Number(p.promo_price)>0;
 const base=hasProductPromo?Number(p.promo_price):Number(p.price);
 const rate=(!hasProductPromo&&promoIsActive())?Number(promoConfig.discount_rate||5):0;
 const final=Math.round((base*(1-rate/100)+Number.EPSILON)*100)/100;
 return {base,final,rate,hasProductPromo,compareAt:Number(p.price),saving:Math.round((base-final+Number.EPSILON)*100)/100};
}
async function loadPromoConfig(){
 if(!db)return;
 const {data,error}=await db.from("promotion_settings").select("active,discount_rate,starts_at,ends_at").eq("id",1).maybeSingle();
 if(!error&&data){promoConfig=data;promoConfigLoaded=true}else{promoConfig={active:false,discount_rate:5,starts_at:null,ends_at:null};promoConfigLoaded=false;if(error)console.warn("Paramètres promotionnels non chargés :",error.message)}
}
function normalizeText(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase()}
function categoryNameById(id){return categories.find(c=>String(c.id)===String(id))?.name||""}
function subcategoryNameById(id){return subcategories.find(c=>String(c.id)===String(id))?.name||""}
function shippingFeeForCity(city){
 const normalized=normalizeText(city);
 if(normalized==="casablanca")return 0;
 const rate=shippingRates.find(r=>normalizeText(r.city)===normalized&&r.is_active);
 return rate?Number(rate.shipping_fee):null;
}
async function loadCommerceMetadata(){
 if(!db)return;
 const [catRes,subRes,rateRes]=await Promise.all([
  db.from("categories").select("id,name,slug"),
  db.from("subcategories").select("id,category_id,name,slug"),
  db.from("shipping_rates").select("city,shipping_fee,is_active").eq("is_active",true)
 ]);
 if(!catRes.error)categories=catRes.data||[];
 if(!subRes.error)subcategories=subRes.data||[];
 if(!rateRes.error)shippingRates=rateRes.data||[];
 const filter=$("#category-filter");
 if(filter){
  const current=filter.value;
  filter.innerHTML='<option value="">Toutes les catégories</option>'+categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')+'<option value="__promotions__">Promotions</option>';
  if([...filter.options].some(o=>o.value===current))filter.value=current;
 }
 const cities=$("#shipping-city-options");
 if(cities)cities.innerHTML=shippingRates.map(r=>`<option value="${esc(r.city)}"></option>`).join('');
}
async function loadProducts(){
 if(db){
  await loadCommerceMetadata();
  const {data,error}=await db.from("products").select("*").eq("published",true).order("created_at",{ascending:false});
  if(error){console.error(error);toast("Impossible de charger le catalogue.");products=[]}else products=data||[];
 }else products=sample;
 renderProducts();
}
function renderProducts(){
 const q=$("#search").value.toLowerCase(),cat=$("#category-filter").value,sort=$("#sort").value;
 let list=products.filter(p=>{
  const mainCategory=categoryNameById(p.category_id)||p.category||"";
  const subCategory=subcategoryNameById(p.subcategory_id);
  const matchesQuery=!q||[p.name,p.brand,p.category,mainCategory,subCategory,p.sku].join(" ").toLowerCase().includes(q);
  const matchesCategory=!cat||(cat==="__promotions__"?(Number(p.promo_price)>0||(!p.promo_price&&promoIsActive())):String(p.category_id)===cat);
  return matchesQuery&&matchesCategory;
 });
 if(sort==="price-asc")list.sort((a,b)=>priceInfo(a).final-priceInfo(b).final);
 if(sort==="price-desc")list.sort((a,b)=>priceInfo(b).final-priceInfo(a).final);
 if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name,"fr"));
 $("#product-total").textContent=`${list.length} produit(s)`;
 $("#products").innerHTML=list.length?list.map(p=>{
  const pi=priceInfo(p),stock=Number(p.stock||0),mainCategory=categoryNameById(p.category_id)||p.category||"",subCategory=subcategoryNameById(p.subcategory_id);
  return `<article class="product-card"><div class="product-image">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="product-placeholder">✿</div>`}</div><div class="product-info"><div class="product-brand">${esc(p.brand||"Rmi-Dist")}</div><div class="product-name">${esc(p.name)}</div><div class="product-meta">${esc(mainCategory)}${subCategory?` · ${esc(subCategory)}`:""}</div><div class="product-buy"><div class="price">${money(pi.final)} ${pi.hasProductPromo&&pi.compareAt>pi.base?`<span class="price-discount-note">−${Math.round((1-pi.base/pi.compareAt)*100)}%</span>`:pi.rate?`<span class="price-discount-note">−${pi.rate}%</span>`:""} ${pi.hasProductPromo&&pi.compareAt>pi.base?`<span class="old-price">${money(pi.compareAt)}</span>`:""}<small class="stock-label">${stock>0?`En stock : ${stock}`:"Rupture de stock"}</small></div><button class="mini-btn" data-add="${esc(p.id)}" ${stock<=0?"disabled":""}>${stock>0?"Ajouter +":"Indisponible"}</button></div></div></article>`;
 }).join(''):'<div class="empty">Aucun produit trouvé. Contactez-nous pour un conseil personnalisé.</div>';
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function saveCart(){localStorage.setItem("prd-cart",JSON.stringify(cart));renderCart()}
function addCart(id){const p=products.find(x=>x.id===id);if(!p)return;const stock=Number(p.stock||0);if(stock<=0){toast("Ce produit est momentanément indisponible.");return}const line=cart.find(x=>x.id===id);if(line){if(line.qty>=stock){toast("La quantité demandée dépasse le stock disponible.");return}line.qty++}else cart.push({id,qty:1});saveCart();toast("Produit ajouté au panier.")}
function renderCart(){
 const count=cart.reduce((s,x)=>s+x.qty,0);$("#cart-count").textContent=count;
 const lines=cart.map(x=>{const p=products.find(z=>z.id===x.id)||sample.find(z=>z.id===x.id);return p?{...p,qty:x.qty}:null}).filter(Boolean);
 const before=lines.reduce((s,p)=>s+priceInfo(p).base*p.qty,0),savings=lines.reduce((s,p)=>s+priceInfo(p).saving*p.qty,0),total=Math.max(0,before-savings);
 $("#cart-lines").innerHTML=lines.length?lines.map(p=>{const pi=priceInfo(p);return `<div class="cart-line"><div><b>${esc(p.name)}</b><small>${money(pi.final)} ${pi.rate?`· remise ${pi.rate}% non cumulable`:pi.hasProductPromo?'· prix promotionnel':''} · ${esc(p.sku||'')}</small><div class="qty-controls" role="group" aria-label="Quantité de ${esc(p.name)}"><button class="qty-step" data-qty="${esc(p.id)}" data-delta="-1" aria-label="Diminuer la quantité" title="Diminuer">−</button><span class="qty-value" aria-live="polite">${p.qty}</span><button class="qty-step qty-plus" data-qty="${esc(p.id)}" data-delta="1" aria-label="Augmenter la quantité" title="Augmenter" ${p.qty>=Number(p.stock||0)?"disabled":""}>+</button><button class="qty-remove" data-remove="${esc(p.id)}" aria-label="Supprimer ${esc(p.name)} du panier" title="Supprimer du panier"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m3 3v7m6-7v7"/></svg></button></div></div><strong>${money(pi.final*p.qty)}</strong></div>`}).join(''):'<div class="empty">Votre panier est encore vide.</div>';
 $("#cart-total").textContent=money(total);
 const foot=$(".cart-foot");let summary=$("#cart-discount-summary");if(!summary&&foot){summary=document.createElement('div');summary.id='cart-discount-summary';summary.className='cart-discount-summary';foot.insertBefore(summary,foot.querySelector('.cart-total'))}if(summary)summary.innerHTML=savings>0?`<span>Sous-total</span><b>${money(before)}</b><span>Remise Rmi-Dist</span><b>− ${money(savings)}</b>`:'';
}
function drawer(open){$("#cart-drawer").classList.toggle("open",open);$("#drawer-backdrop").classList.toggle("open",open)}
function checkoutModal(open){
 const el=$("#checkout-modal"),back=$("#checkout-backdrop");
 if(el)el.classList.toggle("open",open);
 if(back)back.classList.toggle("open",open);
}
function updateCheckoutPriceSummary(){
 const lines=cart.map(x=>{const p=products.find(z=>z.id===x.id);return p?{...p,qty:x.qty}:null}).filter(Boolean);
 const base=lines.reduce((s,p)=>s+Number(p.price||0)*p.qty,0);
 const final=lines.reduce((s,p)=>s+priceInfo(p).final*p.qty,0);
 const discount=Math.max(0,base-final);
 const city=$("#c-city")?.value||"",shipping=city?shippingFeeForCity(city):null;
 const summary=$("#checkout-price-summary");if(!summary)return;
 summary.innerHTML=`<div><span>Sous-total</span><b>${money(base)}</b></div>${discount?`<div><span>Remise Rmi-Dist</span><b>− ${money(discount)}</b></div>`:""}<div><span>Livraison</span><b>${shipping===null?"Saisissez une ville desservie":shipping===0?"Gratuite":money(shipping)}</b></div><div class="checkout-grand-total"><span>Total estimé</span><b>${shipping===null?"—":money(final+shipping)}</b></div><small>Casablanca : livraison gratuite. Les autres tarifs sont ceux de la ville choisie. Le serveur confirme le montant final.</small>`;
}
function startWebsiteOrder(){
 if(!cart.length){toast("Votre panier est vide.");return}
 if(!db){toast("Configurez Supabase pour enregistrer les commandes.");return}
 if(!promoConfigLoaded){toast("Les tarifs sont en cours de vérification. Réessayez dans un instant.");return}
 checkoutModal(true);
 updateCheckoutPriceSummary();
}
function showOrderConfirmation(order,reference){
 const old=document.getElementById("order-success-modal");if(old)old.remove();
 const waText="Bonjour Rmi-Dist, je viens de passer la commande "+reference+". Pouvez-vous me confirmer sa prise en charge ?";
 const el=document.createElement("section");el.id="order-success-modal";el.className="order-success-modal";
 el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-labelledby","order-success-title");
 el.innerHTML="<div class=\"order-success-card\"><button type=\"button\" class=\"close-btn order-success-close\" aria-label=\"Fermer\">×</button><div class=\"order-success-mark\">✓</div><p class=\"eyebrow\">RMI-DIST</p><h2 id=\"order-success-title\">Merci pour votre commande !</h2><p>Votre commande <b>"+esc(reference)+"</b> a bien été enregistrée.</p><p class=\"order-success-total\">Total des produits : <b>"+money(order.total)+"</b></p><p class=\"order-success-note\">Notre équipe vous contactera pour confirmer la livraison. Livraison gratuite à Casablanca ; pour les autres villes, les frais de transport seront confirmés par notre équipe.</p><a class=\"btn btn-dark full\" href=\"https://wa.me/"+CONFIG.whatsapp+"?text="+encodeURIComponent(waText)+"\" target=\"_blank\" rel=\"noopener noreferrer\">Contacter Rmi-Dist sur WhatsApp</a><button type=\"button\" class=\"btn btn-light full order-success-done\">Continuer mes achats</button></div>";
 document.body.appendChild(el);
 const close=()=>el.remove();el.querySelector(".order-success-close").onclick=close;el.querySelector(".order-success-done").onclick=close;
 el.addEventListener("click",e=>{if(e.target===el)close()});
}

async function submitOrder(){
 const form=$("#checkout-form");if(!form.reportValidity())return;
 const customer={customer_name:$("#c-name").value.trim(),phone:$("#c-phone").value.trim(),email:$("#c-email").value.trim(),city:$("#c-city").value.trim(),address:$("#c-address").value.trim(),notes:$("#c-notes").value.trim()};
 if(shippingFeeForCity(customer.city)===null){toast("Cette ville n’a pas encore de tarif de livraison configuré.");return}
 const items=cart.map(x=>({product_id:x.id,quantity:Number(x.qty)}));
 const btn=$("#place-order");btn.disabled=true;btn.textContent="Enregistrement…";
 try{
  const {data,error}=await db.functions.invoke("create-order",{body:{customer,items}});
  if(error)throw error;
  const o=data?.order;
  if(!o?.id)throw new Error(data?.error||"Le serveur n’a pas confirmé l’enregistrement de la commande.");
  cart=[];saveCart();checkoutModal(false);drawer(false);
  const ref=o.order_number||String(o.id).slice(0,8).toUpperCase();
  toast(`Merci ! Votre commande ${ref} a bien été enregistrée.`);
  showOrderConfirmation(o,ref);
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
  $("#acc-login").onclick=async()=>{const email=$("#acc-email").value.trim(),password=$("#acc-password").value;if(!email||!password){toast("Saisissez votre e-mail et votre mot de passe.");return}const {error}=await db.auth.signInWithPassword({email,password});if(error){toast("Connexion refusée : "+error.message);return}await refreshAuth();accountPanel();toast("Bienvenue sur Rmi-Dist.")};
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

const ADMIN_CATEGORIES=["Cosmétiques & Beauté","Soins dermatologiques","Parapharmacie","Produits Maman & Bébé","Bien-être","Produits Naturels","Promotions","Soins Capillaires"];
const ORDER_STATUSES=["pending","confirmed","preparing","shipped","delivered","cancelled"];
const statusLabel=s=>({pending:"En attente",confirmed:"Confirmée",preparing:"En préparation",shipped:"Expédiée",delivered:"Livrée",cancelled:"Annulée"}[s]||s||"—");
function adminDashboard(){
 adminTab="overview";
 $("#admin-modal").classList.add("admin-modal-wide");
 $("#admin-content").innerHTML=`<div class="admin-shell"><div class="admin-topline"><div><p class="eyebrow">CENTRE DE PILOTAGE</p><h3>Gestion Rmi-Dist</h3><p class="admin-hint">Vue centralisée de votre activité commerciale. Les données proviennent de Supabase.</p></div><button class="btn btn-light" id="admin-refresh">Actualiser</button></div><nav class="admin-tabs" aria-label="Navigation administration"><button data-admin-tab="overview" class="active">Vue générale</button><button data-admin-tab="orders">Commandes</button><button data-admin-tab="customers">Clients</button><button data-admin-tab="products">Produits</button><button data-admin-tab="stock">Stock</button><button data-admin-tab="returns">Retours & échanges</button><button data-admin-tab="losses">Pertes</button><button data-admin-tab="promotion">Promotions</button><button data-admin-tab="reports">Rapports</button></nav><div id="admin-workspace"><div class="admin-loading">Chargement des données commerciales…</div></div><div class="admin-footer"><span>Session administrateur sécurisée</span><button class="btn btn-light" id="admin-logout">Déconnexion</button></div></div>`;
 $("#admin-refresh").onclick=loadAdminData;
 $("#admin-logout").onclick=async()=>{await db.auth.signOut();isAdmin=false;$("#admin-modal").classList.remove("admin-modal-wide");adminLogin()};
 loadAdminData();
}
async function loadAdminData(){
 if(!db||!isAdmin)return;
 const [ordersRes,productsRes,customersRes,promoRes,movementsRes,returnsRes,exchangesRes,lossesRes]=await Promise.all([
  db.from("orders").select("*").order("created_at",{ascending:false}).limit(2000),
  db.from("products").select("*").order("created_at",{ascending:false}).limit(5000),
  db.from("customers").select("*").order("last_order_at",{ascending:false}).limit(5000),
  db.from("promotion_settings").select("*").eq("id",1).maybeSingle(),
  db.from("stock_movements").select("*").order("created_at",{ascending:false}).limit(500),
  db.from("order_returns").select("*").order("created_at",{ascending:false}).limit(500),
  db.from("product_exchanges").select("*").order("created_at",{ascending:false}).limit(500),
  db.from("stock_losses").select("*").order("created_at",{ascending:false}).limit(500)
 ]);
 const failed=[ordersRes,productsRes,customersRes,movementsRes,returnsRes,exchangesRes,lossesRes].find(x=>x.error);
 if(failed){$("#admin-workspace").innerHTML=`<div class="admin-error">Impossible de charger les données : ${esc(failed.error.message)}.</div>`;return}
 adminOrders=ordersRes.data||[];adminProducts=productsRes.data||[];adminCustomers=customersRes.data||[];adminPromo=promoRes.data||null;adminPromoError=promoRes.error?.message||null;
 adminStockMovements=movementsRes.data||[];adminReturns=returnsRes.data||[];adminExchanges=exchangesRes.data||[];adminLosses=lossesRes.data||[];
 if(adminPromo)promoConfig=adminPromo;
 renderAdminTab();
}
function isRevenueOrder(o){return o.status==='delivered'||o.payment_status==='paid'}
function orderDate(o){return new Date(o.created_at||Date.now())}
function customerRows(){return adminCustomers}
function filteredOrders(){const from=$("#report-from")?.value,to=$("#report-to")?.value;return adminOrders.filter(o=>{const d=orderDate(o);return (!from||d>=new Date(from+'T00:00:00'))&&(!to||d<=new Date(to+'T23:59:59'))})}
function parseCSV(text){
 const first=(text.split(/\r?\n/,1)[0]||"");
 const delimiters=[";",",","\t"];const delimiter=delimiters.sort((a,b)=>first.split(b).length-first.split(a).length)[0];
 const rows=[];let row=[],field="",quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c;}else if(c==='"'){quoted=true}else if(c===delimiter){row.push(field.trim());field=""}else if(c==='\n'){row.push(field.trim().replace(/\r$/,''));if(row.some(v=>v!==''))rows.push(row);row=[];field=""}else field+=c;}
 row.push(field.trim());if(row.some(v=>v!==''))rows.push(row);
 if(!rows.length)return [];
 const headers=rows.shift().map(h=>h.replace(/^\uFEFF/,"").trim().toLowerCase());
 return rows.map((r,index)=>{const o={_line:index+2};headers.forEach((h,i)=>o[h]=(r[i]??'').trim());return o});
}
function csvCell(v){const s=String(v??'');return /[;"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
function downloadProductCSVTemplate(){const content='sku;name;brand;category;description;price;promo_price;image_url;published\r\nPRD-1001;Crème hydratante;Nivea;Cosmétiques & Beauté;Crème visage;85;75;;true\r\n';const blob=new Blob(['\uFEFF',content],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='modele-produits-pararmidist.csv';a.click();URL.revokeObjectURL(url)}
function csvRowToProduct(r){
 const name=r.name||'',category=r.category||'',priceRaw=r.price??'';const price=Number(priceRaw);
 if(!name||!category||priceRaw===''||!Number.isFinite(price)||price<0)throw new Error('Nom, catégorie et prix valide sont obligatoires.');
 const out={name,category,price,updated_at:new Date().toISOString()};
 for(const key of ['sku','brand','description','image_url'])if(r[key]!==undefined&&r[key]!== '')out[key]=r[key];
 if(r.promo_price!==undefined&&r.promo_price!==''){const promo=Number(r.promo_price);if(!Number.isFinite(promo)||promo<0||promo>=price)throw new Error('Prix promotionnel invalide.');out.promo_price=promo}else if(r.promo_price===''){};
 // Le stock est volontairement ignoré : les ventes sont indépendantes de tout inventaire.
 if(r.published!==undefined&&r.published!==''){const v=r.published.toLowerCase();if(!['true','false','1','0','oui','non'].includes(v))throw new Error('published doit être true/false ou oui/non.');out.published=['true','1','oui'].includes(v)}
 return out;
}
function prepareCSVImport(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{try{const rows=parseCSV(String(reader.result||''));if(!rows.length)throw new Error('Le fichier CSV est vide.');const required=['name','category','price'];const headers=Object.keys(rows[0]||{});const missing=required.filter(k=>!headers.includes(k));if(missing.length)throw new Error('Colonnes obligatoires manquantes : '+missing.join(', '));const seen=new Set();let duplicate=0,valid=0,errors=[];const normalized=[];for(const r of rows){try{const product=csvRowToProduct(r);if(product.sku){const k=product.sku.toLowerCase();if(seen.has(k)){duplicate++;errors.push(`Ligne ${r._line} : SKU répété dans le fichier (${product.sku}).`);continue}seen.add(k)}normalized.push({...product,_line:r._line});valid++}catch(e){errors.push(`Ligne ${r._line} : ${e.message}`)}}resolve({rows:normalized,errors,duplicate,valid,total:rows.length})}catch(e){reject(e)}};reader.onerror=()=>reject(new Error('Lecture du fichier impossible.'));reader.readAsText(file,'UTF-8')})}
async function runCSVImport(){
 if(!db||!isAdmin){toast('Connexion administrateur requise.');return}
 const updateExisting=$('#csv-update-existing')?.checked===true;const btn=$('#csv-run');if(!csvImportRows.length){toast('Aucun produit valide à importer.');return}if(!confirm(`${csvImportRows.length} produit(s) vont être traités. Continuer ?`))return;
 btn.disabled=true;btn.textContent='Importation…';let inserted=0,updated=0,skipped=0,failed=csvValidationErrors.slice();const rows=csvImportRows.slice();
 try{
  const withSku=rows.filter(x=>x.sku),withoutSku=rows.filter(x=>!x.sku);
  for(let i=0;i<withSku.length;i+=100){const batch=withSku.slice(i,i+100);const skus=batch.map(x=>x.sku);let existing=[];const {data:found,error:findError}=await db.from('products').select('id,sku').in('sku',skus);if(findError)throw findError;existing=found||[];const existingMap=new Map(existing.map(x=>[String(x.sku).toLowerCase(),x]));const existingSet=new Set(existingMap.keys());let payload=batch.map(({_line,...x})=>x);if(!updateExisting){const before=payload.length;payload=payload.filter(x=>!existingSet.has(String(x.sku).toLowerCase()));skipped+=before-payload.length;}else updated+=payload.filter(x=>existingSet.has(String(x.sku).toLowerCase())).length;
   if(payload.length){const {error}=await db.from('products').upsert(payload,{onConflict:'sku'});if(error){for(const x of batch)failed.push(`Ligne ${x._line} : ${error.message}`)}else inserted+=payload.length-(updateExisting?payload.filter(x=>existingSet.has(String(x.sku).toLowerCase())).length:0)}
   btn.textContent=`Importation ${Math.min(i+100,withSku.length)}/${withSku.length+withoutSku.length}…`;
  }
  for(let i=0;i<withoutSku.length;i+=100){const batch=withoutSku.slice(i,i+100).map(({_line,...x})=>x);const {error}=await db.from('products').insert(batch);if(error)failed.push(`Produits sans SKU (lot ${Math.floor(i/100)+1}) : ${error.message}`);else inserted+=batch.length;btn.textContent=`Importation ${withSku.length+Math.min(i+100,withoutSku.length)}/${rows.length}…`}
  await loadProducts();await loadAdminData();adminTab='products';renderAdminTab();const report=[`Résultat import CSV`,`Importés : ${inserted}`,`Actualisés : ${updated}`,`Ignorés : ${skipped}`,`Erreurs : ${failed.length}`, ...failed];const blob=new Blob(['\uFEFF'+report.join('\r\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rapport-import-pararmidist.csv';a.click();URL.revokeObjectURL(url);toast(`Import terminé : ${inserted} ajouté(s), ${updated} actualisé(s), ${skipped} ignoré(s), ${failed.length} erreur(s).`);csvImportRows=[];
 }catch(e){console.error(e);toast('Import interrompu : '+(e.message||'erreur Supabase.'))}finally{if($('#csv-run')){$('#csv-run').disabled=false;$('#csv-run').textContent='Confirmer l’importation'}}
}
function renderAdminTab(){
 const host=$("#admin-workspace");if(!host)return;
 document.querySelectorAll('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===adminTab));
 const now=new Date(),monthStart=new Date(now.getFullYear(),now.getMonth(),1);
 const monthly=adminOrders.filter(o=>orderDate(o)>=monthStart),revenue=monthly.filter(isRevenueOrder).reduce((s,o)=>s+Number(o.total||0),0),customers=customerRows();
 if(adminTab==='overview'){
  const pending=adminOrders.filter(o=>o.status==='pending').length,delivered=adminOrders.filter(o=>o.status==='delivered').length;
  const top=topProducts(monthly.filter(isRevenueOrder)).slice(0,5), trend=monthlyRevenueSeries();
  host.innerHTML=`<div class="admin-kpis"><article><span>CA encaissé / livré ce mois</span><b>${money(revenue)}</b><small>Commandes livrées ou paiements confirmés</small></article><article><span>Commandes du mois</span><b>${monthly.length}</b><small>${pending} en attente · ${delivered} livrées</small></article><article><span>Clients identifiés</span><b>${customers.length}</b><small>Dédupliqués par numéro de téléphone</small></article><article><span>Catalogue publié</span><b>${adminProducts.filter(p=>p.published).length}</b><small>${adminProducts.length} produits au total</small></article></div><section class="admin-card"><div class="admin-card-head"><h4>Évolution du chiffre d’affaires</h4><small>6 derniers mois · commandes livrées ou payées</small></div><div class="admin-month-chart">${trend.map(x=>`<div class="admin-month-col"><b>${money(x.value)}</b><span class="admin-month-bar" style="height:${x.height}%"></span><small>${x.label}</small></div>`).join('')}</div></section><div class="admin-two-col"><section class="admin-card"><div class="admin-card-head"><h4>Commandes récentes</h4><button data-jump-tab="orders">Voir tout</button></div>${adminOrders.slice(0,7).map(orderRow).join('')||'<p class="admin-empty">Aucune commande enregistrée.</p>'}</section><section class="admin-card"><div class="admin-card-head"><h4>Meilleures ventes</h4><button data-jump-tab="reports">Rapports</button></div>${top.map(x=>`<div class="admin-ranking"><span>${esc(x.name)}</span><b>${x.quantity} unité(s)</b><strong>${money(x.revenue)}</strong></div>`).join('')||'<p class="admin-empty">Les ventes apparaîtront ici après les premières commandes.</p>'}</section></div><p class="admin-note">Le chiffre d'affaires est calculé sur les commandes livrées ou les paiements marqués comme payés. Les commandes annulées et en attente sont exclues. La marge bénéficiaire nécessite l'enregistrement du coût d'achat des produits.</p>`;
 } else if(adminTab==='orders'){
  host.innerHTML=`<div class="admin-section-head"><div><h4>Gestion des commandes</h4><p>Imprimez une commande ou transmettez son récapitulatif au client par Gmail ou WhatsApp.</p></div><input id="orders-search" placeholder="Rechercher client, téléphone, ville…"></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Commande</th><th>Client</th><th>Date</th><th>Total</th><th>Paiement</th><th>Statut</th><th>Actions</th></tr></thead><tbody id="orders-table-body">${adminOrders.map(orderTableRow).join('')||'<tr><td colspan="7">Aucune commande.</td></tr>'}</tbody></table></div>`;
  $("#orders-search").oninput=()=>{const q=$("#orders-search").value.toLowerCase();$("#orders-table-body").innerHTML=adminOrders.filter(o=>[o.customer_name,o.phone,o.city,String(o.id)].join(' ').toLowerCase().includes(q)).map(orderTableRow).join('')};
 } else if(adminTab==='customers'){
  host.innerHTML=`<div class="admin-section-head"><div><h4>Fichier clients</h4><p>Fiches reconstituées à partir des commandes existantes, comptes et invités confondus.</p></div><input id="customers-search" placeholder="Rechercher un client…"></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Client</th><th>Contact</th><th>Ville</th><th>Commandes</th><th>CA livré / payé</th><th>Dernière commande</th></tr></thead><tbody id="customers-table-body">${customers.map(customerTableRow).join('')||'<tr><td colspan="6">Aucun client identifié.</td></tr>'}</tbody></table></div><p class="admin-note">Les clients invités sont identifiés par leur téléphone. Les comptes authentifiés restent dans Supabase Authentication. Aucun compte client n'est créé automatiquement par ce tableau.</p>`;
  $("#customers-search").oninput=()=>{const q=$("#customers-search").value.toLowerCase();$("#customers-table-body").innerHTML=customers.filter(c=>[c.full_name,c.phone,c.email,c.city].join(' ').toLowerCase().includes(q)).map(customerTableRow).join('')};
 } else if(adminTab==='products'){
  const opts=categories.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  const subOpts=subcategories.map(c=>`<option value="${esc(c.id)}" data-parent-category="${esc(c.category_id)}">${esc(c.name)}</option>`).join('');
  host.innerHTML=`<div class="admin-section-head"><div><h4>Catalogue produits</h4><p>Vente directe : aucun stock n’est suivi ni contrôlé. Nom, catégorie et prix sont obligatoires.</p></div><span class="admin-count">${adminProducts.length} produits</span></div><section class="admin-card csv-import-card"><div class="admin-card-head"><h4>Importation massive CSV</h4><button type="button" id="csv-template" class="admin-edit">Télécharger le modèle CSV</button></div><p class="admin-note">Importez 1 000 produits ou plus. Colonnes utiles : name, category, price, promo_price, SKU, marque, description, image_url, published. Toute colonne stock éventuelle est ignorée. Séparateur ; ou , accepté. Traitement par lots de 100.</p><div class="csv-import-controls"><label>Choisir un fichier CSV<input type="file" id="csv-file" accept=".csv,text/csv"></label><label class="csv-update-option"><input type="checkbox" id="csv-update-existing"> Actualiser les produits existants si le SKU existe</label></div><div id="csv-preview" class="csv-preview" aria-live="polite">Aucun fichier sélectionné.</div><button type="button" class="btn btn-dark" id="csv-run" disabled>Confirmer l’importation</button></section><div class="admin-product-form"><label>Nom du produit<input id="p-name" placeholder="Nom du produit" required></label><label>Catégorie principale<select id="p-category">${opts}</select></label><label>Sous-catégorie<select id="p-subcategory"><option value="">Choisir une sous-catégorie</option>${subOpts}</select></label><label>Prix de vente (MAD)<input id="p-price" type="number" min="0.01" step="0.01" placeholder="129" required></label><label>Marque (facultatif)<input id="p-brand" placeholder="Marque"></label><label>Référence SKU (facultatif)<input id="p-sku" placeholder="Référence"></label><label>Prix promotionnel (facultatif)<input id="p-promo" type="number" min="0.01" step="0.01" placeholder="Vide si aucune promotion"></label><label>URL photo (facultatif)<input id="p-image" type="url" placeholder="https://…"></label><label class="wide">Description (facultatif)<textarea id="p-desc"></textarea></label><input id="p-id" type="hidden"><button class="btn btn-dark" id="p-save">Ajouter le produit</button><button class="btn btn-light" id="p-cancel-edit" type="button" hidden>Annuler</button></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Produit</th><th>Catégorie</th><th>Prix</th><th>Promotion</th><th>Publication</th><th></th></tr></thead><tbody>${adminProducts.map(p=>`<tr><td><b>${esc(p.name)}</b><small>${esc(p.sku||'Sans référence')}</small></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.promo_price?money(p.promo_price):'—'}</td><td>${p.published?'Publié':'Masqué'}</td><td><button class="admin-edit" data-edit-product="${esc(p.id)}">Modifier</button> <button class="admin-danger" data-delete="${esc(p.id)}">Supprimer</button></td></tr>`).join('')||'<tr><td colspan="6">Aucun produit.</td></tr>'}</tbody></table></div>`;
  $("#p-category").onchange=()=>{const id=$("#p-category").value;const sub=$("#p-subcategory");[...sub.options].forEach(o=>{if(o.value)o.hidden=o.dataset.parentCategory!==id});if(sub.selectedOptions[0]?.hidden)sub.value=""};
  $("#p-save").onclick=saveAdminProduct;
  $("#p-cancel-edit").onclick=()=>{["p-id","p-name","p-brand","p-sku","p-price","p-promo","p-image","p-desc"].forEach(id=>$("#"+id).value="");$("#p-save").textContent="Ajouter le produit";$("#p-cancel-edit").hidden=true};
 } else if(adminTab==='stock'){
  const choices=adminProducts.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · Stock : ${Number(p.stock||0)}</option>`).join('');
  host.innerHTML=`<div class="admin-section-head"><div><h4>Gestion du stock</h4><p>Les ventes, retours et échanges mettent à jour le stock automatiquement.</p></div><span class="admin-count">${adminProducts.filter(p=>Number(p.stock)>0).length} références en stock</span></div><div class="admin-card"><h4>Ajustement manuel</h4><label>Produit<select id="stock-product">${choices}</select></label><label>Quantité à ajouter / retirer<input id="stock-quantity" type="number" step="1" placeholder="Ex. 5 ou -2"></label><label>Motif<input id="stock-reason" placeholder="Inventaire / correction"></label><button class="btn btn-dark" id="stock-adjust">Enregistrer l'ajustement</button></div><div class="admin-card"><h4>Historique des mouvements</h4><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Produit</th><th>Mouvement</th><th>Quantité</th><th>Référence</th></tr></thead><tbody>${adminStockMovements.map(m=>{const p=adminProducts.find(x=>String(x.id)===String(m.product_id));return `<tr><td>${new Date(m.created_at).toLocaleString('fr-MA')}</td><td>${esc(p?.name||m.product_id)}</td><td>${esc(m.movement_type)}</td><td>${Number(m.quantity_change)>0?'+':''}${m.quantity_change}</td><td>${esc(m.reference_key)}</td></tr>`}).join('')||'<tr><td colspan="5">Aucun mouvement.</td></tr>'}</tbody></table></div></div>`;
  $("#stock-adjust").onclick=async()=>{const productId=$("#stock-product").value,qty=Number($("#stock-quantity").value),reason=$("#stock-reason").value.trim();if(!productId||!Number.isInteger(qty)||qty===0||!reason){toast("Produit, quantité entière non nulle et motif obligatoires.");return}const {error}=await db.from("stock_movements").insert({product_id:productId,movement_type:"adjustment",quantity_change:qty,reason,reference_key:"adjustment:"+crypto.randomUUID(),created_by:currentUser?.id||null});if(error){toast("Ajustement refusé : "+error.message);return}toast("Stock ajusté.");await loadProducts();await loadAdminData();adminTab="stock";renderAdminTab()};
 } else if(adminTab==='returns'){
  const orderChoices=adminOrders.map(o=>`<option value="${esc(o.id)}">${esc(o.order_number||String(o.id).slice(0,8))} · ${esc(o.customer_name)}</option>`).join('');
  const productChoices=adminProducts.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  host.innerHTML=`<div class="admin-card"><h4>Enregistrer un retour</h4><label>Commande<select id="return-order">${orderChoices}</select></label><label>Produit retourné<select id="return-product">${productChoices}</select></label><label>Quantité<input id="return-qty" type="number" min="1" value="1"></label><label>Motif<input id="return-reason" placeholder="Retour client"></label><label>Note facultative<textarea id="return-note"></textarea></label><button class="btn btn-dark" id="return-save">Valider le retour et réintégrer le stock</button></div><div class="admin-card"><h4>Enregistrer un échange</h4><label>Commande<select id="exchange-order">${orderChoices}</select></label><label>Ancien produit<select id="exchange-old">${productChoices}</select></label><label>Nouveau produit<select id="exchange-new">${productChoices}</select></label><label>Quantité<input id="exchange-qty" type="number" min="1" value="1"></label><label>Note facultative<textarea id="exchange-note"></textarea></label><button class="btn btn-dark" id="exchange-save">Valider l'échange</button></div><div class="admin-card"><h4>Historique des retours</h4><p>${adminReturns.length} retour(s) · ${adminExchanges.length} échange(s)</p></div>`;
  $("#return-save").onclick=async()=>{const order_id=$("#return-order").value,product_id=$("#return-product").value,quantity=Number($("#return-qty").value),reason=$("#return-reason").value.trim();if(!order_id||!product_id||!Number.isInteger(quantity)||quantity<1||!reason){toast("Complétez les informations du retour.");return}const {error}=await db.from("order_returns").insert({order_id,product_id,quantity,reason,notes:$("#return-note").value.trim()||null,idempotency_key:"return:"+crypto.randomUUID(),created_by:currentUser?.id||null});if(error){toast("Retour refusé : "+error.message);return}toast("Retour enregistré et stock réintégré.");await loadProducts();await loadAdminData();adminTab="returns";renderAdminTab()};
  $("#exchange-save").onclick=async()=>{const order_id=$("#exchange-order").value,returned_product_id=$("#exchange-old").value,replacement_product_id=$("#exchange-new").value,quantity=Number($("#exchange-qty").value);if(!order_id||!returned_product_id||!replacement_product_id||returned_product_id===replacement_product_id||!Number.isInteger(quantity)||quantity<1){toast("Vérifiez les produits et la quantité de l'échange.");return}const {error}=await db.from("product_exchanges").insert({order_id,returned_product_id,replacement_product_id,quantity,notes:$("#exchange-note").value.trim()||null,idempotency_key:"exchange:"+crypto.randomUUID(),created_by:currentUser?.id||null});if(error){toast("Échange refusé : "+error.message);return}toast("Échange enregistré.");await loadProducts();await loadAdminData();adminTab="returns";renderAdminTab()};
 } else if(adminTab==='losses'){
  const choices=adminProducts.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} · Stock : ${Number(p.stock||0)}</option>`).join('');
  host.innerHTML=`<div class="admin-card"><h4>Déclarer une perte</h4><label>Produit<select id="loss-product">${choices}</select></label><label>Quantité perdue<input id="loss-qty" type="number" min="1" value="1"></label><label>Motif<select id="loss-reason"><option value="casse">Cassé</option><option value="expire">Expiré</option><option value="endommage">Endommagé</option><option value="perdu">Perdu</option><option value="inutilisable">Inutilisable</option></select></label><label>Coût d'achat unitaire (MAD)<input id="loss-cost" type="number" min="0" step="0.01" value="0"></label><label>Note facultative<textarea id="loss-note"></textarea></label><button class="btn btn-dark" id="loss-save">Enregistrer la perte et déduire le stock</button></div><div class="admin-card"><h4>Historique des pertes</h4><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Date</th><th>Produit</th><th>Quantité</th><th>Motif</th><th>Valeur</th></tr></thead><tbody>${adminLosses.map(l=>{const p=adminProducts.find(x=>String(x.id)===String(l.product_id));return `<tr><td>${new Date(l.created_at).toLocaleDateString('fr-MA')}</td><td>${esc(p?.name||l.product_id)}</td><td>${l.quantity}</td><td>${esc(l.reason)}</td><td>${money(l.loss_value)}</td></tr>`}).join('')||'<tr><td colspan="5">Aucune perte enregistrée.</td></tr>'}</tbody></table></div></div>`;
  $("#loss-save").onclick=async()=>{const product_id=$("#loss-product").value,quantity=Number($("#loss-qty").value),unit_cost=Number($("#loss-cost").value),reason=$("#loss-reason").value;if(!product_id||!Number.isInteger(quantity)||quantity<1||!Number.isFinite(unit_cost)||unit_cost<0){toast("Vérifiez le produit, la quantité et le coût.");return}const {error}=await db.from("stock_losses").insert({product_id,quantity,reason,unit_cost,notes:$("#loss-note").value.trim()||null,idempotency_key:"loss:"+crypto.randomUUID(),created_by:currentUser?.id||null});if(error){toast("Perte refusée : "+error.message);return}toast("Perte enregistrée et stock déduit.");await loadProducts();await loadAdminData();adminTab="losses";renderAdminTab()};
 } else if(adminTab==='promotion'){
  const pr=adminPromo||{active:true,discount_rate:5,starts_at:null,ends_at:null};
  host.innerHTML=`${adminPromoError?`<div class="admin-error">La table de campagne n’est pas disponible. Exécutez la migration 20261122_professional_commerce.sql dans Supabase. Détail : ${esc(adminPromoError)}</div>`:''}<div class="admin-card promotion-editor"><h4>Campagne Rmi-Dist</h4><p>La remise générale s'applique uniquement aux produits sans prix promotionnel. Un article déjà en promotion ne reçoit pas une deuxième réduction.</p><label class="admin-toggle"><input id="promo-active" type="checkbox" ${pr.active?'checked':''}> Campagne active</label><label>Taux de remise (%)<input id="promo-rate" type="number" min="0" max="90" step="0.5" value="${Number(pr.discount_rate||5)}"></label><div class="admin-form-grid"><label>Début de la campagne<input id="promo-start" type="datetime-local" value="${toLocalInput(pr.starts_at)}"></label><label>Fin de la campagne<input id="promo-end" type="datetime-local" value="${toLocalInput(pr.ends_at)}"></label></div><button class="btn btn-dark" id="promo-save">Enregistrer la campagne</button><p class="admin-note">Le serveur recalcule les prix et la remise au moment de la commande. Le montant envoyé par le navigateur n'est jamais considéré comme fiable.</p></div>`;
  $("#promo-save").onclick=savePromotion;
 } else if(adminTab==='reports'){
  host.innerHTML=`<div class="admin-section-head"><div><h4>Rapports commerciaux</h4><p>Choisissez une période pour analyser les commandes et les ventes.</p></div><button class="btn btn-light" id="report-print">Imprimer / Enregistrer en PDF</button></div><div class="report-filters"><label>Du<input id="report-from" type="date"></label><label>Au<input id="report-to" type="date"></label><button class="btn btn-dark" id="report-apply">Appliquer</button></div><div id="report-result">${renderReportHtml(adminOrders)}</div>`;
  $("#report-apply").onclick=()=>{$("#report-result").innerHTML=renderReportHtml(filteredOrders())};
  $("#report-print").onclick=()=>window.print();
 }
}
function toLocalInput(v){if(!v)return '';const d=new Date(v);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function monthlyRevenueSeries(){const now=new Date(),rows=[];for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1),next=new Date(d.getFullYear(),d.getMonth()+1,1);const value=adminOrders.filter(o=>isRevenueOrder(o)&&orderDate(o)>=d&&orderDate(o)<next).reduce((s,o)=>s+Number(o.total||0),0);rows.push({label:d.toLocaleDateString('fr-MA',{month:'short'}),value})}const max=Math.max(1,...rows.map(x=>x.value));return rows.map(x=>({...x,height:Math.max(4,Math.round(x.value/max*100))}))}
function orderRow(o){return `<div class="admin-row"><span><b>${esc(o.customer_name||'Client')}</b><br><small>${esc(o.phone||'')} · ${esc(o.city||'')} · ${new Date(o.created_at).toLocaleDateString('fr-MA')}</small></span><strong>${money(o.total)}</strong><span class="status-pill">${esc(statusLabel(o.status))}</span></div>`}
function orderTableRow(o){return `<tr><td><b>${esc(String(o.id).slice(0,8).toUpperCase())}</b><small>${esc(o.payment_reference||'')}</small></td><td>${esc(o.customer_name||'')}<small>${esc(o.phone||'')} · ${esc(o.city||'')}</small></td><td>${new Date(o.created_at).toLocaleDateString('fr-MA')}</td><td><b>${money(o.total)}</b><small>${Number(o.discount_amount||0)>0?`Remise ${money(o.discount_amount)}`:''}</small></td><td>${esc(o.payment_status||o.payment_method||'—')}</td><td><select data-order-status="${esc(o.id)}">${ORDER_STATUSES.map(s=>`<option value="${s}" ${o.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select></td><td class="order-actions"><button class="admin-edit" type="button" data-print-order="${esc(o.id)}">Imprimer</button><button class="admin-edit" type="button" data-email-order="${esc(o.id)}" ${o.email?'':'disabled title="Aucune adresse e-mail enregistrée"'}>Gmail</button><button class="admin-edit" type="button" data-whatsapp-order="${esc(o.id)}" ${o.phone?'':'disabled title="Aucun téléphone enregistré"'}>WhatsApp</button></td></tr>`}
function orderItemsForMessage(o){
 const items=Array.isArray(o.items)?o.items:[];
 return items.map(i=>`• ${i.name||'Produit'} × ${Number(i.quantity||1)} : ${money(i.line_total??(Number(i.unit_price||0)*Number(i.quantity||1)))}`).join("\n")||"Détail des produits non disponible.";
}
function orderReference(o){return o.order_number||`PRD-${String(o.id).slice(0,8).toUpperCase()}`}
function orderShareText(o){
 const date=o.created_at?new Date(o.created_at).toLocaleString('fr-MA'):'—';
 return `Rmi-Dist — Récapitulatif de commande\nCommande : ${orderReference(o)}\nDate : ${date}\nClient : ${o.customer_name||'Client'}\nTéléphone : ${o.phone||'—'}\nE-mail : ${o.email||'—'}\nAdresse : ${o.address||'—'}, ${o.city||''}\n\nArticles :\n${orderItemsForMessage(o)}\n\nSous-total : ${money(o.subtotal_before_discount??o.subtotal??o.total)}\nRemise : ${money(o.discount_amount||0)}\nTotal à payer : ${money(o.total)}\nPaiement : ${o.payment_method||'—'}\nÉtat : ${statusLabel(o.status)}\n\nMerci pour votre confiance.`;
}
function normalizedWhatsAppNumber(phone){
 let n=String(phone||'').replace(/\D/g,'');
 if(n.startsWith('00'))n=n.slice(2);
 if(n.startsWith('0'))n='212'+n.slice(1);
 if(n.length===9 && /^[5-7]/.test(n))n='212'+n;
 return n;
}
function printOrder(o){
 const w=window.open('','_blank','width=850,height=900');
 if(!w){toast('Autorisez les fenêtres pop-up pour imprimer la commande.');return}
 const rows=(Array.isArray(o.items)?o.items:[]).map(i=>`<tr><td>${esc(i.name||'Produit')}</td><td>${Number(i.quantity||1)}</td><td>${money(i.unit_price||0)}</td><td>${money(i.line_total??(Number(i.unit_price||0)*Number(i.quantity||1)))}</td></tr>`).join('');
 const content=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Commande ${esc(orderReference(o))}</title><style>body{font:14px Arial,sans-serif;color:#28202a;margin:36px}h1{color:#7b173c;margin-bottom:4px}.muted{color:#766b73}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}th{background:#f8eef2}.totals{margin-left:auto;width:300px}.totals div{display:flex;justify-content:space-between;padding:6px}.grand{font-size:19px;font-weight:bold;border-top:2px solid #7b173c;margin-top:8px;padding-top:12px}.contact{margin-top:28px;white-space:pre-line}@media print{button{display:none}}</style></head><body><h1>Rmi-Dist</h1><div class="muted">Bon de commande</div><h2>${esc(orderReference(o))}</h2><p>Date : ${esc(o.created_at?new Date(o.created_at).toLocaleString('fr-MA'):'—')}</p><h3>Informations client</h3><p>${esc(o.customer_name||'Client')}<br>${esc(o.phone||'')}<br>${esc(o.email||'')}<br>${esc(o.address||'')} ${esc(o.city||'')}</p><h3>Articles commandés</h3><table><thead><tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Sous-total</span><b>${money(o.subtotal_before_discount??o.subtotal??o.total)}</b></div><div><span>Remise</span><b>− ${money(o.discount_amount||0)}</b></div><div class="grand"><span>Total à payer</span><span>${money(o.total)}</span></div></div><p class="contact">Paiement : ${esc(o.payment_method||'—')}<br>Statut : ${esc(statusLabel(o.status))}<br>Notes : ${esc(o.notes||'—')}</p><p class="muted">Merci pour votre confiance.</p><script>window.onload=()=>window.print()<\/script></body></html>`;
 w.document.open();w.document.write(content);w.document.close();
}
function customerTableRow(c){return `<tr><td><b>${esc(c.full_name||'Client')}</b></td><td>${esc(c.phone||'')}<small>${esc(c.email||'')}</small></td><td>${esc(c.city||'')}</td><td>${Number(c.order_count||0)}</td><td><b>${money(c.total_spent)}</b></td><td>${c.last_order_at?new Date(c.last_order_at).toLocaleDateString('fr-MA'):'—'}</td></tr>`}
function topProducts(orders){const map=new Map();orders.forEach(o=>(Array.isArray(o.items)?o.items:[]).forEach(i=>{const k=i.product_id||i.name;const x=map.get(k)||{name:i.name||'Produit',quantity:0,revenue:0};x.quantity+=Number(i.quantity||0);x.revenue+=Number(i.line_total??(Number(i.unit_price||0)*Number(i.quantity||0)));map.set(k,x)}));return [...map.values()].sort((a,b)=>b.quantity-a.quantity)}
function renderReportHtml(orders){const paid=orders.filter(isRevenueOrder),revenue=paid.reduce((s,o)=>s+Number(o.total||0),0),discount=orders.reduce((s,o)=>s+Number(o.discount_amount||0),0),avg=paid.length?revenue/paid.length:0,lossValue=adminLosses.reduce((sum,l)=>sum+Number(l.loss_value||0),0);return `<div class="admin-kpis"><article><span>CA livré / payé</span><b>${money(revenue)}</b></article><article><span>Commandes</span><b>${orders.length}</b></article><article><span>Panier moyen encaissé</span><b>${money(avg)}</b></article><article><span>Remises accordées</span><b>${money(discount)}</b></article><article><span>Valeur totale des pertes</span><b>${money(lossValue)}</b></article></div><div class="admin-card"><h4>Produits les plus vendus</h4>${topProducts(orders.filter(isRevenueOrder)).slice(0,15).map(x=>`<div class="admin-ranking"><span>${esc(x.name)}</span><b>${x.quantity} unité(s)</b><strong>${money(x.revenue)}</strong></div>`).join('')||'<p class="admin-empty">Aucune vente sur cette période.</p>'}</div><p class="admin-note">Le chiffre d'affaires est fondé sur les commandes livrées ou payées. Les montants historiques antérieurs à la nouvelle migration ne contiendront pas de champ de remise séparé. La marge nette n'est pas calculée car les coûts d'achat ne sont pas encore enregistrés.</p>`}
async function saveAdminProduct(){
 const name=$("#p-name").value.trim(),categoryId=$("#p-category").value,subcategoryId=$("#p-subcategory").value||null,category=categoryNameById(categoryId),price=Number($("#p-price").value),promoRaw=$("#p-promo").value.trim(),promo=promoRaw===''?null:Number(promoRaw);
 if(!name||!categoryId||!category||!Number.isFinite(price)||price<=0){toast('Nom, catégorie principale et prix valide sont obligatoires.');return}
 if(subcategoryId&&!subcategories.some(x=>String(x.id)===String(subcategoryId)&&String(x.category_id)===String(categoryId))){toast('La sous-catégorie ne correspond pas à la catégorie principale.');return}
 if(promo!==null&&(!Number.isFinite(promo)||promo<=0||promo>=price)){toast('Le prix promotionnel doit être supérieur à 0 et inférieur au prix normal.');return}
 const productId=$("#p-id").value;
 const existing=productId?adminProducts.find(x=>String(x.id)===productId):null;
 const payload={name,category,category_id:categoryId,subcategory_id:subcategoryId,price,brand:$("#p-brand").value.trim()||null,sku:$("#p-sku").value.trim()||null,promo_price:promo,image_url:$("#p-image").value.trim()||null,description:$("#p-desc").value.trim()||null,published:existing?existing.published:true};
 const result=productId?await db.from('products').update(payload).eq('id',productId):await db.from('products').insert(payload);
 if(result.error){toast('Erreur : '+result.error.message);return}toast(productId?'Produit modifié.':'Produit ajouté.');await loadProducts();await loadAdminData();adminTab='products';renderAdminTab();
}
async function savePromotion(){
 const rate=Number($("#promo-rate").value),active=$("#promo-active").checked,start=$("#promo-start").value||null,end=$("#promo-end").value||null;
 if(!Number.isFinite(rate)||rate<0||rate>90){toast('Le taux doit être compris entre 0 et 90 %.');return}
 if(start&&end&&new Date(end)<=new Date(start)){toast('La date de fin doit être après la date de début.');return}
 const payload={active,discount_rate:rate,starts_at:start?new Date(start).toISOString():null,ends_at:end?new Date(end).toISOString():null,updated_at:new Date().toISOString()};
 const {error}=await db.from('promotion_settings').upsert({id:1,...payload});if(error){toast('Impossible d’enregistrer la campagne : '+error.message);return}
 toast('Campagne enregistrée.');await loadPromoConfig();await loadAdminData();adminTab='promotion';renderAdminTab();renderCart();renderProducts();
}
document.addEventListener('change',async e=>{
 if(e.target.id==='csv-file'){const preview=$('#csv-preview'),run=$('#csv-run');csvImportRows=[];csvValidationErrors=[];run.disabled=true;if(!e.target.files?.[0]){preview.textContent='Aucun fichier sélectionné.';return}csvImportFileName=e.target.files[0].name;preview.textContent='Analyse du fichier…';try{const result=await prepareCSVImport(e.target.files[0]);csvImportRows=result.rows;csvValidationErrors=result.errors;const sample=result.rows.slice(0,20);preview.innerHTML=`<b>${esc(csvImportFileName)}</b><p>${result.total} ligne(s) détectée(s) · ${result.valid} valide(s) · ${result.duplicate} doublon(s) interne(s)</p><p>${result.errors.length?`${result.errors.length} erreur(s) détectée(s)`:'Aucune erreur de validation.'}</p><div class="csv-preview-table"><table><thead><tr><th>Ligne</th><th>SKU</th><th>Nom</th><th>Catégorie</th><th>Prix</th></tr></thead><tbody>${sample.map(r=>`<tr><td>${r._line}</td><td>${esc(r.sku||'—')}</td><td>${esc(r.name)}</td><td>${esc(r.category)}</td><td>${esc(r.price)}</td></tr>`).join('')}</tbody></table></div>${result.errors.length?`<details><summary>Voir les erreurs</summary><ul>${result.errors.slice(0,50).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}`;run.disabled=!result.rows.length}catch(err){preview.textContent=err.message;run.disabled=true}}
 const status=e.target.closest('[data-order-status]');
 if(status&&db&&isAdmin){const {error}=await db.from('orders').update({status:status.value}).eq('id',status.dataset.orderStatus);if(error){toast('Statut non modifié : '+error.message);await loadAdminData()}else{const order=adminOrders.find(x=>String(x.id)===status.dataset.orderStatus);if(order)order.status=status.value;toast('Statut de commande mis à jour.');renderAdminTab()}}
});
document.addEventListener("click",async e=>{
 if(e.target.closest("#place-order")){await submitOrder();return}
 const printBtn=e.target.closest('[data-print-order]');
 if(printBtn){const order=adminOrders.find(o=>String(o.id)===printBtn.dataset.printOrder);if(order)printOrder(order);return}
 const emailBtn=e.target.closest('[data-email-order]');
 if(emailBtn){const order=adminOrders.find(o=>String(o.id)===emailBtn.dataset.emailOrder);if(order){if(!order.email){toast("Aucune adresse e-mail n'est enregistrée pour ce client.");return}const subject=encodeURIComponent(`Rmi-Dist — commande ${orderReference(order)}`);const body=encodeURIComponent(orderShareText(order));window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(order.email)}&su=${subject}&body=${body}`,'_blank','noopener')}return}
 const whatsappBtn=e.target.closest('[data-whatsapp-order]');
 if(whatsappBtn){const order=adminOrders.find(o=>String(o.id)===whatsappBtn.dataset.whatsappOrder);if(order){const phone=normalizedWhatsAppNumber(order.phone);if(!phone){toast("Aucun numéro de téléphone valide n'est enregistré.");return}window.open(`https://wa.me/${phone}?text=${encodeURIComponent(orderShareText(order))}`,'_blank','noopener')}return}
 const template=e.target.closest('#csv-template');if(template){downloadProductCSVTemplate();return}
 const csvRun=e.target.closest('#csv-run');if(csvRun){await runCSVImport();return}
 const tab=e.target.closest('[data-admin-tab]');if(tab){adminTab=tab.dataset.adminTab;renderAdminTab();return}
 const jump=e.target.closest('[data-jump-tab]');if(jump){adminTab=jump.dataset.jumpTab;renderAdminTab();return}
 if(e.target.closest("#checkout-close")||e.target.id==="checkout-backdrop")checkoutModal(false);
 const add=e.target.closest("[data-add]");if(add)addCart(add.dataset.add);
 const qty=e.target.closest("[data-qty]");if(qty){const l=cart.find(x=>x.id===qty.dataset.qty);if(l){l.qty+=Number(qty.dataset.delta);if(l.qty<=0)cart=cart.filter(x=>x.id!==l.id);saveCart()}}
 const rem=e.target.closest("[data-remove]");if(rem){cart=cart.filter(x=>x.id!==rem.dataset.remove);saveCart()}
 const edit=e.target.closest('[data-edit-product]');if(edit&&db&&isAdmin){const product=adminProducts.find(x=>String(x.id)===edit.dataset.editProduct);if(product){adminTab='products';renderAdminTab();$("#p-id").value=product.id;$("#p-name").value=product.name||'';$("#p-category").value=product.category_id||categories[0]?.id||"";$("#p-category").dispatchEvent(new Event("change"));$("#p-subcategory").value=product.subcategory_id||"";$("#p-price").value=product.price??'';$("#p-brand").value=product.brand||'';$("#p-sku").value=product.sku||'';$("#p-promo").value=product.promo_price??'';$("#p-image").value=product.image_url||'';$("#p-desc").value=product.description||'';$("#p-save").textContent='Enregistrer les modifications';$("#p-cancel-edit").hidden=false;$("#p-name").focus()}return}
 const del=e.target.closest("[data-delete]");if(del&&db&&isAdmin){if(confirm("Supprimer ce produit ?")){const {error}=await db.from("products").delete().eq("id",del.dataset.delete);if(error)toast(error.message);else{await loadProducts();await loadAdminData();adminTab="products";renderAdminTab();toast("Produit supprimé.")}}}
 const cat=e.target.closest("[data-category]");if(cat){$("#category-filter").value=cat.dataset.category;renderProducts();$("#boutique").scrollIntoView()}
});
$("#search").addEventListener("input",renderProducts);$("#category-filter").addEventListener("change",renderProducts);$("#sort").addEventListener("change",renderProducts);
$("#c-city")?.addEventListener("input",updateCheckoutPriceSummary);
$("#c-city")?.addEventListener("change",updateCheckoutPriceSummary);
$("#cart-open").onclick=()=>drawer(true);$("#account-open").onclick=async()=>{await refreshAuth();$("#account-modal").classList.add("open");$("#account-backdrop").classList.add("open");accountPanel()};$("#account-backdrop").onclick=()=>{$("#account-modal").classList.remove("open");$("#account-backdrop").classList.remove("open")};$("#account-close").onclick=()=>{$("#account-modal").classList.remove("open");$("#account-backdrop").classList.remove("open")};$("#drawer-backdrop").onclick=()=>drawer(false);document.querySelectorAll("[data-close]").forEach(x=>x.onclick=()=>drawer(false));
$("#checkout").onclick=startWebsiteOrder;$("#admin-open").onclick=()=>{modal(true);adminLogin()};$("#modal-backdrop").onclick=()=>modal(false);document.querySelectorAll("[data-modal-close]").forEach(x=>x.onclick=()=>modal(false));
$("#menu-toggle").onclick=()=>$("#main-nav").classList.toggle("show");document.querySelectorAll("#main-nav a").forEach(a=>a.onclick=()=>$("#main-nav").classList.remove("show"));
$("#year").textContent=new Date().getFullYear();loadProducts();renderCart();refreshAuth();if(db){loadPromoConfig().then(()=>{renderProducts();renderCart()});db.auth.onAuthStateChange(()=>refreshAuth())}
if(!configured())console.info("Mode aperçu local actif. Consultez README.md pour connecter Supabase.");
