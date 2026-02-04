const STORAGE_KEY = "verdant_cart_state_v1";
const TOKEN_KEY = "verdant_auth_token";
const API_BASE = "http://localhost:4000";

const defaultState = {
  categories: [],
  products: [],
  cart: {},
};

const state = loadState();
let authToken = localStorage.getItem(TOKEN_KEY) || "";
let currentUser = null;

const elements = {
  productGrid: document.getElementById("productGrid"),
  categoryFilter: document.getElementById("categoryFilter"),
  sortFilter: document.getElementById("sortFilter"),
  stockFilter: document.getElementById("stockFilter"),
  searchInput: document.getElementById("searchInput"),
  cartDrawer: document.getElementById("cartDrawer"),
  adminDrawer: document.getElementById("adminDrawer"),
  cartItems: document.getElementById("cartItems"),
  cartCount: document.getElementById("cartCount"),
  subtotal: document.getElementById("subtotal"),
  delivery: document.getElementById("delivery"),
  total: document.getElementById("total"),
  featuredList: document.getElementById("featuredList"),
  toast: document.getElementById("toast"),
  categoryList: document.getElementById("categoryList"),
  inventoryTable: document.getElementById("inventoryTable"),
  newCategory: document.getElementById("newCategory"),
  newProductName: document.getElementById("newProductName"),
  newProductCategory: document.getElementById("newProductCategory"),
  newProductPrice: document.getElementById("newProductPrice"),
  newProductStock: document.getElementById("newProductStock"),
  newProductUnit: document.getElementById("newProductUnit"),
  newProductImage: document.getElementById("newProductImage"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authStatus: document.getElementById("authStatus"),
};

let toastTimer;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
    };
  } catch (error) {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function api(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload.error || "Request failed";
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2000);
}

function openDrawer(drawer) {
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
}

function closeDrawer(drawer) {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
}

function formatMoney(value) {
  return `$${value.toFixed(2)}`;
}

const imagePalettes = [
  { bg1: "#f7d4c3", bg2: "#f1a38a", accent: "#d9684e" },
  { bg1: "#e4f3d7", bg2: "#b8e08b", accent: "#5b9b3b" },
  { bg1: "#ffe9c7", bg2: "#f6c08e", accent: "#d6802f" },
  { bg1: "#e0f1ff", bg2: "#b6d9ff", accent: "#5b88d6" },
  { bg1: "#f6e0ff", bg2: "#dcb7ff", accent: "#8b61c9" },
];

function hashString(value) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function shortLabel(name) {
  const parts = name.split(" ").slice(0, 2);
  return parts.join(" ");
}

function makeSvgImage(label, palette) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${palette.bg1}" />
          <stop offset="100%" stop-color="${palette.bg2}" />
        </linearGradient>
      </defs>
      <rect width="640" height="480" fill="url(#g)" />
      <circle cx="140" cy="260" r="110" fill="${palette.accent}" opacity="0.45" />
      <circle cx="350" cy="200" r="130" fill="#ffffff" opacity="0.25" />
      <circle cx="520" cy="300" r="120" fill="${palette.accent}" opacity="0.35" />
      <text x="40" y="70" font-family="Space Grotesk, sans-serif" font-size="36" fill="#2a2a2a" font-weight="600">
        ${label}
      </text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function fallbackImage(name) {
  const palette = imagePalettes[hashString(name) % imagePalettes.length];
  return makeSvgImage(shortLabel(name), palette);
}

function getCartQuantity(productId) {
  return state.cart[productId] || 0;
}

function canAddToCart(product) {
  return getCartQuantity(product.id) < product.stock;
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  if (!canAddToCart(product)) {
    showToast("Inventory limit reached.");
    return;
  }
  state.cart[productId] = getCartQuantity(productId) + 1;
  saveState();
  renderCart();
  renderProducts();
}

function removeFromCart(productId) {
  delete state.cart[productId];
  saveState();
  renderCart();
  renderProducts();
}

function updateCartQuantity(productId, quantity) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  const nextQty = Math.min(Math.max(quantity, 0), product.stock);
  if (nextQty === 0) {
    removeFromCart(productId);
    return;
  }
  state.cart[productId] = nextQty;
  saveState();
  renderCart();
  renderProducts();
}

