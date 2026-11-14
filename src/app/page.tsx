"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search, ShoppingBag, User, Sun, Moon, LogOut, ShieldCheck, Package,
  Truck, Headphones, SlidersHorizontal, Download, Printer, Plus, Trash2,
  CheckCircle2, AlertTriangle, Sparkles, Upload, Eye, EyeOff, ArrowRight
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { INITIAL_PRODUCTS, Product } from "@/data/fallbackCatalog";
import { formatCLP, formatRut, validateRut } from "@/lib/rut";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { downloadOrderReceiptPDF, ReceiptOrder } from "@/lib/pdfReceipt";

type Role = "cliente" | "admin" | "bodega" | "despacho" | "soporte";

interface UserSession {
  id: string;
  email: string;
  full_name: string;
  rut: string;
  role: Role;
  address?: string;
  commune?: string;
  region?: string;
}

interface CartItem {
  product: Product;
  size: string;
  color: string;
  quantity: number;
}

const DEMO_ACCOUNTS: Array<{ email: string; password: string; role: Role; label: string; name: string; rut: string }> = [
  { email: "clienta@urbano.cl", password: "Password123", role: "cliente", label: "Clienta Compradora", name: "Camila Valdés", rut: "19.452.831-4" },
  { email: "admin@urbano.cl", password: "Password123", role: "admin", label: "Dueño / Administrador", name: "Valentina Rojas", rut: "15.890.234-K" },
  { email: "bodega@urbano.cl", password: "Password123", role: "bodega", label: "Encargado de Bodega", name: "Matías Soto", rut: "18.234.567-8" },
  { email: "despacho@urbano.cl", password: "Password123", role: "despacho", label: "Despachador / Reparto", name: "Diego Muñoz", rut: "17.654.321-2" },
  { email: "soporte@urbano.cl", password: "Password123", role: "soporte", label: "Soporte y Postventa", name: "Sofía Herrera", rut: "20.112.334-5" },
];

