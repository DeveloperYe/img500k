(function () {
  'use strict';

  var PRESET_BYTES = [200 * 1024, 500 * 1024, 1024 * 1024, 2 * 1024 * 1024, 5 * 1024 * 1024];
  var DEFAULT_PRESET_INDEX = 1;
  var MIN_BYTES = 10 * 1024;
  var MAX_BYTES_LIMIT = 10 * 1024 * 1024;

  var IMG_EXTS = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif' };

  var state = {
    items: [],
    uidSeq: 0,
    processing: false,
    maxBytes: PRESET_BYTES[DEFAULT_PRESET_INDEX],
    presetIndex: DEFAULT_PRESET_INDEX
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    els.dropzone = $('dropzone');
    els.fileInput = $('file-input');
    els.urlInput = $('url-input');
    els.urlAddBtn = $('url-add-btn');
    els.optConvert = $('opt-convert');
    els.sizeSlider = $('size-slider');
    els.sizeInput = $('size-input');
    els.sizeUnit = $('size-unit');
    els.targetBadge = $('target-badge');
    els.toolbar = $('toolbar');
    els.fileList = $('file-list');
    els.emptyTip = $('empty-tip');
    els.statCount = $('stat-count');
    els.statBefore = $('stat-before');
    els.statAfter = $('stat-after');
    els.statSaved = $('stat-saved');
    els.downloadAllBtn = $('download-all-btn');
    els.zipBtn = $('zip-btn');
    els.clearBtn = $('clear-btn');
    els.progressWrap = $('progress-wrap');
    els.progressFill = $('progress-fill');
    els.progressText = $('progress-text');
    els.toast = $('toast');

    bindEvents();
    updateSizeUI();
  }

  function bindEvents() {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
        $('panel-' + btn.dataset.tab).classList.add('active');
      });
    });

    els.dropzone.addEventListener('click', function () { els.fileInput.click(); });
    els.dropzone.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); els.fileInput.click(); }
    });
    ['dragenter', 'dragover'].forEach(function (ev) {
      els.dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        els.dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      els.dropzone.addEventListener(ev, function (e) {
        e.preventDefault();
        els.dropzone.classList.remove('dragover');
      });
    });
    els.dropzone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    });
    els.fileInput.addEventListener('change', function () {
      if (els.fileInput.files.length) handleFiles(els.fileInput.files);
      els.fileInput.value = '';
    });

    els.urlAddBtn.addEventListener('click', function () {
      var text = els.urlInput.value;
      if (!text.trim()) { toast('请先粘贴图片直链', true); return; }
      addUrls(text);
      els.urlInput.value = '';
    });

    els.downloadAllBtn.addEventListener('click', downloadAll);
    els.zipBtn.addEventListener('click', zipAll);
    els.clearBtn.addEventListener('click', clearAll);

    els.fileList.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var item = state.items.find(function (i) { return String(i.id) === btn.dataset.id; });
      if (!item) return;
      if (btn.classList.contains('dl-btn') && item.status === 'done') downloadBlob(item.blob, item.fileName());
      if (btn.classList.contains('rm-btn')) removeItem(item.id);
    });

    els.sizeSlider.addEventListener('input', function () {
      var idx = parseInt(els.sizeSlider.value, 10);
      if (isNaN(idx) || idx < 0 || idx >= PRESET_BYTES.length) return;
      state.presetIndex = idx;
      setMaxBytes(PRESET_BYTES[idx], { fromSlider: true });
    });

    var inputTimer = null;
    var syncFromInput = function () {
      var val = parseFloat(els.sizeInput.value);
      if (isNaN(val) || val <= 0) return;
      var bytes = els.sizeUnit.value === 'MB' ? val * 1024 * 1024 : val * 1024;
      bytes = Math.max(MIN_BYTES, Math.min(MAX_BYTES_LIMIT, Math.round(bytes)));
      setMaxBytes(bytes);
    };
    els.sizeInput.addEventListener('input', function () {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(syncFromInput, 250);
    });
    els.sizeInput.addEventListener('blur', syncFromInput);
    els.sizeUnit.addEventListener('change', syncFromInput);
  }

  function fmtTarget(bytes) {
    if (bytes < 1024) return '≤ ' + bytes + ' B';
    if (bytes < 1024 * 1024) {
      var kb = bytes / 1024;
      return '≤ ' + (kb === Math.floor(kb) ? kb : Math.round(kb)) + ' KB';
    }
    var mb = bytes / 1024 / 1024;
    return '≤ ' + (mb === Math.floor(mb) ? mb : mb.toFixed(1)) + ' MB';
  }

  function updateSizeUI(opts) {
    opts = opts || {};
    var bytes = state.maxBytes;
    els.targetBadge.textContent = fmtTarget(bytes);
    var idx = PRESET_BYTES.indexOf(bytes);
    if (idx >= 0) {
      state.presetIndex = idx;
      if (!opts.fromSlider) els.sizeSlider.value = String(idx);
    }
    if (bytes < 1024 * 1024) {
      els.sizeUnit.value = 'KB';
      els.sizeInput.value = String(Math.round(bytes / 1024));
    } else {
      els.sizeUnit.value = 'MB';
      var mb = bytes / 1024 / 1024;
      els.sizeInput.value = (mb === Math.floor(mb) ? String(mb) : mb.toFixed(1));
    }
  }

  function setMaxBytes(bytes, opts) {
    opts = opts || {};
    if (bytes === state.maxBytes) return;
    state.maxBytes = bytes;
    updateSizeUI(opts);
    if (state.items.length && !state.processing) {
      state.items.forEach(function (it) {
        if (it.status === 'done') {
          it.status = 'pending';
          it.progress = 0;
          it.error = '';
          it.blob = null;
          it.untouched = false;
          if (it.previewUrl) { URL.revokeObjectURL(it.previewUrl); it.previewUrl = null; }
        }
      });
      renderList();
      refreshNumbers();
      updateToolbar();
      processQueue();
    } else if (state.items.length) {
      toast('正在处理中，完成后将按新目标体积重新压缩');
    }
  }

  /* ---------------- 添加图片 ---------------- */

  function uid() { return ++state.uidSeq; }

  function isZipFile(f) {
    return f.type === 'application/zip' ||
      f.type === 'application/x-zip-compressed' ||
      /\.zip$/i.test(f.name);
  }

  function handleFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    var imgs = files.filter(function (f) {
      return f.type.indexOf('image/') === 0 && f.type !== 'image/svg+xml';
    });
    var zips = files.filter(isZipFile);
    if (imgs.length) addFiles(imgs);
    zips.forEach(function (z) { addZipFile(z); });
    if (!imgs.length && !zips.length) {
      toast('未找到有效图片或 ZIP 压缩包（不支持 SVG / 非图片文件）', true);
    }
  }

  function addZipFile(file) {
    if (typeof JSZip === 'undefined') {
      toast('JSZip 库加载失败，无法解压，请检查网络后刷新重试', true);
      return;
    }
    toast('正在解压 ' + file.name + ' ……');
    JSZip.loadAsync(file).then(function (zip) {
      var tasks = [];
      var count = 0;
      zip.forEach(function (path, entry) {
        if (entry.dir) return;
        if (/(^|\/)__MACOSX\//.test(path) || /(^|\/)\._/.test(path)) return;
        if (count >= 500) return;
        var base = path.split('/').pop() || '';
        var ext = (base.split('.').pop() || '').toLowerCase();
        if (!IMG_EXTS[ext]) return;
        count++;
        tasks.push(entry.async('blob').then(function (blob) {
          return new File([blob], base, { type: IMG_EXTS[ext] });
        }));
      });
      return Promise.all(tasks).then(function (files) {
        if (!files.length) {
          toast('压缩包内没有找到图片文件', true);
          return;
        }
        toast('从 ' + file.name + ' 解压出 ' + files.length + ' 张图片');
        addFiles(files);
      });
    }).catch(function (err) {
      toast('解压失败：' + file.name + '（' + err.message + '）', true);
    });
  }

  function addFiles(fileList) {
    var files = Array.prototype.filter.call(fileList, function (f) {
      return f.type.indexOf('image/') === 0 && f.type !== 'image/svg+xml';
    });
    if (!files.length) {
      toast('未找到有效位图（不支持 SVG / 非图片文件）', true);
      return;
    }
    files.forEach(function (f) {
      state.items.push({
        id: uid(),
        file: f,
        name: f.name,
        size: f.size,
        status: 'pending',
        progress: 0,
        error: '',
        blob: null,
        mime: '',
        ext: '',
        width: 0,
        height: 0,
        untouched: false,
        srcUrl: URL.createObjectURL(f),
        previewUrl: null
      });
    });
    refreshNumbers();
    renderList();
    updateToolbar();
    processQueue();
  }

  function addUrls(text) {
    var urls = text.split(/[\s,，;；]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    if (!urls.length) return;
    toast('正在加载直链图片……');
    urls.forEach(function (u) {
      urlToFile(u)
        .then(function (file) { addFiles([file]); })
        .catch(function (err) {
          toast('链接加载失败：' + u + '（' + err.message + '）', true);
          refreshNumbers();
          renderList();
          updateToolbar();
        });
    });
  }

  function urlToFile(raw) {
    var url = raw.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    var name = 'image';
    try {
      var p = new URL(url);
      var n = decodeURIComponent(p.pathname.split('/').pop() || 'image');
      if (n && n.indexOf('.') > 0) name = n;
    } catch (e) { /* 忽略非法 URL，用默认名 */ }

    var fallback = function (err) {
      var bare = url.replace(/^https?:\/\//i, '');
      return fetch('https://images.weserv.nl/?url=' + encodeURIComponent(bare)).then(function (r) {
        if (!r.ok) throw new Error('源站不允许跨域，代理也失败了');
        return r.blob();
      });
    };

    return fetch(url, { mode: 'cors' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.blob();
      })
      .catch(fallback)
      .then(function (blob) {
        if (blob.type && blob.type.indexOf('image/') !== 0) throw new Error('该链接不是图片');
        var ext = name.split('.').pop().toLowerCase();
        if (!blob.type && /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(name)) {
          var m = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif' };
          return new File([blob], name, { type: m[ext] || 'image/jpeg' });
        }
        return new File([blob], name, { type: blob.type || 'image/jpeg' });
      });
  }

  /* ---------------- 压缩队列 ---------------- */

  function processQueue() {
    if (state.processing) return;
    state.processing = true;
    els.progressWrap.hidden = false;
    updateGlobalProgress();

    var next = function () {
      var pending = state.items.filter(function (i) { return i.status === 'pending'; });
      if (!pending.length) {
        state.processing = false;
        els.progressWrap.hidden = true;
        updateToolbar();
        if (state.items.some(function (i) { return i.status === 'done'; })) {
          toast('全部压缩完成');
        }
        return;
      }
      compressItem(pending[0]).then(next);
    };
    next();
  }

  function compressItem(item) {
    item.status = 'working';
    renderItem(item);
    return compressOne(item.file, function (p) {
      item.progress = Math.max(item.progress, p);
      renderItem(item);
      updateGlobalProgress();
    })
      .then(function (r) {
        item.blob = r.blob;
        item.mime = r.mime;
        item.ext = r.ext;
        item.width = r.width;
        item.height = r.height;
        item.outW = r.outW || r.width;
        item.outH = r.outH || r.height;
        item.untouched = !!r.untouched;
        item.outSize = r.blob.size;
        item.status = 'done';
        var prev = item.previewUrl;
        item.previewUrl = URL.createObjectURL(r.blob);
        if (prev) URL.revokeObjectURL(prev);
        refreshNumbers();
        renderItem(item);
        updateToolbar();
        updateGlobalProgress();
      })
      .catch(function (err) {
        item.status = 'error';
        item.error = err && err.message ? err.message : '压缩失败';
        renderItem(item);
        updateToolbar();
        updateGlobalProgress();
      });
  }

  /* ---------------- 压缩管线 ---------------- */

  function detectType(file) {
    var t = (file.type || '').toLowerCase();
    if (t.indexOf('png') >= 0) return 'png';
    if (t.indexOf('webp') >= 0) return 'webp';
    if (t.indexOf('gif') >= 0) return 'gif';
    if (t.indexOf('bmp') >= 0) return 'bmp';
    if (t.indexOf('avif') >= 0) return 'avif';
    return 'jpeg';
  }

  function mimeToExt(mime) {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/gif') return 'gif';
    return 'jpg';
  }

  function webpSupported() {
    var c = document.createElement('canvas');
    return c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  function decideTarget(type, allowConvert) {
    if (type === 'jpeg') return 'image/jpeg';
    if (type === 'webp') return 'image/webp';
    if (type === 'png' && allowConvert) return webpSupported() ? 'image/webp' : 'image/jpeg';
    if (type === 'png') return 'image/png';
    return webpSupported() ? 'image/webp' : 'image/jpeg';
  }

  function loadBitmap(file) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file, { imageOrientation: 'from-image' })
        .then(function (bmp) {
          return { bitmap: bmp, width: bmp.width, height: bmp.height };
        })
        .catch(function () { return loadViaImg(file); });
    }
    return loadViaImg(file);
  }

  function loadViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve({ bitmap: img, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('无法解析该图片'));
      };
      img.src = url;
    });
  }

  function encode(bitmap, mime, quality, w, h, whiteBg) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    if (whiteBg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    return new Promise(function (resolve, reject) {
      try {
        canvas.toBlob(function (b) {
          b ? resolve(b) : reject(new Error('浏览器不支持编码 ' + mime));
        }, mime, quality);
      } catch (err) {
        reject(new Error('浏览器不支持编码 ' + mime));
      }
    });
  }

  function iterCompress(bitmap, mime, onProgress) {
    var needWhite = mime === 'image/jpeg';
    var origW = bitmap.width;
    var origH = bitmap.height;
    var isPng = mime === 'image/png';
    var qualities = [0.95, 0.75, 0.55, 0.4];
    var scale = 1;
    var scaleFactor = 0.8;
    var totalStages = Math.ceil(Math.log(0.05) / Math.log(scaleFactor));
    var stage = 0;
    var best = null;

    return new Promise(function (resolve, reject) {
      var loop = function () {
        if (scale < 0.05) {
          if (best) { resolve(best); return; }
          reject(new Error('无法压缩到目标体积以内'));
          return;
        }
        var w = Math.max(2, Math.round(origW * scale));
        var h = Math.max(2, Math.round(origH * scale));
        var qs = isPng ? [0.9] : qualities;
        var qi = 0;

        var encodeNext = function () {
          if (qi >= qs.length) {
            scale *= scaleFactor;
            stage++;
            loop();
            return;
          }
          var q = qs[qi++];
          encode(bitmap, mime, q, w, h, needWhite)
            .then(function (blob) {
              if (blob.size <= state.maxBytes) {
                resolve({ blob: blob, outW: w, outH: h });
                return;
              }
              if (!best || blob.size < best.blob.size) best = { blob: blob, outW: w, outH: h };
              onProgress(Math.min(95, 10 + (stage / totalStages) * 85));
              encodeNext();
            })
            .catch(reject);
        };
        encodeNext();
      };
      loop();
    });
  }

  function compressOne(file, onProgress) {
    return loadBitmap(file).then(function (info) {
      var type = detectType(file);
      var width = info.width;
      var height = info.height;
      var bitmap = info.bitmap;

      if (file.size <= state.maxBytes && (type === 'jpeg' || type === 'png' || type === 'webp' || type === 'gif' || type === 'bmp' || type === 'avif')) {
        var keepExt = mimeToExt(file.type || 'image/' + type);
        return {
          blob: file,
          mime: file.type || 'image/' + type,
          ext: keepExt,
          width: width,
          height: height,
          untouched: true
        };
      }

      var allowConvert = els.optConvert.checked;
      var targetMime = decideTarget(type, allowConvert);

      if (type === 'jpeg') {
        if (typeof imageCompression === 'undefined') {
          return iterCompress(bitmap, targetMime, onProgress).then(function (r) {
            return { blob: r.blob, mime: targetMime, ext: mimeToExt(targetMime), width: width, height: height, outW: r.outW, outH: r.outH };
          });
        }
        return imageCompression(file, {
          maxSizeMB: state.maxBytes / 1024 / 1024,
          useWebWorker: true,
          initialQuality: 0.95,
          maxIteration: 40,
          onProgress: onProgress
        }).then(function (result) {
          if (result.size > state.maxBytes) {
            return iterCompress(bitmap, targetMime, onProgress).then(function (r) {
              return { blob: r.blob, mime: targetMime, ext: mimeToExt(targetMime), width: width, height: height, outW: r.outW, outH: r.outH };
            });
          }
          return { blob: result, mime: result.type || 'image/jpeg', ext: 'jpg', width: width, height: height };
        }).catch(function () {
          return iterCompress(bitmap, targetMime, onProgress).then(function (r) {
            return { blob: r.blob, mime: targetMime, ext: mimeToExt(targetMime), width: width, height: height, outW: r.outW, outH: r.outH };
          });
        });
      }

      onProgress(5);
      return iterCompress(bitmap, targetMime, onProgress).then(function (r) {
        return { blob: r.blob, mime: targetMime, ext: mimeToExt(targetMime), width: width, height: height, outW: r.outW, outH: r.outH };
      });
    });
  }

  /* ---------------- 编号与渲染 ---------------- */

  function refreshNumbers() {
    state.items.forEach(function (it, idx) {
      it.num = idx + 1;
      it.fileName = function () { return 'p' + it.num + '.' + (it.ext || 'jpg'); };
    });
  }

  function renderList() {
    els.emptyTip.hidden = state.items.length > 0;
    els.fileList.innerHTML = '';
    state.items.forEach(function (it) { els.fileList.appendChild(buildItemEl(it)); });
  }

  function renderItem(item) {
    var old = els.fileList.querySelector('[data-id="' + item.id + '"]');
    if (old && old.parentNode) old.parentNode.replaceChild(buildItemEl(item), old);
    else if (!state.items.length) renderList();
  }

  function buildItemEl(item) {
    var el = document.createElement('div');
    el.className = 'file-item';
    el.dataset.id = item.id;

    var thumb = document.createElement('img');
    thumb.className = 'thumb';
    var src = item.previewUrl || item.srcUrl;
    if (src) {
      thumb.src = src;
    } else {
      thumb.className = 'thumb placeholder';
      thumb.alt = '';
    }

    var info = document.createElement('div');
    info.className = 'file-info';

    var nameRow = document.createElement('div');
    nameRow.className = 'file-name-row';
    var pn = document.createElement('span');
    pn.className = 'file-pn';
    pn.textContent = 'p' + item.num;
    var origin = document.createElement('span');
    origin.className = 'file-origin-name';
    origin.textContent = item.name;
    origin.title = item.name;
    nameRow.appendChild(pn);
    nameRow.appendChild(origin);

    var meta = document.createElement('div');
    meta.className = 'file-meta';
    var dims = (item.width && item.height) ? ' · ' + item.width + '×' + item.height : '';
    if (item.status === 'done') {
      var ratio = item.outSize / item.size;
      var delta = document.createElement('span');
      delta.className = 'delta ' + (ratio <= 1 ? 'saved' : 'grew');
      var pct = Math.round((1 - ratio) * 100);
      delta.textContent = ratio <= 1 ? ' -' + pct + '%' : ' +' + Math.abs(pct) + '%';
      meta.appendChild(document.createTextNode(fmtSize(item.size) + ' → '));
      var strong = document.createElement('b');
      strong.textContent = fmtSize(item.outSize);
      meta.appendChild(strong);
      meta.appendChild(delta);
      var dims2 = (item.outW && item.outH && (item.outW !== item.width || item.outH !== item.height))
        ? ' · 缩放 ' + item.outW + '×' + item.outH : '';
      meta.appendChild(document.createTextNode(dims + dims2));
      if (item.untouched) {
        var tag = document.createElement('span');
        tag.style.color = '#12b886';
        tag.textContent = ' · 原样保留';
        meta.appendChild(tag);
      }
    } else if (item.status === 'working') {
      meta.textContent = fmtSize(item.size) + dims;
    } else if (item.status === 'error') {
      meta.textContent = fmtSize(item.size) + dims;
    } else {
      meta.textContent = fmtSize(item.size) + dims;
    }

    var status = document.createElement('div');
    status.className = 'file-status ' + (item.status === 'error' ? 'error' : (item.status === 'done' ? 'done' : ''));
    if (item.status === 'pending') {
      status.textContent = '等待压缩…';
    } else if (item.status === 'working') {
      var spinner = document.createElement('span');
      spinner.className = 'spinner';
      status.appendChild(spinner);
      var mini = document.createElement('div');
      mini.className = 'mini-progress';
      var fill = document.createElement('div');
      fill.className = 'mini-progress-fill';
      fill.style.width = Math.min(100, Math.round(item.progress || 0)) + '%';
      mini.appendChild(fill);
      status.appendChild(mini);
      var txt = document.createElement('span');
      txt.textContent = '压缩中 ' + Math.min(100, Math.round(item.progress || 0)) + '%';
      status.appendChild(txt);
    } else if (item.status === 'done') {
      status.textContent = item.untouched ? '✓ 已就绪（未超过上限）' : '✓ 已压缩至 ' + fmtSize(item.outSize);
    } else {
      status.textContent = '✗ ' + item.error;
    }

    info.appendChild(nameRow);
    info.appendChild(meta);
    info.appendChild(status);

    var actions = document.createElement('div');
    actions.className = 'file-actions';
    var dl = document.createElement('button');
    dl.className = 'btn dl-btn';
    dl.dataset.id = item.id;
    dl.textContent = '下载';
    dl.disabled = item.status !== 'done';
    var rm = document.createElement('button');
    rm.className = 'btn btn-ghost rm-btn';
    rm.dataset.id = item.id;
    rm.textContent = '✕';
    actions.appendChild(dl);
    actions.appendChild(rm);

    el.appendChild(thumb);
    el.appendChild(info);
    el.appendChild(actions);
    return el;
  }

  function removeItem(id) {
    var idx = state.items.findIndex(function (i) { return i.id === id; });
    if (idx < 0) return;
    var it = state.items[idx];
    if (it.srcUrl) URL.revokeObjectURL(it.srcUrl);
    if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    state.items.splice(idx, 1);
    refreshNumbers();
    renderList();
    updateToolbar();
    if (state.items.length && state.items.some(function (i) { return i.status === 'pending'; })) processQueue();
  }

  function clearAll() {
    state.items.forEach(function (it) {
      if (it.srcUrl) URL.revokeObjectURL(it.srcUrl);
      if (it.previewUrl) URL.revokeObjectURL(it.previewUrl);
    });
    state.items = [];
    state.processing = false;
    els.progressWrap.hidden = true;
    refreshNumbers();
    renderList();
    updateToolbar();
  }

  /* ---------------- 下载 ---------------- */

  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function downloadAll() {
    var done = state.items.filter(function (i) { return i.status === 'done'; });
    if (!done.length) return;
    var delay = 0;
    done.forEach(function (it) {
      setTimeout(function () { downloadBlob(it.blob, it.fileName()); }, delay);
      delay += 300;
    });
    if (done.length > 1) toast('浏览器可能拦截多个下载：若弹出提示请选择“允许”，或用 ZIP 一键打包');
  }

  function zipAll() {
    var done = state.items.filter(function (i) { return i.status === 'done'; });
    if (!done.length) return;
    if (typeof JSZip === 'undefined') { toast('JSZip 库加载失败，请检查网络后刷新重试', true); return; }
    els.progressWrap.hidden = false;
    els.progressFill.style.width = '0%';
    els.progressText.textContent = '正在打包 ZIP…';

    var zip = new JSZip();
    done.forEach(function (it) { zip.file(it.fileName(), it.blob); });
    zip.generateAsync({ type: 'blob' }, function (meta) {
      els.progressFill.style.width = meta.percent + '%';
      els.progressText.textContent = '打包中 ' + Math.round(meta.percent) + '%';
    }).then(function (content) {
      var name = done.length > 1 ? 'p1-p' + done.length + '.zip' : 'p1.zip';
      downloadBlob(content, name);
      els.progressWrap.hidden = true;
      toast('ZIP 已生成：' + name);
    }).catch(function () {
      els.progressWrap.hidden = true;
      toast('打包失败，请重试', true);
    });
  }

  /* ---------------- 工具栏与统计 ---------------- */

  function updateToolbar() {
    var total = state.items.length;
    els.toolbar.hidden = total === 0;
    if (!total) return;
    els.statCount.textContent = total + ' 张';

    var done = state.items.filter(function (i) { return i.status === 'done'; });
    var working = state.items.filter(function (i) { return i.status === 'working'; }).length;
    var errors = state.items.filter(function (i) { return i.status === 'error'; }).length;

    var totalBefore = state.items.reduce(function (s, i) { return s + i.size; }, 0);
    var totalAfter = done.reduce(function (s, i) { return s + i.outSize; }, 0);

    els.statBefore.innerHTML = '原大小 <b>' + fmtSize(totalBefore) + '</b>';
    els.statAfter.innerHTML = '压缩后 <b>' + fmtSize(totalAfter) + '</b>';
    if (done.length) {
      var pct = Math.round((1 - totalAfter / (done.reduce(function (s, i) { return s + i.size; }, 0))) * 100);
      els.statSaved.textContent = '节省 ' + (pct >= 0 ? pct : 0) + '%';
      els.statSaved.hidden = false;
    } else {
      els.statSaved.hidden = true;
    }

    var busy = working > 0 || state.processing;
    els.downloadAllBtn.disabled = done.length === 0 || busy;
    els.zipBtn.disabled = done.length === 0 || busy;

    var hint = [];
    if (errors) hint.push(errors + ' 张失败');
    if (done.length < total && !busy) hint.push((total - done.length - errors) + ' 张未完成');
    if (hint.length) {
      els.progressText.textContent = hint.join('，');
      els.progressWrap.hidden = false;
    }
  }

  function updateGlobalProgress() {
    var total = state.items.length;
    if (!total) return;
    var finished = state.items.filter(function (i) { return i.status === 'done' || i.status === 'error'; }).length;
    els.progressFill.style.width = Math.round(finished / total * 100) + '%';
    els.progressText.textContent = '压缩进度 ' + finished + '/' + total;
  }

  /* ---------------- 工具函数 ---------------- */

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  var toastTimer = null;
  function toast(msg, isError) {
    els.toast.textContent = msg;
    els.toast.classList.toggle('error', !!isError);
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.hidden = true; }, 3500);
  }
})();
