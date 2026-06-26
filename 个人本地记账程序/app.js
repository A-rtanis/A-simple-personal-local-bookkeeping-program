const API = '/api';
const today = new Date();
const curYear = today.getFullYear();
const curMonth = String(today.getMonth() + 1).padStart(2, '0');
function $(id) { return document.getElementById(id); }
function qsa(sel) { return document.querySelectorAll(sel); }
function fmt(n) { return '\u00a5' + Number(n).toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2}); }
async function api(method, path, body) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + path, opts);
  if (!r.ok) { const e = await r.json(); throw new Error(e.error || '\u8bf7\u6c42\u5931\u8d25'); }
  return r.json();
}
function populateYears(sel) {
  sel.innerHTML = '';
  for (let y = 1960; y <= 2100; y++) {
    const o = document.createElement('option');
    o.value = String(y);
    o.textContent = y + '\u5e74';
    if (y === curYear) o.selected = true;
    sel.appendChild(o);
  }
}
populateYears($('filter-year'));
populateYears($('stats-year'));
populateMonths($('filter-month'));
populateMonths($('stats-month'));
function populateMonths(sel) {
  for (var i = 1; i <= 12; i++) {
    var v = i < 10 ? '0' + i : '' + i;
    var o = document.createElement('option');
    o.value = v;
    o.textContent = i + '\u6708';
    if (v === curMonth) o.selected = true;
    sel.appendChild(o);
  }
}