export default function TiendasUrbanoApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [view, setView] = useState<"home" | "catalog" | "offers" | "product" | "checkout" | "auth" | "dashboard" | "accessibility" | "info">("home");
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [session, setSession] = useState<UserSession | null>(null);
  const [orders, setOrders] = useState<ReceiptOrder[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  // Filtros catálogo
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [sizeFilter, setSizeFilter] = useState("Todas");
  const [sortBy, setSortBy] = useState("featured");

  // Accesibilidad independiente (WCAG 2.0 / SENADIS)
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [textOnly, setTextOnly] = useState(false);

  // Auth form
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [rutInput, setRutInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Checkout
  const [shipAddress, setShipAddress] = useState("Av. Providencia 2145, Depto 804");
  const [shipCommune, setShipCommune] = useState("Providencia");
  const [shipRegion, setShipRegion] = useState("Metropolitana");
  const [shipPhone, setShipPhone] = useState("+56 9 8765 4321");
  const [processingPay, setProcessingPay] = useState(false);

  // Admin: nuevo producto + subida real a Supabase Storage
  const [newProdName, setNewProdName] = useState("");
  const [newProdSku, setNewProdSku] = useState("");
  const [newProdCat, setNewProdCat] = useState("Blazers");
  const [newProdPrice, setNewProdPrice] = useState("39990");
  const [newProdImageUrl, setNewProdImageUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Cargar preferencias persistentes y datos desde Supabase si está configurado
  useEffect(() => {
    const savedTheme = localStorage.getItem("tu_dark_mode");
    if (savedTheme === "true") {
      setDarkMode(true);
      document.documentElement.classList.add("dark");
    }
    const savedCart = localStorage.getItem("tu_cart");
    if (savedCart) {
      try { setCart(JSON.parse(savedCart)); } catch {}
    }
    const savedOrders = localStorage.getItem("tu_demo_orders");
    if (savedOrders) {
      try { setOrders(JSON.parse(savedOrders)); } catch {}
    } else {
      // Pedido inicial de demostración para probar Bodega, Despacho y Soporte desde el primer segundo
      const seedOrder: ReceiptOrder = {
        id: "URB-2026-001",
        created_at: new Date().toISOString(),
        customer_name: "Camila Valdés",
        customer_rut: "19.452.831-4",
        customer_email: "clienta@urbano.cl",
        customer_phone: "+56 9 8765 4321",
        shipping_address: "Av. Providencia 2145, Depto 804",
        commune: "Providencia",
        region: "Metropolitana",
        status: "Pagado",
        payment_method: "Webpay Plus (Integración)",
        items: [{ sku: "URB-BLZ-001", name: "Blazer Estructurado Hongdae Noir", size: "M", color: "Burgundy Oscuro", quantity: 1, price: 44990 }],
        subtotal: 44990,
        shipping_cost: 3990,
        total: 48980,
      };
      setOrders([seedOrder]);
      localStorage.setItem("tu_demo_orders", JSON.stringify([seedOrder]));
    }

    if (isSupabaseConfigured && supabase) {
      supabase.from("products").select("*").eq("is_published", true).then(({ data }) => {
        if (data && data.length > 0) setProducts(data as Product[]);
      });
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("tu_cart", JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-scale", String(fontScale));
    document.documentElement.classList.toggle("high-contrast", highContrast);
    document.documentElement.classList.toggle("text-only", textOnly);
  }, [fontScale, highContrast, textOnly]);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("tu_dark_mode", String(next));
  };

  const categories = useMemo(() => ["Todas", ...Array.from(new Set(products.map((p) => p.category)))], [products]);

  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => (view === "offers" ? p.discount_percent > 0 : true))
      .filter((p) => categoryFilter === "Todas" || p.category === categoryFilter)
      .filter((p) => sizeFilter === "Todas" || p.sizes.includes(sizeFilter))
      .filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => {
        if (sortBy === "price-asc") return a.price - b.price;
        if (sortBy === "price-desc") return b.price - a.price;
        return Number(b.is_featured) - Number(a.is_featured);
      });
  }, [products, view, categoryFilter, sizeFilter, searchQuery, sortBy]);

  const addToCart = (product: Product, size: string, color: string) => {
    const available = product.stock_by_size[size] ?? 0;
    if (available <= 0) {
      notify("Sin stock disponible para la talla seleccionada.");
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id && i.size === size && i.color === color);
      if (idx > -1) {
        if (prev[idx].quantity + 1 > available) {
          notify(`Stock máximo alcanzado (${available} unidades en bodega).`);
          return prev;
        }
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, { product, size, color, quantity: 1 }];
    });
    notify(`Agregado: ${product.name} (${size})`);
    setCartOpen(true);
  };

  const cartSubtotal = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  const shippingCost = cartSubtotal === 0 ? 0 : shipRegion === "Metropolitana" ? 3990 : 6990;

  const handleLogin = async (email: string, password: string) => {
    setAuthError("");
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data.user) {
        const { data: profile } = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
        if (profile) {
          setSession(profile as UserSession);
          setView(profile.role === "cliente" ? "home" : "dashboard");
          notify(`Sesión iniciada como ${profile.full_name}`);
          return;
        }
      }
    }
    // Autenticación de cuentas demo preconfiguradas
    const demo = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password);
    if (!demo) {
      setAuthError("Credenciales inválidas. Usa una cuenta de demostración o verifica tu correo/clave.");
      return;
    }
    setSession({
      id: `demo-${demo.role}`,
      email: demo.email,
      full_name: demo.name,
      rut: demo.rut,
      role: demo.role,
    });
    setView(demo.role === "cliente" ? "home" : "dashboard");
    notify(`Bienvenido/a ${demo.name} — Rol: ${demo.role.toUpperCase()}`);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    if (!validateRut(rutInput)) {
      setAuthError("El RUT ingresado no es válido (verifique dígito verificador).");
      return;
    }
    if (passwordInput.length < 8 || !/[a-zA-Z]/.test(passwordInput) || !/[0-9]/.test(passwordInput)) {
      setAuthError("La contraseña debe tener al menos 8 caracteres, incluyendo letras y números.");
      return;
    }
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: emailInput,
        password: passwordInput,
        options: { data: { full_name: nameInput, rut: formatRut(rutInput), role: "cliente" } },
      });
      if (error) {
        setAuthError(error.message);
        return;
      }
      if (data.user) {
        await supabase.from("profiles").insert({
          id: data.user.id,
          email: emailInput,
          full_name: nameInput,
          rut: formatRut(rutInput),
          role: "cliente",
        });
      }
    }
    setSession({
      id: `cli-${Date.now()}`,
      email: emailInput,
      full_name: nameInput,
      rut: formatRut(rutInput),
      role: "cliente",
    });
    notify("Cuenta de clienta creada exitosamente.");
    setView("home");
  };

  const handleWebpayCheckout = async () => {
    if (!session) {
      notify("Debes iniciar sesión como clienta para finalizar la compra.");
      setView("auth");
      return;
    }
    setProcessingPay(true);
    const orderId = `URB-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
    const total = cartSubtotal + shippingCost;

    try {
      // Llamada real al endpoint backend de Transbank Webpay Plus
      const res = await fetch("/api/webpay/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyOrder: orderId, sessionId: session.id, amount: total }),
      });
      const data = await res.json();

      const newOrder: ReceiptOrder = {
        id: orderId,
        created_at: new Date().toISOString(),
        customer_name: session.full_name,
        customer_rut: session.rut,
        customer_email: session.email,
        customer_phone: shipPhone,
        shipping_address: shipAddress,
        commune: shipCommune,
        region: shipRegion,
        status: "Pagado",
        payment_method: data?.token ? "Webpay Plus (Transbank SDK)" : "Webpay Plus (Entorno Demo)",
        webpay_buy_order: orderId,
        items: cart.map((c) => ({
          sku: c.product.sku,
          name: c.product.name,
          size: c.size,
          color: c.color,
          quantity: c.quantity,
          price: c.product.price,
        })),
        subtotal: cartSubtotal,
        shipping_cost: shippingCost,
        total,
      };

      // Descontar stock real
      setProducts((prev) =>
        prev.map((p) => {
          const orderedItems = cart.filter((c) => c.product.id === p.id);
          if (orderedItems.length === 0) return p;
          const updatedStock = { ...p.stock_by_size };
          orderedItems.forEach((oi) => {
            updatedStock[oi.size] = Math.max(0, (updatedStock[oi.size] || 0) - oi.quantity);
          });
          return { ...p, stock_by_size: updatedStock };
        })
      );

      const updatedOrders = [newOrder, ...orders];
      setOrders(updatedOrders);
      localStorage.setItem("tu_demo_orders", JSON.stringify(updatedOrders));
      setCart([]);
      setProcessingPay(false);
      notify(`Pago aprobado para orden ${orderId}. Stock descontado y comprobante disponible.`);
      setView("dashboard");
    } catch {
      setProcessingPay(false);
      notify("Error procesando el checkout.");
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    if (isSupabaseConfigured && supabase) {
      const filePath = `products/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("product-images").upload(filePath, file);
      if (!error) {
        const { data } = supabase.storage.from("product-images").getPublicUrl(filePath);
        setNewProdImageUrl(data.publicUrl);
        setUploadingImg(false);
        notify("Imagen subida online a Supabase Storage.");
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = () => {
      setNewProdImageUrl(String(reader.result));
      setUploadingImg(false);
      notify("Imagen cargada en vista previa local.");
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdSku) return;
    const created: Product = {
      id: String(Date.now()),
      sku: newProdSku.toUpperCase(),
      name: newProdName,
      description: "Prenda femenina importada colección Neo-Seoul Noir.",
      category: newProdCat,
      price: Number(newProdPrice) || 34990,
      original_price: null,
      discount_percent: 0,
      sizes: ["XS", "S", "M", "L"],
      colors: ["Charcoal Off-Black", "Burgundy Oscuro"],
      stock_by_size: { XS: 4, S: 6, M: 6, L: 3 },
      images: [newProdImageUrl || "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=80"],
      is_published: true,
      is_featured: true,
      is_new: true,
    };
    setProducts([created, ...products]);
    if (isSupabaseConfigured && supabase) {
      await supabase.from("products").insert(created);
    }
    setNewProdName("");
    setNewProdSku("");
    notify("Producto publicado en el catálogo.");
  };

  const updateOrderStatus = (orderId: string, nextStatus: ReceiptOrder["status"]) => {
    const updated = orders.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o));
    setOrders(updated);
    localStorage.setItem("tu_demo_orders", JSON.stringify(updated));
    notify(`Pedido ${orderId} actualizado a: ${nextStatus}`);
  };

  const exportCatalogCSV = () => {
    const header = "SKU,Nombre,Categoria,Precio_CLP,Descuento
";
    const rows = filteredProducts.map((p) => `${p.sku},"${p.name}",${p.category},${p.price},${p.discount_percent}%`).join("
");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Catalogo_Tiendas_Urbano.csv";
    a.click();
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Barra superior de anuncios */}
      <div className="bg-burgundy text-ivory text-xs py-2 px-4 text-center tracking-widest uppercase font-medium">
        NEO-SEOUL NOIR DROP 2026 • DESPACHO A TODO CHILE • PAGO SEGURO CON WEBPAY PLUS
      </div>

      {/* Header Opaco Sólido (Ivory en claro / Burgundy en oscuro) */}
      <header className="sticky top-0 z-40 bg-ivory dark:bg-burgundy border-b border-charcoal/15 dark:border-ivory/15 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-4">
          <button onClick={() => setView("home")} className="text-left">
            <BrandLogo />
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold uppercase tracking-wider">
            <button onClick={() => setView("home")} className="hover:text-crimson dark:hover:text-dusty-rose">Inicio</button>
            <button onClick={() => { setCategoryFilter("Todas"); setView("catalog"); }} className="hover:text-crimson dark:hover:text-dusty-rose">Catálogo (24)</button>
            <button onClick={() => setView("offers")} className="text-crimson dark:text-dusty-rose font-bold">Ofertas</button>
            <button onClick={() => setView("info")} className="hover:text-crimson dark:hover:text-dusty-rose">Tienda & Políticas</button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleDarkMode}
              aria-label="Cambiar modo claro u oscuro"
              className="p-2.5 rounded-full border border-charcoal/20 dark:border-ivory/20 hover:bg-dusty-rose/20"
            >
              {darkMode ? <Sun className="w-4 h-4 text-ivory" /> : <Moon className="w-4 h-4 text-burgundy" />}
            </button>

            <button
              onClick={() => setView(session ? "dashboard" : "auth")}
              className="flex items-center gap-2 px-3 py-2 rounded text-xs font-bold uppercase tracking-wider bg-burgundy text-ivory dark:bg-ivory dark:text-burgundy"
            >
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">{session ? `${session.role.toUpperCase()}` : "Ingresar / Roles"}</span>
            </button>

            <button
              onClick={() => setCartOpen(true)}
              aria-label="Abrir carrito"
              className="relative p-2.5 rounded border border-charcoal/20 dark:border-ivory/20 hover:bg-dusty-rose/20"
            >
              <ShoppingBag className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-crimson text-ivory text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Notificación flotante */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-burgundy text-ivory border border-dusty-rose px-4 py-3 rounded shadow-xl text-sm font-medium">
          {toast}
        </div>
      )}

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1">
        {view === "home" && (
          <div>
            {/* Hero Editorial Neo-Seoul Noir */}
            <section className="bg-burgundy text-ivory">
              <div className="max-w-7xl mx-auto px-4 py-14 md:py-20 grid md:grid-cols-12 gap-8 items-center">
                <div className="md:col-span-6 space-y-6">
                  <span className="inline-block bg-crimson text-ivory text-xs font-bold px-3 py-1 uppercase tracking-widest">
                    COLECCIÓN OTOÑO / INVIERNO SEÚL
                  </span>
                  <h1 className="font-display text-5xl md:text-7xl font-bold uppercase leading-[0.95] tracking-tight">
                    NOCTURNAL <span className="text-dusty-rose">EDITORIAL</span> STREETWEAR
                  </h1>
                  <p className="text-ivory/85 text-base md:text-lg max-w-xl">
                    Moda femenina importada con carácter underground, cortes estructurados Y2K y sastrería contemporánea. Compra directa con stock real en bodega y pago seguro Webpay Plus.
                  </p>
                  <div className="flex flex-wrap gap-4 pt-2">
                    <button
                      onClick={() => setView("catalog")}
                      className="bg-ivory text-burgundy font-display uppercase tracking-wider px-7 py-3.5 text-base font-bold hover:bg-dusty-rose hover:text-charcoal transition"
                    >
                      Explorar Catálogo
                    </button>
                    <button
                      onClick={() => setView("offers")}
                      className="bg-crimson text-ivory font-display uppercase tracking-wider px-7 py-3.5 text-base font-bold hover:opacity-90 transition"
                    >
                      Ver Ofertas Activas
                    </button>
                  </div>
                </div>
                <div className="md:col-span-6">
                  <img
                    src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1100&q=85"
                    alt="Editorial Moda Femenina Seoul Streetwear"
                    className="w-full h-[460px] object-cover rounded border-2 border-dusty-rose/40 shadow-2xl"
                  />
                </div>
              </div>
            </section>

            {/* Acceso rápido a 5 Roles de Demostración para el Profesor */}
            <section className="max-w-7xl mx-auto px-4 py-10">
              <div className="p-6 rounded border border-burgundy/25 dark:border-dusty-rose/30 bg-burgundy/5 dark:bg-burgundy/40">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="font-display text-2xl uppercase font-bold">Acceso Directo — 5 Roles Operativos (Demo Evaluación)</h2>
                    <p className="text-sm opacity-80">Haz clic en cualquier rol para iniciar sesión automáticamente y probar la separación real de vistas y permisos.</p>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-burgundy text-ivory">RBAC ACTIVO</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.role}
                      onClick={() => handleLogin(acc.email, acc.password)}
                      className="text-left p-3.5 rounded bg-ivory dark:bg-charcoal border border-charcoal/15 dark:border-ivory/15 hover:border-crimson transition"
                    >
                      <div className="text-xs font-bold uppercase text-crimson dark:text-dusty-rose">{acc.label}</div>
                      <div className="font-semibold text-sm mt-1">{acc.name}</div>
                      <div className="text-[11px] opacity-70 mt-0.5">{acc.email}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Productos Destacados */}
            <section className="max-w-7xl mx-auto px-4 py-10">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-crimson dark:text-dusty-rose">Selección Curada</span>
                  <h2 className="font-display text-4xl uppercase font-bold">Prendas Protagonistas</h2>
                </div>
                <button onClick={() => setView("catalog")} className="text-sm font-bold uppercase underline">
                  Ver las {products.length} prendas →
                </button>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.slice(0, 8).map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    onOpen={() => {
                      setSelectedProduct(prod);
                      setSelectedSize(prod.sizes[0]);
                      setSelectedColor(prod.colors[0]);
                      setView("product");
                    }}
                    onQuickAdd={() => addToCart(prod, prod.sizes[0], prod.colors[0])}
                  />
                ))}
              </div>
            </section>
          </div>
        )}

        {(view === "catalog" || view === "offers") && (
          <section className="max-w-7xl mx-auto px-4 py-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="font-display text-4xl uppercase font-bold">
                  {view === "offers" ? "Ofertas & Promociones Vigentes" : "Catálogo Completo Femenino"}
                </h1>
                <p className="text-sm opacity-75">Mostrando {filteredProducts.length} prendas con stock real sincronizado en bodega.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={exportCatalogCSV} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase border rounded">
                  <Download className="w-3.5 h-3.5" /> Descargar CSV
                </button>
                <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold uppercase border rounded">
                  <Printer className="w-3.5 h-3.5" /> Imprimir
                </button>
              </div>
            </div>

            {/* Buscador y Filtros Reales */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8 p-4 rounded bg-burgundy/5 dark:bg-burgundy/30 border border-charcoal/10 dark:border-ivory/10">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 opacity-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre o SKU..."
                  className="w-full pl-9 pr-3 py-2 rounded text-sm bg-ivory dark:bg-charcoal border border-charcoal/20 dark:border-ivory/20"
                />
              </div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded text-sm bg-ivory dark:bg-charcoal border border-charcoal/20 dark:border-ivory/20">
                {categories.map((c) => <option key={c} value={c}>Categoría: {c}</option>)}
              </select>
              <select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} className="px-3 py-2 rounded text-sm bg-ivory dark:bg-charcoal border border-charcoal/20 dark:border-ivory/20">
                {["Todas", "XS", "S", "M", "L", "XL", "Única"].map((s) => <option key={s} value={s}>Talla: {s}</option>)}
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="px-3 py-2 rounded text-sm bg-ivory dark:bg-charcoal border border-charcoal/20 dark:border-ivory/20">
                <option value="featured">Orden: Destacados</option>
                <option value="price-asc">Precio: Menor a Mayor</option>
                <option value="price-desc">Precio: Mayor a Menor</option>
              </select>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onOpen={() => {
                    setSelectedProduct(prod);
                    setSelectedSize(prod.sizes[0]);
                    setSelectedColor(prod.colors[0]);
                    setView("product");
                  }}
                  onQuickAdd={() => addToCart(prod, prod.sizes[0], prod.colors[0])}
                />
              ))}
            </div>
          </section>
        )}

        {view === "product" && selectedProduct && (
          <section className="max-w-6xl mx-auto px-4 py-10">
            <button onClick={() => setView("catalog")} className="text-xs font-bold uppercase underline mb-6">
              ← Volver al catálogo
            </button>
            <div className="grid md:grid-cols-2 gap-10">
              <img src={selectedProduct.images[0]} alt={selectedProduct.name} className="w-full h-[520px] object-cover rounded border border-charcoal/15" />
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase px-2 py-0.5 bg-burgundy text-ivory">{selectedProduct.sku}</span>
                  <span className="text-xs uppercase opacity-70">{selectedProduct.category}</span>
                </div>
                <h1 className="font-display text-4xl uppercase font-bold">{selectedProduct.name}</h1>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-burgundy dark:text-dusty-rose">{formatCLP(selectedProduct.price)}</span>
                  {selectedProduct.original_price && (
                    <span className="text-lg line-through opacity-50">{formatCLP(selectedProduct.original_price)}</span>
                  )}
                </div>
                <p className="text-sm leading-relaxed opacity-85">{selectedProduct.description}</p>

                <div>
                  <label className="block text-xs font-bold uppercase mb-2">Talla disponible (Stock en tiempo real)</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.sizes.map((sz) => {
                      const st = selectedProduct.stock_by_size[sz] ?? 0;
                      return (
                        <button
                          key={sz}
                          disabled={st <= 0}
                          onClick={() => setSelectedSize(sz)}
                          className={`px-4 py-2 rounded border text-sm font-bold ${
                            selectedSize === sz ? "bg-burgundy text-ivory border-burgundy" : "border-charcoal/25 dark:border-ivory/25"
                          } ${st <= 0 ? "opacity-35 cursor-not-allowed line-through" : ""}`}
                        >
                          {sz} ({st} un.)
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase mb-2">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.colors.map((col) => (
                      <button
                        key={col}
                        onClick={() => setSelectedColor(col)}
                        className={`px-3 py-1.5 rounded border text-xs font-semibold ${
                          selectedColor === col ? "bg-dusty-rose text-charcoal border-dusty-rose" : "border-charcoal/25 dark:border-ivory/25"
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => addToCart(selectedProduct, selectedSize, selectedColor)}
                  className="w-full py-4 bg-crimson text-ivory font-display text-lg uppercase tracking-wider font-bold rounded hover:opacity-90"
                >
                  Agregar al Carrito
                </button>
              </div>
            </div>
          </section>
        )}

        {view === "checkout" && (
          <section className="max-w-4xl mx-auto px-4 py-10">
            <h1 className="font-display text-4xl uppercase font-bold mb-6">Checkout & Pago Webpay Plus</h1>
            <div className="grid md:grid-cols-12 gap-8">
              <div className="md:col-span-7 space-y-4">
                <h2 className="font-display text-xl uppercase font-bold">Dirección de Despacho</h2>
                <input value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} placeholder="Calle y número" className="w-full p-3 rounded border bg-transparent" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={shipCommune} onChange={(e) => setShipCommune(e.target.value)} placeholder="Comuna" className="p-3 rounded border bg-transparent" />
                  <select value={shipRegion} onChange={(e) => setShipRegion(e.target.value)} className="p-3 rounded border bg-ivory dark:bg-charcoal">
                    <option value="Metropolitana">Región Metropolitana ($3.990)</option>
                    <option value="Valparaíso">Región de Valparaíso ($6.990)</option>
                    <option value="Biobío">Región del Biobío ($6.990)</option>
                    <option value="Otra Región">Otras Regiones ($6.990)</option>
                  </select>
                </div>
                <input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} placeholder="Teléfono contacto" className="w-full p-3 rounded border bg-transparent" />
              </div>

              <div className="md:col-span-5 p-6 rounded bg-burgundy text-ivory space-y-4">
                <h2 className="font-display text-2xl uppercase font-bold">Resumen de Orden</h2>
                {cart.map((c, i) => (
                  <div key={i} className="flex justify-between text-xs border-b border-ivory/15 pb-2">
                    <span>{c.quantity}x {c.product.name} ({c.size})</span>
                    <span>{formatCLP(c.product.price * c.quantity)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatCLP(cartSubtotal)}</span></div>
                <div className="flex justify-between text-sm"><span>Despacho</span><span>{formatCLP(shippingCost)}</span></div>
                <div className="flex justify-between text-xl font-bold border-t border-ivory/25 pt-3">
                  <span>Total CLP</span><span>{formatCLP(cartSubtotal + shippingCost)}</span>
                </div>
                <button
                  disabled={processingPay || cart.length === 0}
                  onClick={handleWebpayCheckout}
                  className="w-full py-3.5 bg-crimson text-ivory font-display uppercase tracking-wider font-bold rounded hover:opacity-90 disabled:opacity-50"
                >
                  {processingPay ? "Conectando con Transbank..." : "Pagar con Webpay Plus"}
                </button>
              </div>
            </div>
          </section>
        )}

        {view === "auth" && (
          <section className="max-w-md mx-auto px-4 py-12">
            <div className="p-6 rounded border border-charcoal/20 dark:border-ivory/20 bg-ivory dark:bg-burgundy/30 space-y-4">
              <div className="flex gap-2 border-b pb-3">
                <button onClick={() => setAuthMode("login")} className={`flex-1 py-2 font-display uppercase font-bold ${authMode === "login" ? "bg-burgundy text-ivory" : ""}`}>Iniciar Sesión</button>
                <button onClick={() => setAuthMode("register")} className={`flex-1 py-2 font-display uppercase font-bold ${authMode === "register" ? "bg-burgundy text-ivory" : ""}`}>Registro Clienta</button>
              </div>

              {authError && <div className="p-3 rounded bg-crimson/15 text-crimson text-xs font-semibold">{authError}</div>}

              {authMode === "login" ? (
                <form onSubmit={(e) => { e.preventDefault(); handleLogin(emailInput, passwordInput); }} className="space-y-3">
                  <input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="Correo electrónico" className="w-full p-3 rounded border bg-transparent" />
                  <div className="relative">
                    <input type={showPass ? "text" : "password"} required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Contraseña" className="w-full p-3 rounded border bg-transparent" />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-3.5 opacity-60">
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button type="submit" className="w-full py-3 bg-burgundy text-ivory font-display uppercase font-bold">Ingresar</button>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="space-y-3">
                  <input required value={nameInput} onChange={(e) => setNameInput(e.target.value)} placeholder="Nombre completo" className="w-full p-3 rounded border bg-transparent" />
                  <input required value={rutInput} onChange={(e) => setRutInput(formatRut(e.target.value))} placeholder="RUT (ej: 19.452.831-4)" className="w-full p-3 rounded border bg-transparent" />
                  <input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder="Correo electrónico" className="w-full p-3 rounded border bg-transparent" />
                  <input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Contraseña (mín. 8 caracteres, letras y números)" className="w-full p-3 rounded border bg-transparent" />
                  <button type="submit" className="w-full py-3 bg-crimson text-ivory font-display uppercase font-bold">Crear Cuenta Clienta</button>
                </form>
              )}
            </div>
          </section>
        )}

        {view === "dashboard" && session && (
          <section className="max-w-7xl mx-auto px-4 py-10 space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
              <div>
                <span className="text-xs font-bold uppercase px-2.5 py-1 bg-crimson text-ivory rounded">ROL: {session.role.toUpperCase()}</span>
                <h1 className="font-display text-3xl uppercase font-bold mt-2">Panel Operativo — {session.full_name}</h1>
              </div>
              <button onClick={() => { setSession(null); setView("home"); notify("Sesión cerrada."); }} className="inline-flex items-center gap-2 px-4 py-2 rounded border text-xs font-bold uppercase">
                <LogOut className="w-4 h-4" /> Cerrar Sesión
              </button>
            </div>

            {/* PANEL EXCLUSIVO CLIENTA */}
            {session.role === "cliente" && (
              <div className="space-y-4">
                <h2 className="font-display text-2xl uppercase font-bold">Mis Compras y Seguimiento en Tiempo Real</h2>
                {orders.filter((o) => o.customer_email === session.email).map((ord) => (
                  <div key={ord.id} className="p-5 rounded border flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="font-bold text-lg">{ord.id} — <span className="text-crimson dark:text-dusty-rose">{ord.status}</span></div>
                      <div className="text-xs opacity-75">{ord.shipping_address}, {ord.commune} • Total: {formatCLP(ord.total)}</div>
                    </div>
                    <button onClick={() => downloadOrderReceiptPDF(ord)} className="inline-flex items-center gap-2 px-4 py-2 bg-burgundy text-ivory text-xs font-bold uppercase rounded h-fit">
                      <Download className="w-4 h-4" /> Descargar Comprobante PDF
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* PANEL EXCLUSIVO ADMINISTRADOR / DUEÑO */}
            {session.role === "admin" && (
              <div className="grid lg:grid-cols-12 gap-8">
                <div className="lg:col-span-5 p-6 rounded border space-y-4">
                  <h2 className="font-display text-2xl uppercase font-bold">Publicar Nueva Prenda + Foto Online</h2>
                  <form onSubmit={handleCreateProduct} className="space-y-3">
                    <input required value={newProdSku} onChange={(e) => setNewProdSku(e.target.value)} placeholder="SKU (ej: URB-BLZ-025)" className="w-full p-2.5 rounded border bg-transparent text-sm" />
                    <input required value={newProdName} onChange={(e) => setNewProdName(e.target.value)} placeholder="Nombre de la prenda" className="w-full p-2.5 rounded border bg-transparent text-sm" />
                    <select value={newProdCat} onChange={(e) => setNewProdCat(e.target.value)} className="w-full p-2.5 rounded border bg-ivory dark:bg-charcoal text-sm">
                      {["Blazers", "Poleras y tops", "Blusas", "Pantalones", "Jeans", "Faldas", "Vestidos", "Chaquetas", "Parkas", "Accesorios"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <input type="number" required value={newProdPrice} onChange={(e) => setNewProdPrice(e.target.value)} placeholder="Precio CLP" className="w-full p-2.5 rounded border bg-transparent text-sm" />
                    <label className="block p-3 border border-dashed rounded text-xs cursor-pointer text-center">
                      <Upload className="w-4 h-4 mx-auto mb-1" />
                      {uploadingImg ? "Subiendo imagen a la nube..." : "Seleccionar fotografía desde computador"}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                    <button type="submit" className="w-full py-3 bg-burgundy text-ivory font-display uppercase font-bold">Guardar en Catálogo</button>
                  </form>
                </div>

                <div className="lg:col-span-7 space-y-4">
                  <h2 className="font-display text-2xl uppercase font-bold">Supervisión General de Pedidos ({orders.length})</h2>
                  {orders.map((ord) => (
                    <div key={ord.id} className="p-4 rounded border flex flex-wrap justify-between items-center gap-3">
                      <div>
                        <div className="font-bold">{ord.id} — {ord.customer_name}</div>
                        <div className="text-xs opacity-75">Total: {formatCLP(ord.total)} • Estado: <strong>{ord.status}</strong></div>
                      </div>
                      <button onClick={() => downloadOrderReceiptPDF(ord)} className="px-3 py-1.5 bg-crimson text-ivory text-xs font-bold uppercase rounded">PDF</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PANEL EXCLUSIVO BODEGA */}
            {session.role === "bodega" && (
              <div className="space-y-4">
                <h2 className="font-display text-2xl uppercase font-bold">Módulo de Bodega — Preparación de Pedidos (Sin acceso financiero)</h2>
                {orders.map((ord) => (
                  <div key={ord.id} className="p-5 rounded border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="font-bold text-lg">{ord.id} — Estado: {ord.status}</div>
                      <ul className="text-xs mt-1 space-y-1">
                        {ord.items.map((it, idx) => (
                          <li key={idx}>• [{it.sku}] {it.name} — Talla: <strong>{it.size}</strong> — Cant: <strong>{it.quantity}</strong></li>
                        ))}
                      </ul>
                    </div>
                    {ord.status === "Pagado" && (
                      <button onClick={() => updateOrderStatus(ord.id, "Listo para despacho")} className="px-4 py-2 bg-burgundy text-ivory text-xs font-bold uppercase rounded">
                        Confirmar Picking y Pasar a Despacho
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* PANEL EXCLUSIVO DESPACHO */}
            {session.role === "despacho" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-display text-2xl uppercase font-bold">Hoja de Ruta Diaria — Despacho</h2>
                  <button onClick={() => window.print()} className="px-3 py-2 border text-xs font-bold uppercase rounded">Imprimir Hoja de Ruta</button>
                </div>
                {orders.map((ord) => (
                  <div key={ord.id} className="p-5 rounded border flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="font-bold">{ord.id} — Destinataria: {ord.customer_name}</div>
                      <div className="text-xs opacity-80">Dirección: {ord.shipping_address}, {ord.commune}, {ord.region} • Tel: {ord.customer_phone}</div>
                      <div className="text-xs font-bold mt-1 text-crimson dark:text-dusty-rose">Estado actual: {ord.status}</div>
                    </div>
                    <div className="flex gap-2 h-fit">
                      <button onClick={() => updateOrderStatus(ord.id, "En despacho")} className="px-3 py-2 border text-xs font-bold uppercase rounded">En Ruta</button>
                      <button onClick={() => updateOrderStatus(ord.id, "Entregado")} className="px-3 py-2 bg-burgundy text-ivory text-xs font-bold uppercase rounded">Marcar Entregado</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* PANEL EXCLUSIVO SOPORTE */}
            {session.role === "soporte" && (
              <div className="space-y-4">
                <h2 className="font-display text-2xl uppercase font-bold">Atención Postventa & Seguimiento de Casos</h2>
                <p className="text-sm opacity-80">Consulta el estado de órdenes para responder consultas de clientas sobre cambios, devoluciones o seguimiento.</p>
                {orders.map((ord) => (
                  <div key={ord.id} className="p-4 rounded border">
                    <div className="font-bold">{ord.id} — {ord.customer_name} ({ord.customer_email})</div>
                    <div className="text-xs opacity-75">Estado logístico: {ord.status} • Comuna: {ord.commune}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {view === "accessibility" && (
          <section className="max-w-2xl mx-auto px-4 py-12 space-y-6">
            <h1 className="font-display text-4xl uppercase font-bold">Preferencias de Accesibilidad (WCAG 2.0 / SENADIS)</h1>
            <p className="text-sm opacity-80">Ajusta la visualización de Tiendas Urbano según tus necesidades. Tus preferencias se guardan automáticamente.</p>
            <div className="space-y-4 p-6 rounded border">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Tamaño de tipografía ({Math.round(fontScale * 100)}%)</span>
                <div className="flex gap-2">
                  <button onClick={() => setFontScale(Math.max(0.9, +(fontScale - 0.1).toFixed(1)))} className="px-3 py-1.5 border rounded font-bold">A-</button>
                  <button onClick={() => setFontScale(Math.min(1.3, +(fontScale + 0.1).toFixed(1)))} className="px-3 py-1.5 border rounded font-bold">A+</button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Modo Alto Contraste</span>
                <input type="checkbox" checked={highContrast} onChange={(e) => setHighContrast(e.target.checked)} className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Modo Solo Texto (Ocultar imágenes decorativas)</span>
                <input type="checkbox" checked={textOnly} onChange={(e) => setTextOnly(e.target.checked)} className="w-5 h-5" />
              </div>
              <button onClick={() => { setFontScale(1); setHighContrast(false); setTextOnly(false); }} className="px-4 py-2 bg-burgundy text-ivory text-xs font-bold uppercase rounded">
                Restablecer Valores por Defecto
              </button>
            </div>
          </section>
        )}

        {view === "info" && (
          <section className="max-w-4xl mx-auto px-4 py-12 space-y-6">
            <h1 className="font-display text-4xl uppercase font-bold">Información Institucional, Despachos y Cambios</h1>
            <div className="grid md:grid-cols-2 gap-6 text-sm leading-relaxed">
              <div className="p-5 rounded border space-y-2">
                <h2 className="font-display text-xl uppercase font-bold">Política de Despachos</h2>
                <p>Despachamos desde nuestra bodega central en Santiago a todas las regiones de Chile. Región Metropolitana: 24 a 48 hrs hábiles ($3.990). Regiones: 2 a 5 días hábiles ($6.990).</p>
              </div>
              <div className="p-5 rounded border space-y-2">
                <h2 className="font-display text-xl uppercase font-bold">Cambios y Devoluciones</h2>
                <p>Tienes 30 días desde la recepción de tu prenda para solicitar cambio de talla o devolución presentando tu comprobante de compra.</p>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Drawer Carrito */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end">
          <div className="w-full max-w-md bg-ivory dark:bg-charcoal h-full p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="font-display text-2xl uppercase font-bold">Tu Bolsa Urbana</h2>
                <button onClick={() => setCartOpen(false)} className="text-sm font-bold uppercase">Cerrar ✕</button>
              </div>
              <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {cart.length === 0 && <p className="text-sm opacity-70 py-10 text-center">Tu carrito está vacío.</p>}
                {cart.map((item, idx) => (
                  <div key={idx} className="flex gap-3 border-b pb-3">
                    <img src={item.product.images[0]} alt={item.product.name} className="w-16 h-20 object-cover rounded" />
                    <div className="flex-1 text-xs">
                      <div className="font-bold">{item.product.name}</div>
                      <div className="opacity-75">Talla: {item.size} • {item.color}</div>
                      <div className="font-bold mt-1">{formatCLP(item.product.price)} x {item.quantity}</div>
                    </div>
                    <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} className="text-crimson">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {cart.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between font-bold text-lg">
                  <span>Subtotal</span>
                  <span>{formatCLP(cartSubtotal)}</span>
                </div>
                <button
                  onClick={() => { setCartOpen(false); setView("checkout"); }}
                  className="w-full py-3.5 bg-burgundy text-ivory font-display uppercase tracking-wider font-bold rounded"
                >
                  Continuar al Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Completo con Acceso Discreto a Accesibilidad */}
      <footer className="bg-burgundy text-ivory border-t border-ivory/15 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div className="space-y-3">
            <BrandLogo variant="light" />
            <p className="text-ivory/75 text-xs">Moda femenina importada con estética Neo-Seoul Noir. Compra segura y transparente.</p>
          </div>
          <div>
            <h3 className="font-display uppercase font-bold tracking-wider mb-3">Colecciones</h3>
            <ul className="space-y-1.5 text-xs text-ivory/80">
              <li><button onClick={() => setView("catalog")}>Catálogo Completo</button></li>
              <li><button onClick={() => setView("offers")}>Ofertas Activas</button></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display uppercase font-bold tracking-wider mb-3">Atención & Legal</h3>
            <ul className="space-y-1.5 text-xs text-ivory/80">
              <li><button onClick={() => setView("info")}>Políticas de Cambio y Despacho</button></li>
              <li><button onClick={() => setView("accessibility")} className="underline text-dusty-rose">Opciones de Accesibilidad (WCAG 2.0)</button></li>
            </ul>
          </div>
          <div>
            <h3 className="font-display uppercase font-bold tracking-wider mb-3">Estado del Backend</h3>
            <p className="text-xs text-ivory/75">
              {isSupabaseConfigured ? "Conectado a Supabase PostgreSQL Online" : "Modo Respaldo Activo (Listo para conectar claves Supabase en .env)"}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ProductCard({ product, onOpen, onQuickAdd }: { product: Product; onOpen: () => void; onQuickAdd: () => void }) {
  const totalStock = Object.values(product.stock_by_size).reduce((a, b) => a + b, 0);
  return (
    <div className="group rounded border border-charcoal/15 dark:border-ivory/15 overflow-hidden bg-ivory dark:bg-charcoal flex flex-col justify-between">
      <div>
        <div className="relative overflow-hidden cursor-pointer" onClick={onOpen}>
          <img src={product.images[0]} alt={product.name} className="w-full h-72 object-cover group-hover:scale-105 transition duration-300" />
          {product.discount_percent > 0 && (
            <span className="absolute top-3 left-3 bg-crimson text-ivory text-xs font-bold px-2.5 py-1 uppercase">
              -{product.discount_percent}% OFF
            </span>
          )}
          {product.is_new && (
            <span className="absolute top-3 right-3 bg-burgundy text-ivory text-[10px] font-bold px-2 py-1 uppercase">
              NUEVO
            </span>
          )}
        </div>
        <div className="p-4 space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider opacity-65">{product.category} • Stock: {totalStock} un.</div>
          <h3 onClick={onOpen} className="font-bold text-base cursor-pointer hover:text-crimson dark:hover:text-dusty-rose">
            {product.name}
          </h3>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg text-burgundy dark:text-dusty-rose">{formatCLP(product.price)}</span>
            {product.original_price && <span className="text-xs line-through opacity-50">{formatCLP(product.original_price)}</span>}
          </div>
        </div>
      </div>
      <div className="p-4 pt-0 flex gap-2">
        <button onClick={onOpen} className="flex-1 py-2 border border-charcoal/25 dark:border-ivory/25 text-xs font-bold uppercase rounded">
          Ver Ficha
        </button>
        <button onClick={onQuickAdd} className="flex-1 py-2 bg-burgundy text-ivory text-xs font-bold uppercase rounded hover:bg-crimson transition">
          + Bolsa
        </button>
      </div>
    </div>
  );
}