function setAuth(token, user) {
  authToken = token || "";
  currentUser = user || null;
  if (authToken) {
    localStorage.setItem(TOKEN_KEY, authToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  renderAuthStatus();
}

function renderAuthStatus() {
  if (currentUser) {
    elements.authStatus.textContent = `Signed in as ${currentUser.email}`;
  } else {
    elements.authStatus.textContent = "Not signed in.";
  }
}

async function loadCatalog() {
  const data = await api("/api/catalog");
  state.categories = data.categories;
  state.products = data.products;
  saveState();
}

function renderCategories() {
  elements.categoryFilter.innerHTML = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All categories";
  elements.categoryFilter.appendChild(allOption);

  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });

  elements.categoryList.innerHTML = "";
  state.categories.forEach((category) => {
    const pill = document.createElement("span");
    pill.className = "badge";
    pill.textContent = category;
    elements.categoryList.appendChild(pill);
  });

  const categoryInputs = document.querySelectorAll("#newProductCategory");
  categoryInputs.forEach((input) => {
    input.setAttribute("list", "categoryDataList");
  });

  let dataList = document.getElementById("categoryDataList");
  if (!dataList) {
    dataList = document.createElement("datalist");
    dataList.id = "categoryDataList";
    document.body.appendChild(dataList);
  }
  dataList.innerHTML = "";
  state.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    dataList.appendChild(option);
  });
}

function renderProducts() {
  const search = elements.searchInput.value.trim().toLowerCase();
  const category = elements.categoryFilter.value;
  const sort = elements.sortFilter.value;
  const stockFilter = elements.stockFilter.value;

  let products = [...state.products];

  if (search) {
    products = products.filter((product) =>
      product.name.toLowerCase().includes(search)
    );
  }

  if (category !== "all") {
    products = products.filter((product) => product.category === category);
  }

  if (stockFilter === "in") {
    products = products.filter((product) => product.stock > 5);
  }
  if (stockFilter === "low") {
    products = products.filter((product) => product.stock > 0 && product.stock <= 5);
  }
  if (stockFilter === "out") {
    products = products.filter((product) => product.stock === 0);
  }

  if (sort === "priceAsc") {
    products.sort((a, b) => a.price - b.price);
  }
  if (sort === "priceDesc") {
    products.sort((a, b) => b.price - a.price);
  }
  if (sort === "stockDesc") {
    products.sort((a, b) => b.stock - a.stock);
  }
  if (sort === "featured") {
    products.sort((a, b) => Number(b.featured) - Number(a.featured));
  }

  elements.productGrid.innerHTML = "";
  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "card";

    const imageWrap = document.createElement("div");
    imageWrap.className = "product-image";
    const image = document.createElement("img");
    image.src = product.imageUrl || fallbackImage(product.name);
    image.alt = product.name;
    imageWrap.appendChild(image);

    const badges = document.createElement("div");
    badges.className = "badges";

    const categoryBadge = document.createElement("span");
    categoryBadge.className = "badge";
    categoryBadge.textContent = product.category;
    badges.appendChild(categoryBadge);

    if (product.stock === 0) {
      const outBadge = document.createElement("span");
      outBadge.className = "badge out";
      outBadge.textContent = "Out of stock";
      badges.appendChild(outBadge);
    } else if (product.stock <= 5) {
      const lowBadge = document.createElement("span");
      lowBadge.className = "badge low";
      lowBadge.textContent = `Low stock (${product.stock})`;
      badges.appendChild(lowBadge);
    }

    const title = document.createElement("h4");
    title.textContent = product.name;

    const price = document.createElement("p");
    price.className = "price";
    price.textContent = `${formatMoney(product.price)} ${product.unit}`;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const count = document.createElement("span");
    count.textContent = `${getCartQuantity(product.id)} in cart`;

    const btn = document.createElement("button");
    btn.className = "primary";
    btn.textContent = product.stock === 0 ? "Unavailable" : "Add to cart";
    btn.disabled = product.stock === 0;
    btn.addEventListener("click", () => addToCart(product.id));

    actions.append(count, btn);

    card.append(imageWrap, badges, title, price, actions);
    elements.productGrid.appendChild(card);
  });

  renderFeatured();
}

