import { useState } from 'react';

export default function NotificationDebugPanel({
  loans,
  onRequestPermission,
  onResync,
  onGetPending,
  onSendTest,
  onSendRealPreview,
  onClearAll,
  onRecalculateSchedule,
}) {
  const [status, setStatus] = useState('প্রস্তুত');
  const [pendingRows, setPendingRows] = useState([]);

  const handleAction = async (runner, successText) => {
    try {
      setStatus('চলছে...');
      const result = await runner();
      if (successText) setStatus(successText);
      return result;
    } catch (error) {
      setStatus(`ত্রুটি: ${error?.message || 'অজানা সমস্যা'}`);
      return null;
    }
  };

  const loadPending = async () => {
    const result = await handleAction(onGetPending, 'পেন্ডিং তালিকা আপডেট হয়েছে');
    if (result) setPendingRows(result);
  };

  const sendTest = async () => {
    const result = await handleAction(onSendTest, 'টেস্ট নোটিফিকেশন সেট হয়েছে');
    if (result?.at) {
      setStatus(`Test যাবে: ${new Date(result.at).toLocaleString('bn-BD')}`);
    }
  };

  const sendRealPreview = async () => {
    const result = await handleAction(onSendRealPreview, 'রিয়েল প্রিভিউ নোটিফিকেশন সেট হয়েছে');
    if (result?.length) {
      const previewTimes = result.map((item) => new Date(item.at).toLocaleTimeString('bn-BD')).join(', ');
      setStatus(`Real messages যাবে: ${previewTimes}`);
    }
  };

  const recalculateSchedule = async () => {
    const updatedCount = await handleAction(
      async () => onRecalculateSchedule?.(),
      null,
    );

    if (updatedCount === null || updatedCount === undefined) return;

    if (updatedCount > 0) {
      setStatus(
        `${updatedCount.toLocaleString('bn-BD')}টি চলতি হিসাবের পরবর্তী কিস্তির তারিখ আপডেট হয়েছে।`,
      );
      return;
    }

    setStatus('সব চলতি হিসাব ইতিমধ্যে সঠিক তারিখে আছে।');
  };

  return (
    <div className="glass-card notification-debug-panel">
      <div className="notification-debug-summary">
        <span className="notification-debug-summary-label">চলতি হিসাব</span>
        <strong className="notification-debug-summary-count">
          {loans.length.toLocaleString('bn-BD')}
        </strong>
      </div>

      <section className="notification-debug-section">
        <h4 className="notification-debug-section-title">হিসাব টুলস</h4>
        <button
          type="button"
          className="btn btn-primary btn-sm notification-debug-btn notification-debug-btn-full"
          onClick={recalculateSchedule}
        >
          পরবর্তী কিস্তির তারিখ ঠিক করুন
        </button>
        <p className="notification-debug-help">
          নেওয়ার তারিখ ও সেটিংসের ব্যবধান অনুযায়ী সব ACTIVE হিসাবের তারিখ আপডেট করবে।
        </p>
      </section>

      <section className="notification-debug-section">
        <h4 className="notification-debug-section-title">নোটিফিকেশন</h4>
        <div className="notification-debug-actions">
          <button type="button" className="btn btn-secondary btn-sm notification-debug-btn" onClick={() => handleAction(onRequestPermission, 'পারমিশন চেক সম্পন্ন')}>
            পারমিশন চেক
          </button>
          <button type="button" className="btn btn-secondary btn-sm notification-debug-btn" onClick={() => handleAction(onResync, 'রিমাইন্ডার রিসিঙ্ক সম্পন্ন')}>
            রিমাইন্ডার রিসিঙ্ক
          </button>
          <button type="button" className="btn btn-secondary btn-sm notification-debug-btn" onClick={sendTest}>
            টেস্ট পাঠান (৩০ সেকেন্ড)
          </button>
          <button type="button" className="btn btn-secondary btn-sm notification-debug-btn" onClick={sendRealPreview}>
            রিয়েল প্রিভিউ (১০/২০/৩০ সেকেন্ড)
          </button>
          <button type="button" className="btn btn-secondary btn-sm notification-debug-btn" onClick={loadPending}>
            পেন্ডিং দেখুন
          </button>
          <button type="button" className="btn btn-danger btn-sm notification-debug-btn" onClick={() => handleAction(onClearAll, 'সব পেন্ডিং মুছে ফেলা হয়েছে')}>
            পেন্ডিং ক্লিয়ার
          </button>
        </div>
      </section>

      <p className="notification-debug-status">{status}</p>

      {pendingRows.length > 0 && (
        <div className="notification-debug-pending-list">
          {pendingRows.map((item) => (
            <p key={item.id} className="notification-debug-pending-row">
              #{item.id} - {item.title} - {item.body}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
