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
const BUSINESS_TIMEZONE = 'Asia/Dhaka';
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

export const getLoanInterestAmount = (loan) => {
  const amount = Number(loan?.interestPerInstallment ?? loan?.interestPerWeek ?? 0);
  return Number.isFinite(amount) ? amount : 0;
};

const normalizeLoan = (loan) => {
  if (!loan || typeof loan !== 'object') return loan;
  const rest = { ...loan };
  delete rest.interestPerWeek;
  return {
    ...rest,
    interestPerInstallment: getLoanInterestAmount(loan),
    payments: Array.isArray(loan.payments) ? loan.payments : [],
  };
};

export const getLoans = () => {
  const data = localStorage.getItem(LOANS_KEY);
  if (!data) return [];

  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed.map(normalizeLoan) : [];
  } catch {
    return [];
  }
};

export const saveLoans = (loans) => {
  localStorage.setItem(LOANS_KEY, JSON.stringify(loans.map(normalizeLoan)));
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

const toBangladeshYmd = (dateValue = new Date()) => {
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return toBangladeshYmd(new Date());

  const parts = new Intl.DateTimeFormat('en', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const bangladeshYmdToDate = (ymd) => new Date(`${ymd}T00:00:00+06:00`);

const shiftBangladeshYmdDays = (ymd, days) => {
  const date = bangladeshYmdToDate(ymd);
  date.setUTCDate(date.getUTCDate() + days);
  return toBangladeshYmd(date);
};

const toStartOfDay = (dateValue) => {
  return bangladeshYmdToDate(toBangladeshYmd(dateValue));
};

const getFixedScheduleSlot = (startDate, intervalDays, slotIndex) => {
  const anchorYmd = toBangladeshYmd(startDate);
  return bangladeshYmdToDate(shiftBangladeshYmdDays(anchorYmd, slotIndex * intervalDays));
};

const buildNextPaymentDate = (startDate, intervalDays) => {
  // First munafa due is always start + one interval (slot 1), even if that date is already past.
  return getFixedScheduleSlot(startDate, intervalDays, 1).toISOString();
};

const countInterestPayments = (loan) => {
  if (!Array.isArray(loan?.payments)) return 0;
  return loan.payments.filter((payment) => payment.type !== 'SETTLEMENT').length;
};

const computeNextPaymentDateForLoan = (loan, intervalDays) => {
  const paidCycles = countInterestPayments(loan);
  return getFixedScheduleSlot(loan.startDate, intervalDays, paidCycles + 1).toISOString();
};

const getCoveredDateForPaymentIndex = (loan, intervalDays, interestPaymentIndex) => (
  getFixedScheduleSlot(loan.startDate, intervalDays, interestPaymentIndex).toISOString()
);

const withCoveredDates = (loan, intervalDays) => {
  if (!Array.isArray(loan?.payments)) return loan;

  let interestPaymentIndex = 0;
  let changed = false;
  const payments = loan.payments.map((payment) => {
    if (payment.type === 'SETTLEMENT') return payment;

    interestPaymentIndex += 1;
    if (payment.coveredDate) return payment;

    changed = true;
    return {
      ...payment,
      coveredDate: getCoveredDateForPaymentIndex(loan, intervalDays, interestPaymentIndex),
    };
  });

  return changed ? { ...loan, payments } : loan;
};

const getNextUpcomingFixedDate = (startDate, intervalDays) => {
  const today = toStartOfDay(new Date());

  for (let slotIndex = 1; slotIndex < 10000; slotIndex += 1) {
    const slot = getFixedScheduleSlot(startDate, intervalDays, slotIndex);
    if (slot > today) {
      return slot.toISOString();
    }
  }

  return buildNextPaymentDate(startDate, intervalDays);
};

// Each unpaid cycle whose due date is today or already past (oldest first).
export const getMissedDueCycleDates = (loan, intervalDays = getProfitIntervalDays()) => {
  if (loan?.status !== 'ACTIVE') return [];

  const today = toStartOfDay(new Date());
  const paidCycles = countInterestPayments(loan);
  const dates = [];

  for (let slotIndex = paidCycles + 1; slotIndex < 10000; slotIndex += 1) {
    const slot = getFixedScheduleSlot(loan.startDate, intervalDays, slotIndex);
    if (slot > today) break;
    dates.push(slot.toISOString());
  }

  return dates;
};

export const getMissedDueCycles = (loan, intervalDays = getProfitIntervalDays()) => (
  getMissedDueCycleDates(loan, intervalDays).length
);

export const getLoanDueState = (loan, intervalDays = getProfitIntervalDays()) => {
  const nextPaymentDate = computeNextPaymentDateForLoan(loan, intervalDays);
  const missedDueDates = getMissedDueCycleDates(loan, intervalDays);
  const upcomingPaymentDate = missedDueDates.length > 0
    ? getNextUpcomingFixedDate(loan.startDate, intervalDays)
    : nextPaymentDate;

  return {
    nextPaymentDate,
    upcomingPaymentDate,
    missedCycles: missedDueDates.length,
    missedDueDates,
    paidCycles: countInterestPayments(loan),
  };
};

const dueDatesMatch = (leftValue, rightValue) => {
  return toStartOfDay(leftValue).getTime() === toStartOfDay(rightValue).getTime();
};

const paymentDateToIso = (paymentDate) => {
  if (!paymentDate) {
    return toStartOfDay(new Date()).toISOString();
  }
  if (typeof paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    return bangladeshYmdToDate(paymentDate).toISOString();
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
    const coveredDate = isFullSettlement
      ? null
      : getCoveredDateForPaymentIndex(loan, intervalDays, countInterestPayments(loan) + 1);
    
    const payment = {
      date: paymentDateIso,
      amount,
      type: isFullSettlement ? 'SETTLEMENT' : 'INTEREST'
    };
    if (coveredDate) {
      payment.coveredDate = coveredDate;
    }
    loan.payments.push(payment);

    if (isFullSettlement) {
      loan.status = 'DONE';
    } else {
      loan.nextPaymentDate = computeNextPaymentDateForLoan(loan, intervalDays);
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

    const nextPaymentDate = computeNextPaymentDateForLoan(loan, intervalDays);

    return { ...loan, nextPaymentDate };
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
  const intervalDays = getProfitIntervalDays();

  if (loanIndex > -1) {
    const existing = loans[loanIndex];
    const startDate = loanData.startDate;
    const nextPaymentDate = existing.status === 'ACTIVE'
      ? computeNextPaymentDateForLoan({ ...existing, startDate }, intervalDays)
      : existing.nextPaymentDate;

    loans[loanIndex] = {
      ...existing,
      name: loanData.name,
      startDate,
      principal: Number(loanData.principal),
      interestPerInstallment: getLoanInterestAmount(loanData),
      proofImage: loanData.proofImage || null,
      nextPaymentDate,
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

export const getInterestPaymentCoveredDate = (
  loan,
  targetPayment,
  intervalDays = getProfitIntervalDays(),
) => {
  if (!loan?.startDate || !Array.isArray(loan?.payments) || !targetPayment) return '';
  if (targetPayment.coveredDate) return targetPayment.coveredDate;

  let interestPaymentIndex = 0;
  for (const payment of loan.payments) {
    if (payment.type === 'SETTLEMENT') continue;
    interestPaymentIndex += 1;
    if (payment === targetPayment) {
      return getCoveredDateForPaymentIndex(loan, intervalDays, interestPaymentIndex);
    }
  }

  return '';
};

export const recalculateActiveLoansToFixedSchedule = () => {
  const intervalDays = getProfitIntervalDays();
  const loans = getLoans();
  let updatedCount = 0;

  const updatedLoans = loans.map((loan) => {
    const loanWithCoveredDates = withCoveredDates(loan, intervalDays);
    const coveredDatesChanged = loanWithCoveredDates !== loan;
    if (loan.status !== 'ACTIVE') {
      if (coveredDatesChanged) updatedCount += 1;
      return loanWithCoveredDates;
    }

    const nextPaymentDate = computeNextPaymentDateForLoan(loanWithCoveredDates, intervalDays);

    if (!coveredDatesChanged && dueDatesMatch(loan.nextPaymentDate, nextPaymentDate)) {
      return loanWithCoveredDates;
    }

    updatedCount += 1;
    return { ...loanWithCoveredDates, nextPaymentDate };
  });

  if (updatedCount > 0) {
    saveLoans(updatedLoans);
  }

  return { loans: getLoans(), updatedCount };
};

export const calculateDaysLeft = (nextPaymentDateIso) => {
  const today = toStartOfDay(new Date());
  const nextPayment = toStartOfDay(nextPaymentDateIso);
  const diffTime = nextPayment.getTime() - today.getTime();
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
                
                const [paymentYear, paymentMonth] = toBangladeshYmd(payment.date).split('-').map(Number);
                if (paymentYear === currentSelYear && paymentMonth - 1 === currentSelMonth) {
                   monthlyInterest += amount;
                }
            }
        });
    });

    return { totalActivePrincipal, totalInterestCollected, monthlyInterest };
}
