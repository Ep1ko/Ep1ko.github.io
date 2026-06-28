import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ========================
// НАСТРОЙКИ
// ========================
const SUPABASE_URL = 'https://civmjhjefyxxddawbstk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zO47rJfcZVCyRO-JiruFbA_zrQCs3wn';

// ВСТАВЬТЕ СВОИ TELEGRAM ID
const ALLOWED_IDS = [732965327, 540870507];
// ========================

const dbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const MONTH_NAMES = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

// ========================
// DOM-ЭЛЕМЕНТЫ
// ========================
const balanceEl = document.getElementById('total-balance');
const debtsEl = document.getElementById('total-debts');
const netEl = document.getElementById('net-available');
const amountInput = document.getElementById('amount-input');
const descInput = document.getElementById('desc-input');
const listEl = document.getElementById('transaction-list');
const creditListEl = document.getElementById('credit-list');
const txEmptyEl = document.getElementById('tx-empty');
const crEmptyEl = document.getElementById('cr-empty');
const txCountEl = document.getElementById('tx-count');
const debtCountEl = document.getElementById('debt-count');
const txSummaryEl = document.getElementById('tx-summary');
const sumIncomeEl = document.getElementById('sum-income');
const sumExpenseEl = document.getElementById('sum-expense');

const btnPlus = document.getElementById('add-plus');
const btnMinus = document.getElementById('add-minus');
const btnAddCredit = document.getElementById('add-credit');

const loadingOverlay = document.getElementById('loading-overlay');
const confirmModal = document.getElementById('confirm-modal');
const confirmText = document.getElementById('confirm-text');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');
const toastEl = document.getElementById('toast');

const filterLabel = document.getElementById('filter-label');
const filterPrev = document.getElementById('filter-prev');
const filterNext = document.getElementById('filter-next');
const filterAll = document.getElementById('filter-all');

// ========================
// СОСТОЯНИЕ (опирается на текущее время)
// ========================
const NOW = new Date();
let filterYear = NOW.getFullYear();
let filterMonth = NOW.getMonth(); // 0-indexed
let filterActive = true;
let periodDays = 15; // для плана платежей: 15 / 30 / 90
let confirmCallback = null;

// ========================
// УТИЛИТЫ
// ========================
function today() {
    return new Date();
}

/** Начало текущего дня (для сравнения дат) */
function todayStart() {
    const d = today();
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatMoney(n) {
    return Number(n).toLocaleString('ru-RU');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}.${d.getFullYear()}`;
}

function formatShortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}.${month}`;
}

function parseYearMonth(dateStr) {
    if (!dateStr) return null;
    // Берём год и месяц прямо из ISO-строки, без конвертации таймзон
    const y = parseInt(dateStr.substring(0, 4), 10);
    const m = parseInt(dateStr.substring(5, 7), 10); // 1-indexed
    if (isNaN(y) || isNaN(m)) return null;
    return { year: y, month: m - 1 }; // 0-indexed месяц
}

function isSameMonth(dateStr, year, month) {
    const p = parseYearMonth(dateStr);
    if (!p) return false;
    return p.year === year && p.month === month;
}

/** Дней от сегодняшнего дня до даты (0 = сегодня, отрицательное = прошлое) */
function daysFromNow(dateStr) {
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    return Math.round((target - todayStart()) / (1000 * 60 * 60 * 24));
}

/** Получить дату для следующего месяца с тем же днём */
function nextMonthDate(currentDueDate) {
    const d = new Date(currentDueDate);
    let year = d.getFullYear();
    let month = d.getMonth() + 1; // next month
    let day = d.getDate();

    // Если месяц переполнился
    if (month > 11) { month = 0; year++; }

    // Максимальный день в новом месяце
    const maxDay = new Date(year, month + 1, 0).getDate();
    if (day > maxDay) day = maxDay;

    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function showToast(message, type = 'error') {
    toastEl.textContent = message;
    toastEl.className = 'toast' + (type === 'success' ? ' success' : '');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 3000);
}

function showLoading() { loadingOverlay.classList.remove('hidden'); }
function hideLoading() { loadingOverlay.classList.add('hidden'); }

function showConfirm(text, onYes) {
    confirmText.textContent = text;
    confirmCallback = onYes;
    confirmModal.classList.remove('hidden');
}

