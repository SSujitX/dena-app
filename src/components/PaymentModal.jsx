import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  getInterestPaymentCoveredDate,
  getLastInterestPayment,
  getLoanInterestAmount,
  getLoanDueState,
} from '../utils/loanManager';

const BUSINESS_TIMEZONE = 'Asia/Dhaka';

const formatPaymentDateYmd = (date) => {
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: BUSINESS_TIMEZONE }));
  const yyyy = tzDate.getFullYear();
  const mm = String(tzDate.getMonth() + 1).padStart(2, '0');
  const dd = String(tzDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function PaymentModal({ loan, isSettle, profitIntervalDays = 7, onConfirm, onCancel }) {
  const installmentAmount = getLoanInterestAmount(loan);
  const defaultAmount = isSettle ? Number(loan.principal) : installmentAmount;
  const [amount, setAmount] = useState(String(defaultAmount));
  const [paymentDate, setPaymentDate] = useState(() => new Date());

  useEffect(() => {
    setAmount(String(defaultAmount));
  }, [defaultAmount]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount)) return;
    const paymentDateYmd = isSettle ? null : formatPaymentDateYmd(paymentDate);
    onConfirm(loan.id, Number(amount), isSettle, paymentDateYmd);
  };

  const intervalLabel = Number(profitIntervalDays || 7).toLocaleString('bn-BD');
  const lastInterestPayment = !isSettle ? getLastInterestPayment(loan) : null;
  const lastInterestCoveredDate = lastInterestPayment
    ? getInterestPaymentCoveredDate(loan, lastInterestPayment, profitIntervalDays)
    : '';
  const { missedCycles, missedDueDates, nextPaymentDate, upcomingPaymentDate } = !isSettle
    ? getLoanDueState(loan, profitIntervalDays)
    : { missedCycles: 0, missedDueDates: [], nextPaymentDate: '', upcomingPaymentDate: '' };
  const currentDueDate = missedDueDates[0] || nextPaymentDate;

  const formatBnDate = (isoString) => {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString('bn-BD', { timeZone: BUSINESS_TIMEZONE });
    const dayName = new Intl.DateTimeFormat('bn-BD', {
      timeZone: BUSINESS_TIMEZONE,
      weekday: 'long',
    }).format(d);
    return `${datePart} (${dayName})`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2 text-pure">
              {isSettle ? 'পুরো টাকা বুঝে নিন' : 'মুনাফা জমা নিন'}
            </h2>
            <p className="text-sm text-secondary">
              {isSettle ? `${loan.name} এর হিসাবটি পুরোপুরি পরিশোধ করা হচ্ছে।` : `${loan.name} এর কিস্তির মুনাফা জমা করা হচ্ছে।`}
            </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group mb-8">
             <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted">পাওয়ার কথা</span>
                    <span className="font-bold text-lg" style={{ color: isSettle ? 'var(--color-warning)' : 'var(--color-success)'}}>
                        {defaultAmount.toLocaleString('bn-BD')} ৳
                    </span>
                 </div>
             </div>

            {!isSettle && missedCycles > 0 && (
              <div className="payment-missed-box">
                <span className="text-xs text-muted">বাকি কিস্তি ({Number(missedCycles).toLocaleString('bn-BD')})</span>
                <ul className="loan-missed-dates-list payment-missed-dates-list">
                  {missedDueDates.map((dueDate, index) => (
                    <li key={dueDate} className="loan-missed-date-item">
                      <span className="loan-missed-date-index">
                        {Number(index + 1).toLocaleString('bn-BD')}.
                      </span>
                      <span className="loan-missed-date-text">{formatBnDate(dueDate)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted mt-2">
                  এই জমা হবে: <strong>{formatBnDate(currentDueDate)}</strong>
                </p>
                <p className="text-xs text-muted mt-1">
                  নতুন পরবর্তী কিস্তি: <strong>{formatBnDate(upcomingPaymentDate)}</strong>
                </p>
                <p className="text-xs text-muted mt-1">
                  এই জমা সবচেয়ে পুরনো বাকি কিস্তির জন্য গণ্য হবে।
                </p>
              </div>
            )}

            {!isSettle && lastInterestPayment && (
              <div className="loan-joma-preview">
                <div className="loan-joma-top">
                  <span className="loan-info-tile-label">শেষ জমা ছিল</span>
                  <span className="loan-joma-amount">{Number(lastInterestPayment.amount).toLocaleString('bn-BD')} ৳</span>
                </div>
                <span className="loan-joma-paid-date">{formatBnDate(lastInterestPayment.date)}</span>
                {lastInterestCoveredDate && (
                  <div className="loan-joma-done">
                    <span className="loan-joma-done-mark" aria-hidden="true">✓</span>
                    <div className="loan-joma-done-body">
                      <span className="loan-joma-done-label">সম্পন্ন কিস্তি</span>
                      <span className="loan-joma-done-date">{formatBnDate(lastInterestCoveredDate)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!isSettle && (
              <div className="form-group date-picker-wrapper mb-4">
                <label className="form-label">মুনাফা জমার তারিখ</label>
                <DatePicker
                  selected={paymentDate}
                  onChange={(date) => setPaymentDate(date)}
                  className="form-input w-full"
                  dateFormat="dd/MM/yyyy"
                  placeholderText="তারিখ নির্বাচন করুন"
                  maxDate={new Date()}
                  required
                />
                <span className="text-xs mt-2 text-muted" style={{ marginLeft: '0.25rem', display: 'block' }}>
                  ডিফল্ট আজকের তারিখ। পেছনের তারিখও বেছে নিতে পারবেন।
                </span>
              </div>
            )}

            <label className="form-label">কত টাকা পেলেন? (৳)</label>
            <input 
              type="number" 
              className="form-input" 
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              style={{ fontSize: '1.25rem', padding: '1.25rem', fontWeight: 'bold' }}
            />
            {!isSettle && (
              <span className="text-xs mt-2 text-muted" style={{ marginLeft: '0.25rem' }}>
                প্রতি জমা = এক কিস্তির মুনাফা। কিস্তির তারিখ {intervalLabel} দিন পর পর ঠিক থাকবে। দেরিতে জমা দিলে আগের বাকি কিস্তি মাফ হবে না — প্রতিটি বাকি কিস্তির জন্য আলাদা জমা লাগবে।
              </span>
            )}
          </div>

          <div className="flex justify-between items-center mt-8 gap-4 mobile-btn-stack">
            <button type="button" className="btn btn-secondary flex-1 text-lg" onClick={onCancel}>
               বাতিল করুন
            </button>
            <button type="submit" className={`btn ${isSettle ? 'btn-warning' : 'btn-primary'} flex-1 text-lg shadow-glow`} style={isSettle ? {background: 'var(--gradient-gold)', color: '#000'} : {}}>
               {isSettle ? 'হিসাব সম্পূর্ণ করুন' : 'জমা নিশ্চিত করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
