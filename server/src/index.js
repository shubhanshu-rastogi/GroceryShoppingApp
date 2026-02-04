const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const path = require("path");
require("dotenv").config();

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
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
  return name.split(" ").slice(0, 2).join(" ");
}

function makeImage(label, palette) {
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

function resolveImage(name, imageUrl) {
  if (imageUrl && imageUrl.trim()) return imageUrl.trim();
  const palette = imagePalettes[hashString(name) % imagePalettes.length];
  return makeImage(shortLabel(name), palette);
}

function signToken(user) {
  return jwt.sign({ sub: user.id, isAdmin: user.isAdmin }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    isAdmin: user.isAdmin,
  };
}

async function getUserFromAuthHeader(header) {
  if (!header) return null;
  const [, token] = header.split(" ");
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.sub) return null;
    return prisma.user.findUnique({ where: { id: decoded.sub } });
  } catch (error) {
    return null;
  }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "Missing auth token" });
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function adminRequired(req, res, next) {
  authRequired(req, res, async () => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || !user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user = user;
    next();
  });
}

async function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  const hash = await bcrypt.hash(password, 10);

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        isAdmin: true,
      },
    });
    return;
  }

  if (!existing.isAdmin) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { isAdmin: true },
    });
  }
}

async function seedCatalog() {
  const existingProducts = await prisma.product.findMany();
  if (existingProducts.length > 0) {
    const missingImages = existingProducts.filter((product) => !product.imageUrl);
    if (missingImages.length > 0) {
      await prisma.$transaction(
        missingImages.map((product) =>
          prisma.product.update({
            where: { id: product.id },
            data: { imageUrl: resolveImage(product.name) },
          })
        )
      );
    }
    return;
  }

  const categoryNames = ["Fruits", "Vegetables", "Leafy Greens", "Herbs", "Roots"];
  const categories = await Promise.all(
    categoryNames.map((name) =>
      prisma.category.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  const categoryMap = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  await prisma.product.createMany({
    data: [
      {
        name: "Honeycrisp Apples",
        categoryId: categoryMap["Fruits"],
        price: 2.8,
        unit: "/lb",
        stock: 40,
        imageUrl: resolveImage("Honeycrisp Apples"),
        featured: true,
      },
      {
        name: "Strawberry Basket",
        categoryId: categoryMap["Fruits"],
        price: 5.5,
        unit: "/box",
        stock: 18,
        imageUrl: resolveImage("Strawberry Basket"),
        featured: true,
      },
      {
        name: "Heirloom Tomatoes",
        categoryId: categoryMap["Vegetables"],
        price: 4.2,
        unit: "/lb",
        stock: 22,
        imageUrl: resolveImage("Heirloom Tomatoes"),
        featured: false,
      },
      {
        name: "Baby Spinach",
        categoryId: categoryMap["Leafy Greens"],
        price: 3.25,
        unit: "/bag",
        stock: 15,
        imageUrl: resolveImage("Baby Spinach"),
        featured: true,
      },
      {
        name: "Organic Carrots",
        categoryId: categoryMap["Roots"],
        price: 2.1,
        unit: "/bunch",
        stock: 30,
        imageUrl: resolveImage("Organic Carrots"),
        featured: false,
      },
      {
        name: "Basil Bundle",
        categoryId: categoryMap["Herbs"],
        price: 2.75,
        unit: "/bundle",
        stock: 12,
        imageUrl: resolveImage("Basil Bundle"),
        featured: true,
      },
    ],
  });
}

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash: hash },
  });
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signToken(user);
  res.json({ token, user: sanitizeUser(user) });
});

app.get("/api/me", authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ user: sanitizeUser(user) });
});

app.get("/api/catalog", async (req, res) => {
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const products = await prisma.product.findMany({
    include: { category: true },
    orderBy: { createdAt: "asc" },
  });

  res.json({
    categories: categories.map((c) => c.name),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category.name,
      price: p.price,
      unit: p.unit,
      stock: p.stock,
      imageUrl: p.imageUrl,
      featured: p.featured,
    })),
  });
});

app.post("/api/categories", adminRequired, async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name required" });

  await prisma.category.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  res.json({ categories: categories.map((c) => c.name) });
});

app.post("/api/products", adminRequired, async (req, res) => {
  const { name, category, price, unit, stock, imageUrl } = req.body || {};
  if (!name || !category || price == null || stock == null) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const categoryRecord = await prisma.category.upsert({
    where: { name: category },
    update: {},
    create: { name: category },
  });

  const product = await prisma.product.create({
    data: {
      name,
      categoryId: categoryRecord.id,
      price: Number(price),
      unit: unit || "/unit",
      stock: Math.max(Number(stock), 0),
      imageUrl: resolveImage(name, imageUrl),
    },
    include: { category: true },
  });

  res.json({
    id: product.id,
    name: product.name,
    category: product.category.name,
    price: product.price,
    unit: product.unit,
    stock: product.stock,
    imageUrl: product.imageUrl,
    featured: product.featured,
  });
});

app.put("/api/products/:id", adminRequired, async (req, res) => {
  const { id } = req.params;
  const { category, price, unit, stock, imageUrl } = req.body || {};

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  let categoryId = product.categoryId;
  if (category) {
    const categoryRecord = await prisma.category.upsert({
      where: { name: category },
      update: {},
      create: { name: category },
    });
    categoryId = categoryRecord.id;
  }

  const updated = await prisma.product.update({
    where: { id },
    data: {
      categoryId,
      price: price != null ? Number(price) : product.price,
      unit: unit || product.unit,
      stock: stock != null ? Math.max(Number(stock), 0) : product.stock,
      imageUrl: imageUrl != null ? resolveImage(product.name, imageUrl) : product.imageUrl,
    },
    include: { category: true },
  });

  res.json({
    id: updated.id,
    name: updated.name,
    category: updated.category.name,
    price: updated.price,
    unit: updated.unit,
    stock: updated.stock,
    imageUrl: updated.imageUrl,
    featured: updated.featured,
  });
});

app.post("/api/orders", async (req, res) => {
  const { items, note } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Order items required" });
  }

  const authUser = await getUserFromAuthHeader(req.headers.authorization);

  const productIds = items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));
  let subtotal = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (item.quantity > product.stock) {
      return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
    }
    subtotal += product.price * item.quantity;
  }

  const deliveryFee = subtotal > 40 ? 0 : 4.5;
  const total = subtotal + deliveryFee;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: authUser?.id || null,
        total,
        deliveryFee,
        note: note || null,
        items: {
          create: items.map((item) => {
            const product = productMap.get(item.productId);
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: product.price,
            };
          }),
        },
      },
      include: { items: true },
    });

    for (const item of items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return created;
  });

  res.json({ orderId: order.id, total: order.total });
});

const PORT = process.env.PORT || 4000;

async function start() {
  await ensureAdmin();
  await seedCatalog();

  app.listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
