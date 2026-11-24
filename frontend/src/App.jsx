import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck,
  ChevronDown, ChevronLeft, ChevronRight, Home,
  LogOut, MapPin, MessageCircle, Package, Plus, Search,
  ShieldCheck, ShoppingBag, Sparkles, Store, UserRound, X,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const TOKEN_KEY = "omnivente.access_token";
const CATEGORIES = ["Tout voir", "Mode", "Maison", "Beauté", "Artisanat", "Électronique"];
const CATEGORY_ARTWORK = {
  Mode: "photo-1515886657613-9f3515b0c78f",
  Maison: "photo-1490312278390-ab64016e0aa9",
  Beauté: "photo-1493106641515-6b5631de4bb9",
  Artisanat: "photo-1493106641515-6b5631de4bb9",
  "Électronique": "photo-1490312278390-ab64016e0aa9",
};
const EDITORIAL_IMAGES = {
  fashion: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1100&q=85",
  craft: "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=600&q=80",
  home: "https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=600&q=80",
};
const ORDER_LABELS = {
  pending: "À confirmer", confirmed: "Confirmée", preparing: "En préparation",
  shipped: "Expédiée", completed: "Terminée", cancelled: "Annulée",
};
const ORDER_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${path}`, { ...options, headers });
  if (!response.ok) {
    let message = `La requête a échoué (${response.status}).`;
    try {
      const body = await response.json();
      message = Array.isArray(body.detail) ? body.detail.map((item) => item.msg).join(" ") : body.detail || message;
    } catch { /* The server returned a non-JSON error. */ }
    throw new Error(message);
  }
  return response.status === 204 ? null : response.json();
}

const money = (value) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Number(value))} FCFA`;
const displayName = (person) => `${person.first_name} ${person.last_name}`;

function OmniMark({ small = false }) {
  return <span className={`brand-mark${small ? " small" : ""}`} aria-hidden="true">
    <span className="brand-letters"><i>O</i><b>V</b></span><span className="brand-plus">+</span>
  </span>;
}

