import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// --- НАСТРОЙКИ ---
const SUPABASE_URL = 'https://civmjhjefyxxddawbstk.supabase.co';
const SUPABASE_KEY = 'sb_publishable_zO47rJfcZVCyRO-JiruFbA_zrQCs3wn';

// ВСТАВЬ СЮДА СВОИ TELEGRAM ID (числами)
const ALLOWED_IDS = [732965327, 540870507];
// -----------------

const dbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const balanceEl = document.getElementById('total-balance');
const debtsEl = document.getElementById('total-debts');
const netEl = document.getElementById('net-available');
const amountInput = document.getElementById('amount-input');
const descInput = document.getElementById('desc-input');
const listEl = document.getElementById('transaction-list');
const creditListEl = document.getElementById('credit-list');

const btnPlus = document.getElementById('add-plus');
const btnMinus = document.getElementById('add-minus');
const btnAddCredit = document.getElementById('add-credit');

// Табы
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

async function updateUI() {
    try {
        // 1. Получаем транзакции
        const { data: transactions, error: txErr } = await dbClient
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (txErr) throw txErr;

        // 2. Получаем кредиты
        const { data: credits, error: crErr } = await dbClient
            .from('credits')
            .select('*')
            .order('due_date', { ascending: true });

        if (crErr) throw crErr;

        let currentBalance = 0;
        listEl.innerHTML = '';
        transactions.forEach(t => {
            if (t.type === 'plus') currentBalance += Number(t.amount);
            else currentBalance -= Number(t.amount);

            const li = document.createElement('li');
            li.innerHTML = `
                <span class="t-desc">${t.description || 'Без описания'}</span>
                <span class="t-amount ${t.type === 'plus' ? 'positive' : 'negative'}">
                    ${t.type === 'plus' ? '+' : '-'}${Number(t.amount).toLocaleString()} ₽
                </span>
            `;
            listEl.appendChild(li);
        });

        let totalDebts = 0;
        creditListEl.innerHTML = '';
        credits.forEach(c => {
            if (!c.is_paid) {
                totalDebts += Number(c.amount);
                const li = document.createElement('li');
                li.className = 'credit-item';
                li.innerHTML = `
                    <div class="credit-info">
                        <span>${c.description || 'Долг'}</span>
                        <span class="credit-date">${c.due_date}</span>
                    </div>
                    <span class="t-amount negative">-${Number(c.amount).toLocaleString()} ₽</span>
                `;
                creditListEl.appendChild(li);
            }
        });

        // Обновляем верхние карточки
        balanceEl.innerText = `${currentBalance.toLocaleString()} ₽`;
        debtsEl.innerText = `${totalDebts.toLocaleString()} ₽`;
        netEl.innerText = `${(currentBalance - totalDebts).toLocaleString()} ₽`;

    } catch (error) {
        console.error('Ошибка обновления UI:', error);
    }
}

// Добавление транзакции
async function addTransaction(type) {
    const amount = amountInput.value;
    const description = descInput.value;
    if (!amount || amount <= 0) return alert('Введите сумму');

    try {
        await dbClient.from('transactions').insert([{
            amount: parseFloat(amount),
            description,
            type
        }]);
        amountInput.value = '';
        descInput.value = '';
        updateUI();
    } catch (e) { console.error(e); }
}

// Добавление кредита
async function addCredit() {
    const amount = document.getElementById('credit-amount').value;
    const description = document.getElementById('credit-desc').value;
    const due_date = document.getElementById('credit-date').value;

    if (!amount || !due_date) return alert('Заполните все поля кредита');

    try {
        await dbClient.from('credits').insert([{
            amount: parseFloat(amount),
            description,
            due_date,
            is_paid: false
        }]);
        document.getElementById('credit-amount').value = '';
        document.getElementById('credit-desc').value = '';
        updateUI();
    } catch (e) { console.error(e); }
}

btnPlus.addEventListener('click', () => addTransaction('plus'));
btnMinus.addEventListener('click', () => addTransaction('minus'));
btnAddCredit.addEventListener('click', addCredit);

// Запуск
(async () => {
    if (window.Telegram && window.Telegram.WebApp) {
        const user = window.Telegram.WebApp.initDataUnsafe?.user;
        if (!user || !ALLOWED_IDS.includes(user.id)) {
            document.getElementById('app').innerHTML = `
                <div style="text-align:center; padding: 50px;">
                    <h2>🚫 Доступ запрещен</h2>
                </div>`;
            return;
        }
    } else {
        // Если открыто не в телеграме — тоже блокируем для безопасности ключей
        document.getElementById('app').innerHTML = `<h2>Приложение доступно только в Telegram</h2>`;
        return;
    }

    updateUI();
})();
