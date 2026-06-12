import { lazy, Suspense, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import {
  calculateDaysLeft,
  getInterestPaymentCoveredDate,
  getLastInterestPayment,
  getLoanInterestAmount,
  getLoanDueState,
} from '../utils/loanManager';

const ZoomableImageViewerModal = lazy(() => import('./ZoomableImageViewerModal'));

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

const toBnAmount = (amount) => Number(amount).toLocaleString('bn-BD');

export default function LoanDetailsModal({ loan, onClose, onEdit }) {
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  if (!loan) return null;
  const { nextPaymentDate, upcomingPaymentDate, missedCycles, missedDueDates } = getLoanDueState(loan);
  const currentDueDate = missedDueDates[0] || nextPaymentDate;
  const lastInterestPayment = getLastInterestPayment(loan);
  const lastInterestCoveredDate = lastInterestPayment
    ? getInterestPaymentCoveredDate(loan, lastInterestPayment)
    : '';
  const unpaidDaysReferenceDate = lastInterestCoveredDate || currentDueDate;
  const unpaidDaysSinceReference = Math.abs(calculateDaysLeft(unpaidDaysReferenceDate));
  const safeLoanName = `${loan.name || 'loan'}`
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const fileName = `${safeLoanName || 'loan'}-proof-${Date.now()}.jpg`;

  const handleJpgDownload = async () => {
    if (!loan.proofImage?.dataUrl) return;

    try {
      const image = new Image();
      image.src = loan.proofImage.dataUrl;

      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('ক্যানভাস পাওয়া যায়নি।');

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);

      const jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64Data = jpgDataUrl.split(',')[1];

      if (Capacitor.isNativePlatform()) {
        const targetPath = `Dena/${fileName}`;
        await Filesystem.writeFile({
          path: targetPath,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
        window.alert(`ছবি সেভ হয়েছে: Documents/Dena/${fileName}`);
        return;
      }

      const link = document.createElement('a');
      link.href = jpgDataUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Proof download failed:', error);
      window.alert('ছবি সেভ করা যায়নি। আবার চেষ্টা করুন।');
    }
  };

  const modalLoadingFallback = (
    <div className="modal-overlay">
      <div className="modal-content">
        <p className="text-sm text-muted">লোড হচ্ছে...</p>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content loan-details-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mb-6 loan-details-header">
          <div className="loan-details-header-top">
            <h2 className="text-2xl font-bold text-brand-gradient loan-details-title">হিসাবের বিস্তারিত</h2>
            <button
              type="button"
              className="loan-details-close-btn"
              onClick={onClose}
              aria-label="বন্ধ করুন"
            >
              &times;
            </button>
          </div>
          <div className="loan-details-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm loan-details-edit-btn"
              onClick={() => onEdit?.(loan)}
            >
              এডিট করুন
            </button>
          </div>
        </div>

        <div className="loan-details-grid">
          <div className="loan-details-item">
            <span className="text-xs text-muted">নাম</span>
            <p className="text-base font-bold text-pure">{loan.name}</p>
          </div>
          <div className="loan-details-item">
            <span className="text-xs text-muted">স্ট্যাটাস</span>
            <p className="text-base font-bold" style={{ color: loan.status === 'ACTIVE' ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {loan.status === 'ACTIVE' ? 'চলতি' : 'পরিশোধিত'}
            </p>
          </div>
          <div className="loan-details-item">
            <span className="text-xs text-muted">আসল টাকা</span>
            <p className="text-base font-bold text-pure">{toBnAmount(loan.principal)} ৳</p>
          </div>
          <div className="loan-details-item">
            <span className="text-xs text-muted">প্রতি কিস্তির মুনাফা</span>
            <p className="text-base font-bold text-pure">{toBnAmount(getLoanInterestAmount(loan))} ৳</p>
          </div>
          <div className="loan-details-item">
            <span className="text-xs text-muted">শুরু</span>
            <p className="text-sm text-secondary">{formatBnDate(loan.startDate)}</p>
          </div>
          {loan.status === 'ACTIVE' && (
            <div className="loan-details-item">
              <span className="text-xs text-muted">পরবর্তী কিস্তি</span>
              <p className="text-sm text-secondary">{formatBnDate(upcomingPaymentDate)}</p>
            </div>
          )}
          {loan.status === 'ACTIVE' && missedCycles > 0 && (
            <>
              <div className="loan-details-item loan-details-item-wide">
                <span className="text-xs text-muted">এখন জমা হবে</span>
                <p className="text-sm font-bold text-pure">{formatBnDate(currentDueDate)}</p>
                <p className="text-xs text-muted mt-1">
                  {toBnAmount(missedCycles)} কিস্তি বাকি · শেষ সম্পন্ন কিস্তির পর {toBnAmount(unpaidDaysSinceReference)} দিন জমা হয়নি
                </p>
              </div>
              <div className="loan-details-item loan-details-item-wide">
                <span className="text-xs text-muted">বাকি কিস্তি</span>
                <ul className="loan-missed-dates-list">
                  {missedDueDates.map((dueDate, index) => (
                    <li key={dueDate} className="loan-missed-date-item">
                      <span className="loan-missed-date-index">{toBnAmount(index + 1)}.</span>
                      <span className="loan-missed-date-text">{formatBnDate(dueDate)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="loan-proof-block">
          <h3 className="text-base font-bold mb-2">ডকুমেন্ট প্রুফ</h3>
          {loan.proofImage?.dataUrl ? (
            <>
              <img
                src={loan.proofImage.dataUrl}
                alt={`${loan.name} proof`}
                className="loan-proof-image clickable-proof-image"
                onClick={() => setIsImageViewerOpen(true)}
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm mt-4"
                onClick={() => setIsImageViewerOpen(true)}
              >
                ছবি বড় করে দেখুন
              </button>
              <div className="mt-4">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleJpgDownload}
                >
                  ছবি ডাউনলোড করুন
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">কোনো ছবি যোগ করা হয়নি।</p>
          )}
        </div>

        <div className="loan-proof-block">
          <h3 className="text-base font-bold mb-2">পেমেন্ট হিস্ট্রি</h3>
          {loan.payments?.length ? (
            <div className="loan-history-list">
              {[...loan.payments].reverse().map((payment, index) => (
                <div key={`${payment.date}-${index}`} className="loan-history-item">
                  <div>
                    <span className="text-sm text-secondary">{formatBnDate(payment.date)}</span>
                    {payment.type !== 'SETTLEMENT' && (
                      index === 0 ? (
                        <div className="loan-joma-done loan-joma-done-inline">
                          <span className="loan-joma-done-mark" aria-hidden="true">✓</span>
                          <div className="loan-joma-done-body">
                            <span className="loan-joma-done-label">সম্পন্ন কিস্তি</span>
                            <span className="loan-joma-done-date">
                              {formatBnDate(getInterestPaymentCoveredDate(loan, payment))}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted mt-1">
                          কিস্তির তারিখ: {formatBnDate(getInterestPaymentCoveredDate(loan, payment))}
                        </p>
                      )
                    )}
                  </div>
                  <span className="text-sm font-bold" style={{ color: payment.type === 'SETTLEMENT' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                    {payment.type === 'SETTLEMENT' ? 'পরিশোধ' : 'মুনাফা'}: {toBnAmount(payment.amount)} ৳
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">এখনও কোনো পেমেন্ট নেই।</p>
          )}
        </div>
      </div>

      <Suspense fallback={modalLoadingFallback}>
        <ZoomableImageViewerModal
          isOpen={isImageViewerOpen}
          imageSrc={loan.proofImage?.dataUrl}
          imageAlt={`${loan.name} proof zoomed`}
          title="ডকুমেন্ট প্রিভিউ"
          onClose={() => setIsImageViewerOpen(false)}
        />
      </Suspense>
    </div>
  );
}
