const state = {
  prices: null,
  selectedFuel: "92",
};

const elements = {
  price92: document.querySelector("#price-92"),
  price95: document.querySelector("#price-95"),
  effectiveDate: document.querySelector("#effective-date"),
  updatedAt: document.querySelector("#updated-at"),
  selectedFuelName: document.querySelector("#selected-fuel-name"),
  selectedFuelPrice: document.querySelector("#selected-fuel-price"),
  litersResult: document.querySelector("#liters-result"),
  amountResult: document.querySelector("#amount-result"),
  amountInput: document.querySelector("#amount-input"),
  litersInput: document.querySelector("#liters-input"),
  fuelTabs: Array.from(document.querySelectorAll(".fuel-tab")),
  quickButtons: Array.from(document.querySelectorAll(".quick-button")),
  referenceCheck: document.querySelector("#reference-check"),
  officialLink: document.querySelector("#official-link"),
  referenceLink: document.querySelector("#reference-link"),
  notesPanel: document.querySelector(".notes-panel"),
  page: document.querySelector(".page"),
  errorTemplate: document.querySelector("#error-template"),
};

init().catch((error) => {
  console.error("Failed to initialize app:", error);
  renderError();
});

async function init() {
  const response = await fetch("./data/prices.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Unable to load prices.json: ${response.status}`);
  }

  state.prices = await response.json();
  bindEvents();
  renderPrices();
  renderSelectedFuel();
  updateFromAmount();
  updateFromLiters();
}

function bindEvents() {
  elements.fuelTabs.forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedFuel = button.dataset.fuel;
      syncFuelTabs();
      renderSelectedFuel();
      updateFromAmount();
      updateFromLiters();
    });
  });

  elements.amountInput.addEventListener("input", updateFromAmount);
  elements.litersInput.addEventListener("input", updateFromLiters);

  elements.quickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      elements.amountInput.value = button.dataset.amount;
      updateFromAmount();
    });
  });
}

function renderPrices() {
  const { fuels, effectiveDate, updatedAt, officialUrl, referenceUrl, referenceCheck } = state.prices;

  elements.price92.textContent = formatPrice(fuels["92"].price);
  elements.price95.textContent = formatPrice(fuels["95"].price);
  elements.effectiveDate.textContent = `生效日 ${effectiveDate}`;
  elements.updatedAt.textContent = formatDateTime(updatedAt);
  elements.officialLink.href = officialUrl;
  elements.referenceLink.href = referenceUrl;
  elements.referenceCheck.textContent = formatReferenceCheck(referenceCheck);
}

function renderSelectedFuel() {
  const fuel = getSelectedFuel();

  elements.selectedFuelName.textContent = fuel.name;
  elements.selectedFuelPrice.textContent = `${formatPrice(fuel.price)} 元 / 公升`;
}

function syncFuelTabs() {
  elements.fuelTabs.forEach((button) => {
    const isActive = button.dataset.fuel === state.selectedFuel;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function updateFromAmount() {
  const price = getSelectedFuel().price;
  const amount = parseNonNegativeNumber(elements.amountInput.value);
  const liters = amount === null ? 0 : amount / price;

  elements.litersResult.textContent = liters.toFixed(3);
}

function updateFromLiters() {
  const price = getSelectedFuel().price;
  const liters = parseNonNegativeNumber(elements.litersInput.value);
  const amount = liters === null ? 0 : Math.round(liters * price);

  elements.amountResult.textContent = String(amount);
}

function getSelectedFuel() {
  return state.prices.fuels[state.selectedFuel];
}

function parseNonNegativeNumber(value) {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function formatPrice(value) {
  return Number(value).toFixed(1);
}

function formatDateTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
    timeZone: "Asia/Taipei",
  }).format(date);
}

function formatReferenceCheck(referenceCheck) {
  if (!referenceCheck) {
    return "未提供";
  }

  const labelMap = {
    matched: "比對一致",
    mismatch: "比對有差異",
    warning: "第三方比對失敗",
    unchecked: "未比對",
  };

  const statusLabel = labelMap[referenceCheck.status] ?? referenceCheck.status;
  return referenceCheck.message ? `${statusLabel}：${referenceCheck.message}` : statusLabel;
}

function renderError() {
  const fragment = elements.errorTemplate.content.cloneNode(true);

  if (elements.notesPanel) {
    elements.notesPanel.replaceWith(fragment);
    return;
  }

  elements.page.append(fragment);
}
