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

// Категории
const CATEGORIES = {
    salary: 'Зарплата',
    food: 'Продукты',
    transport: 'Транспорт',
    housing: 'Жильё / Коммуналка',
    entertainment: 'Развлечения',
    health: 'Здоровье',
    clothes: 'Одежда',
    education: 'Образование',
    gifts: 'Подарки',
    other: 'Другое'
};

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
const categorySelect = document.getElementById('category-select');
const listEl = document.getElementById('transaction-list');
const creditListEl = document.getElementById('credit-list');
const paidCreditListEl = document.getElementById('paid-credit-list');
const txEmptyEl = document.getElementById('tx-empty');
const crEmptyEl = document.getElementById('cr-empty');
const txCountEl = document.getElementById('tx-count');
const debtCountEl = document.getElementById('debt-count');
const paidCountEl = document.getElementById('paid-count');
const txSummaryEl = document.getElementById('tx-summary');
const sumIncomeEl = document.getElementById('sum-income');
const sumExpenseEl = document.getElementById('sum-expense');
const paidSectionEl = document.getElementById('paid-section');

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
// СОСТОЯНИЕ
// ========================
let filterYear = new Date().getFullYear();
let filterMonth = new Date().getMonth(); // 0-indexed
let filterActive = true; // true = фильтр по месяцу, false = все время
let confirmCallback = null;

// ========================
// УТИЛИТЫ
// ========================
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

function isSameMonth(dateStr, year, month) {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getFullYear() === year && d.getMonth() === month;
}

function showToast(message, type = 'error') {
    toastEl.textContent = message;
    toastEl.className = 'toast' + (type === 'success' ? ' success' : '');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toastEl.classList.add('hidden');
    }, 3000);
}

