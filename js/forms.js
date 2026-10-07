// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// 帳票作成：市の公式様式（画像）に入力内容の文字を描画し、画像化したPDFとして出力する。
// 座標は様式PDFのポイント単位（左上原点、y は文字のベースライン）。
(function () {
  const FONT = '"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo","Noto Sans JP",sans-serif';
  const INK = '#10153a';

  const split = d => (d ? d.split('-') : ['', '', '']);
  const yy = d => split(d)[0] || '';
  const mm = d => (split(d)[1] ? String(+split(d)[1]) : '');
  const dd = d => (split(d)[2] ? String(+split(d)[2]) : '');

  function makePen(ctx, scale, off) {
    const X = x => (x + off.x) * scale, Y = y => (y + off.y) * scale;
    const font = (size, bold) => { ctx.font = `${bold ? '600 ' : ''}${size * scale}px ${FONT}`; };
    const pen = {
      t(x, y, s, size = 9, { align = 'left', max = 0, bold = false } = {}) {
        if (s == null || s === '') return;
        s = String(s); font(size, bold); ctx.fillStyle = INK; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
        if (max) { let sz = size; while (sz > 4 && ctx.measureText(s).width > max * scale) { sz -= 0.25; font(sz, bold); } }
        ctx.fillText(s, X(x), Y(y));
      },
      r(x, y, s, size = 9) { pen.t(x, y, s, size, { align: 'right' }); },
      c(x, y, s, size = 9, max = 0) { pen.t(x, y, s, size, { align: 'center', max }); },
      // 指定幅で折り返し（最大行数）
      wrap(x, y, w, s, size = 7, lines = 2, lh = 1.25) {
        if (!s) return; font(size); const out = []; let cur = '';
        for (const ch of String(s)) { if (ctx.measureText(cur + ch).width > w * scale) { out.push(cur); cur = ch; } else cur += ch; }
        if (cur) out.push(cur);
        if (out.length > lines) { return pen.wrap(x, y, w, s, size - 0.5, lines, lh); }
        out.forEach((l, i) => pen.t(x, y + i * size * lh, l, size));
      },
      // □ のグリフ左上(x,y)と大きさ size の中に ✓ を描く
      chk(x, y, size = 8) {
        const s = size;
        ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1.2, s * 0.16 * scale); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(X(x + s * 0.12), Y(y + s * 0.55));
        ctx.lineTo(X(x + s * 0.42), Y(y + s * 0.88));
        ctx.lineTo(X(x + s * 1.0), Y(y + s * 0.0));
        ctx.stroke(); ctx.restore();
      },
      circle(cx, cy, rx, ry = rx) {
        ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1 * scale; ctx.beginPath();
        ctx.ellipse(X(cx), Y(cy), rx * scale, ry * scale, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      },
      date(d, yx, mx, dx, y, size = 8) { if (!d) return; pen.r(yx - 1.5, y, yy(d), size); pen.r(mx - 1.5, y, mm(d), size); pen.r(dx - 1.5, y, dd(d), size); },
    };
    return pen;
  }

  // ---------- 様式定義 ----------
  const MO_W = 620.13, A4_W = 595.32;

  function facilityName(w) {
    if (!w) return '';
    if (w.name) return w.name;
    const f = (window.FACILITIES || []).find(f => String(f.id) === String(w.id));
    return f ? f.name : '';
  }
  const ageApr1 = birth => { const a = birth && Calc.ageAt(birth, '2027-04-01'); return a && a.y >= 0 ? a.y : ''; };
  const representative = s => (s.application.representative === 'father' ? s.father : s.mother);
  const repRel = s => (s.application.representative === 'father' ? '父' : '母');

  const FORMS = {
    mousikomi: {
      title: '教育・保育給付認定申請書 兼 保育施設利用申込書',
      pages: [
        { bg: 'mo-1', w: MO_W, draw: (p, s) => {
          const h = s.household, app = s.application;
          p.date(app.writtenDate, 505, 541, 577, 127, 9);
          const [z1, z2] = (h.postal || '').replace(/[^0-9]/g, '').match(/^(\d{3})(\d{4})$/)?.slice(1) || ['', ''];
          p.c(96, 149, z1, 9); p.c(145, 149, z2, 9);
          if (h.residence === 'fujisawa') p.chk(74, 163.5, 8.5); else p.chk(74, 174.5, 8.5);
          p.t(122, 171, h.address1, 9, { max: 295 }); p.t(122, 183, h.address2, 8.5, { max: 295 });
          p.t(475, 153, s.father.present ? s.father.phone : '', 9); p.t(475, 181, s.mother.present ? s.mother.phone : '', 9);
          const dys = [0, 36.5, 73];
          s.children.slice(0, 3).forEach((c, k) => {
            const dy = dys[k];
            p.t(65, 213 + dy, c.kana, 7, { max: 135 }); p.t(65, 233 + dy, c.name, 11, { max: 135 });
            if (c.sex === 'male') p.chk(206, 213 + dy, 8); if (c.sex === 'female') p.chk(206, 223 + dy, 8);
            p.date(c.birth, 257, 279, 301, 225 + dy, 8);
            p.c(371, 236 + dy, c.birth ? ageApr1(c.birth) : '', 9);
            const st = { licensed: [206, 489], unlicensed: [214, 493], temporary: [223, 481], ikukyu: [231, 0] }[c.status];
            if (st) { p.chk(421, st[0] + dy, 7); if (st[1]) p.t(st[1], st[0] + 6 + dy, c.statusName, 6.5, { max: 583 - st[1] }); }
            if (c.status === 'other') { p.chk(453, 231 + dy, 7); p.t(487, 237 + dy, c.statusName, 6.5, { max: 95 }); }
          });
          // 開始時期
          if (app.startMonth === '2027-04') {
            if (app.aprilRound === '1') p.chk(61.5, 342, 10.5); else p.chk(157, 345, 8);
            if (app.continueFromR8) { p.chk(211, 336.5, 8); p.t(220, 362, app.r8FirstWish, 7, { max: 110 }); }
          } else if (app.startMonth) { const [y, m] = app.startMonth.split('-'); p.r(385, 357, y, 9); p.r(412, 357, String(+m), 9); }
          if (app.endType === 'preschool') p.chk(476, 345, 8);
          else if (app.endDate) { p.chk(476, 354, 8); p.date(app.endDate, 509, 539, 568, 362, 8); }
          // 希望施設
          const tops = [387, 423, 459, 496, 532];
          app.wishes.slice(0, 10).forEach((w, i) => {
            if (!w.id && !w.name) return;
            const y0 = tops[i % 5], xo = i < 5 ? 0 : 283;
            const id = String(w.id || '').replace(/\D/g, '');
            if (id) { const d = id.padStart(3, '0').slice(-3); [68.5, 82.5, 97].forEach((x, j) => p.c(x + xo, y0 + 25, d[j], 11)); }
            p.wrap(112 + xo, y0 + 19, 112, facilityName(w), 9, 2);
            if (w.visited) p.chk(273 + xo, y0 - 1.5, 7.5); else p.chk(253 + xo, y0 - 1.5, 7.5);
            p.wrap(230 + xo, y0 + 20, 90, w.reason, 7, 2);
          });
          // 世帯の状況
          const rows = [591, 627.5, 664, 700.5, 737, 773.5];
          const rep = representative(s), repKey = s.application.representative;
          const other = repKey === 'father' ? s.mother : s.father;
          const fam = [{ rel: repKey, ...rep }];
          if (other.present || other.name) fam.push({ rel: repKey === 'father' ? 'mother' : 'father', ...other });
          s.members.forEach(m => fam.push({ relText: m.relation, ...m }));
          fam.slice(0, 6).forEach((m, k) => {
            const top = rows[k];
            if (k < 2) { if (m.rel === 'father') p.chk(69, top + 9, 8); if (m.rel === 'mother') p.chk(69, top + 18, 8); }
            else p.c(76, top + 22, m.relText, 8, 26);
            p.t(96, top + 10, m.kana, 7, { max: 150 }); p.t(96, top + 29, m.name, 10.5, { max: 150 });
            p.date(m.birth, 256, 279, 301, top + 20, 8);
            p.c(371, top + 31, m.birth ? ageApr1(m.birth) : '', 9);
            if (m.cohabit === false) p.chk(430, top + 18, 8); else p.chk(430, top + 9, 8);
            p.t(462, top + 22, m.workplace, 8, { max: 130 });
          });
          if (h.familyDisability) p.t(140, 852, h.familyDisabilityNames, 9, { max: 230 });
        } },
        { bg: 'mo-2', w: MO_W, draw: (p, s) => {
          const h = s.household, app = s.application;
          app.continueReview ? p.chk(257, 57, 9) : p.chk(421, 57, 9);
          if (h.reg2026 === 'fujisawa') p.chk(257, 98, 9); else { p.chk(312, 93, 9); p.c(397, 112, h.reg2026Pref, 7.5); p.c(503, 112, h.reg2026City, 7.5); }
          if (h.reg2027 === 'fujisawa') p.chk(257, 134, 9); else { p.chk(312, 130, 9); p.c(397, 148, h.reg2027Pref, 7.5); p.c(503, 148, h.reg2027City, 7.5); }
          if (h.welfare) { p.chk(312, 165, 9); if (h.welfareFrom) p.date(h.welfareFrom, 405, 438, 471, 173, 8); } else p.chk(257, 165, 9);
          h.familyDisability ? p.chk(312, 189, 9) : p.chk(257, 189, 9);
          const nj = [s.father, s.mother].some(x => x.present && x.nurseryJob !== 'none');
          nj ? p.chk(312, 225, 9) : p.chk(257, 225, 9);
          if (h.motherPregnant) {
            p.chk(312, 262, 9);
            p.date(h.dueDate, 390, 417, 444, 296, 8);
            p.date(h.maternityFrom, 426, 447, 468, 306, 7.5); p.date(h.maternityTo, 522, 543, 564, 306, 7.5);
            const ab = { leave: 329, work: 349, ikukyu: 359 }[h.afterBirth]; if (ab) p.chk(312, ab, 9);
          } else p.chk(262, 316, 9);
          s.children.length >= 2 ? p.chk(312, 391, 9) : p.chk(257, 395, 9);
          if (h.singleParent || h.absentParent !== 'none') {
            p.chk(312, 420, 9);
            const sr = { unmarried: 312, divorce: 357, bereaved: 402 }[h.singleReason];
            if (sr) p.chk(sr, 442, 9);
            if (h.singleReason === 'other') { p.chk(312, 453, 9); }
            if (h.singleDate) p.date(h.singleDate, 417, 456, 495, 471, 8);
            if (h.absentParent === 'transfer') p.chk(312, 494, 9);
            if (h.absentParent === 'hospital') p.chk(384, 494, 9);
          } else p.chk(257, 420, 9);
          [s.father, s.mother].some(x => x.present && x.selfEmployed && ['work', 'offer'].includes(x.reason)) ? p.chk(312, 518, 9) : p.chk(257, 518, 9);
          const ik = [s.father, s.mother].some(x => x.present && x.ikukyu);
          if (ik) { p.chk(312, 544, 9); app.ikukyuChoice === 'B' ? p.chk(439, 566, 9) : p.chk(312, 588, 9); } else p.chk(257, 544, 9);
          // ⑫ 見学予定日
          app.wishes.slice(0, 10).forEach((w, i) => {
            if (!w.visitPlan || w.visited) return;
            const y = 655 + (i % 5) * 12, xo = i < 5 ? 0 : 173;
            p.date(w.visitPlan, 341 + xo, 374 + xo, 407 + xo, y, 8);
          });
          // 2 祖父母
          const g = s.grandparents;
          [['pf', 762], ['pm', 787], ['mf', 811], ['mm', 835]].forEach(([k, y]) => {
            const x = g[k]; if (!x || !x.name) return;
            p.t(76, y + 8, x.name, 9, { max: 120 });
            p.date(x.birth, 205, 229, 253, y + 8, 8);
            if (x.cohabit) p.chk(266, y - 4, 8); else { p.chk(354, y - 4, 8); p.t(380, y + 12, x.addr, 6.5, { max: 195 }); }
          });
        } },
        { bg: 'mo-3', w: MO_W, draw: (p, s) => {
          const rowY = { work: 101, offer: 101, seeking: 117, study: 134, illness: 150, disability: 150, care: 167, birth: 183, other: 200 };
          [[s.father, 58, 0], [s.mother, 231, 265]].forEach(([par, cx, xo]) => {
            if (!par.present) return;
            if (par.reason === 'birth') p.chk(231, 183, 9);
            else if (rowY[par.reason]) p.chk(cx, rowY[par.reason], 9);
            if (par.reason === 'other') p.t(402, 207, 'その他', 8);
            if (['work', 'offer'].includes(par.reason)) {
              p.t(124 + xo, 285, par.employer, 8.5, { max: 200 }); p.t(124 + xo, 304, par.employerAddr, 7.5, { max: 200 });
              if (par.employStart) { p.chk(148 + xo, 313, 9); p.date(par.employStart, 186 + xo, 219 + xo, 252 + xo, 321, 8); }
              par.reason === 'offer' ? p.chk(234 + xo, 323.5, 8) : p.chk(165 + xo, 323.5, 8);
              if (par.startOnEntry) p.chk(148 + xo, 334.5, 8);
              if (par.ikukyu) { p.date(par.ikukyuFrom, 180 + xo, 204 + xo, 229 + xo, 362, 7.5); p.date(par.ikukyuTo, 281 + xo, 304 + xo, 327 + xo, 362, 7.5); }
            }
            if (par.reason === 'seeking') {
              const sp = { pause: [148, 371], continueHW: [167, 409], continueHome: [167, 433], stop: [148, 457] }[par.seekingPlan];
              if (sp) p.chk(sp[0] + xo, sp[1], 8.5);
              if (par.seekingPlan === 'continueHW') { p.chk(148 + xo, 397, 8.5); p.c(203 + xo, 416, par.seekingPerWeek, 8); }
              if (par.seekingPlan === 'continueHome') p.chk(148 + xo, 397, 8.5);
            }
            if (par.reason === 'study') {
              p.t(124 + xo, 479, par.schoolName, 8.5, { max: 200 }); p.t(124 + xo, 498, par.schoolAddr, 7.5, { max: 200 });
              p.date(par.schoolFrom, 184 + xo, 209 + xo, 235 + xo, 519, 7.5); p.date(par.schoolTo, 277 + xo, 302 + xo, 328 + xo, 519, 7.5);
            }
            if (['illness', 'disability'].includes(par.reason)) p.t(140 + xo, 550, par.illnessName, 8.5, { max: 180 });
            if (par.reason === 'care') { p.t(155 + xo, 578, par.careTarget, 8.5, { max: 90 }); p.c(301 + xo, 583, par.careRelation, 7, 26); }
          });
          const plan = { extendIkukyu: [48, 663, 198], waitHome: [48, 663, 293], relative: [48, 675], otherFacility: [48, 687], seeking: [48, 712], continueCurrent: [48, 724], withdraw: [48, 737], other: [48, 749] }[s.application.planIfFail];
          if (plan) { p.chk(plan[0], plan[1], 8); if (plan[2]) p.chk(plan[2], plan[1], 8); }
          const pd = s.application.planDetail;
          if (s.application.planIfFail === 'relative') p.t(260, 682, pd, 7, { max: 78 });
          if (s.application.planIfFail === 'otherFacility') p.t(215, 694, pd, 7, { max: 178 });
          if (s.application.planIfFail === 'other') p.t(92, 756, pd, 7.5, { max: 428 });
        } },
        { bg: 'mo-4', w: MO_W, draw: (p, s) => {
          if (s.children.length < 2) return;
          const a = s.application;
          if (a.siblingNoPref) { p.chk(64, 131, 10); return; }
          const pos = { A: 191, B: 215, C: 283, D: 307, E: 331, F: 383, G: 408 };
          [a.sib1, a.sib2, a.sib3].forEach(v => { if (pos[v]) p.chk(64, pos[v] + 0.5, 10); });
        } },
      ],
    },

    chosa: {
      title: '保育施設利用申込みの児童調査書',
      perChild: true,
      pages: [
        { bg: 'jc-1', w: A4_W, draw: (p, s, c) => {
          const v = c.survey;
          p.date(s.application.writtenDate, 407, 444, 481, 55, 9);
          p.t(128, 93, c.kana, 8, { max: 140 }); p.t(128, 111, c.name, 11.5, { max: 140 });
          if (c.sex === 'male') p.circle(306.5, 103, 7); if (c.sex === 'female') p.circle(330.5, 103, 7);
          p.date(c.birth, 462, 504, 549, 98, 9);
          const a = c.birth && Calc.ageAt(c.birth, s.application.writtenDate || new Date().toISOString().slice(0, 10));
          if (a && a.y >= 0) { p.r(503, 116, a.y, 9); p.r(539, 116, a.m, 9); }
          [152, 169, 180, 191].forEach((y, i) => { if (v.confirms[i]) p.chk(49, y, 8); });
          p.c(120, 305, v.birthOrder, 9);
          if (v.delivery === 'normal') p.circle(236.5, 302, 10, 6.5); if (v.delivery === 'abnormal') p.circle(269, 302, 10, 6.5);
          p.c(408, 305, v.gestation, 9);
          p.c(160, 324, v.birthWeight, 9); p.c(369, 324, v.birthHeight, 9);
          p.c(140, 354, v.weight, 9); p.c(285, 354, v.height, 9);
          p.date(v.measureDate, 451, 484, 518, 354, 8.5);
          const ck = { m4: 76, m9: 174, y1: 273, y3: 369 };
          (v.checkups || []).forEach(k => ck[k] != null && p.chk(ck[k], 408, 8));
          const vac = { hepb: [76, 445], pneumo: [160, 445], dpt: [259, 445], bcg: [410, 445], rota: [466, 445], mr: [76, 457], varicella: [188, 457], je: [313, 457], other: [397, 457] };
          (v.vaccines || []).forEach(k => vac[k] && p.chk(vac[k][0], vac[k][1], 8));
          if ((v.vaccines || []).includes('other')) p.t(442, 464, v.vaccineOther, 7, { max: 100 });
          v.devConsult ? p.chk(62, 546, 8.5) : p.chk(62, 535, 8.5);
          v.specialCare ? p.chk(205, 632, 7) : p.chk(135, 632, 7);
          p.c(184, 678, v.walkMonth, 9);
        } },
        { bg: 'jc-2', w: A4_W, draw: (p, s, c) => {
          const v = c.survey;
          const rowY = { none: 165, unknown: 176, yes: 187 }[v.allergy];
          if (rowY) p.chk(49, rowY, 8);
          if (v.allergy !== 'none') {
            const ix = { egg: 104, milk: 146, soy: 188, wheat: 229, buckwheat: 271, other: 313 };
            (v.allergyItems || []).forEach(k => ix[k] && p.chk(ix[k], rowY, 8.5));
            if ((v.allergyItems || []).includes('other')) p.t(360, rowY + 7, v.allergyOther, 7.5, { max: 172 });
          }
          v.illness ? p.chk(49, 505, 8) : p.chk(49, 493, 8);
        } },
      ],
    },

    jyuri: {
      title: '誓約書・保育施設利用申込受理通知',
      pages: [
        { bg: 'js-1', w: A4_W, draw: (p, s) => {
          const app = s.application;
          const start = app.startMonth ? app.startMonth + '-01' : '';
          p.date(start, 265, 301, 329, 281, 8.5);
          p.t(178, 297, representative(s).name, 9.5, { max: 160 }); p.c(396, 297, repRel(s), 7.5);
          const first = app.wishes.find(w => w.id || w.name);
          s.children.slice(0, 3).forEach((c, k) => {
            const y = 319 + k * 16;
            p.t(112, y + 5, c.kana, 5.5, { max: 80 }); p.t(84, y + 14.5, c.name, 8, { max: 105 });
            p.date(c.birth, 205, 222, 239, y + 11, 7.5);
            if (first) p.t(255, y + 11, (first.id ? first.id + ' ' : '') + facilityName(first), 8.5, { max: 185 });
          });
        } },
        { bg: 'js-2', w: A4_W, draw: () => {} },
      ],
    },
  };

  // ---------- 描画・出力 ----------
  const imgCache = {};
  function loadImg(key) {
    if (imgCache[key]) return imgCache[key];
    imgCache[key] = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = window.FORM_BG[key]; });
    return imgCache[key];
  }

  async function renderPage(page, s, child, { grid = false } = {}) {
    const img = await loadImg(page.bg);
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0);
    const scale = cv.width / page.w;
    if (grid) drawGrid(ctx, scale, cv);
    const off = s.formOffset || { x: 0, y: 0 };
    page.draw(makePen(ctx, scale, { x: +off.x || 0, y: +off.y || 0 }), s, child);
    return cv;
  }
  function drawGrid(ctx, scale, cv) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,0,0,.25)'; ctx.fillStyle = 'rgba(255,0,0,.6)'; ctx.font = `${7 * scale}px sans-serif`;
    for (let x = 0; x * scale < cv.width; x += 50) { ctx.beginPath(); ctx.moveTo(x * scale, 0); ctx.lineTo(x * scale, cv.height); ctx.stroke(); ctx.fillText(x, x * scale + 2, 8 * scale); }
    for (let y = 0; y * scale < cv.height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y * scale); ctx.lineTo(cv.width, y * scale); ctx.stroke(); ctx.fillText(y, 2, y * scale - 2); }
    ctx.restore();
  }

  // ---------- データ連携用シート（QRコード） ----------
  // 藤沢市の様式ではなく、追加の1枚。申込内容を圧縮したデータをQRコードにして印刷する。
  const loadScript = src => new Promise((res, rej) => { if ([...document.scripts].some(s => s.src === src)) return res(); const el = document.createElement('script'); el.src = src; el.onload = res; el.onerror = () => rej(new Error('ライブラリを読み込めませんでした（インターネット接続を確認してください）')); document.head.appendChild(el); });
  const QR_LIB = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
  async function renderQRSheet(s) {
    await loadScript(QR_LIB);
    const enc = await QRData.encode(s);
    const W = 2480, H = 3508, mm = W / 210; // A4・300dpi
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.dataset.png = '1';
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const text = (x, y, str, size, { bold = false, color = '#111', align = 'left', max = 0 } = {}) => { ctx.font = `${bold ? '700 ' : ''}${size * mm}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(str, x * mm, y * mm, max ? max * mm : undefined); };
    // 見出し
    ctx.fillStyle = '#0017c1'; ctx.fillRect(15 * mm, 14 * mm, 180 * mm, 1.2 * mm);
    text(15, 26, '保育施設利用申込　データ連携用シート', 7.5, { bold: true });
    text(15, 34, 'このシートは藤沢市の正式な様式ではありません。申込書の内容をデータにしたQRコードです（非公式ツールで作成）。', 3.2, { color: '#333', max: 180 });
    // QRコード
    const n = enc.chunks.length, cols = n === 1 ? 1 : 2;
    const box = n === 1 ? 90 : 82; // 1つあたりの最大一辺（mm）
    enc.chunks.forEach((chunk, i) => {
      const qr = qrcode(0, 'M'); qr.addData(chunk, 'Alphanumeric'); qr.make();
      const count = qr.getModuleCount();
      const px = Math.max(4, Math.floor((box * mm) / (count + 8))); // 1セルの画素数（整数で鮮明に）
      const size = px * (count + 8);
      const col = i % cols, row = Math.floor(i / cols);
      const left = cols === 1 ? (W - size) / 2 : 15 * mm + col * (92 * mm) + (88 * mm - size) / 2;
      const top = 42 * mm + row * (box + 14) * mm;
      ctx.fillStyle = '#000';
      for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) ctx.fillRect(left + (c + 4) * px, top + (r + 4) * px, px, px);
      text((left + size / 2) / mm, top / mm + size / mm + 5, n > 1 ? `QR ${i + 1} / ${n}` : 'QR 1 / 1', 3.4, { align: 'center', bold: true });
    });
    let y = 42 + Math.ceil(n / cols) * (box + 14) + 6;
    // 照合情報と内容の要約
    const a = s.application, rep = a.representative === 'father' ? s.father : s.mother;
    const first = a.wishes.find(w => w.id || w.name);
    const lines = [
      ['照合コード', enc.code + '（読み取り時に同じ値になることを確認してください）'],
      ['作成日時', new Date().toLocaleString('ja-JP')],
      ['代表者', (rep.name || '') + (a.representative === 'father' ? '（父）' : '（母）')],
      ['申込児童', s.children.map(c => `${c.name || ''}（${c.birth || '出生前'}）`).join('、')],
      ['保育希望開始', (a.startMonth || '') + (a.startMonth === '2027-04' ? `（4月${a.aprilRound}次）` : '')],
      ['第1希望', first ? `${first.id || ''} ${first.name || ''}` : ''],
      ['データ量', `${enc.bytes}バイト・QR ${n}個`],
    ];
    ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
    ctx.strokeRect(15 * mm, y * mm, 180 * mm, (lines.length * 8 + 6) * mm);
    lines.forEach(([k, v], i) => { text(20, y + 9 + i * 8, k, 3.6, { bold: true, color: '#333' }); text(58, y + 9 + i * 8, v, 3.6, { max: 132 }); });
    y += lines.length * 8 + 14;
    const notes = [
      '【職員の方へ】',
      '・QRコードの読み取りは https://hoiku.pons-llc.com/#reader で行えます（読み取りはブラウザ内で処理され、外部に送信されません）。',
      '・QRリーダー（キーボード入力型）で読んだ文字列の貼り付け、スキャンしたPDF・画像の読み込みに対応し、CSVで出力できます。',
      '・印刷後に手書きで修正・追記された場合は、紙の申込書の記載が優先されます。QRの内容と紙の内容を必ず照合してください。',
      '・マイナンバー、署名、誓約書のチェックはQRに含まれていません。',
      '',
      '【申込者の方へ】',
      '・このシートは申込書類と一緒に提出してください。提出が必須の書類ではありません。',
      '・このシートを受け付けるかどうか、データとして利用するかどうかは藤沢市の判断によります。',
      '・QRコードには申込書に書いた個人情報が入っています。取り扱いにご注意ください。',
    ];
    notes.forEach((t, i) => text(15, y + i * 6.2, t, 3.2, { bold: t.startsWith('【'), color: '#222', max: 180 }));
    text(15, 287, '藤沢市 保育所申込ポータル（非公式・合同会社Pons）https://hoiku.pons-llc.com/ ／ データ形式：FH1（JSON・deflate・Base45）', 2.6, { color: '#666', max: 180 });
    return cv;
  }

  async function renderForm(key, s, opts) {
    if (key === 'qrsheet') return [{ canvas: await renderQRSheet(s), label: 'データ連携用シート（QRコード）' }];
    const f = FORMS[key]; const out = [];
    const targets = f.perChild ? s.children.map((c, i) => ({ c, label: `（${c.name || '児童' + (i + 1)}）` })) : [{ c: null, label: '' }];
    for (const t of targets) for (const pg of f.pages) out.push({ canvas: await renderPage(pg, s, t.c, opts), label: f.title + t.label });
    return out;
  }

  async function toPDF(canvases, filename) {
    if (!window.jspdf) throw new Error('PDFライブラリ（jsPDF）を読み込めませんでした。インターネット接続を確認してください。');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    canvases.forEach((cv, i) => {
      if (i) doc.addPage('a4', 'portrait');
      const png = cv.dataset.png === '1';
      const data = png ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.88);
      const pw = 210, ph = 297, r = cv.width / cv.height;
      let w = pw, h = pw / r; if (h > ph) { h = ph; w = ph * r; }
      doc.addImage(data, png ? 'PNG' : 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST');
    });
    doc.setProperties({ title: filename, creator: '藤沢市保育所申込ポータル（非公式）' });
    doc.save(filename);
  }

  window.Forms = { FORMS, renderForm, toPDF };
})();
