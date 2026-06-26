const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DATA_FILE = path.join(__dirname, 'finance.json');
const PORT = 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

// ====== Data Layer ======
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { transactions: [], categories: [], nextTransId: 1, nextCatId: 1 };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ====== Default Categories ======
function ensureDefaultCategories(data) {
  if (!data.categories || data.categories.length === 0) {
    data.categories = [
      { id: data.nextCatId++, name: '餐饮', type: 'expense' },
      { id: data.nextCatId++, name: '交通', type: 'expense' },
      { id: data.nextCatId++, name: '购物', type: 'expense' },
      { id: data.nextCatId++, name: '娱乐', type: 'expense' },
      { id: data.nextCatId++, name: '住房', type: 'expense' },
      { id: data.nextCatId++, name: '日用', type: 'expense' },
      { id: data.nextCatId++, name: '医疗', type: 'expense' },
      { id: data.nextCatId++, name: '工资', type: 'income' },
      { id: data.nextCatId++, name: '奖金', type: 'income' },
      { id: data.nextCatId++, name: '其他收入', type: 'income' },
      { id: data.nextCatId++, name: '其他支出', type: 'expense' },
    ];
    saveData(data);
  }
}

// ====== API Handlers ======
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendError(res, status, msg) {
  sendJson(res, status, { error: msg });
}

// Transactions
function transList(data, query) {
  let list = [...data.transactions];
  const year = query.year || new Date().getFullYear().toString();
  const month = query.month || (new Date().getMonth() + 1).toString().padStart(2, '0');
  list = list.filter(t => {
    const d = t.date.split('-');
    if (year && d[0] !== year) return false;
    if (month && d[1] !== month) return false;
    return true;
  });
  list.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return list;
}

function transCreate(data, body) {
  const t = {
    id: data.nextTransId++,
    date: body.date,
    amount: parseFloat(body.amount),
    category: body.category || '',
    type: body.type || 'expense',
    note: body.note || '',
    status: body.status || 'done',
  };
  if (!t.date || isNaN(t.amount)) return null;
  data.transactions.push(t);
  saveData(data);
  return t;
}

function transUpdate(data, id, body) {
  const idx = data.transactions.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const t = data.transactions[idx];
  if (body.date !== undefined) t.date = body.date;
  if (body.amount !== undefined) t.amount = parseFloat(body.amount);
  if (body.category !== undefined) t.category = body.category;
  if (body.type !== undefined) t.type = body.type;
  if (body.note !== undefined) t.note = body.note;
  if (body.status !== undefined) t.status = body.status;
  saveData(data);
  return t;
}

function transDelete(data, id) {
  const idx = data.transactions.findIndex(t => t.id === id);
  if (idx === -1) return false;
  data.transactions.splice(idx, 1);
  saveData(data);
  return true;
}

function transStats(data, query) {
  const year = query.year || new Date().getFullYear().toString();
  const month = query.month || (new Date().getMonth() + 1).toString().padStart(2, '0');
  const filtered = data.transactions.filter(t => {
    const d = t.date.split('-');
    return d[0] === year && d[1] === month;
  });
  let income = 0, expense = 0;
  filtered.forEach(t => {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  });
  return { year, month, income, expense, balance: income - expense, count: filtered.length };
}

function transExpenses(data, days) {
  const n = parseInt(days) || 7;
  const now = new Date();
  const results = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayTotal = data.transactions
      .filter(t => t.date === key && t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);
    results.push({ date: key, amount: dayTotal });
  }
  return results;
}

// Categories
function catList(data) { return data.categories; }

function catCreate(data, body) {
  const c = { id: data.nextCatId++, name: body.name, type: body.type || 'expense' };
  if (!c.name) return null;
  data.categories.push(c);
  saveData(data);
  return c;
}

function catUpdate(data, id, body) {
  const c = data.categories.find(x => x.id === id);
  if (!c) return null;
  if (body.name !== undefined) c.name = body.name;
  if (body.type !== undefined) c.type = body.type;
  saveData(data);
  return c;
}

function catDelete(data, id) {
  const cat = data.categories.find(c => c.id === id);
  const used = cat ? data.transactions.some(t => t.category === cat.name) : false;
  const idx = data.categories.findIndex(c => c.id === id);
  if (idx === -1) return { deleted: false, reason: 'not_found' };
    if (used) return { deleted: false, reason: 'in_use' };
    if (cat && cat.name.indexOf('其他') === 0) return { deleted: false, reason: 'protected' };
  data.categories.splice(idx, 1);
  saveData(data);
  return { deleted: true };
}

// ====== HTTP Server ======
function serveStatic(res, urlPath) {
  const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;
  const data = loadData();
  ensureDefaultCategories(data);

  // CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // ---- Transactions API ----
    if (pathname === '/api/transactions' && method === 'GET') {
      const list = transList(data, parsed.query);
      return sendJson(res, 200, list);
    }
    if (pathname === '/api/transactions' && method === 'POST') {
      const body = await parseJsonBody(req);
      const t = transCreate(data, body);
      if (!t) return sendError(res, 400, '缺少必填字段（日期、金额）');
      return sendJson(res, 201, t);
    }
    const transMatch = pathname.match(/^\/api\/transactions\/(\d+)$/);
    if (transMatch) {
      const id = parseInt(transMatch[1]);
      if (method === 'PUT') {
        const body = await parseJsonBody(req);
        const t = transUpdate(data, id, body);
        if (!t) return sendError(res, 404, '记录未找到');
        return sendJson(res, 200, t);
      }
      if (method === 'DELETE') {
        if (!transDelete(data, id)) return sendError(res, 404, '记录未找到');
        return sendJson(res, 200, { ok: true });
      }
    }

    // ---- Stats API ----
    if (pathname === '/api/transactions/stats' && method === 'GET') {
      return sendJson(res, 200, transStats(data, parsed.query));
    }
    if (pathname === '/api/transactions/expenses' && method === 'GET') {
      return sendJson(res, 200, transExpenses(data, parsed.query.days || '7'));
    }

    // ---- Categories API ----
    if (pathname === '/api/categories' && method === 'GET') {
      return sendJson(res, 200, catList(data));
    }
    if (pathname === '/api/categories' && method === 'POST') {
      const body = await parseJsonBody(req);
      const c = catCreate(data, body);
      if (!c) return sendError(res, 400, '缺少分类名称');
      return sendJson(res, 201, c);
    }
    const catMatch = pathname.match(/^\/api\/categories\/(\d+)$/);
    if (catMatch) {
      const id = parseInt(catMatch[1]);
      if (method === 'PUT') {
        const body = await parseJsonBody(req);
        const c = catUpdate(data, id, body);
        if (!c) return sendError(res, 404, '分类未找到');
        return sendJson(res, 200, c);
      }
      if (method === 'DELETE') {
        const result = catDelete(data, id);
        if (!result.deleted && result.reason === 'in_use')
            return sendError(res, 409, '该分类下已有记录，无法删除');
          if (!result.deleted && result.reason === 'protected')
            return sendError(res, 400, '系统默认分类不可删除');
        if (!result.deleted) return sendError(res, 404, '分类未找到');
        return sendJson(res, 200, { ok: true });
      }
    }

    // ---- Static Files ----
    serveStatic(res, pathname);
  } catch (e) {
    console.error(e);
    sendError(res, 500, '服务器内部错误');
  }
});

server.listen(PORT, () => {
  console.log(`记账软件已启动: http://localhost:${PORT}`);
});
