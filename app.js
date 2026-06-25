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
const timerEl = document.getElementById('next-payment-timer');

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

async function updateTimer() {
    try {
        const { data: credits, error: crErr } = await dbClient
            .from('credits')
            .select('*')
            .eq('is_paid', false)
            .order('due_date', { ascending: true })
            .limit(1);

        if (crErr || !credits || credits.length === 0) {
            timerEl.innerText = 'Нет платежей';
            return;
        }

        const nextDate = new Date(credits[0].due_date);
        const now = new Date();
        const diff = nextDate - now;

        if (diff <= 0) {
            timerEl.innerText = 'Срок вышел';
            timerEl.style.color = 'var(--accent-danger)';
        } else {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            timerEl.innerText = `${days}д ${hours}ч ${mins}м`;
            timerEl.style.color = 'var(--text-main)';
        }
    } catch (e) {
        console.error('Ошибка таймера:', e);
    }
}

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
                        <span class="c-desc">${c.description || 'Долг'}</span>
                        <span class="credit-date">${c.due_date}</span>
                    </div>
                    <span class="t-amount negative">-${Number(c.amount).toLocaleString()} ₽</span>
                    <button onclick="payCredit('${c.id}', ${c.amount}, '${c.description.replace(/'/g, "\\'")}')" class="btn-pay">Оплачено</button>
                `;
                creditListEl.appendChild(li);
            }
        });

        // Обновляем верхние карточки
        balanceEl.innerText = `${currentBalance.toLocaleString()} ₽`;
        debtsEl.innerText = `${totalDebts.toLocaleString()} ₽`;
        netEl.innerText = `${(currentBalance - totalDebts).toLocaleString()} ₽`;
        
        await updateTimer();

    } catch (error) {
        console.error('Ошибка обновления UI:', error);
    }
}

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

async function payCredit(id, amount, description) {
    try {
        const { error: txErr } = await dbClient.from('transactions').insert([{
            amount: parseFloat(amount),
            description: `Оплата: ${description}`,
            type: 'minus'
        }]);

        if (txErr) throw txErr;

        const { error: updateErr } = await dbClient.from('credits')
            .update({ is_paid: true })
            .eq('id', id);

        if (updateErr) throw updateErr;

        updateUI();
    } catch (e) {
        console.error('Ошибка оплаты:', e);
        alert('Не удалось оплатить кредит');
    }
}

btnPlus.addEventListener('click', () => addTransaction('plus'));
btnMinus.addEventListener('click', () => addTransaction('minus'));
btnAddCredit.addEventListener('click', addCredit);

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
        document.getElementById('app').innerHTML = `<h2>Приложение доступно только в Telegram</h2>`;
        return;
    }

    updateUI();
})();
