const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = window.APP_CONFIG || {};

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn("Supabase yapılandırması eksik. config.js dosyasını doldurun.");
}

const supabase = window.supabase.createClient(
  SUPABASE_URL || "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY || "missing-key"
);

const state = {
  user: null,
  reservations: [],
  expenses: []
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => [...document.querySelectorAll(selector)];

const refs = {
  authView: qs("#auth-view"),
  appView: qs("#app-view"),
  loginForm: qs("#login-form"),
  loginError: qs("#login-error"),
  email: qs("#email"),
  password: qs("#password"),
  logoutBtn: qs("#logout-btn"),
  userEmail: qs("#user-email"),

  tabs: qsa(".tab"),
  panels: qsa(".panel"),

  reservationForm: qs("#reservation-form"),
  reservationId: qs("#reservation-id"),
  catName: qs("#cat-name"),
  ownerName: qs("#owner-name"),
  checkInDate: qs("#check-in-date"),
  checkOutDate: qs("#check-out-date"),
  reservationStatus: qs("#reservation-status"),
  arrivalStatus: qs("#arrival-status"),
  totalPrice: qs("#total-price"),
  amountReceived: qs("#amount-received"),
  reservationNotes: qs("#reservation-notes"),
  reservationMessage: qs("#reservation-message"),
  reservationResetBtn: qs("#reservation-reset-btn"),
  reservationSearch: qs("#reservation-search"),
  reservationFilter: qs("#reservation-filter"),
  reservationsTableBody: qs("#reservations-table-body"),

  expenseForm: qs("#expense-form"),
  expenseId: qs("#expense-id"),
  expenseDate: qs("#expense-date"),
  expenseCategory: qs("#expense-category"),
  expenseAmount: qs("#expense-amount"),
  expenseDescription: qs("#expense-description"),
  expenseMessage: qs("#expense-message"),
  expenseResetBtn: qs("#expense-reset-btn"),
  expenseSearch: qs("#expense-search"),
  expensesTableBody: qs("#expenses-table-body"),

  metricExpectedIncome: qs("#metric-expected-income"),
  metricCollectedIncome: qs("#metric-collected-income"),
  metricOutstanding: qs("#metric-outstanding"),
  metricExpenses: qs("#metric-expenses"),
  metricNetCash: qs("#metric-net-cash"),
  upcomingList: qs("#upcoming-list"),
  outstandingList: qs("#outstanding-list")
};

const money = (value) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const todayISO = () => new Date().toISOString().slice(0, 10);

const parseNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const paymentStatus = (reservation) => {
  const total = parseNumber(reservation.total_price);
  const received = parseNumber(reservation.amount_received);
  if (received <= 0) return "Alınmadı";
  if (received < total) return "Kısmi";
  return "Tamamlandı";
};

const paymentBadgeClass = (reservation) => {
  const status = paymentStatus(reservation);
  if (status === "Tamamlandı") return "badge";
  if (status === "Kısmi") return "badge warn";
  return "badge danger";
};

const reservationStatusText = {
  pending: "Bekliyor",
  confirmed: "Kesinleşti",
  cancelled: "İptal"
};

const arrivalStatusText = {
  not_arrived: "Henüz gelmedi",
  arrived: "Geldi",
  no_show: "Gelmedi"
};

const categoryText = {
  mama: "Mama",
  kum: "Kum",
  temizlik: "Temizlik",
  veteriner: "Veteriner",
  ulasim: "Ulaşım",
  diger: "Diğer"
};

function showAuth(user = null) {
  state.user = user;
  refs.userEmail.textContent = user?.email || "";
  refs.authView.classList.toggle("hidden", !!user);
  refs.appView.classList.toggle("hidden", !user);
}

function setMessage(node, text, isError = false) {
  node.textContent = text || "";
  node.style.color = isError ? "#8a2d2d" : "#667066";
}

async function init() {
  refs.checkInDate.value = todayISO();
  refs.expenseDate.value = todayISO();

  bindEvents();

  const { data } = await supabase.auth.getSession();
  const user = data?.session?.user || null;
  showAuth(user);

  if (user) {
    await refreshAll();
  }
}

function bindEvents() {
  refs.loginForm.addEventListener("submit", handleLogin);
  refs.logoutBtn.addEventListener("click", handleLogout);

  refs.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      refs.tabs.forEach((item) => item.classList.remove("active"));
      refs.panels.forEach((panel) => panel.classList.remove("active"));
      tab.classList.add("active");
      qs(`#${tab.dataset.tab}-panel`).classList.add("active");
    });
  });

  refs.reservationForm.addEventListener("submit", saveReservation);
  refs.reservationResetBtn.addEventListener("click", resetReservationForm);
  refs.reservationSearch.addEventListener("input", renderReservations);
  refs.reservationFilter.addEventListener("change", renderReservations);

  refs.expenseForm.addEventListener("submit", saveExpense);
  refs.expenseResetBtn.addEventListener("click", resetExpenseForm);
  refs.expenseSearch.addEventListener("input", renderExpenses);
}

