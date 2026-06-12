import {
  calculateDaysLeft,
  getInterestPaymentCoveredDate,
  getLastInterestPayment,
  getLoanInterestAmount,
  getLoanDueState,
} from '../utils/loanManager';

const BUSINESS_TIMEZONE = 'Asia/Dhaka';

const formatBnDate = (isoString) => {
  const date = new Date(isoString);
  const datePart = date.toLocaleDateString('bn-BD', { timeZone: BUSINESS_TIMEZONE });
  const dayName = new Intl.DateTimeFormat('bn-BD', {
    timeZone: BUSINESS_TIMEZONE,
    weekday: 'long',
  }).format(date);
  return `${datePart} (${dayName})`;
};

export default function LoanCard({ loan, onPaymentClick, onSettleClick, onDeleteClick, onOpenDetails }) {
  const { nextPaymentDate, upcomingPaymentDate, missedCycles, missedDueDates } = getLoanDueState(loan);
  const currentDueDate = missedDueDates[0] || nextPaymentDate;
  const daysLeft = calculateDaysLeft(currentDueDate);
  const isOverdue = daysLeft < 0;
  const isActive = loan.status === 'ACTIVE';

  const toBn = (num) => Number(num).toLocaleString('bn-BD');

  const lastInterestPayment = getLastInterestPayment(loan);
  const lastInterestCoveredDate = lastInterestPayment
    ? getInterestPaymentCoveredDate(loan, lastInterestPayment)
    : '';
  const unpaidDaysReferenceDate = lastInterestCoveredDate || currentDueDate;
  const unpaidDaysSinceReference = Math.abs(calculateDaysLeft(unpaidDaysReferenceDate));

  const statusTileClass = !isActive
    ? 'loan-info-tile-done'
    : isOverdue
      ? 'loan-info-tile-overdue'
      : daysLeft === 0
        ? 'loan-info-tile-today'
        : 'loan-info-tile-upcoming';

  const statusText = !isActive
    ? 'হিসাব সম্পূর্ণ পরিশোধিত'
    : missedCycles > 0 && isOverdue
      ? (
        <>
          <span className="loan-info-em">{toBn(missedCycles)}</span> কিস্তি বাকি ·{' '}
          শেষ সম্পন্ন কিস্তির পর <span className="loan-info-em">{toBn(unpaidDaysSinceReference)}</span> দিন জমা হয়নি
        </>
      )
      : missedCycles > 0
        ? (
          <>
            <span className="loan-info-em">{toBn(missedCycles)}</span> কিস্তি বাকি · আজকের কিস্তি বাকি
          </>
        )
      : daysLeft === 0
        ? 'আজকে টাকা দিবে'
        : (
          <>
            টাকা দিবে আর <span className="loan-info-em">{toBn(daysLeft)}</span> দিন পর
          </>
        );

  return (
    <div
      className={`glass-card loan-card-container clickable-loan-card ${isActive ? 'active-loan-highlight' : 'done-loan-highlight'} ${isOverdue && isActive ? 'overdue-alert' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDetails(loan)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetails(loan);
        }
      }}
    >
      <div className="loan-card-main">
        <div className="loan-card-header">
          <h3 className="loan-card-name truncate-text">{loan.name}</h3>
          <div className="loan-card-amounts">
            <span className="loan-principal-amount">{toBn(loan.principal)} ৳</span>
            {isActive && (
              <span className="loan-interest-amount">+{toBn(getLoanInterestAmount(loan))} ৳</span>
            )}
          </div>
        </div>

        <div className="loan-info-list">
          <div className="loan-info-tile loan-info-tile-start">
            <span className="loan-info-tile-label">নেওয়া হয়েছে</span>
            <span className="loan-info-tile-value">{formatBnDate(loan.startDate)}</span>
          </div>

          {lastInterestPayment && (
            <div className="loan-info-tile loan-info-tile-joma">
              <div className="loan-joma-top">
                <span className="loan-info-tile-label">শেষ মুনাফা জমা</span>
                <span className="loan-joma-amount">{toBn(lastInterestPayment.amount)} ৳</span>
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

          {isActive && missedCycles > 0 && (
            <div className="loan-info-tile loan-info-tile-missed">
              <span className="loan-info-tile-label">
                বাকি কিস্তি ({toBn(missedCycles)})
              </span>
              <ul className="loan-missed-dates-list">
                {missedDueDates.map((dueDate, index) => (
                  <li key={dueDate} className="loan-missed-date-item">
                    <span className="loan-missed-date-index">{toBn(index + 1)}.</span>
                    <span className="loan-missed-date-text">{formatBnDate(dueDate)}</span>
                  </li>
                ))}
              </ul>
              <p className="loan-info-missed-hint">
                <span>এখন জমা হবে:</span>
                <strong>{formatBnDate(currentDueDate)}</strong>
                <span>· প্রতি জমা = ১ কিস্তি</span>
              </p>
            </div>
          )}

          {isActive && (
            <div className="loan-info-duo">
              <div className="loan-info-tile loan-info-tile-next">
                <span className="loan-info-tile-label">
                  {missedCycles > 0 ? 'নতুন পরবর্তী কিস্তি' : 'পরবর্তী কিস্তি'}
                </span>
                <span className="loan-info-tile-value">{formatBnDate(upcomingPaymentDate)}</span>
              </div>

              <div className={`loan-info-tile loan-info-tile-status ${statusTileClass}`}>
                <span className="loan-info-tile-label">বাকি</span>
                <span className="loan-info-tile-value">{statusText}</span>
              </div>
            </div>
          )}

          {!isActive && (
            <div className="loan-info-tile loan-info-tile-done">
              <span className="loan-info-tile-label">অবস্থা</span>
              <span className="loan-info-tile-value">{statusText}</span>
            </div>
          )}
        </div>
      </div>

      <div className="loan-card-actions">
        {isActive ? (
          <>
            <button
              type="button"
              className="btn btn-primary compact-btn"
              onClick={(event) => {
                event.stopPropagation();
                onPaymentClick(loan);
              }}
            >
              <span className="btn-line-label">
                <span>মুনাফা</span>
                <span>জমা</span>
              </span>
            </button>
            <button
              type="button"
              className="btn btn-secondary compact-btn"
              onClick={(event) => {
                event.stopPropagation();
                onSettleClick(loan);
              }}
            >
              পরিশোধ
            </button>
            <button
              type="button"
              className="btn btn-danger compact-btn delete-btn"
              onClick={(event) => {
                event.stopPropagation();
                onDeleteClick();
              }}
            >
              <span className="btn-line-label">
                <span>মুছে</span>
                <span>ফেলুন</span>
              </span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-danger compact-btn delete-btn"
            onClick={(event) => {
              event.stopPropagation();
              onDeleteClick();
            }}
          >
            <span className="btn-line-label">
              <span>মুছে</span>
              <span>ফেলুন</span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
