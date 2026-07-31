require('dotenv').config();

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const jwt = require('jsonwebtoken');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-moi';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '221785314117';
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data', 'products.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads', 'products');

fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

// ---------- Simple JSON "database" helpers ----------
function readProducts() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    console.error('Erreur lecture products.json', e);
    return [];
  }
}

function writeProducts(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

// ---------- App setup ----------
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Auth ----------
function signToken() {
  return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
}

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Session expirée, reconnecte-toi.' });
  }
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Mot de passe incorrect.' });
  }
  res.json({ token: signToken() });
});

app.get('/api/admin/check', requireAdmin, (req, res) => {
  res.json({ ok: true });
});

// ---------- Public config & products ----------
app.get('/api/config', (req, res) => {
  res.json({ whatsappNumber: WHATSAPP_NUMBER });
});

app.get('/api/products', (req, res) => {
  res.json(readProducts());
});

// Admin sees the same list (kept as a separate route in case we want to
// include extra fields for admin-only use later).
app.get('/api/admin/products', requireAdmin, (req, res) => {
  res.json(readProducts());
});

// ---------- Photo upload handling ----------
function makeUploader(getProductId) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      const id = getProductId(req);
      const dir = path.join(UPLOADS_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${safeExt}`);
    }
  });
  return multer({
    storage,
    limits: { fileSize: 8 * 1024 * 1024, files: 15 },
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Seules les images JPG, PNG ou WEBP sont acceptées.'));
    }
  });
}

// For new products we don't know the id yet, so generate it up front
// in a tiny middleware that runs before multer.
function assignNewProductId(req, res, next) {
  req.newProductId = crypto.randomBytes(5).toString('hex');
  next();
}

const uploadForCreate = makeUploader((req) => req.newProductId);
const uploadForUpdate = makeUploader((req) => req.params.id);

function parseBool(v) {
  return v === true || v === 'true' || v === 'on' || v === '1';
}

function parseSpecs(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw !== 'string') return [];
  return raw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------- Create product ----------
app.post(
  '/api/admin/products',
  requireAdmin,
  assignNewProductId,
  (req, res, next) => uploadForCreate.array('photos', 15)(req, res, next),
  (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.price) {
      return res.status(400).json({ error: 'Nom et prix sont obligatoires.' });
    }
    const id = req.newProductId;
    const photos = (req.files || []).map((f) => `/uploads/products/${id}/${f.filename}`);

    const product = {
      id,
      name: b.name.trim(),
      cat: b.cat || 'laptop',
      catLabel: b.catLabel || 'Portable',
      price: b.price.trim(),
      priceFixed: parseBool(b.priceFixed),
      specs: parseSpecs(b.specs),
      photos,
      stock: b.stock || 'En stock',
      low: parseBool(b.low),
      createdAt: new Date().toISOString()
    };

    const list = readProducts();
    list.unshift(product);
    writeProducts(list);
    res.status(201).json(product);
  }
);

// ---------- Update product (fields + optionally add photos) ----------
app.put(
  '/api/admin/products/:id',
  requireAdmin,
  (req, res, next) => uploadForUpdate.array('photos', 15)(req, res, next),
  (req, res) => {
    const list = readProducts();
    const idx = list.findIndex((p) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Produit introuvable.' });

    const b = req.body || {};
    const existing = list[idx];
    const newPhotos = (req.files || []).map(
      (f) => `/uploads/products/${req.params.id}/${f.filename}`
    );

    const updated = {
      ...existing,
      name: b.name !== undefined ? b.name.trim() : existing.name,
      cat: b.cat !== undefined ? b.cat : existing.cat,
      catLabel: b.catLabel !== undefined ? b.catLabel : existing.catLabel,
      price: b.price !== undefined ? b.price.trim() : existing.price,
      priceFixed: b.priceFixed !== undefined ? parseBool(b.priceFixed) : existing.priceFixed,
      specs: b.specs !== undefined ? parseSpecs(b.specs) : existing.specs,
      stock: b.stock !== undefined ? b.stock : existing.stock,
      low: b.low !== undefined ? parseBool(b.low) : existing.low,
      photos: [...existing.photos, ...newPhotos]
    };

    list[idx] = updated;
    writeProducts(list);
    res.json(updated);
  }
);

// ---------- Delete a single photo from a product ----------
app.delete('/api/admin/products/:id/photos', requireAdmin, (req, res) => {
  const { photo } = req.body || {};
  if (!photo) return res.status(400).json({ error: 'Chemin de la photo manquant.' });

  const list = readProducts();
  const idx = list.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produit introuvable.' });

  list[idx].photos = list[idx].photos.filter((p) => p !== photo);
  writeProducts(list);

  const filePath = path.join(__dirname, photo.replace(/^\//, ''));
  fs.unlink(filePath, () => {}); // best-effort cleanup

  res.json(list[idx]);
});

// ---------- Delete product ----------
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  const list = readProducts();
  const idx = list.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Produit introuvable.' });

  const [removed] = list.splice(idx, 1);
  writeProducts(list);

  const dir = path.join(UPLOADS_DIR, removed.id);
  fs.rm(dir, { recursive: true, force: true }, () => {});

  res.json({ ok: true });
});

// Friendly multer error messages
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message || 'Erreur de téléversement.' });
  }
  next();
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`Kotic's Informatique — serveur lancé sur http://localhost:${PORT}`);
  console.log(`Page admin : http://localhost:${PORT}/admin`);
});