async function handleLogin(event) {
  event.preventDefault();
  refs.loginError.textContent = "";

  const email = refs.email.value.trim();
  const password = refs.password.value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    refs.loginError.textContent = "Giriş başarısız. E-posta veya şifreyi kontrol edin.";
    return;
  }

  showAuth(data.user);
  await refreshAll();
}

async function handleLogout() {
  await supabase.auth.signOut();
  showAuth(null);
  state.reservations = [];
  state.expenses = [];
  renderReservations();
  renderExpenses();
  renderDashboard();
}

async function refreshAll() {
  await Promise.all([loadReservations(), loadExpenses()]);
  renderReservations();
  renderExpenses();
  renderDashboard();
}

async function loadReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("check_in_date", { ascending: true });

  if (error) {
    console.error(error);
    state.reservations = [];
    return;
  }

  state.reservations = data || [];
}

async function loadExpenses() {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false });

  if (error) {
    console.error(error);
    state.expenses = [];
    return;
  }

  state.expenses = data || [];
}

async function saveReservation(event) {
  event.preventDefault();
  setMessage(refs.reservationMessage, "");

  const payload = {
    user_id: state.user.id,
    cat_name: refs.catName.value.trim(),
    owner_name: refs.ownerName.value.trim() || null,
    check_in_date: refs.checkInDate.value,
    check_out_date: refs.checkOutDate.value || null,
    reservation_status: refs.reservationStatus.value,
    arrival_status: refs.arrivalStatus.value,
    total_price: parseNumber(refs.totalPrice.value),
    amount_received: parseNumber(refs.amountReceived.value),
    notes: refs.reservationNotes.value.trim() || null
  };

  if (!payload.cat_name || !payload.check_in_date) {
    setMessage(refs.reservationMessage, "Kedi adı ve geliş tarihi zorunludur.", true);
    return;
  }

  let result;
  if (refs.reservationId.value) {
    result = await supabase
      .from("reservations")
      .update(payload)
      .eq("id", refs.reservationId.value);
  } else {
    result = await supabase.from("reservations").insert(payload);
  }

  if (result.error) {
    console.error(result.error);
    setMessage(refs.reservationMessage, "Rezervasyon kaydedilemedi.", true);
    return;
  }

  setMessage(refs.reservationMessage, "Rezervasyon kaydedildi.");
  resetReservationForm(false);
  await loadReservations();
  renderReservations();
  renderDashboard();
}

function resetReservationForm(clearMessage = true) {
  refs.reservationId.value = "";
  refs.catName.value = "";
  refs.ownerName.value = "";
  refs.checkInDate.value = todayISO();
  refs.checkOutDate.value = "";
  refs.reservationStatus.value = "pending";
  refs.arrivalStatus.value = "not_arrived";
  refs.totalPrice.value = "0";
  refs.amountReceived.value = "0";
  refs.reservationNotes.value = "";
  if (clearMessage) setMessage(refs.reservationMessage, "");
}

function editReservation(id) {
  const item = state.reservations.find((reservation) => reservation.id === id);
  if (!item) return;

  refs.reservationId.value = item.id;
  refs.catName.value = item.cat_name || "";
  refs.ownerName.value = item.owner_name || "";
  refs.checkInDate.value = item.check_in_date || todayISO();
  refs.checkOutDate.value = item.check_out_date || "";
  refs.reservationStatus.value = item.reservation_status || "pending";
  refs.arrivalStatus.value = item.arrival_status || "not_arrived";
  refs.totalPrice.value = item.total_price ?? 0;
  refs.amountReceived.value = item.amount_received ?? 0;
  refs.reservationNotes.value = item.notes || "";
  setMessage(refs.reservationMessage, "Düzenleme modu açık.");
}

