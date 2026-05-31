import { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { getLastInterestPayment } from '../utils/loanManager';

const formatPaymentDateYmd = (date) => {
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }));
  const yyyy = tzDate.getFullYear();
  const mm = String(tzDate.getMonth() + 1).padStart(2, '0');
  const dd = String(tzDate.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function PaymentModal({ loan, isSettle, profitIntervalDays = 7, onConfirm, onCancel }) {
  const [amount, setAmount] = useState(isSettle ? loan.principal.toString() : loan.interestPerWeek.toString());
  const [paymentDate, setPaymentDate] = useState(() => new Date());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount)) return;
    const paymentDateYmd = isSettle ? null : formatPaymentDateYmd(paymentDate);
    onConfirm(loan.id, Number(amount), isSettle, paymentDateYmd);
  };

  const intervalLabel = Number(profitIntervalDays || 7).toLocaleString('bn-BD');
  const lastInterestPayment = !isSettle ? getLastInterestPayment(loan) : null;

  const banglaDays = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const formatBnDate = (isoString) => {
    const d = new Date(isoString);
    const datePart = d.toLocaleDateString('bn-BD');
    const dayName = banglaDays[d.getDay()];
    return `${datePart} (${dayName})`;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2 text-pure">
              {isSettle ? 'পুরো টাকা বুঝে নিন' : 'সাপ্তাহিক মুনাফা জমা নিন'}
            </h2>
            <p className="text-sm text-secondary">
              {isSettle ? `${loan.name} এর হিসাবটি পুরোপুরি পরিশোধ করা হচ্ছে।` : `${loan.name} এর এই সপ্তাহের মুনাফা জমা করা হচ্ছে।`}
            </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group mb-8">
             <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', marginBottom: '1rem' }}>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted">পাওয়ার কথা</span>
                    <span className="font-bold text-lg" style={{ color: isSettle ? 'var(--color-warning)' : 'var(--color-success)'}}>
                        {isSettle ? loan.principal.toLocaleString('bn-BD') : loan.interestPerWeek.toLocaleString('bn-BD')} ৳
                    </span>
                 </div>
             </div>

            {!isSettle && lastInterestPayment && (
              <div style={{ padding: '0.85rem', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', border: '1px solid var(--border-subtle)' }}>
                <span className="text-xs text-muted">শেষ জমা ছিল</span>
                <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-warning)' }}>
                  {Number(lastInterestPayment.amount).toLocaleString('bn-BD')} ৳
                  <span className="text-xs text-secondary font-normal" style={{ marginLeft: '0.35rem' }}>
                    ({formatBnDate(lastInterestPayment.date)})
                  </span>
                </p>
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
                জমা দেওয়ার তারিখ থেকে পরবর্তী মুনাফা {intervalLabel} দিন পরে হবে।
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