function ProductArtwork({ product, large = false }) {
  const image = product.images?.[0];
  if (image?.url) {
    return <img className={`product-art${large ? " large" : ""}`} src={image.url} alt={image.alt_text || product.name} />;
  }
  const artworkId = CATEGORY_ARTWORK[product.category] || "photo-1515886657613-9f3515b0c78f";
  return (
    <div className={`product-art art-placeholder${large ? " large" : ""}`}>
      <img src={`https://images.unsplash.com/${artworkId}?auto=format&fit=crop&w=${large ? 1000 : 700}&q=80`} alt={`Photo d’inspiration pour la catégorie ${product.category}`} loading="lazy" />
      <span className="art-caption">Inspiration · {product.category || "Belle trouvaille"}</span>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tout voir");
  const [storeFilter, setStoreFilter] = useState("");
  const [view, setView] = useState("discover");
  const [mobilePage, setMobilePage] = useState("home");
  const [activeSection, setActiveSection] = useState("home");
  const [modal, setModal] = useState(null);
  const [product, setProduct] = useState(null);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3800);
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await request("/products"));
    } catch (error) {
      notify(error.message);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    request("/auth/me")
      .then(setUser)
      .catch(() => localStorage.removeItem(TOKEN_KEY));
  }, []);

  const visibleProducts = useMemo(() => products.filter((item) => {
    const matchesCategory = category === "Tout voir" || item.category.toLowerCase() === category.toLowerCase();
    const query = search.trim().toLowerCase();
    const matchesStore = !storeFilter || item.seller.name === storeFilter;
    return matchesCategory && matchesStore && (!query || `${item.name} ${item.description} ${item.category} ${item.seller.name}`.toLowerCase().includes(query));
  }), [category, products, search, storeFilter]);
  const stores = useMemo(() => {
    const byName = new Map();
    products.forEach((item) => {
      const entry = byName.get(item.seller.name) || { name: item.seller.name, count: 0, image: null };
      entry.count += 1;
      entry.image = entry.image || item.images?.find((image) => image.url)?.url || null;
      byName.set(item.seller.name, entry);
    });
    return Array.from(byName.values());
  }, [products]);

  function navigateTo(section) {
    setView("discover");
    setActiveSection(section);
    if (section === "home") {
      setMobilePage("home");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobilePage(section);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setMobilePage("home");
    window.setTimeout(() => document.getElementById(section)?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    setModal(null);
    setView("discover");
    setMobilePage("home");
    setActiveSection("home");
    notify("Vous êtes déconnecté·e.");
  }

  async function contactSeller(item) {
    if (!user) { setModal({ type: "auth", mode: "register" }); return; }
    try {
      const conversation = await request(`/products/${item.id}/conversations`, { method: "POST" });
      setProduct(item);
      setView("messages");
      setModal({ type: "messages", conversationId: conversation.id });
    } catch (error) {
      notify(error.message);
    }
  }

  function openOrders() {
    if (!user) { setModal({ type: "auth", mode: "login" }); return; }
    setView("orders");
  }

  return (
    <div className="app-shell" data-mobile-page={mobilePage}>
      <div className="announcement"><Sparkles size={14} /> Les belles trouvailles sont tout près <span>·</span> Le marché local de Lomé</div>
      <header className="site-header">
        <button className="brand" onClick={() => navigateTo("home")} aria-label="Retour à l’accueil">
          <OmniMark />
          <span>OmniVente<span className="brand-accent">+</span><small>LE MARCHÉ LOCAL</small></span>
        </button>
        <div className="header-search"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setView("discover"); }} placeholder="Que recherchez-vous ?" aria-label="Rechercher un produit ou une boutique" /></div>
        <nav className="main-nav" aria-label="Navigation principale">
          <button className={activeSection === "home" ? "selected" : ""} aria-current={activeSection === "home" ? "page" : undefined} onClick={() => navigateTo("home")}>Accueil</button>
          <button className={activeSection === "catalogue" ? "selected" : ""} aria-current={activeSection === "catalogue" ? "location" : undefined} onClick={() => navigateTo("catalogue")}>Produits</button>
          <button className={activeSection === "boutiques" ? "selected" : ""} aria-current={activeSection === "boutiques" ? "location" : undefined} onClick={() => navigateTo("boutiques")}>Boutiques</button>
        </nav>
        <nav className="header-actions">
          {user && <button className={`text-nav${view === "messages" ? " selected" : ""}`} onClick={() => { setView("messages"); setModal({ type: "messages" }); }}><MessageCircle size={17} /><span>Messages</span></button>}
          {user?.role === "seller" && <button className={`text-nav${view === "seller" ? " selected" : ""}`} onClick={() => setView("seller")}><Store size={17} /><span>Ma boutique</span></button>}
          {user?.role === "admin" && <button className="text-nav" onClick={() => setView("admin")}><ShieldCheck size={17} /><span>Administration</span></button>}
          {user && user.role !== "buyer" && <button className={`text-nav${view === "orders" ? " selected" : ""}`} onClick={openOrders}><ShoppingBag size={17} /><span>Commandes</span></button>}
          {user && user.role === "buyer" && <button className="icon-action" aria-label="Mes commandes" onClick={openOrders}><ShoppingBag size={19} /></button>}
          {user ? (
            <div className="account-wrap">
              <button className="account-button" onClick={() => setModal({ type: "account" })}><span className="avatar">{user.first_name?.slice(0, 1)}</span><span className="account-name">{user.first_name}</span><ChevronDown size={14} /></button>
            </div>
          ) : <button className="button button-dark sign-in" aria-label="Se connecter" onClick={() => setModal({ type: "auth", mode: "login" })}><UserRound size={16} /><span>Se connecter</span><ArrowUpRight size={16} /></button>}
        </nav>
      </header>

      {view === "discover" && (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow"><span className="eyebrow-dot" /> LE MARCHÉ LOCAL, RÉINVENTÉ</div>
              <h1>Les belles trouvailles<br /><em>sont tout près.</em></h1>
              <p>Mode, maison, beauté, artisanat… découvrez les boutiques de Lomé, échangez directement avec les vendeurs et payez à la livraison.</p>
              <div className="hero-actions"><button className="button button-dark" onClick={() => navigateTo("catalogue")}>Explorer les produits <ArrowRight size={17} /></button><button className="button button-light" onClick={() => user?.role === "seller" ? setView("seller") : setModal({ type: "auth", mode: "register", role: "seller" })}>Je suis vendeur·se <Plus size={16} /></button></div>
              <div className="hero-proof"><span className="hero-proof-icon"><MapPin size={17} /></span><div><strong>Le commerce local, à portée de clic.</strong><small>Découvrez, échangez, commandez en toute simplicité.</small></div></div>
            </div>
            <div className="hero-art" aria-label="Sélection de mode, artisanat et décoration proposés sur le marché local">
              <div className="hero-photo-main"><img src={EDITORIAL_IMAGES.fashion} alt="Sélection de mode" fetchpriority="high" /><span className="hero-photo-caption">LE STYLE D’ICI, À PORTÉE DE MAIN</span></div>
              <div className="hero-photo-stack">
                <div className="hero-photo-small"><img src={EDITORIAL_IMAGES.craft} alt="Objets et savoir-faire artisanal" loading="lazy" /><span>FAIT AVEC SOIN</span></div>
                <div className="hero-photo-small"><img src={EDITORIAL_IMAGES.home} alt="Décoration pour la maison" loading="lazy" /><span>LA MAISON, AUTREMENT</span></div>
              </div>
              <div className="hero-location"><span><MapPin size={15} /></span><div><b>Le meilleur du marché local</b><small>Lomé · Togo</small></div><ArrowUpRight size={17} /></div>
            </div>
          </section>

          <section className="benefits-strip" aria-label="Les avantages OmniVente+">
            <div><span className="benefit-number"><MapPin size={19} /></span><span><b>Des boutiques d’ici</b><small>Découvrez les vendeurs locaux</small></span></div>
            <div><span className="benefit-number"><MessageCircle size={19} /></span><span><b>Un vrai contact</b><small>Échangez directement avec eux</small></span></div>
            <div><span className="benefit-number"><ShoppingBag size={19} /></span><span><b>Payez à la réception</b><small>Le paiement, à la livraison</small></span></div>
          </section>

          <section className="catalog-section" id="catalogue">
            <div className="section-heading"><div><div className="eyebrow">LE MARCHÉ EN LIGNE</div><h2>Les produits <span>à découvrir</span></h2></div><div className="catalog-count">{visibleProducts.length.toString().padStart(2, "0")} produits <ArrowDownRight size={16} /></div></div>
            <label className="mobile-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); setStoreFilter(""); }} placeholder="Un produit, une boutique…" aria-label="Rechercher" /></label>
            {storeFilter && <div className="active-store-filter">Boutique : <strong>{storeFilter}</strong><button onClick={() => setStoreFilter("")}>Tout voir <X size={13} /></button></div>}
            <div className="category-row">{CATEGORIES.map((item) => <button key={item} className={`category-pill${category === item ? " active" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div>
            {loading ? <div className="empty-state"><span className="loader" />On prépare les belles choses…</div> : visibleProducts.length ? (
              <div className="product-grid">{visibleProducts.map((item, index) => <ProductCard key={item.id} product={item} index={index} onClick={() => { setProduct(item); setModal({ type: "product" }); }} onOrder={() => { if (!user) { setModal({ type: "auth", mode: "register" }); return; } setModal({ type: "order", product: item }); }} onContact={() => contactSeller(item)} />)}</div>
            ) : <div className="empty-state empty-card"><span className="empty-icon"><Package size={22} /></span><h3>Les étagères se remplissent.</h3><p>Il n’y a pas encore de produit dans cette catégorie. Revenez bientôt découvrir les prochaines pépites.</p>{user?.role === "seller" && <button className="button button-dark" onClick={() => setView("seller")}>Ajouter un produit <Plus size={16} /></button>}</div>}
          </section>

          <section className="stores-section" id="boutiques">
            <div className="section-heading"><div><div className="eyebrow">LES GENS DERRIÈRE LES PRODUITS</div><h2>Nos <span>boutiques</span></h2></div><button className="text-button" onClick={() => user?.role === "seller" ? setView("seller") : setModal({ type: "auth", mode: "register", role: "seller" })}>{user?.role === "seller" ? "Mon espace vendeur" : "Ouvrir ma boutique"} <ArrowRight size={15} /></button></div>
            {stores.length ? <div className="store-grid">{stores.slice(0, 6).map((shop) => <button className="store-card" key={shop.name} onClick={() => { setCategory("Tout voir"); setStoreFilter(shop.name); navigateTo("catalogue"); }}>
              <span className="store-cover">{shop.image ? <img src={shop.image} alt="" /> : <span className="store-cover-pattern" />}<span className="store-cover-mark">OV<span>+</span></span></span>
              <span className="store-card-info"><span className="store-avatar">{shop.name.slice(0, 1).toUpperCase()}</span><span className="store-card-name"><b>{shop.name}</b><small>{shop.count} produit{shop.count > 1 ? "s" : ""} en vitrine</small></span><ArrowUpRight size={17} /></span>
            </button>)}</div> : <div className="stores-empty"><Store size={22} /><span><b>Les boutiques se préparent.</b><small>Les vendeurs locaux seront bientôt à découvrir ici.</small></span></div>}
          </section>

          <section className="seller-banner"><div className="seller-banner-icon"><Store size={22} /></div><div><span className="eyebrow">VOUS AVEZ QUELQUE CHOSE À PARTAGER ?</span><h2>Votre boutique mérite<br />d’être découverte.</h2><p>Créez votre espace, racontez vos produits, échangez avec vos clients.</p><button className="button button-dark" onClick={() => user?.role === "seller" ? setView("seller") : setModal({ type: "auth", mode: "register", role: "seller" })}>Ouvrir mon espace vendeur <ArrowRight size={16} /></button></div><span className="banner-sparkle sparkle-one">✳</span><span className="banner-sparkle sparkle-two">✳</span></section>
        </main>
      )}

      {view === "seller" && user?.role === "seller" && <SellerDashboard user={user} onProductCreated={loadProducts} notify={notify} />}
      {view === "orders" && user && <OrdersView user={user} notify={notify} />}
      {view === "messages" && user && <MessagesView user={user} onClose={() => setView("discover")} initialConversationId={modal?.conversationId} />}
      {view === "admin" && user?.role === "admin" && <AdminDashboard notify={notify} />}

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-about"><span className="footer-brand"><OmniMark small /> OmniVente<span className="brand-accent">+</span></span><p>Le marché local, plus accessible. Découvrez des produits et boutiques près de vous.</p></div>
          <div className="footer-links"><b>Découvrir</b><button onClick={() => setView("discover")}>Accueil</button><button onClick={() => navigateTo("catalogue")}>Produits</button><button onClick={() => navigateTo("boutiques")}>Boutiques</button></div>
          <div className="footer-links"><b>Vendre</b><button onClick={() => user?.role === "seller" ? setView("seller") : setModal({ type: "auth", mode: "register", role: "seller" })}>Créer ma boutique</button><span>Paiement à la livraison</span></div>
        </div>
        <div className="footer-bottom"><span>© OmniVente+ · Lomé, Togo</span><span>Le commerce local, sous un autre angle.</span></div>
      </footer>

      {modal?.type === "auth" && <AuthModal mode={modal.mode} role={modal.role} onClose={() => setModal(null)} onAuth={(account) => { localStorage.setItem(TOKEN_KEY, account.access_token); setUser(account.user); setModal(null); setView(account.user.role === "seller" ? "seller" : account.user.role === "admin" ? "admin" : "discover"); setMobilePage("home"); setActiveSection("home"); notify(`Bienvenue, ${account.user.first_name} !`); }} />}
      {modal?.type === "product" && product && <ProductModal product={product} user={user} onClose={() => setModal(null)} onContact={() => contactSeller(product)} onOrder={() => { if (!user) { setModal({ type: "auth", mode: "register" }); return; } setModal({ type: "order", product }); }} />}
      {modal?.type === "order" && <OrderModal product={modal.product} user={user} onClose={() => setModal(null)} onSuccess={(reference) => { setModal(null); setView("orders"); notify(`Commande ${reference} envoyée au vendeur.`); }} />}
      {modal?.type === "account" && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setModal(null)}><div className="account-menu"><button className="modal-close" onClick={() => setModal(null)} aria-label="Fermer"><X size={18} /></button><span className="avatar large-avatar">{user?.first_name?.slice(0, 1)}</span><h3>{user && displayName(user)}</h3><p>{user?.email}</p><span className="account-role">{user?.role === "seller" ? "Vendeur·se" : user?.role === "admin" ? "Administration" : "Client·e"}</span>{user?.role === "buyer" && <button className="menu-link" onClick={() => { setModal(null); openOrders(); }}><ShoppingBag size={16} />Mes commandes</button>}{user?.role === "seller" && <button className="menu-link" onClick={() => { setModal(null); setView("seller"); }}><Store size={16} />Ma boutique</button>}<button className="menu-link danger-link" onClick={signOut}><LogOut size={16} />Se déconnecter</button></div></div>}
      <nav className="mobile-nav" aria-label="Navigation mobile">
        <button className={view === "discover" && mobilePage === "home" ? "active" : ""} aria-current={view === "discover" && mobilePage === "home" ? "page" : undefined} onClick={() => navigateTo("home")}><Home size={19} /><span>Accueil</span></button>
        <button className={view === "discover" && mobilePage === "catalogue" ? "active" : ""} aria-current={view === "discover" && mobilePage === "catalogue" ? "page" : undefined} onClick={() => navigateTo("catalogue")}><Package size={19} /><span>Produits</span></button>
        <button className="mobile-nav-plus" aria-label="Mes commandes" onClick={openOrders}><Plus size={23} /></button>
        <button className={view === "discover" && mobilePage === "boutiques" ? "active" : ""} aria-current={view === "discover" && mobilePage === "boutiques" ? "page" : undefined} onClick={() => navigateTo("boutiques")}><Store size={19} /><span>Boutiques</span></button>
        <button onClick={() => user ? setModal({ type: "account" }) : setModal({ type: "auth", mode: "login" })}><UserRound size={19} /><span>Profil</span></button>
      </nav>
      {toast && <div className="toast"><BadgeCheck size={17} />{toast}</div>}
    </div>
  );
}

function ProductCard({ product, index, onClick, onOrder, onContact }) {
  return <article className="product-card" style={{ "--card-delay": `${index * 55}ms` }}>
    <button className="card-image" onClick={onClick} aria-label={`Voir ${product.name}`}>
      <ProductArtwork product={product} /><span className="card-tag">{product.category}</span><span className="card-arrow"><ArrowUpRight size={17} /></span>
    </button>
    <div className="card-info"><div><button className="product-title" onClick={onClick}>{product.name}</button><p>par {product.seller.name}</p></div><strong>{money(product.price)}</strong></div>
    <div className="card-foot"><span><span className="stock-dot" />Disponible</span><span>En stock : {product.stock}</span></div>
    <div className="product-card-actions"><button className="button button-dark" onClick={onOrder}>Commander</button><button className="button button-light" onClick={onContact}><MessageCircle size={14} />Contacter</button></div>
  </article>;
}

function AuthModal({ mode: initialMode, role: initialRole, onClose, onAuth }) {
  const [mode, setMode] = useState(initialMode || "login");
  const [role, setRole] = useState(initialRole || "buyer");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const result = await request(`/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        body: JSON.stringify(mode === "login" ? payload : { ...payload, role }),
      });
      onAuth(result);
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="auth-modal"><button className="modal-close" onClick={onClose} aria-label="Fermer"><X size={19} /></button><div className="auth-brand"><OmniMark /><span>OmniVente<span className="brand-accent">+</span><small>LE MARCHÉ LOCAL</small></span></div>
      <span className="eyebrow">{mode === "login" ? "RAVI·E DE VOUS REVOIR" : "BIENVENUE DANS LE MARCHÉ"}</span>
      <h2>{mode === "login" ? "On reprend ?" : role === "seller" ? "Votre boutique commence ici." : "Faisons connaissance."}</h2>
      <p>{mode === "login" ? "Connectez-vous pour retrouver vos échanges et commandes." : "Un compte, et vous voilà tout près des vendeurs."}</p>
      {mode === "register" && <div className="role-switch"><button type="button" className={role === "buyer" ? "active" : ""} onClick={() => setRole("buyer")}><ShoppingBag size={15} />Je découvre</button><button type="button" className={role === "seller" ? "active" : ""} onClick={() => setRole("seller")}><Store size={15} />Je vends</button></div>}
      <form className="form-stack" onSubmit={submit}>
        {mode === "register" && <div className="form-split"><label>Prénom<input name="first_name" required autoComplete="given-name" maxLength="80" /></label><label>Nom<input name="last_name" required autoComplete="family-name" maxLength="80" /></label></div>}
        <label>Adresse e-mail<input name="email" type="email" required autoComplete="email" /></label>
        <label>Mot de passe<input name="password" type="password" required minLength={mode === "register" ? 10 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />{mode === "register" && <small>10 caractères minimum</small>}</label>
        {mode === "register" && <label>Téléphone <span className="optional">facultatif</span><input name="phone" type="tel" autoComplete="tel" /></label>}
        {error && <div className="form-error">{error}</div>}
        <button className="button button-dark full-button" disabled={busy}>{busy ? "Un instant…" : mode === "login" ? "Me connecter" : "Créer mon compte"}<ArrowRight size={16} /></button>
      </form>
      <div className="auth-switch">{mode === "login" ? "Pas encore de compte ?" : "Vous avez déjà un compte ?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Créer un compte" : "Se connecter"}</button></div>
      <small className="auth-privacy">En continuant, vos informations servent uniquement à vos commandes et échanges.</small>
    </section>
  </div>;
}

function ProductModal({ product, user, onClose, onContact, onOrder }) {
  const [imageIndex, setImageIndex] = useState(0);
  const images = product.images?.filter((image) => image.url) || [];
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="product-modal"><button className="modal-close" onClick={onClose} aria-label="Fermer"><X size={19} /></button>
      <div className="product-modal-art">
        {images.length ? <img src={images[imageIndex].url} alt={images[imageIndex].alt_text || product.name} /> : <ProductArtwork product={product} large />}
        {images.length > 1 && <div className="image-controls"><button onClick={() => setImageIndex((imageIndex + images.length - 1) % images.length)} aria-label="Photo précédente"><ChevronLeft size={17} /></button><span>{imageIndex + 1} / {images.length}</span><button onClick={() => setImageIndex((imageIndex + 1) % images.length)} aria-label="Photo suivante"><ChevronRight size={17} /></button></div>}
      </div>
      <div className="product-modal-info"><span className="eyebrow">{product.category} <span>·</span> BELLE TROUVAILLE</span><h2>{product.name}</h2><strong className="product-price">{money(product.price)}</strong><p className="product-description">{product.description}</p><div className="seller-profile"><span className="seller-avatar">{product.seller.name.slice(0, 1)}</span><span><small>IMAGINÉ PAR</small><b>{product.seller.name}</b></span><BadgeCheck size={17} /></div>
        <div className="product-stock"><span className="stock-dot" />{product.stock} disponible{product.stock > 1 ? "s" : ""}</div>
        <button className="button button-dark full-button" onClick={onOrder}><ShoppingBag size={17} />Commander</button>
        <button className="button button-light full-button" onClick={onContact}><MessageCircle size={17} />Écrire au vendeur</button>
        <small className="payment-note">Vous échangez directement avec le vendeur. Le paiement se fait auprès de lui.</small>
      </div>
    </section>
  </div>;
}

function OrderModal({ product, user, onClose, onSuccess }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [position, setPosition] = useState(null);
  const [locationError, setLocationError] = useState("");
  function sharePosition() {
    setLocationError("");
    if (!navigator.geolocation) {
      setLocationError("La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setPosition({
        latitude: Number(coords.latitude.toFixed(6)),
        longitude: Number(coords.longitude.toFixed(6)),
      }),
      () => setLocationError("Position non partagée. Vous pouvez saisir votre adresse manuellement."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const order = await request("/orders", { method: "POST", body: JSON.stringify({
        product_id: product.id, quantity: Number(form.get("quantity")),
        first_name: form.get("first_name"), last_name: form.get("last_name"),
        phone: form.get("phone"), delivery_address: form.get("delivery_address"), city: form.get("city"),
        latitude: position?.latitude ?? null, longitude: position?.longitude ?? null,
      }) });
      onSuccess(order.reference);
    } catch (cause) { setError(cause.message); } finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="order-modal"><button className="modal-close" onClick={onClose} aria-label="Fermer"><X size={19} /></button><span className="eyebrow">UNE BELLE TROUVAILLE POUR VOUS</span><h2>On vous la met de côté ?</h2><p className="order-product">{product.name}<strong>{money(product.price)}</strong></p><form className="form-stack" onSubmit={submit}><div className="form-split"><label>Prénom<input name="first_name" defaultValue={user?.first_name || ""} required maxLength="80" /></label><label>Nom<input name="last_name" defaultValue={user?.last_name || ""} required maxLength="80" /></label></div><label>Téléphone<input name="phone" defaultValue={user?.phone || ""} required minLength="5" maxLength="40" type="tel" /></label><label>Adresse de livraison<input name="delivery_address" defaultValue={user?.address || ""} required minLength="5" maxLength="240" /></label><label>Ville<input name="city" defaultValue={user?.city || "Lomé"} required minLength="2" maxLength="100" /></label><div className="location-share"><button type="button" className="button button-light" onClick={sharePosition}><MapPin size={15} />{position ? "Position ajoutée" : "Partager ma position GPS"}</button>{position && <small>{position.latitude}, {position.longitude}</small>}{locationError && <small className="location-error">{locationError}</small>}</div><label>Quantité<input name="quantity" type="number" min="1" max={product.stock} defaultValue="1" required /></label>{error && <div className="form-error">{error}</div>}<button className="button button-dark full-button" disabled={busy}>{busy ? "Envoi de la commande…" : "Envoyer ma commande"}<ArrowRight size={16} /></button></form><small className="auth-privacy">Le vendeur recevra vos coordonnées pour organiser la livraison. Aucun paiement en ligne n’est effectué.</small></section></div>;
}

function SellerDashboard({ user, onProductCreated, notify }) {
  const [products, setProducts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => request("/seller/products").then(setProducts).catch((cause) => setError(cause.message)), []);
  useEffect(() => { load(); }, [load]);

  async function uploadImage(productId, file) {
    const prepared = await request(`/seller/products/${productId}/images`, {
      method: "POST", body: JSON.stringify({
        content_type: file.type,
        alt_text: file.name.replace(/\.[^.]+$/, "").slice(0, 160),
      }),
    });
    const response = await fetch(prepared.upload_url, {
      method: "PUT", headers: { "Content-Type": file.type }, body: file,
    });
    if (!response.ok) throw new Error("L’envoi de la photo au stockage cloud a échoué.");
    await request(`/seller/images/${prepared.image_id}/complete`, { method: "POST" });
  }

  async function submitProduct(event) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const files = Array.from(form.getAll("images")).filter((file) => file instanceof File && file.size > 0);
    if (files.length > 8) { setError("Choisissez au maximum 8 photos."); setBusy(false); return; }
    if (files.some((file) => file.size > 10 * 1024 * 1024)) {
      setError("Chaque photo doit peser moins de 10 Mo."); setBusy(false); return;
    }
    if (files.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("Formats acceptés : JPG, PNG ou WEBP."); setBusy(false); return;
    }
    const payload = {
      name: form.get("name"), description: form.get("description"),
      category: form.get("category"), price: Number(form.get("price")),
      stock: Number(form.get("stock")),
    };
    try {
      const created = await request("/seller/products", { method: "POST", body: JSON.stringify(payload) });
      for (const file of files) await uploadImage(created.id, file);
      const shouldPublish = form.get("publish") === "on";
      if (shouldPublish && files.length === 0) throw new Error("Ajoutez au moins une photo avant de publier votre produit.");
      const updated = await request(`/seller/products/${created.id}`, {
        method: "PUT", body: JSON.stringify({ ...payload, status: shouldPublish ? "published" : "draft" }),
      });
      await load();
      onProductCreated();
      setNotice(updated.status === "published" ? "Votre produit est en ligne !" : "Produit enregistré dans vos brouillons.");
      setShowForm(false);
      formElement.reset();
    } catch (cause) {
      setError(cause.message);
      await load();
    } finally { setBusy(false); }
  }

  return <main className="workspace">
    <div className="workspace-heading"><div><div className="eyebrow">VOTRE COIN À VOUS</div><h1>Bonjour, {user.first_name}<span className="heading-period">.</span></h1><p>Chaque belle boutique commence par une première trouvaille.</p></div><button className="button button-dark" onClick={() => { setShowForm(!showForm); setError(""); setNotice(""); }}><Plus size={17} />Ajouter un produit</button></div>
    <div className="workspace-stats"><div><span>Produits en boutique</span><strong>{products.length}</strong></div><div><span>En ligne</span><strong>{products.filter((item) => item.status === "published").length}</strong></div><div><span>Prêt à recevoir du monde</span><strong className="stat-live"><span className="stock-dot" />Oui</strong></div></div>
    {showForm && <section className="panel product-form-panel"><div className="panel-title"><div><span className="eyebrow">NOUVELLE TROUVAILLE</span><h2>Ajoutez votre produit</h2></div><button className="icon-action" onClick={() => setShowForm(false)} aria-label="Fermer"><X size={18} /></button></div><form className="seller-form" onSubmit={submitProduct}><label>Nom du produit<input name="name" required minLength="2" maxLength="160" placeholder="Ex. Sac tissé à la main" /></label><label>Catégorie<select name="category" required defaultValue=""><option value="" disabled>Choisir une catégorie</option>{CATEGORIES.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>Description<textarea name="description" rows="3" required maxLength="5000" placeholder="Racontez ce qui rend ce produit spécial…" /></label><div className="form-split"><label>Prix (FCFA)<input name="price" type="number" min="1" step="1" required placeholder="15000" /></label><label>Quantité disponible<input name="stock" type="number" min="0" max="100000" required defaultValue="1" /></label></div><label className="upload-field"><span className="upload-symbol"><Plus size={20} /></span><span><b>Ajouter des photos</b><small>JPG, PNG ou WEBP · jusqu’à 8 angles · 10 Mo max par image</small></span><input name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => { const files = Array.from(event.target.files || []); if (files.some((file) => file.size > 10 * 1024 * 1024)) setError("Chaque photo doit peser moins de 10 Mo."); }} /></label><label className="publish-option"><input name="publish" type="checkbox" defaultChecked /><span><b>Publier dès maintenant</b><small>Une photo est requise pour mettre un produit en ligne.</small></span></label>{error && <div className="form-error">{error}</div>}<div className="form-actions"><button type="button" className="button button-light" onClick={() => setShowForm(false)}>Annuler</button><button className="button button-dark" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer le produit"}<ArrowRight size={16} /></button></div></form></section>}
    {notice && <div className="success-banner"><BadgeCheck size={17} />{notice}<button onClick={() => setNotice("")}><X size={15} /></button></div>}
    {error && !showForm && <div className="form-error">{error}</div>}
    <section className="panel seller-list"><div className="panel-title"><div><span className="eyebrow">VOTRE SÉLECTION</span><h2>Vos produits <span className="muted-count">{products.length}</span></h2></div><button className="text-button" onClick={() => setShowForm(true)}>Ajouter une trouvaille <Plus size={15} /></button></div>
      {products.length ? <div className="seller-products">{products.map((item) => <div className="seller-product" key={item.id}><div className="seller-product-image"><ProductArtwork product={item} /></div><div className="seller-product-name"><b>{item.name}</b><span>{item.category} · Stock : {item.stock}</span></div><strong>{money(item.price)}</strong><span className={`status-pill ${item.status}`}>{item.status === "published" ? "En ligne" : "Brouillon"}</span><button className="small-arrow" onClick={async () => { try { const next = item.status === "published" ? "draft" : "published"; await request(`/seller/products/${item.id}`, { method: "PUT", body: JSON.stringify({ name: item.name, description: item.description, category: item.category, price: item.price, stock: item.stock, status: next }) }); await load(); onProductCreated(); } catch (cause) { notify(cause.message); } }} aria-label={item.status === "published" ? "Mettre en brouillon" : "Publier"}><ArrowUpRight size={16} /></button></div>)}</div> : <div className="empty-state seller-empty"><span className="empty-icon"><Package size={23} /></span><h3>Le premier produit vous attend.</h3><p>Ajoutez quelques photos, racontez son histoire, puis partagez-le avec vos futurs clients.</p><button className="button button-dark" onClick={() => setShowForm(true)}>Ajouter mon premier produit <Plus size={15} /></button></div>}
    </section>
  </main>;
}

function OrdersView({ user, notify }) {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const sellerView = user.role !== "buyer";
  const load = useCallback(() => request("/orders").then(setOrders).catch((cause) => setError(cause.message)), []);
  useEffect(() => { load(); }, [load]);

  async function changeStatus(order, nextStatus) {
    setBusy(order.id);
    setError("");
    try {
      await request(`/seller/orders/${order.id}`, {
        method: "PATCH", body: JSON.stringify({ status: nextStatus }),
      });
      await load();
      notify(`Commande ${order.reference} : ${ORDER_LABELS[nextStatus].toLowerCase()}.`);
    } catch (cause) { setError(cause.message); } finally { setBusy(null); }
  }

  return <main className="workspace"><div className="workspace-heading"><div><div className="eyebrow">{sellerView ? "SUIVI DE VOTRE ACTIVITÉ" : "VOS PETITES AFFAIRES"}</div><h1>{sellerView ? "Commandes reçues" : "Mes commandes"}<span className="heading-period">.</span></h1><p>{sellerView ? "Gardez chaque client au courant, de la confirmation à la livraison." : "Tout ce qui se passe entre vous et les belles trouvailles."}</p></div></div>{error && <div className="form-error">{error}</div>}<section className="panel seller-list"><div className="panel-title"><div><span className="eyebrow">{sellerView ? "À VOUS DE JOUER" : "VOTRE HISTORIQUE"}</span><h2>Commandes <span className="muted-count">{orders.length}</span></h2></div></div>{orders.length ?   <div className="seller-products">{orders.map((order) => <div className="seller-product order-row" key={order.id}><div className="order-mark"><ShoppingBag size={18} /></div><div className="seller-product-name"><b>{order.product_name} · {money(order.total)}</b><span>{order.reference} · Qté {order.quantity} · {new Date(order.created_at).toLocaleDateString("fr-FR")}{sellerView ? ` · ${order.buyer} · ${order.phone} · ${order.delivery_address}, ${order.city}${order.latitude != null && order.longitude != null ? ` · GPS ${order.latitude}, ${order.longitude}` : ""}` : ""}</span></div>{sellerView ? <select className="order-status-select" value={order.status} disabled={busy === order.id || ORDER_TRANSITIONS[order.status].length === 0} onChange={(event) => changeStatus(order, event.target.value)} aria-label={`Statut de la commande ${order.reference}`}><option value={order.status}>{ORDER_LABELS[order.status]}</option>{ORDER_TRANSITIONS[order.status].map((step) => <option value={step} key={step}>{ORDER_LABELS[step]}</option>)}</select> : <span className={`status-pill ${order.status}`}>{ORDER_LABELS[order.status] || order.status}</span>}</div>)}</div> : !error && <div className="empty-state seller-empty"><span className="empty-icon"><ShoppingBag size={23} /></span><h3>{sellerView ? "Votre première commande approche." : "Votre prochaine trouvaille vous attend."}</h3><p>{sellerView ? "Dès qu’un client commande un de vos produits, vous pourrez suivre son avancée ici." : "Vos commandes apparaîtront ici. Pour le moment, aucun paiement n’est prélevé en ligne."}</p></div>}</section></main>;
}

function MessagesView({ user, initialConversationId, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(initialConversationId || null);
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const loadConversations = useCallback(() => request("/conversations").then((items) => {
    setConversations(items);
    if (initialConversationId) setActive(initialConversationId);
    else if (!active && items.length) setActive(items[0].id);
  }).catch((cause) => setError(cause.message)), [active, initialConversationId]);
  const loadMessages = useCallback(() => active ? request(`/conversations/${active}/messages`).then(setMessages).catch((cause) => setError(cause.message)) : setMessages([]), [active]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    loadMessages();
    if (!active) return undefined;
    const timer = window.setInterval(loadMessages, 5000);
    return () => window.clearInterval(timer);
  }, [active, loadMessages]);

  async function send(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = String(form.get("body") || "").trim();
    if (!body || !active) return;
    setSending(true); setError("");
    try {
      await request(`/conversations/${active}/messages`, { method: "POST", body: JSON.stringify({ body }) });
      formElement.reset();
      await loadMessages();
    } catch (cause) { setError(cause.message); } finally { setSending(false); }
  }
  const selected = conversations.find((item) => item.id === active);

  return <main className="workspace messages-workspace"><div className="workspace-heading"><div><div className="eyebrow">ON SE PARLE</div><h1>Les conversations<span className="heading-period">.</span></h1><p>Une question, un détail, un joli projet ? On est là.</p></div><button className="button button-light back-button" onClick={onClose}><ArrowLeft size={16} />Retour au marché</button></div><section className="message-panel"><aside className="conversation-list"><div className="conversation-list-head">Vos échanges <span>{conversations.length}</span></div>{conversations.map((item) => <button key={item.id} className={`conversation-item${active === item.id ? " active" : ""}`} onClick={() => setActive(item.id)}><span className="conversation-avatar"><MessageCircle size={17} /></span><span><b>{user.role === "seller" ? item.buyer_name : item.seller_name}</b><small>À propos de {item.product_name}</small></span><ChevronRight size={15} /></button>)}{!conversations.length && <div className="conversation-empty">Vos conversations avec les vendeurs s’afficheront ici.</div>}</aside><div className="chat-window">{selected ? <><div className="chat-head"><span className="conversation-avatar"><MessageCircle size={17} /></span><span><b>{user.role === "seller" ? selected.buyer_name : selected.seller_name}</b><small>{selected.product_name}</small></span><span className="chat-secure"><ShieldCheck size={15} />Échange privé</span></div><div className="chat-messages">{messages.map((item) => <div className={`chat-bubble${item.sender_id === user.id ? " mine" : ""}`} key={item.id}><p>{item.body}</p><small>{new Date(item.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</small></div>)}{!messages.length && <div className="chat-welcome"><span><MessageCircle size={20} /></span><b>La conversation commence ici.</b><small>Posez votre question sur ce produit, le vendeur vous répondra.</small></div>}</div><form className="chat-compose" onSubmit={send}><input name="body" maxLength="4000" required placeholder="Écrivez votre message…" /><button className="button button-dark" disabled={sending} aria-label="Envoyer"><ArrowRight size={18} /></button></form></> : <div className="chat-welcome"><span><MessageCircle size={20} /></span><b>Choisissez une conversation</b><small>Vos messages sont réservés aux personnes concernées par la commande.</small></div>}</div>{error && <div className="form-error message-error">{error}</div>}</section></main>;
}

function AdminDashboard({ notify }) {
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [overview, allProducts, allUsers] = await Promise.all([
        request("/admin/overview"), request("/admin/products"), request("/admin/users"),
      ]);
      setSummary(overview); setProducts(allProducts); setUsers(allUsers);
    } catch (cause) { setError(cause.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function changeStatus(item) {
    const status = item.status === "published" ? "draft" : "published";
    try {
      await request(`/admin/products/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
      notify(`Annonce ${status === "published" ? "publiée" : "mise en brouillon"}.`);
    } catch (cause) { notify(cause.message); }
  }
  async function changeRole(account) {
    const role = account.role === "seller" ? "buyer" : "seller";
    try {
      await request(`/admin/users/${account.id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      await load();
      notify("Rôle du compte mis à jour.");
    } catch (cause) { notify(cause.message); }
  }
  return <main className="workspace"><div className="workspace-heading"><div><div className="eyebrow">ESPACE PRIVÉ · OMNIVENTE</div><h1>Le marché, côté coulisses<span className="heading-period">.</span></h1><p>Une vue d’ensemble pour garder le marché vivant et accueillant.</p></div><span className="admin-badge"><ShieldCheck size={16} />Administrateur</span></div>{error && <div className="form-error">{error}</div>}<div className="admin-stats">{[["Comptes", summary?.users ?? "—"], ["Vendeurs", summary?.sellers ?? "—"], ["Produits", summary?.products ?? "—"], ["Commandes", summary?.orders ?? "—"]].map(([label, count]) => <div className="admin-stat" key={label}><span>{label}</span><b>{count}</b></div>)}</div><section className="panel seller-list"><div className="panel-title"><div><span className="eyebrow">QUALITÉ DU CATALOGUE</span><h2>Annonces <span className="muted-count">{products.length}</span></h2></div></div><div className="seller-products">{products.map((item) => <div className="seller-product" key={item.id}><div className="seller-product-image"><ProductArtwork product={item} /></div><div className="seller-product-name"><b>{item.name}</b><span>{item.seller.name} · {item.category}</span></div><strong>{money(item.price)}</strong><span className={`status-pill ${item.status}`}>{item.status === "published" ? "En ligne" : "Brouillon"}</span><button className="small-arrow" onClick={() => changeStatus(item)} aria-label="Changer le statut"><ArrowUpRight size={16} /></button></div>)}</div></section><section className="panel seller-list admin-users"><div className="panel-title"><div><span className="eyebrow">LA COMMUNAUTÉ</span><h2>Comptes <span className="muted-count">{users.length}</span></h2></div></div><div className="seller-products">{users.map((account) => <div className="seller-product" key={account.id}><span className="seller-avatar">{account.first_name.slice(0, 1)}</span><div className="seller-product-name"><b>{displayName(account)}</b><span>{account.email}</span></div><span className="status-pill">{account.role === "seller" ? "Vendeur" : account.role === "admin" ? "Admin" : "Client"}</span>{account.role !== "admin" && <button className="role-action" onClick={() => changeRole(account)}>{account.role === "seller" ? "Rendre client" : "Promouvoir vendeur"}</button>}</div>)}</div></section></main>;
}

export default App;