function hideConfirm() {
    confirmModal.classList.add('hidden');
    confirmCallback = null;
}

function updateFilterLabel() {
    if (!filterActive) {
        filterLabel.textContent = 'За всё время';
    } else {
        filterLabel.textContent = `${MONTH_NAMES[filterMonth]} ${filterYear}`;
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ========================
// ТАБЫ
// ========================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

// ========================
// МОДАЛКА
// ========================
confirmYes.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    hideConfirm();
});
confirmNo.addEventListener('click', hideConfirm);
confirmModal.addEventListener('click', (e) => {
    if (e.target === confirmModal) hideConfirm();
});

// ========================
// ФИЛЬТР МЕСЯЦА (для транзакций)
// ========================
filterPrev.addEventListener('click', () => {
    filterActive = true;
    filterMonth--;
    if (filterMonth < 0) { filterMonth = 11; filterYear--; }
    updateFilterLabel();
    updateUI();
});

filterNext.addEventListener('click', () => {
    filterActive = true;
    filterMonth++;
    if (filterMonth > 11) { filterMonth = 0; filterYear++; }
    updateFilterLabel();
    updateUI();
});

filterAll.addEventListener('click', () => {
    filterActive = false;
    updateFilterLabel();
    updateUI();
});

// ========================
// ПЕРЕКЛЮЧАТЕЛЬ 15/30/90 ДНЕЙ
// ========================
document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        periodDays = parseInt(btn.dataset.days, 10);
        renderCredits();
    });
});

// ========================
// ГЛАВНОЕ ОБНОВЛЕНИЕ UI
// ========================
let _allTransactions = [];
let _allCredits = [];

