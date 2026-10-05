// SPDX-License-Identifier: Apache-2.0
// Copyright 2026 合同会社Pons
// 自己情報はすべてブラウザの localStorage にのみ保存する（サーバー送信なし）
(function () {
  const KEY = 'fujisawa-hoiku-portal:v1';
  const TERMS_KEY = 'fujisawa-hoiku-portal:terms-agreed';

  const emptyParent = () => ({
    present: true, name: '', kana: '', birth: '', phone: '', cohabit: true, workplace: '',
    reason: 'work', // work offer seeking study illness disability care disaster birth other
    hours: '', employer: '', employerAddr: '', employStart: '', employState: 'working', startOnEntry: false,
    ikukyu: false, ikukyuFrom: '', ikukyuTo: '',
    selfEmployed: false, executiveSelfCert: false, spouseCompany: false,
    illnessLevel: 'daytime', illnessName: '', disabilityLevel: 'severe',
    schoolName: '', schoolAddr: '', schoolFrom: '', schoolTo: '',
    careTarget: '', careRelation: '',
    seekingPlan: 'pause', seekingPerWeek: '',
    nurseryJob: 'none', // none teacher assistant
  });

  const emptyChild = () => ({
    name: '', kana: '', sex: '', birth: '', unborn: false,
    status: 'none', statusName: '', // none licensed unlicensed temporary ikukyu other
    paidCare: 'none', // none 3days weekly
    special: false,
    survey: {
      birthOrder: '', delivery: '', gestation: '', birthWeight: '', birthHeight: '',
      weight: '', height: '', measureDate: '',
      checkups: [], vaccines: [], vaccineOther: '',
      devConsult: false, specialCare: false, walkMonth: '',
      allergy: 'none', allergyItems: [], allergyOther: '',
      illness: false, confirms: [false, false, false, false],
    },
  });

  const emptyMember = () => ({ relation: '', name: '', kana: '', birth: '', cohabit: true, workplace: '' });
  const emptyWish = () => ({ id: '', name: '', visited: false, reason: '', visitPlan: '' });

  const defaults = () => ({
    version: 1,
    updatedAt: null,
    household: {
      postal: '', residence: 'fujisawa', // fujisawa moving outsideWork chigasaki
      address1: '', address2: '',
      singleParent: false, singleReason: '', singleDate: '',
      welfare: false, welfareFrom: '', welfareSelfReliance: false,
      reg2026: 'fujisawa', reg2026Pref: '', reg2026City: '',
      reg2027: 'fujisawa', reg2027Pref: '', reg2027City: '',
      taxFiled: true,
      taxStatus: 'taxed', // welfare nontax zeroIncomeLevy taxed
      shotokuwari: '', // 父母（又は祖父母）の市町村民税所得割額の合算
      childOrder: 1, // 保育料算定上の第何子
      siblingsUnder18: 1,
      familyDisability: false, familyDisabilityNames: '',
      familyCareC7: false,
      absentParent: 'none', // none transfer hospital
      noRelativeUnder65: false,
      arrears: false, pastDecline: false,
      graduateSmall: false, siblingSameFacility: false,
      contractDocs: true,
      motherPregnant: false, dueDate: '', maternityFrom: '', maternityTo: '', afterBirth: 'ikukyu',
    },
    father: emptyParent(),
    mother: emptyParent(),
    children: [emptyChild()],
    members: [], // 代表者・父母以外の同居／同一生計家族
    grandparents: { pf: { name: '', birth: '', cohabit: false, addr: '' }, pm: { name: '', birth: '', cohabit: false, addr: '' }, mf: { name: '', birth: '', cohabit: false, addr: '' }, mm: { name: '', birth: '', cohabit: false, addr: '' } },
    application: {
      representative: 'mother',
      writtenDate: '',
      startMonth: '2027-04', aprilRound: '1', continueFromR8: false, r8FirstWish: '',
      endType: 'preschool', endDate: '',
      continueReview: true,
      ikukyuChoice: 'A',
      method: 'mail', // mail window online
      wishes: Array.from({ length: 10 }, emptyWish),
      siblingNoPref: false, sib1: '', sib2: '', sib3: '',
      planIfFail: 'extendIkukyu', planDetail: '',
      transfer: false, preBirth: false,
    },
    favorites: [],
    checklist: {},
    formOffset: { x: 0, y: 0 },
    chat: { answers: {} }, // チャット入力の進行状況（質問ID → 答え）
    ui: { profileMode: "chat" },
  });

  function deepMerge(base, src) {
    if (Array.isArray(base)) return Array.isArray(src) ? src : base;
    if (base && typeof base === 'object') {
      const out = { ...base };
      if (src && typeof src === 'object') for (const k of Object.keys(src)) out[k] = k in base ? deepMerge(base[k], src[k]) : src[k];
      return out;
    }
    return src === undefined ? base : src;
  }

  let state;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = deepMerge(defaults(), raw ? JSON.parse(raw) : {});
    } catch (e) { state = defaults(); }
    // 配列要素の欠損項目を補完
    state.children = state.children.map(c => deepMerge(emptyChild(), c));
    state.members = state.members.map(m => deepMerge(emptyMember(), m));
    // 希望園は空き番号を詰める（第1希望から連続させる）
    state.application.wishes = state.application.wishes.filter(w => w && (w.id || w.name)).map(w => deepMerge(emptyWish(), w));
    while (state.application.wishes.length < 10) state.application.wishes.push(emptyWish());
    return state;
  }
  let saveTimer = null;
  const listeners = [];
  function save() {
    state.updatedAt = new Date().toISOString();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('保存に失敗しました', e); }
    }, 200);
    listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
  }

  function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, val) {
    const ks = path.split('.'); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }

  window.Store = {
    get state() { return state || load(); },
    load, save,
    get: p => getPath(Store.state, p),
    set: (p, v) => { setPath(Store.state, p, v); save(); },
    onChange: fn => listeners.push(fn),
    emptyChild, emptyMember, emptyWish,
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} state = defaults(); save(); },
    exportJSON() { return JSON.stringify(Store.state, null, 2); },
    importJSON(text) {
      const obj = JSON.parse(text);
      if (!obj || typeof obj !== 'object' || !obj.household) throw new Error('このポータルで書き出したファイルではありません');
      try { localStorage.setItem(KEY, JSON.stringify(obj)); load(); }
      catch (e) { state = deepMerge(defaults(), obj); }
      save();
    },
    termsAgreed() { try { return localStorage.getItem(TERMS_KEY) === '1'; } catch (e) { return false; } },
    agreeTerms() { try { localStorage.setItem(TERMS_KEY, '1'); } catch (e) {} },
  };
})();