async function deleteReservation(id) {
  const confirmed = window.confirm("Bu rezervasyonu silmek istediğine emin misin?");
  if (!confirmed) return;

  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) {
    console.error(error);
    return;
  }

  await loadReservations();
  renderReservations();
  renderDashboard();
}

function renderReservations() {
  const search = refs.reservationSearch.value.trim().toLowerCase();
  const filter = refs.reservationFilter.value;
  const today = todayISO();

  let rows = [...state.reservations];

  if (search) {
    rows = rows.filter((item) => {
      const haystack = `${item.cat_name || ""} ${item.owner_name || ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  if (filter === "upcoming") {
    rows = rows.filter((item) => item.check_in_date >= today && item.reservation_status !== "cancelled");
  }

  if (filter === "payment_open") {
    rows = rows.filter((item) => parseNumber(item.amount_received) < parseNumber(item.total_price));
  }

  if (filter === "arrived") {
    rows = rows.filter((item) => item.arrival_status === "arrived");
  }

  refs.reservationsTableBody.innerHTML = rows.length
    ? rows.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.cat_name || "-")}</strong></td>
        <td>${escapeHtml(item.owner_name || "-")}</td>
        <td>${formatDate(item.check_in_date)}${item.check_out_date ? ` → ${formatDate(item.check_out_date)}` : ""}</td>
        <td>
          <div class="badge">${reservationStatusText[item.reservation_status] || "-"}</div>
          <div class="badge ${item.arrival_status === "no_show" ? "danger" : item.arrival_status === "arrived" ? "" : "warn"}" style="margin-top:6px;">
            ${arrivalStatusText[item.arrival_status] || "-"}
          </div>
        </td>
        <td>
          <div class="${paymentBadgeClass(item)}">${paymentStatus(item)}</div>
          <div style="margin-top:6px;">${money(item.amount_received)} / ${money(item.total_price)}</div>
        </td>
        <td>
          <div class="actions">
            <button type="button" class="ghost" onclick="editReservation('${item.id}')">Düzenle</button>
            <button type="button" class="danger" onclick="deleteReservation('${item.id}')">Sil</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="6"><div class="empty-state">Kayıt bulunamadı.</div></td></tr>`;
}

async function saveExpense(event) {
  event.preventDefault();
  setMessage(refs.expenseMessage, "");

  const payload = {
    user_id: state.user.id,
    expense_date: refs.expenseDate.value,
    category: refs.expenseCategory.value,
    amount: parseNumber(refs.expenseAmount.value),
    description: refs.expenseDescription.value.trim() || null
  };

  if (!payload.expense_date || payload.amount <= 0) {
    setMessage(refs.expenseMessage, "Tarih ve pozitif tutar zorunludur.", true);
    return;
  }

  let result;
  if (refs.expenseId.value) {
    result = await supabase
      .from("expenses")
      .update(payload)
      .eq("id", refs.expenseId.value);
  } else {
    result = await supabase.from("expenses").insert(payload);
  }

  if (result.error) {
    console.error(result.error);
    setMessage(refs.expenseMessage, "Gider kaydedilemedi.", true);
    return;
  }

  setMessage(refs.expenseMessage, "Gider kaydedildi.");
  resetExpenseForm(false);
  await loadExpenses();
  renderExpenses();
  renderDashboard();
}

function resetExpenseForm(clearMessage = true) {
  refs.expenseId.value = "";
  refs.expenseDate.value = todayISO();
  refs.expenseCategory.value = "mama";
  refs.expenseAmount.value = "";
  refs.expenseDescription.value = "";
  if (clearMessage) setMessage(refs.expenseMessage, "");
}

function editExpense(id) {
  const item = state.expenses.find((expense) => expense.id === id);
  if (!item) return;

  refs.expenseId.value = item.id;
  refs.expenseDate.value = item.expense_date || todayISO();
  refs.expenseCategory.value = item.category || "mama";
  refs.expenseAmount.value = item.amount ?? "";
  refs.expenseDescription.value = item.description || "";
  setMessage(refs.expenseMessage, "Düzenleme modu açık.");
}

async function deleteExpense(id) {
  const confirmed = window.confirm("Bu gider kaydını silmek istediğine emin misin?");
  if (!confirmed) return;

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) {
    console.error(error);
    return;
  }

  await loadExpenses();
  renderExpenses();
  renderDashboard();
}

function renderExpenses() {
  const search = refs.expenseSearch.value.trim().toLowerCase();
  let rows = [...state.expenses];

  if (search) {
    rows = rows.filter((item) => {
      const haystack = `${categoryText[item.category] || item.category || ""} ${item.description || ""}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  refs.expensesTableBody.innerHTML = rows.length
    ? rows.map((item) => `
      <tr>
        <td>${formatDate(item.expense_date)}</td>
        <td>${escapeHtml(categoryText[item.category] || item.category || "-")}</td>
        <td>${money(item.amount)}</td>
        <td>${escapeHtml(item.description || "-")}</td>
        <td>
          <div class="actions">
            <button type="button" class="ghost" onclick="editExpense('${item.id}')">Düzenle</button>
            <button type="button" class="danger" onclick="deleteExpense('${item.id}')">Sil</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="5"><div class="empty-state">Gider kaydı bulunamadı.</div></td></tr>`;
}

function renderDashboard() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const reservationsThisMonth = state.reservations.filter((item) => {
    if (!item.check_in_date) return false;
    const date = new Date(`${item.check_in_date}T00:00:00`);
    return date.getMonth() === month && date.getFullYear() === year && item.reservation_status !== "cancelled";
  });

  const expensesThisMonth = state.expenses.filter((item) => {
    if (!item.expense_date) return false;
    const date = new Date(`${item.expense_date}T00:00:00`);
    return date.getMonth() === month && date.getFullYear() === year;
  });

  const expectedIncome = reservationsThisMonth.reduce((sum, item) => sum + parseNumber(item.total_price), 0);
  const collectedIncome = reservationsThisMonth.reduce((sum, item) => sum + parseNumber(item.amount_received), 0);
  const outstanding = reservationsThisMonth.reduce((sum, item) => {
    return sum + Math.max(parseNumber(item.total_price) - parseNumber(item.amount_received), 0);
  }, 0);
  const expenses = expensesThisMonth.reduce((sum, item) => sum + parseNumber(item.amount), 0);
  const netCash = collectedIncome - expenses;

  refs.metricExpectedIncome.textContent = money(expectedIncome);
  refs.metricCollectedIncome.textContent = money(collectedIncome);
  refs.metricOutstanding.textContent = money(outstanding);
  refs.metricExpenses.textContent = money(expenses);
  refs.metricNetCash.textContent = money(netCash);

  const today = new Date(`${todayISO()}T00:00:00`);
  const in14Days = new Date(today);
  in14Days.setDate(in14Days.getDate() + 14);

  const upcoming = state.reservations
    .filter((item) => {
      if (!item.check_in_date || item.reservation_status === "cancelled") return false;
      const date = new Date(`${item.check_in_date}T00:00:00`);
      return date >= today && date <= in14Days;
    })
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date))
    .slice(0, 8);

  refs.upcomingList.innerHTML = upcoming.length
    ? upcoming.map((item) => `
      <div class="list-item">
        <strong>${escapeHtml(item.cat_name || "-")}</strong>
        <span>${escapeHtml(item.owner_name || "-")} · ${formatDate(item.check_in_date)}</span>
        <span class="muted">${arrivalStatusText[item.arrival_status] || "-"}</span>
      </div>
    `).join("")
    : `<div class="empty-state">Yaklaşan geliş yok.</div>`;

  const outstandingItems = state.reservations
    .filter((item) => parseNumber(item.amount_received) < parseNumber(item.total_price) && item.reservation_status !== "cancelled")
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date))
    .slice(0, 8);

  refs.outstandingList.innerHTML = outstandingItems.length
    ? outstandingItems.map((item) => `
      <div class="list-item">
        <strong>${escapeHtml(item.cat_name || "-")}</strong>
        <span>${money(item.amount_received)} / ${money(item.total_price)}</span>
        <span class="muted">Kalan: ${money(Math.max(parseNumber(item.total_price) - parseNumber(item.amount_received), 0))}</span>
      </div>
    `).join("")
    : `<div class="empty-state">Açık ödeme yok.</div>`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.editReservation = editReservation;
window.deleteReservation = deleteReservation;
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;

init();
