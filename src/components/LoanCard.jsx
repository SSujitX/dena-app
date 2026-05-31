import { calculateDaysLeft, getLastInterestPayment } from '../utils/loanManager';

export default function LoanCard({ loan, onPaymentClick, onSettleClick, onDeleteClick, onOpenDetails }) {
  const daysLeft = calculateDaysLeft(loan.nextPaymentDate);
  const isOverdue = daysLeft < 0;
  const isActive = loan.status === 'ACTIVE';

  const toBn = (num) => Number(num).toLocaleString('bn-BD');

  const banglaDays = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

  const formatBnDate = (isoString) => {
    const d = new Date(isoString);
    return `${d.toLocaleDateString('bn-BD')} (${banglaDays[d.getDay()]})`;
  };

  const lastInterestPayment = getLastInterestPayment(loan);

  const statusTileClass = !isActive
    ? 'loan-info-tile-done'
    : isOverdue
      ? 'loan-info-tile-overdue'
      : daysLeft === 0
        ? 'loan-info-tile-today'
        : 'loan-info-tile-upcoming';

  const statusText = !isActive
    ? 'হিসাব সম্পূর্ণ পরিশোধিত'
    : isOverdue
      ? (
        <>
          <span className="loan-info-em">{toBn(Math.abs(daysLeft))}</span> দিন হয়ে গেছে টাকা দেয়নি!
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
              <span className="loan-interest-amount">+{toBn(loan.interestPerWeek)} ৳</span>
            )}
          </div>
        </div>

        <div className="loan-info-list">
          <div className="loan-info-tile loan-info-tile-start">
            <span className="loan-info-tile-label">নেওয়া হয়েছে</span>
            <span className="loan-info-tile-value">{formatBnDate(loan.startDate)}</span>
          </div>

          {lastInterestPayment && (
            <div className="loan-info-tile loan-info-tile-joma loan-info-tile-split">
              <div className="loan-info-tile-main">
                <span className="loan-info-tile-label">শেষ মুনাফা জমা</span>
                <span className="loan-info-tile-value">{formatBnDate(lastInterestPayment.date)}</span>
              </div>
              <div className="loan-info-joma-amount-box">
                <span className="loan-info-joma-amount">{toBn(lastInterestPayment.amount)} ৳</span>
              </div>
            </div>
          )}

          {isActive && (
            <div className="loan-info-duo">
              <div className={`loan-info-tile loan-info-tile-next ${isOverdue ? 'loan-info-tile-next-overdue' : ''}`}>
                <span className="loan-info-tile-label">পরবর্তী কিস্তি</span>
                <span className="loan-info-tile-value">{formatBnDate(loan.nextPaymentDate)}</span>
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
              মুনাফা জমা
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
              মুছে ফেলুন
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
            মুছে ফেলুন
          </button>
        )}
      </div>
    </div>
  );
}
