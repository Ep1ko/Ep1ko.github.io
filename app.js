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

function updateCountdown() {
    const timerEl = document.getElementById('countdown-timer');
    const warningDiv = document.getElementById('next-payment-warning');
    if (!timerEl || !warningDiv) return;

    const now = new Date();
    // Ищем ближайший невыплаченный долг (у которых is_paid = false или просто в списке планов)
    // Для этого нам нужно заново просканировать данные из переменной credits, 
    // но так как updateUI() вызывается часто, мы можем логически вычислить это.
}

// Внесем изменения в updateUI для расчета таймера:
async function updateUI() {
    try {
        const { data: transactions, error: txErr } = await dbClient
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (txErr) throw txErr;

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
                <button class="delete-btn" onclick="deleteTransaction('${t.id}')">🗑️</button>
            `;
            listEl.appendChild(li);
        });

        let totalDebts = 0;
        creditListEl.innerHTML = '';
        
        // Логика таймера
        let nearestDate = null;
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

                // Ищем ближайшую дату из тех, что еще не прошли или скоро наступят
                const currentD = new Date();
                const targetD = new Date(c.due_date);
                if (!nearestDate || targetD < nearestDate) {
                    nearestDate = targetD;
                }
            }
        });

        // Обновление таймера
        if (nearestDate) {
            const now = new Date();
            const diff = nearestDate - now;
            const warningDiv = document.getElementById('next-payment-warning');
            const timerEl = document.getElementById('countdown-timer');
            
            if (diff > 0) {
                warningDiv.style.display = 'block';
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        } else {
            warningDiv.style.display = 'none';
        }

        // Если нужно точное время в часах/минутах, можно усложнить расчет ниже:
        if (nearestDate && diff > 0) {
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            timerEl.innerText = `${d}д ${h}ч ${m}м`;
        }

        balanceEl.innerText = `${currentBalance.toLocaleString()} ₽`;
        debtsEl.innerText = `${totalDebts.toLocaleString()} ₽`;
        netEl.innerText = `${(currentBalance - totalDebts).toLocaleString()} ₽`;

    } catch (error) {
        console.error('Ошибка обновления UI:', error);
    }
}
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
async function deleteTransaction(id) {
    if (!confirm('Удалить эту транзакцию?')) return;
    try {
        await dbClient.from('transactions').delete().eq('id', id);
        updateUI();
    } catch (e) {
        console.error(e);
        alert('Ошибка при удалении');
    }
}

// Обработка оплаты существующего кредита
async function handlePay(id) {
    try {
        const credit = await dbClient.from('credits').select('amount').eq('id', id).single();
        await dbClient.from('transactions').insert([{
            amount: credit.data.amount,
            description: 'Оплата долга',
            type: 'minus'
        }]);

        const newDate = new Date();
        newDate.setDate(newDate.getDate() + 30);
        
        await dbClient.from('credits').update({ 
            is_paid: true, 
            due_date: newDate.toISOString().split('T')[0] 
        }).eq('id', id);

        updateUI();
    } catch (e) {
        console.error('Ошибка при оплате:', e);
        alert('Ошибка при обработке платежа');
    }
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