function showLoading() {
    loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

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
// ФИЛЬТР МЕСЯЦА
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
// ГЛАВНОЕ ОБНОВЛЕНИЕ UI
// ========================
async function updateUI() {
    try {
        // 1. Все транзакции (нужны для расчёта баланса)
        const { data: allTransactions, error: txErr } = await dbClient
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (txErr) throw txErr;

        // 2. Все кредиты
        const { data: credits, error: crErr } = await dbClient
            .from('credits')
            .select('*')
            .order('due_date', { ascending: true });

        if (crErr) throw crErr;

        // --- Фильтрованные транзакции ---
        const filtered = filterActive
            ? allTransactions.filter(t => isSameMonth(t.created_at, filterYear, filterMonth))
            : allTransactions;

        // --- Баланс за всё время ---
        let currentBalance = 0;
        allTransactions.forEach(t => {
            if (t.type === 'plus') currentBalance += Number(t.amount);
            else currentBalance -= Number(t.amount);
        });

        // --- Сумма за период ---
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
            const cat = t.category ? (CATEGORIES[t.category] || '') : '';
            li.innerHTML = `
                <div class="tx-left">
                    <span class="tx-desc">${escapeHtml(t.description || 'Без описания')}</span>
                    <div class="tx-meta">
                        ${cat ? `<span class="tx-category">${escapeHtml(cat)}</span>` : ''}
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

        // Пустое состояние
        txEmptyEl.classList.toggle('hidden', filtered.length > 0);
        txCountEl.textContent = filtered.length;

        // Сводка доходов/расходов
        if (filtered.length > 0) {
            txSummaryEl.classList.remove('hidden');
            sumIncomeEl.textContent = formatMoney(periodIncome);
            sumExpenseEl.textContent = formatMoney(periodExpense);
        } else {
            txSummaryEl.classList.add('hidden');
        }

        // --- Кредиты ---
        let totalDebts = 0;
        let unpaidCredits = [];
        let paidCredits = [];

        credits.forEach(c => {
            if (!c.is_paid) {
                totalDebts += Number(c.amount);
                unpaidCredits.push(c);
            } else {
                paidCredits.push(c);
            }
        });

        // Неоплаченные
        creditListEl.innerHTML = '';
        unpaidCredits.forEach(c => {
            const li = document.createElement('li');
            li.className = 'credit-item';
            li.innerHTML = `
                <div class="credit-info">
                    <span>${escapeHtml(c.description || 'Долг')}</span>
                    <span class="credit-date">до ${formatDate(c.due_date)}</span>
                </div>
                <div class="credit-actions">
                    <span class="t-amount negative">-${formatMoney(c.amount)} ₽</span>
                    <button class="btn-outline-paid" data-id="${c.id}" data-action="pay">Оплачено</button>
                    <button class="tx-delete" data-id="${c.id}" data-type="credit" title="Удалить">&times;</button>
                </div>
            `;
            creditListEl.appendChild(li);
        });

        crEmptyEl.classList.toggle('hidden', unpaidCredits.length > 0);
        debtCountEl.textContent = unpaidCredits.length;

        // Оплаченные
        if (paidCredits.length > 0) {
            paidSectionEl.classList.remove('hidden');
            paidCountEl.textContent = paidCredits.length;
            paidCreditListEl.innerHTML = '';
            paidCredits.forEach(c => {
                const li = document.createElement('li');
                li.className = 'credit-item paid';
                li.innerHTML = `
                    <div class="credit-info">
                        <span>${escapeHtml(c.description || 'Долг')}</span>
                        <span class="credit-date">${formatDate(c.due_date)}</span>
                    </div>
                    <div class="credit-actions">
                        <span class="t-amount" style="color:var(--text-dim); text-decoration:line-through;">${formatMoney(c.amount)} ₽</span>
                        <button class="tx-delete" data-id="${c.id}" data-type="credit" title="Удалить">&times;</button>
                    </div>
                `;
                paidCreditListEl.appendChild(li);
            });
        } else {
            paidSectionEl.classList.add('hidden');
        }

        // --- Верхние карточки ---
        balanceEl.textContent = `${formatMoney(currentBalance)} ₽`;
        debtsEl.textContent = `${formatMoney(totalDebts)} ₽`;
        netEl.textContent = `${formatMoney(currentBalance - totalDebts)} ₽`;

    } catch (error) {
        console.error('Ошибка обновления UI:', error);
        showToast('Не удалось загрузить данные. Проверьте подключение.');
    }
}

// ========================
// ДОБАВЛЕНИЕ ТРАНЗАКЦИИ
// ========================
async function addTransaction(type) {
    const amount = amountInput.value;
    const description = descInput.value.trim();
    const category = categorySelect.value;

    if (!amount || Number(amount) <= 0) {
        showToast('Введите корректную сумму');
        amountInput.focus();
        return;
    }

    try {
        const { error } = await dbClient.from('transactions').insert([{
            amount: parseFloat(amount),
            description: description || null,
            type,
            category: category || null
        }]);

        if (error) throw error;

        amountInput.value = '';
        descInput.value = '';
        categorySelect.value = '';
        showToast('Транзакция добавлена', 'success');
        updateUI();
    } catch (e) {
        console.error(e);
        showToast('Ошибка при добавлении транзакции');
    }
}

// ========================
// ДОБАВЛЕНИЕ КРЕДИТА
// ========================
async function addCredit() {
    const amount = document.getElementById('credit-amount').value;
    const description = document.getElementById('credit-desc').value.trim();
    const due_date = document.getElementById('credit-date').value;

    if (!amount || Number(amount) <= 0 || !due_date) {
        showToast('Заполните сумму и дату');
        return;
    }

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
        document.getElementById('credit-date').value = '';  // ИСПРАВЛЕНО: теперь очищается
        showToast('Платёж добавлен в план', 'success');
        updateUI();
    } catch (e) {
        console.error(e);
        showToast('Ошибка при добавлении платежа');
    }
}

// ========================
// УДАЛЕНИЕ ТРАНЗАКЦИИ / КРЕДИТА
// ========================
async function deleteTransaction(id) {
    showConfirm('Удалить эту транзакцию?', async () => {
        try {
            const { error } = await dbClient.from('transactions').delete().eq('id', id);
            if (error) throw error;
            showToast('Транзакция удалена', 'success');
            updateUI();
        } catch (e) {
            console.error(e);
            showToast('Ошибка при удалении');
        }
    });
}

async function deleteCredit(id) {
    showConfirm('Удалить этот платёж из плана?', async () => {
        try {
            const { error } = await dbClient.from('credits').delete().eq('id', id);
            if (error) throw error;
            showToast('Платёж удалён', 'success');
            updateUI();
        } catch (e) {
            console.error(e);
            showToast('Ошибка при удалении');
        }
    });
}

async function markCreditPaid(id) {
    showConfirm('Отметить платёж как оплаченный?', async () => {
        try {
            const { error } = await dbClient
                .from('credits')
                .update({ is_paid: true })
                .eq('id', id);
            if (error) throw error;
            showToast('Платёж отмечен как оплаченный', 'success');
            updateUI();
        } catch (e) {
            console.error(e);
            showToast('Ошибка обновления');
        }
    });
}

// ========================
// DELEGATION: клики по кнопкам удаления и «Оплачено»
// ========================
document.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.tx-delete');
    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        const type = deleteBtn.dataset.type;
        if (type === 'tx') deleteTransaction(id);
        else if (type === 'credit') deleteCredit(id);
        return;
    }

    const payBtn = e.target.closest('[data-action="pay"]');
    if (payBtn) {
        markCreditPaid(payBtn.dataset.id);
    }
});

// ========================
// КНОПКИ ФОРМЫ
// ========================
btnPlus.addEventListener('click', () => addTransaction('plus'));
btnMinus.addEventListener('click', () => addTransaction('minus'));
btnAddCredit.addEventListener('click', addCredit);

// Enter на полях суммы
amountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTransaction('plus');
});

document.getElementById('credit-amount').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCredit();
});

// ========================
// ЗАПУСК
// ========================
(async () => {
    // Проверка Telegram
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
        // Расширяем приложение на весь экран
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

    // Всё ок — загружаем данные
    updateFilterLabel();
    await updateUI();
    hideLoading();
})();