export const generateId = () => Math.random().toString(36).substr(2, 9);
const LOANS_KEY = 'denaLoans';
const PROFIT_INTERVAL_KEY = 'denaProfitIntervalDays';
const DEFAULT_PROFIT_INTERVAL_DAYS = 7;
const PROFIT_PRESET_KEY = 'denaProfitPreset';
const DEFAULT_PROFIT_PRESET = {
  principal: 5000,
  interest: 500,
};
const AUTO_BACKUP_CONFIG_KEY = 'denaAutoBackupConfig';
const LAST_AUTO_BACKUP_AT_KEY = 'denaLastAutoBackupAt';
const DEFAULT_AUTO_BACKUP_CONFIG = {
  enabled: false,
  intervalDays: 1,
};

const normalizeProfitIntervalDays = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return DEFAULT_PROFIT_INTERVAL_DAYS;
  return Math.min(365, Math.max(1, parsed));
};

const normalizeProfitPreset = (value) => {
  const parsedPrincipal = Number.parseInt(value?.principal, 10);
  const parsedInterest = Number.parseInt(value?.interest, 10);

  const principal = Number.isNaN(parsedPrincipal)
    ? DEFAULT_PROFIT_PRESET.principal
    : Math.min(100000000, Math.max(1, parsedPrincipal));
  const interest = Number.isNaN(parsedInterest)
    ? DEFAULT_PROFIT_PRESET.interest
    : Math.min(100000000, Math.max(1, parsedInterest));

  return { principal, interest };
};

const normalizeAutoBackupConfig = (value) => {
  const parsedDays = Number.parseInt(value?.intervalDays, 10);
  const intervalDays = Number.isNaN(parsedDays) ? 1 : Math.min(365, Math.max(1, parsedDays));
  return {
    enabled: Boolean(value?.enabled),
    intervalDays,
  };
};

