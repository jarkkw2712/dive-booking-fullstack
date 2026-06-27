const DEFAULT_MASTER_DATA = {
  programs: [
    { id: "boat_ticket", name: "ตั๋วเรือ", price: 1500 },
    { id: "one_day", name: "One Day Trip", price: 2500 },
    { id: "two_day", name: "2 Day 1 Night", price: 4500 },
    { id: "three_day", name: "3 Day 2 Night", price: 6500 }
  ],

  // ใช้ menu เดียวกันทั้ง Pre Add-on และ Island Add-on
  addOns: [
    { id: "fin", name: "Fin", defaultPrice: 150 },
    { id: "mask", name: "หน้ากากดำน้ำ", defaultPrice: 150 },
    { id: "life_jacket", name: "ชูชีพ", defaultPrice: 100 },
    { id: "tent", name: "เต็นท์", defaultPrice: 800 },
    { id: "other", name: "อื่นๆ", defaultPrice: 0 }
  ]
};

function mergeById(defaultList, savedList) {
  const result = defaultList.map(defaultItem => {
    const saved = (savedList || []).find(x => x.id === defaultItem.id);
    return saved ? { ...defaultItem, ...saved } : defaultItem;
  });

  // เผื่ออนาคตมี item พิเศษที่ user เพิ่มเอง
  (savedList || []).forEach(saved => {
    if (!result.some(x => x.id === saved.id)) {
      result.push(saved);
    }
  });

  return result;
}

function normalizeMasterData(data) {
  const md = data || {};

  // รองรับข้อมูลเก่าทุกแบบ:
  // - v เก่าใช้ preAddOns
  // - v เก่าใช้ islandAddOns
  // - v ใหม่ใช้ addOns
  // แล้ว merge กับ DEFAULT เสมอ เพื่อไม่ให้ Fin/Mask/Life Jacket หาย
  const savedAddOns = md.addOns || md.islandAddOns || md.preAddOns || [];

  return {
    programs: mergeById(DEFAULT_MASTER_DATA.programs, md.programs || []),
    addOns: mergeById(DEFAULT_MASTER_DATA.addOns, savedAddOns)
  };
}

function getMasterData() {
  const saved = localStorage.getItem("master_data");

  if (!saved) {
    localStorage.setItem("master_data", JSON.stringify(DEFAULT_MASTER_DATA));
    return structuredClone(DEFAULT_MASTER_DATA);
  }

  const normalized = normalizeMasterData(JSON.parse(saved));
  localStorage.setItem("master_data", JSON.stringify(normalized));
  return normalized;
}

function saveMasterData(data) {
  localStorage.setItem("master_data", JSON.stringify(normalizeMasterData(data)));
}

function resetMasterData() {
  if (typeof requirePermission === 'function' && !requirePermission('editMasterData', 'เฉพาะ Admin เท่านั้นที่ reset Master Data ได้')) return;
  localStorage.setItem("master_data", JSON.stringify(DEFAULT_MASTER_DATA));
  renderMasterDataForm();
  alert("Reset Master Data แล้ว");
}

async function renderMasterDataForm() {
  const root = document.getElementById("masterDataForm");
  if (!root) return;

  let md;
  try {
    md = (typeof DataService !== "undefined") ? await DataService.getMasterData() : getMasterData();
  } catch (error) {
    console.warn(error);
    md = getMasterData();
  }

  root.innerHTML = `
    <h2>Program</h2>
    ${md.programs.map((p, i) => `
      <div class="form-grid">
        <div><label>ชื่อ</label><input id="program_id_${i}" type="hidden" value="${p.id}"><input id="program_name_${i}" value="${p.name}"></div>
        <div><label>ราคา</label><input id="program_price_${i}" type="number" value="${p.price}"></div>
      </div>
    `).join("")}

    <h2 class="mt">Add-on Master</h2>
    <p class="muted">เมนูนี้ใช้ร่วมกันทั้ง Pre Add-on และซื้อเพิ่มบนเกาะ</p>
    ${md.addOns.map((a, i) => `
      <div class="form-grid">
        <div><label>ชื่อ</label><input id="addon_id_${i}" type="hidden" value="${a.id}"><input id="addon_name_${i}" value="${a.name}"></div>
        <div><label>ราคา</label><input id="addon_price_${i}" type="number" value="${a.defaultPrice}"></div>
      </div>
    `).join("")}
  `;
}