function renderFeatured() {
  elements.featuredList.innerHTML = "";
  const featured = state.products.filter((product) => product.featured).slice(0, 4);
  featured.forEach((product) => {
    const item = document.createElement("li");

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "center";
    left.style.gap = "10px";

    const thumb = document.createElement("div");
    thumb.className = "featured-thumb";
    const img = document.createElement("img");
    img.src = product.imageUrl || fallbackImage(product.name);
    img.alt = product.name;
    thumb.appendChild(img);

    const name = document.createElement("span");
    name.textContent = product.name;

    left.append(thumb, name);

    const price = document.createElement("strong");
    price.textContent = formatMoney(product.price);

    item.append(left, price);
    elements.featuredList.appendChild(item);
  });
}

function renderCart() {
  elements.cartItems.innerHTML = "";
  const entries = Object.entries(state.cart);
  let subtotal = 0;

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Your cart is empty. Add fresh produce.";
    elements.cartItems.appendChild(empty);
  }

  entries.forEach(([productId, quantity]) => {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;

    const row = document.createElement("div");
    row.className = "cart-item";

    const info = document.createElement("div");
    info.innerHTML = `<strong>${product.name}</strong><p>${product.category}</p>`;

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.max = product.stock;
    qtyInput.value = quantity;
    qtyInput.addEventListener("change", (event) => {
      updateCartQuantity(productId, Number(event.target.value));
    });

    const price = document.createElement("div");
    price.innerHTML = `<strong>${formatMoney(product.price * quantity)}</strong>`;

    const remove = document.createElement("button");
    remove.className = "ghost";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeFromCart(productId));

    row.append(info, qtyInput, price, remove);
    elements.cartItems.appendChild(row);

    subtotal += product.price * quantity;
  });

  const deliveryFee = subtotal === 0 ? 0 : subtotal > 40 ? 0 : 4.5;
  const total = subtotal + deliveryFee;

  elements.subtotal.textContent = formatMoney(subtotal);
  elements.delivery.textContent = formatMoney(deliveryFee);
  elements.total.textContent = formatMoney(total);
  elements.cartCount.textContent = entries.reduce(
    (sum, [, qty]) => sum + qty,
    0
  );
}

function renderInventory() {
  elements.inventoryTable.innerHTML = "";

  state.products.forEach((product) => {
    const row = document.createElement("div");
    row.className = "inventory-row";

    const name = document.createElement("strong");
    name.textContent = product.name;

    const categorySelect = document.createElement("select");
    state.categories.forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      option.selected = category === product.category;
      categorySelect.appendChild(option);
    });

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.step = "0.01";
    priceInput.value = product.price;

    const unitInput = document.createElement("input");
    unitInput.value = product.unit;

    const stockInput = document.createElement("input");
    stockInput.type = "number";
    stockInput.step = "1";
    stockInput.value = product.stock;

    const imageInput = document.createElement("input");
    imageInput.placeholder = "Image URL";
    imageInput.value = product.imageUrl || "";

    const saveBtn = document.createElement("button");
    saveBtn.className = "primary";
    saveBtn.textContent = "Update";

    saveBtn.addEventListener("click", async () => {
      try {
        const updated = await api(`/api/products/${product.id}`, {
          method: "PUT",
          body: JSON.stringify({
            category: categorySelect.value,
            price: Number(priceInput.value),
            unit: unitInput.value.trim() || "/unit",
            stock: Math.max(Number(stockInput.value), 0),
            imageUrl: imageInput.value.trim() || null,
          }),
        });
        const index = state.products.findIndex((item) => item.id === product.id);
        state.products[index] = updated;
        saveState();
        renderProducts();
        renderCategories();
        renderInventory();
        showToast("Inventory updated");
      } catch (error) {
        showToast(error.message);
      }
    });

    row.append(
      name,
      categorySelect,
      priceInput,
      unitInput,
      stockInput,
      imageInput,
      saveBtn
    );
    elements.inventoryTable.appendChild(row);
  });
}

async function addCategory() {
  const value = elements.newCategory.value.trim();
  if (!value || state.categories.includes(value)) return;
  try {
    const data = await api("/api/categories", {
      method: "POST",
      body: JSON.stringify({ name: value }),
    });
    state.categories = data.categories;
    elements.newCategory.value = "";
    saveState();
    renderCategories();
    renderInventory();
    showToast("Category added");
  } catch (error) {
    showToast(error.message);
  }
}