export const getLoans = () => {
  const data = localStorage.getItem(LOANS_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveLoans = (loans) => {
  localStorage.setItem(LOANS_KEY, JSON.stringify(loans));
};

export const getProfitIntervalDays = () => {
  const raw = localStorage.getItem(PROFIT_INTERVAL_KEY);
  if (!raw) return DEFAULT_PROFIT_INTERVAL_DAYS;
  return normalizeProfitIntervalDays(raw);
};

export const saveProfitIntervalDays = (days) => {
  const normalized = normalizeProfitIntervalDays(days);
  localStorage.setItem(PROFIT_INTERVAL_KEY, String(normalized));
  return normalized;
};

export const getProfitPreset = () => {
  const raw = localStorage.getItem(PROFIT_PRESET_KEY);
  if (!raw) return DEFAULT_PROFIT_PRESET;

  try {
    const parsed = JSON.parse(raw);
    return normalizeProfitPreset(parsed);
  } catch {
    return DEFAULT_PROFIT_PRESET;
  }
};

export const saveProfitPreset = (preset) => {
  const normalized = normalizeProfitPreset(preset);
  localStorage.setItem(PROFIT_PRESET_KEY, JSON.stringify(normalized));
  return normalized;
};

export const getAutoBackupConfig = () => {
  const raw = localStorage.getItem(AUTO_BACKUP_CONFIG_KEY);
  if (!raw) return DEFAULT_AUTO_BACKUP_CONFIG;
  try {
    return normalizeAutoBackupConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_AUTO_BACKUP_CONFIG;
  }
};

export const saveAutoBackupConfig = (config) => {
  const normalized = normalizeAutoBackupConfig(config);
  localStorage.setItem(AUTO_BACKUP_CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
};

export const getLastAutoBackupAt = () => {
  const raw = localStorage.getItem(LAST_AUTO_BACKUP_AT_KEY);
  if (!raw) return '';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
};

export const saveLastAutoBackupAt = (dateValue = new Date()) => {
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '';
  const value = parsed.toISOString();
  localStorage.setItem(LAST_AUTO_BACKUP_AT_KEY, value);
  return value;
};

export const calculateInterestFromPreset = (principalAmount, preset = getProfitPreset()) => {
  const principal = Number(principalAmount);
  if (!Number.isFinite(principal) || principal <= 0) return 0;

  const normalizedPreset = normalizeProfitPreset(preset);
  const interest = (principal * normalizedPreset.interest) / normalizedPreset.principal;
  return Math.max(0, Math.round(interest));
};

const toStartOfDay = (dateValue) => {
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
    const [year, month, day] = dateValue.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(dateValue);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getFixedScheduleSlot = (startDate, intervalDays, slotIndex) => {
  const anchor = toStartOfDay(startDate);
  const slot = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  slot.setDate(slot.getDate() + slotIndex * intervalDays);
  return slot;
};

const buildNextPaymentDate = (startDate, intervalDays) => {
  const today = toStartOfDay(new Date());

  for (let slotIndex = 1; slotIndex < 10000; slotIndex += 1) {
    const slot = getFixedScheduleSlot(startDate, intervalDays, slotIndex);
    if (slot >= today) {
      return slot.toISOString();
    }
  }

  return getFixedScheduleSlot(startDate, intervalDays, 1).toISOString();
};

const getNextFixedDueDateAfterPayment = (startDate, intervalDays, paymentDate) => {
  const reference = toStartOfDay(paymentDate);

  for (let slotIndex = 1; slotIndex < 10000; slotIndex += 1) {
    const slot = getFixedScheduleSlot(startDate, intervalDays, slotIndex);
    if (slot > reference) {
      return slot.toISOString();
    }
  }

  return getFixedScheduleSlot(startDate, intervalDays, 2).toISOString();
};

const paymentDateToIso = (paymentDate) => {
  if (!paymentDate) {
    return toStartOfDay(new Date()).toISOString();
  }
  if (typeof paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(paymentDate)) {
    const [year, month, day] = paymentDate.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day).toISOString();
  }
  return toStartOfDay(paymentDate).toISOString();
};

export const addLoan = (loanData) => {
  const loans = getLoans();
  const intervalDays = getProfitIntervalDays();
  const nextPaymentDate = buildNextPaymentDate(loanData.startDate, intervalDays);

  const newLoan = {
    ...loanData,
    id: generateId(),
    status: 'ACTIVE', // ACTIVE, DONE
    nextPaymentDate,
    payments: [] // Log of payments
  };

  loans.push(newLoan);
  saveLoans(loans);
  return getLoans();
};

export const collectPayment = (loanId, amount, isFullSettlement, paymentDate = null) => {
  const loans = getLoans();
  const intervalDays = getProfitIntervalDays();
  const loanIndex = loans.findIndex(l => l.id === loanId);
  
  if (loanIndex > -1) {
    const loan = loans[loanIndex];
    const paymentDateIso = paymentDateToIso(paymentDate);
    
    loan.payments.push({
      date: paymentDateIso,
      amount,
      type: isFullSettlement ? 'SETTLEMENT' : 'INTEREST'
    });

    if (isFullSettlement) {
      loan.status = 'DONE';
    } else {
      loan.nextPaymentDate = getNextFixedDueDateAfterPayment(
        loan.startDate,
        intervalDays,
        paymentDateIso,
      );
    }
    
    saveLoans(loans);
  }
  return getLoans();
};

export const applyProfitIntervalToActiveLoans = (days) => {
  const intervalDays = saveProfitIntervalDays(days);
  const loans = getLoans();

  const updatedLoans = loans.map((loan) => {
    if (loan.status !== 'ACTIVE') return loan;
    return {
      ...loan,
      nextPaymentDate: buildNextPaymentDate(loan.startDate, intervalDays),
    };
  });

  saveLoans(updatedLoans);
  return { intervalDays, loans: getLoans() };
};

export const deleteLoan = (loanId) => {
  const loans = getLoans();
  const filteredLoans = loans.filter(l => l.id !== loanId);
  saveLoans(filteredLoans);
  return getLoans();
};

export const updateLoan = (loanId, loanData) => {
  const loans = getLoans();
  const loanIndex = loans.findIndex((loan) => loan.id === loanId);

  if (loanIndex > -1) {
    loans[loanIndex] = {
      ...loans[loanIndex],
      name: loanData.name,
      startDate: loanData.startDate,
      principal: Number(loanData.principal),
      interestPerWeek: Number(loanData.interestPerWeek),
      proofImage: loanData.proofImage || null,
    };
    saveLoans(loans);
  }

  return getLoans();
};

export const getLastInterestPayment = (loan) => {
  if (!Array.isArray(loan?.payments) || !loan.payments.length) return null;

  for (let index = loan.payments.length - 1; index >= 0; index -= 1) {
    const payment = loan.payments[index];
    if (payment.type === 'SETTLEMENT') continue;
    return payment;
  }

  return null;
};

export const calculateDaysLeft = (nextPaymentDateIso) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const paymentDate = new Date(nextPaymentDateIso);
  const nextPayment = new Date(paymentDate.getFullYear(), paymentDate.getMonth(), paymentDate.getDate());
  
  const diffTime = nextPayment - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getAvailableYears = (loans) => {
   const years = new Set([new Date().getFullYear()]);
   loans.forEach(loan => {
      loan.payments.forEach(p => {
         years.add(new Date(p.date).getFullYear());
      });
   });
   return Array.from(years).sort((a,b) => b - a);
};

export const getSummaryStats = (loans, selectedYear, selectedMonth) => {
    let totalActivePrincipal = 0;
    let totalInterestCollected = 0;
    let monthlyInterest = 0;

    const currentSelYear = selectedYear !== undefined ? Number(selectedYear) : new Date().getFullYear();
    const currentSelMonth = selectedMonth !== undefined ? Number(selectedMonth) : new Date().getMonth();

    loans.forEach(loan => {
        if (loan.status === 'ACTIVE') {
            totalActivePrincipal += Number(loan.principal);
        }
        loan.payments.forEach(payment => {
            if (payment.type === 'INTEREST') {
                const amount = Number(payment.amount);
                totalInterestCollected += amount;
                
                const pDate = new Date(payment.date);
                if (pDate.getFullYear() === currentSelYear && pDate.getMonth() === currentSelMonth) {
                   monthlyInterest += amount;
                }
            }
        });
    });

    return { totalActivePrincipal, totalInterestCollected, monthlyInterest };
}