async function saveMasterDataFromForm() {
  if (typeof requirePermission === 'function' && !requirePermission('editMasterData', 'เฉพาะ Admin เท่านั้นที่แก้ Master Data ได้')) return;

  const current = (typeof DataService !== "undefined") ? await DataService.getMasterData() : getMasterData();

  const md = {
    programs: current.programs.map((p, i) => ({
      ...p,
      id: document.getElementById(`program_id_${i}`)?.value || p.id,
      name: document.getElementById(`program_name_${i}`).value,
      price: Number(document.getElementById(`program_price_${i}`).value || 0)
    })),
    addOns: current.addOns.map((a, i) => ({
      ...a,
      id: document.getElementById(`addon_id_${i}`)?.value || a.id,
      name: document.getElementById(`addon_name_${i}`).value,
      defaultPrice: Number(document.getElementById(`addon_price_${i}`).value || 0)
    }))
  };

  if (typeof DataService !== "undefined") {
    await DataService.saveMasterData(md);
  } else {
    saveMasterData(md);
  }

  localStorage.setItem("master_data", JSON.stringify(md));
  alert("บันทึก Master Data แล้ว");
}

function resetMasterData() {
  if (typeof requirePermission === 'function' && !requirePermission('editMasterData', 'เฉพาะ Admin เท่านั้นที่ reset Master Data ได้')) return;
  localStorage.setItem("master_data", JSON.stringify(DEFAULT_MASTER_DATA));
  renderMasterDataForm();
  alert("Reset Master Data แล้ว");
}

async function renderMasterDataForm() {
  const root = document.getElementById("masterDataForm");
  if (!root) return;

  let md;
  try {
    md = (typeof DataService !== "undefined") ? await DataService.getMasterData() : getMasterData();
  } catch (error) {
    console.warn(error);
    md = getMasterData();
  }

  root.innerHTML = `
    <h2>Program</h2>
    ${md.programs.map((p, i) => `
      <div class="form-grid">
        <div><label>ชื่อ</label><input id="program_id_${i}" type="hidden" value="${p.id}"><input id="program_name_${i}" value="${p.name}"></div>
        <div><label>ราคา</label><input id="program_price_${i}" type="number" value="${p.price}"></div>
      </div>
    `).join("")}

    <h2 class="mt">Add-on Master</h2>
    <p class="muted">เมนูนี้ใช้ร่วมกันทั้ง Pre Add-on และซื้อเพิ่มบนเกาะ</p>
    ${md.addOns.map((a, i) => `
      <div class="form-grid">
        <div><label>ชื่อ</label><input id="addon_id_${i}" type="hidden" value="${a.id}"><input id="addon_name_${i}" value="${a.name}"></div>
        <div><label>ราคา</label><input id="addon_price_${i}" type="number" value="${a.defaultPrice}"></div>
      </div>
    `).join("")}
  `;
}

function saveMasterDataFromForm() {
  if (typeof requirePermission === 'function' && !requirePermission('editMasterData', 'เฉพาะ Admin เท่านั้นที่แก้ Master Data ได้')) return;
  const md = getMasterData();

  md.programs = md.programs.map((p, i) => ({
    ...p,
    name: document.getElementById(`program_name_${i}`).value,
    price: Number(document.getElementById(`program_price_${i}`).value || 0)
  }));

  md.addOns = md.addOns.map((a, i) => ({
    ...a,
    name: document.getElementById(`addon_name_${i}`).value,
    defaultPrice: Number(document.getElementById(`addon_price_${i}`).value || 0)
  }));

  saveMasterData(md);
  alert("บันทึก Master Data แล้ว");
}