async function addProduct() {
  const name = elements.newProductName.value.trim();
  const category = elements.newProductCategory.value.trim();
  const price = Number(elements.newProductPrice.value);
  const stock = Number(elements.newProductStock.value);
  const unit = elements.newProductUnit.value.trim() || "/unit";
  const imageUrl = elements.newProductImage.value.trim();

  if (!name || !category || Number.isNaN(price) || Number.isNaN(stock)) return;

  try {
    const product = await api("/api/products", {
      method: "POST",
      body: JSON.stringify({ name, category, price, unit, stock, imageUrl }),
    });

    state.products.push(product);
    if (!state.categories.includes(category)) {
      state.categories.push(category);
    }

    elements.newProductName.value = "";
    elements.newProductCategory.value = "";
  elements.newProductPrice.value = "";
  elements.newProductStock.value = "";
  elements.newProductUnit.value = "";
  elements.newProductImage.value = "";

    saveState();
    renderCategories();
    renderProducts();
    renderInventory();
    showToast("Product added");
  } catch (error) {
    showToast(error.message);
  }
}

async function checkout() {
  const entries = Object.entries(state.cart);
  if (entries.length === 0) {
    showToast("Add items to checkout.");
    return;
  }

  const note = document.getElementById("deliveryNote").value.trim();

  try {
    await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        items: entries.map(([productId, quantity]) => ({
          productId,
          quantity,
        })),
        note,
      }),
    });

    state.cart = {};
    saveState();
    await loadCatalog();
    renderProducts();
    renderCart();
    renderInventory();
    showToast("Order placed! Inventory synced.");
  } catch (error) {
    showToast(error.message);
  }
}

async function register() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value.trim();
  if (!email || !password) return;
  try {
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuth(data.token, data.user);
    showToast("Account created");
  } catch (error) {
    showToast(error.message);
  }
}

async function login() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value.trim();
  if (!email || !password) return;
  try {
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAuth(data.token, data.user);
    showToast("Signed in");
  } catch (error) {
    showToast(error.message);
  }
}

async function logout() {
  setAuth("", null);
  showToast("Signed out");
}

async function hydrateAuth() {
  if (!authToken) return;
  try {
    const data = await api("/api/me");
    currentUser = data.user;
    renderAuthStatus();
  } catch (error) {
    setAuth("", null);
  }
}

function bindEvents() {
  document.getElementById("viewCart").addEventListener("click", () => {
    openDrawer(elements.cartDrawer);
  });
  document.getElementById("closeCart").addEventListener("click", () => {
    closeDrawer(elements.cartDrawer);
  });

  document.getElementById("openAdmin").addEventListener("click", () => {
    openDrawer(elements.adminDrawer);
  });
  document.getElementById("openAdminHero").addEventListener("click", () => {
    openDrawer(elements.adminDrawer);
  });
  document.getElementById("closeAdmin").addEventListener("click", () => {
    closeDrawer(elements.adminDrawer);
  });

  document.getElementById("shopNow").addEventListener("click", () => {
    document.getElementById("shop").scrollIntoView({ behavior: "smooth" });
  });

  document
    .getElementById("refreshInventory")
    .addEventListener("click", () => {
      renderProducts();
      showToast("Inventory refreshed");
    });

  elements.searchInput.addEventListener("input", renderProducts);
  elements.categoryFilter.addEventListener("change", renderProducts);
  elements.sortFilter.addEventListener("change", renderProducts);
  elements.stockFilter.addEventListener("change", renderProducts);

  document.getElementById("addCategory").addEventListener("click", addCategory);
  document.getElementById("addProduct").addEventListener("click", addProduct);
  document.getElementById("checkoutBtn").addEventListener("click", checkout);
  document.getElementById("registerBtn").addEventListener("click", register);
  document.getElementById("loginBtn").addEventListener("click", login);
  document.getElementById("logoutBtn").addEventListener("click", logout);
}

async function init() {
  try {
    await loadCatalog();
  } catch (error) {
    showToast("API offline - showing cached data.");
  }
  renderCategories();
  renderProducts();
  renderCart();
  renderInventory();
  bindEvents();
  await hydrateAuth();
}

init();