$('filter-month').value = curMonth;
$('stats-month').value = curMonth;
qsa('.tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    qsa('.tab').forEach(function(b) { b.classList.remove('active'); });
    qsa('.tab-content').forEach(function(c) { c.classList.remove('active'); });
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'stats') loadStats();
    if (btn.dataset.tab === 'categories') loadCategories();
  });
});
async function loadRecords() {
  const year = $('filter-year').value;
  const month = $('filter-month').value;
  const a = api('GET', '/transactions?year=' + year + '&month=' + month);
  const b = api('GET', '/transactions/stats?year=' + year + '&month=' + month);
  const [records, stats] = await Promise.all([a, b]);
  renderRecords(records);
  $('stat-income').textContent = fmt(stats.income);
  $('stat-expense').textContent = fmt(stats.expense);
  $('stat-balance').textContent = fmt(stats.balance);
}
function renderRecords(records) {
  const tbody = $('records-body');
  const empty = $('empty-msg');
  tbody.innerHTML = '';
  if (records.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  records.forEach(function(r) {
    const tr = document.createElement('tr');
    var tl = r.type === 'income' ? '\u6536\u5165' : '\u652f\u51fa';
    var s = r.status === 'done' ? '\u5df2\u5b8c\u6210' : '\u672a\u5b8c\u6210';
    var btns = '<button class="btn small btn-edit" data-id="' + r.id + '">\u7f16\u8f91</button> ';
    btns += '<button class="btn small btn-del" data-id="' + r.id + '">\u5220\u9664</button> ';
    btns += '<button class="btn small btn-toggle" data-id="' + r.id + '">';
    btns += (r.status === 'done' ? '\u6807\u672a\u5b8c\u6210' : '\u6807\u5df2\u5b8c\u6210') + '</button>';
    tr.innerHTML = '<td>' + r.date + '</td><td class="type-' + r.type + '">' + tl + '</td>';
    tr.innerHTML += '<td>' + (r.category || '-') + '</td>';
    tr.innerHTML += '<td class="type-' + r.type + '" style="font-weight:600">' + fmt(r.amount) + '</td>';
    tr.innerHTML += '<td>' + (r.note || '-') + '</td>';
    tr.innerHTML += '<td><span class="status-' + r.status + '">' + s + '</span></td>';
    tr.innerHTML += '<td>' + btns + '</td>';
    tr.querySelector('.btn-edit').addEventListener('click', function() { openEdit(r); });
    tr.querySelector('.btn-del').addEventListener('click', function() { deleteRecord(r.id); });
    tr.querySelector('.btn-toggle').addEventListener('click', function() { toggleStatus(r); });
    tbody.appendChild(tr);
  });
}
$('filter-year').addEventListener('change', loadRecords);
$('filter-month').addEventListener('change', loadRecords);
async function loadCategoriesForForm() {
  const cats = await api('GET', '/categories');
  const sel = $('form-category');
  const type = $('form-type').value;
  sel.innerHTML = '';
  cats.filter(function(c) { return c.type === type; }).forEach(function(c) {
    const o = document.createElement('option');
    o.value = c.name; o.textContent = c.name; sel.appendChild(o);
  });
}
$('form-type').addEventListener('change', loadCategoriesForForm);
function openModal(title, record) {
  $('modal-title').textContent = title;
  $('modal').style.display = 'flex';
  if (record) {
    $('form-id').value = record.id; $('form-date').value = record.date;
    $('form-type').value = record.type; $('form-amount').value = record.amount;
    $('form-status').value = record.status; $('form-note').value = record.note || '';
  } else {
    $('form-id').value = ''; $('form-date').value = today.toISOString().slice(0, 10);
    $('form-type').value = 'expense'; $('form-amount').value = '';
    $('form-note').value = '';
  }
  loadCategoriesForForm();
  if (!$('form-id').value) {
    $('form-status').value = $('form-date').value <= today.toISOString().slice(0, 10) ? 'done' : 'pending';
  }
}
function closeModal() { $('modal').style.display = 'none'; }
$('btn-add').addEventListener('click', function() { openModal('\u65b0\u589e\u8bb0\u5f55'); });
$('modal-cancel').addEventListener('click', closeModal);
$('form-date').addEventListener('change', function() {
  $('form-status').value = $('form-date').value <= today.toISOString().slice(0, 10) ? 'done' : 'pending';
});
$('modal').addEventListener('click', function(e) { if (e.target === $('modal')) closeModal(); });
$('modal-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var body = { date: $('form-date').value, type: $('form-type').value,
    category: $('form-category').value, amount: parseFloat($('form-amount').value),
    status: $('form-status').value, note: $('form-note').value };
  try {
    var id = $('form-id').value;
    if (id) { await api('PUT', '/transactions/' + id, body); }
    else { await api('POST', '/transactions', body); }
    closeModal(); loadRecords();
  } catch (err) { alert(err.message); }
});
function openEdit(r) { openModal('\u7f16\u8f91\u8bb0\u5f55', r); }
async function deleteRecord(id) {
  if (!confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u8bb0\u5f55\uff1f')) return;
  await api('DELETE', '/transactions/' + id); loadRecords();
}
async function toggleStatus(r) {
  await api('PUT', '/transactions/' + r.id, { status: r.status === 'done' ? 'pending' : 'done' });
  loadRecords();
}
async function loadStats() {
  var year = $('stats-year').value, month = $('stats-month').value;
  var stats = await api('GET', '/transactions/stats?year=' + year + '&month=' + month);
  $('stats-income').textContent = fmt(stats.income);
  $('stats-expense').textContent = fmt(stats.expense);
  $('stats-balance').textContent = fmt(stats.balance);
  drawChart(7);
}
$('stats-month').addEventListener('change', loadStats);
$('stats-year').addEventListener('change', loadStats);
var chartDays = 7;
qsa('.chart-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    qsa('.chart-btn').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
    chartDays = parseInt(btn.dataset.days);
    drawChart(chartDays);
  });
});
async function drawChart(days){var data=await api('GET','/transactions/expenses?days='+days);var canvas=$('expense-chart');var ctx=canvas.getContext('2d');var rect=canvas.parentElement.getBoundingClientRect();var w=(rect.width-32)||600;var h=250;canvas.width=Math.min(w,900)*(window.devicePixelRatio||1);canvas.height=h*(window.devicePixelRatio||1);ctx.scale(window.devicePixelRatio||1,window.devicePixelRatio||1);ctx.clearRect(0,0,w,h);if(data.length>0){var f=data[0].date;var l=data[data.length-1].date;ctx.fillStyle='#999';ctx.font='12px sans-serif';ctx.textAlign='right';ctx.fillText(f+' ~ '+l,w-10,14);}var maxVal=Math.max.apply(null,data.map(function(d){return d.amount;}))||1;var pad={top:24,bottom:30,left:10,right:10};var cw=w-pad.left-pad.right;var ch=h-pad.top-pad.bottom;var gap=cw/data.length;var bw=Math.min(gap*0.6,days>15?10:30);var fs=days>20?'8px':'10px';data.forEach(function(d,i){var x=pad.left+i*gap+(gap-bw)/2;var bh=(d.amount/maxVal)*ch;var y=pad.top+ch-bh;if(d.amount>0){var g=ctx.createLinearGradient(x,y,x,pad.top+ch);g.addColorStop(0,'#e74c3c');g.addColorStop(1,'#f1948a');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x,y,bw,bh,[3,3,0,0]);ctx.fill();}ctx.fillStyle='#888';ctx.font=fs+' sans-serif';ctx.textAlign='center';ctx.fillText(d.date.slice(8),x+bw/2,h-pad.bottom+16);if(d.amount>0){ctx.fillStyle='#333';ctx.font='bold '+fs+' sans-serif';ctx.fillText(fmt(d.amount),x+bw/2,y-4);}});}async function loadCategories() {
  var cats = await api('GET', '/categories');
  var list = $('category-list'); list.innerHTML = '';
  cats.forEach(function(c) {
    var div = document.createElement('div'); div.className = 'cat-item';
    
    var tl = c.type === 'income' ? '\u6536\u5165' : '\u652f\u51fa';
    var showType = '<span class="cat-type ' + c.type + '">' + tl + '</span>';
    div.innerHTML = '<div><span class="cat-name">' + c.name + '</span>' + showType + '</div>';
    var isOther = c.name.indexOf('\u5176\u4ed6') === 0;
    if (!isOther) {
      div.innerHTML += '<div class="cat-actions"><button class="btn small cat-edit" data-id="' + c.id + '">\u7f16\u8f91</button> <button class="btn small danger cat-del" data-id="' + c.id + '">\u5220\u9664</button></div>';
    }
    var editEl = div.querySelector('.cat-edit');
    if (editEl) editEl.addEventListener('click', function() { openCatEdit(c); });
    var delEl = div.querySelector('.cat-del');
    if (delEl) delEl.addEventListener('click', function() { deleteCategory(c.id); });
    list.appendChild(div);
  });
}
function openCatModal(title, cat) {
  $('cat-modal-title').textContent = title; $('cat-modal').style.display = 'flex';
  if (cat) {
    $('cat-form-id').value = cat.id; $('cat-form-name').value = cat.name; $('cat-form-type').value = cat.type;
  } else {
    $('cat-form-id').value = ''; $('cat-form-name').value = ''; $('cat-form-type').value = 'expense';
  }
}
function closeCatModal() { $('cat-modal').style.display = 'none'; }
$('btn-add-cat').addEventListener('click', function() { openCatModal('\u65b0\u589e\u5206\u7c7b'); });
$('cat-modal-cancel').addEventListener('click', closeCatModal);
$('cat-modal').addEventListener('click', function(e) { if (e.target === $('cat-modal')) closeCatModal(); });
$('cat-modal-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var id = $('cat-form-id').value;
  var body = { name: $('cat-form-name').value, type: $('cat-form-type').value };
  try {
    if (id) { await api('PUT', '/categories/' + id, body); }
    else { await api('POST', '/categories', body); }
    closeCatModal(); loadCategories();
  } catch (err) { alert(err.message); }
});
function openCatEdit(c) { openCatModal('\u7f16\u8f91\u5206\u7c7b', c); }
async function deleteCategory(id) {
  if (!confirm('\u786e\u5b9a\u5220\u9664\u6b64\u5206\u7c7b\uff1f\u5982\u679c\u5206\u7c7b\u4e0b\u6709\u8bb0\u5f55\u5219\u65e0\u6cd5\u5220\u9664\u3002')) return;
  try { await api('DELETE', '/categories/' + id); loadCategories(); }
  catch (err) { alert(err.message); }
}
loadRecords();