async function updateUI() {
    try {
        // 1. Все транзакции (для баланса за всё время)
        const { data: allTx, error: txErr } = await dbClient
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });
        if (txErr) throw txErr;
        _allTransactions = allTx || [];

        // 2. Все кредиты (неоплаченные = текущие ежемесячные)
        const { data: credits, error: crErr } = await dbClient
            .from('credits')
            .select('*')
            .eq('is_paid', false)
            .order('due_date', { ascending: true });
        if (crErr) throw crErr;
        _allCredits = credits || [];

        // --- Баланс за всё время ---
        let currentBalance = 0;
        _allTransactions.forEach(t => {
            if (t.type === 'plus') currentBalance += Number(t.amount);
            else currentBalance -= Number(t.amount);
        });

        // --- Долги ТЕКУЩЕГО МЕСЯЦА (опираемся на today) ---
        const now = today();
        const curMonth = now.getMonth();
        const curYear = now.getFullYear();
        let monthDebts = 0;
        _allCredits.forEach(c => {
            if (isSameMonth(c.due_date, curYear, curMonth)) {
                monthDebts += Number(c.amount);
            }
        });

        // --- Фильтрованные транзакции для списка ---
        const filtered = filterActive
            ? _allTransactions.filter(t => isSameMonth(t.created_at, filterYear, filterMonth))
            : _allTransactions;

        let periodIncome = 0;
        let periodExpense = 0;
        filtered.forEach(t => {
            if (t.type === 'plus') periodIncome += Number(t.amount);
            else periodExpense += Number(t.amount);
        });

        // --- Рендер транзакций ---
        listEl.innerHTML = '';
        filtered.slice(0, 100).forEach(t => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="tx-left">
                    <span class="tx-desc">${escapeHtml(t.description || 'Без описания')}</span>
                    <div class="tx-meta">
                        <span>${formatShortDate(t.created_at)}</span>
                    </div>
                </div>
                <div class="tx-right">
                    <span class="t-amount ${t.type === 'plus' ? 'positive' : 'negative'}">
                        ${t.type === 'plus' ? '+' : '-'}${formatMoney(t.amount)} ₽
                    </span>
                    <button class="tx-delete" data-id="${t.id}" data-type="tx" title="Удалить">&times;</button>
                </div>
            `;
            listEl.appendChild(li);
        });

        txEmptyEl.classList.toggle('hidden', filtered.length > 0);
        txCountEl.textContent = filtered.length;

        // Подитог — всегда видим, пересчитывается для каждого месяца
        txSummaryEl.classList.remove('hidden');
        sumIncomeEl.textContent = formatMoney(periodIncome);
        sumExpenseEl.textContent = formatMoney(periodExpense);

        // --- Рендер кредитов (план платежей) ---
        renderCredits();

        // --- Верхние карточки ---
        balanceEl.textContent = `${formatMoney(currentBalance)} ₽`;
        debtsEl.textContent = `${formatMoney(monthDebts)} ₽`;
        netEl.textContent = `${formatMoney(currentBalance - monthDebts)} ₽`;

    } catch (error) {
        console.error('Ошибка обновления UI:', error);
        showToast('Не удалось загрузить данные');
    }
}

/** Рендер списка кредитов по текущему periodDays */
function renderCredits() {
    const filtered = _allCredits.filter(c => {
        const days = daysFromNow(c.due_date);
        return days >= 0 && days <= periodDays;
    });

    creditListEl.innerHTML = '';
    filtered.forEach(c => {
        const days = daysFromNow(c.due_date);
        const li = document.createElement('li');
        li.className = 'credit-item';
        li.innerHTML = `
            <div class="credit-info">
                <span>${escapeHtml(c.description || 'Долг')}</span>
                <span class="credit-date">${formatDate(c.due_date)}${days === 0 ? ' — сегодня' : days === 1 ? ' — завтра' : ` — через ${days} дн.`}</span>
            </div>
            <div class="credit-actions">
                <span class="t-amount negative">-${formatMoney(c.amount)} ₽</span>
                <button class="btn-outline-paid" data-id="${c.id}" data-action="pay">Оплатить</button>
                <button class="tx-delete" data-id="${c.id}" data-type="credit" title="Закрыть кредит">&times;</button>
            </div>
        `;
        creditListEl.appendChild(li);
    });

    crEmptyEl.classList.toggle('hidden', filtered.length > 0);
    debtCountEl.textContent = filtered.length;
}

// ========================
// ДОБАВЛЕНИЕ ТРАНЗАКЦИИ
// ========================
async function addTransaction(type) {
    const amount = amountInput.value;
    const description = descInput.value.trim();

    if (!amount || Number(amount) <= 0) {
        showToast('Введите корректную сумму');
        amountInput.focus();
        return;
    }

    try {
        const { error } = await dbClient.from('transactions').insert([{
            amount: parseFloat(amount),
            description: description || null,
            type
        }]);
        if (error) throw error;

        amountInput.value = '';
        descInput.value = '';
        showToast('Транзакция добавлена', 'success');
        updateUI();
    } catch (e) {
        console.error(e);
        showToast('Ошибка при добавлении');
    }
}

// ========================
// ДОБАВЛЕНИЕ КРЕДИТА (ежемесячного долга)
// ========================
async function addCredit() {
    const amount = document.getElementById('credit-amount').value;
    const description = document.getElementById('credit-desc').value.trim();
    const dayInput = document.getElementById('credit-day').value;

    if (!amount || Number(amount) <= 0 || !dayInput) {
        showToast('Заполните сумму и день оплаты');
        return;
    }

    const day = parseInt(dayInput, 10);
    if (day < 1 || day > 31) {
        showToast('День должен быть от 1 до 31');
        return;
    }

    // Вычисляем due_date: ближайший день в этом месяце или следующем, если уже прошёл
    const now = today();
    let year = now.getFullYear();
    let month = now.getMonth(); // 0-indexed
    const maxDay = new Date(year, month + 1, 0).getDate();
    let targetDay = Math.min(day, maxDay);

    // Если день уже прошёл в этом месяце — ставим на следующий
    const todayDate = now.getDate();
    if (targetDay < todayDate) {
        month++;
        if (month > 11) { month = 0; year++; }
        const maxDayNext = new Date(year, month + 1, 0).getDate();
        targetDay = Math.min(day, maxDayNext);
    }

    const due_date = `${year}-${String(month + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

    try {
        const { error } = await dbClient.from('credits').insert([{
            amount: parseFloat(amount),
            description: description || null,
            due_date,
            is_paid: false
        }]);
        if (error) throw error;

        document.getElementById('credit-amount').value = '';
        document.getElementById('credit-desc').value = '';
        document.getElementById('credit-day').value = '';
        showToast('Ежемесячный платёж добавлен', 'success');
        updateUI();
    } catch (e) {
        console.error(e);
        showToast('Ошибка при добавлении');
    }
}

// ========================
// ОПЛАТА КРЕДИТА
// 1. Создаёт транзакцию-расход (баланс уменьшается)
// 2. Удаляет текущую запись
// 3. Пересоздаёт на следующий месяц
// ========================
async function payCredit(id) {
    const credit = _allCredits.find(c => c.id === id);
    if (!credit) return;

    showConfirm(`Оплатить «${credit.description || 'Долг'}» — ${formatMoney(credit.amount)} ₽?`, async () => {
        try {
            // 1. Создаём транзакцию-расход
            const { error: txErr } = await dbClient.from('transactions').insert([{
                amount: Number(credit.amount),
                description: (credit.description || 'Ежемесячный платёж'),
                type: 'minus'
            }]);
            if (txErr) throw txErr;

            // 2. Удаляем текущую запись кредита
            const { error: delErr } = await dbClient
                .from('credits')
                .delete()
                .eq('id', id);
            if (delErr) throw delErr;

            // 3. Пересоздаём на следующий месяц (тот же день)
            const nextDate = nextMonthDate(credit.due_date);
            const { error: insErr } = await dbClient.from('credits').insert([{
                amount: Number(credit.amount),
                description: credit.description,
                due_date: nextDate,
                is_paid: false
            }]);
            if (insErr) throw insErr;

            showToast('Платёж проведён, создан на след. месяц', 'success');
            updateUI();
        } catch (e) {
            console.error(e);
            showToast('Ошибка при оплате');
        }
    });
}

// ========================
// ПОЛНОЕ УДАЛЕНИЕ КРЕДИТА (кредит закрыт навсегда)
// ========================
async function closeCredit(id) {
    const credit = _allCredits.find(c => c.id === id);
    if (!credit) return;

    showConfirm(`Закрыть «${credit.description || 'Долг'}» полностью? Платёж больше не появится.`, async () => {
        try {
            const { error } = await dbClient
                .from('credits')
                .delete()
                .eq('id', id);
            if (error) throw error;

            showToast('Кредит закрыт', 'success');
            updateUI();
        } catch (e) {
            console.error(e);
            showToast('Ошибка при удалении');
        }
    });
}

// ========================
// УДАЛЕНИЕ ТРАНЗАКЦИИ
// ========================
async function deleteTransaction(id) {
    showConfirm('Удалить эту транзакцию?', async () => {
        try {
            const { error } = await dbClient.from('transactions').delete().eq('id', id);
            if (error) throw error;
            showToast('Удалено', 'success');
            updateUI();
        } catch (e) {
            console.error(e);
            showToast('Ошибка при удалении');
        }
    });
}

// ========================
// DELEGATION: клики
// ========================
document.addEventListener('click', (e) => {
    // Удаление транзакции
    const deleteBtn = e.target.closest('.tx-delete');
    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        const type = deleteBtn.dataset.type;
        if (type === 'tx') deleteTransaction(id);
        else if (type === 'credit') closeCredit(id);
        return;
    }

    // Оплата кредита
    const payBtn = e.target.closest('[data-action="pay"]');
    if (payBtn) {
        payCredit(payBtn.dataset.id);
    }
});

// ========================
// КНОПКИ ФОРМЫ
// ========================
btnPlus.addEventListener('click', () => addTransaction('plus'));
btnMinus.addEventListener('click', () => addTransaction('minus'));
btnAddCredit.addEventListener('click', addCredit);

amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTransaction('plus');
});

document.getElementById('credit-day').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCredit();
});

// ========================
// ЗАПУСК
// ========================
(async () => {
    const isTelegram = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe?.user);
    const isDev = new URLSearchParams(window.location.search).has('dev');

    if (isTelegram) {
        const user = window.Telegram.WebApp.initDataUnsafe.user;
        if (!user || !ALLOWED_IDS.includes(user.id)) {
            document.getElementById('app').innerHTML = `
                <div class="access-denied">
                    <h2>Доступ запрещён</h2>
                    <p>Ваш Telegram ID не авторизован</p>
                </div>`;
            hideLoading();
            return;
        }
        window.Telegram.WebApp.expand();
    } else if (!isDev) {
        document.getElementById('app').innerHTML = `
            <div class="access-denied">
                <h2>Открыто вне Telegram</h2>
                <p>Добавьте <code>?dev</code> в адрес для тестирования</p>
            </div>`;
        hideLoading();
        return;
    }

    updateFilterLabel();
    await updateUI();
    hideLoading();
})();
