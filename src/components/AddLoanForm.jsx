import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { compressImage } from '../utils/imageCompression';
import { calculateInterestFromPreset, getLoanInterestAmount } from '../utils/loanManager';

const DocumentCropModal = lazy(() => import('./DocumentCropModal'));
const ZoomableImageViewerModal = lazy(() => import('./ZoomableImageViewerModal'));

const parseLoanStartDate = (value) => {
  if (!value) return new Date();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export default function AddLoanForm({ onSave, onCancel, initialLoan = null, mode = 'create', profitPreset = null }) {
  const [name, setName] = useState(initialLoan?.name || '');
  
  // Use pure JS date for DatePicker, we will format it exactly later on submit.
  const [startDate, setStartDate] = useState(parseLoanStartDate(initialLoan?.startDate));
  
  const [principal, setPrincipal] = useState(initialLoan?.principal ? String(initialLoan.principal) : '');
  const [interestPerInstallment, setInterestPerInstallment] = useState(
    initialLoan ? String(getLoanInterestAmount(initialLoan) || '') : ''
  );
  const [proofImage, setProofImage] = useState(initialLoan?.proofImage || null);
  const isEditMode = mode === 'edit';

  const [imageError, setImageError] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [cropSource, setCropSource] = useState(null);
  const [cropSourceName, setCropSourceName] = useState('proof-image.png');
  const [isPreviewViewerOpen, setIsPreviewViewerOpen] = useState(false);
  const [isRemoveImageConfirmOpen, setIsRemoveImageConfirmOpen] = useState(false);
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const handlePrincipalChange = (value) => {
    setPrincipal(value);
    if (isEditMode) return;

    if (!value || Number.isNaN(Number(value))) {
      setInterestPerInstallment('');
      return;
    }
    setInterestPerInstallment(String(calculateInterestFromPreset(Number(value), profitPreset || undefined)));
  };

  useEffect(() => {
    if (isEditMode) return;
    if (!principal) return;
    if (Number.isNaN(Number(principal))) return;
    setInterestPerInstallment(String(calculateInterestFromPreset(Number(principal), profitPreset || undefined)));
  }, [isEditMode, principal, profitPreset]);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('ছবি পড়া যায়নি।'));
      reader.readAsDataURL(file);
    });

  const handleImagePick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setImageError('');
      const source = await fileToDataUrl(file);
      setCropSource(source);
      setCropSourceName(file.name || 'proof-image.png');
    } catch (error) {
      setImageError(error.message || 'ছবি প্রসেস করা যায়নি।');
    }
  };

  const handleCropConfirm = async (blob) => {
    try {
      setIsProcessingImage(true);
      setImageError('');
      const file = new File([blob], cropSourceName, { type: blob.type || 'image/png' });
      const compressed = await compressImage(file);
      setProofImage(compressed);
      setCropSource(null);
    } catch (error) {
      setImageError(error.message || 'ছবি প্রসেস করা যায়নি।');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name || !principal || !interestPerInstallment || !startDate) return;

    // Final conversion to ensure strictly accurate Asia timezone string (YYYY-MM-DD) natively
    const tzDate = new Date(startDate.toLocaleString("en-US", {timeZone: "Asia/Dhaka"}));
    const yyyy = tzDate.getFullYear();
    const mm = String(tzDate.getMonth() + 1).padStart(2, '0');
    const dd = String(tzDate.getDate()).padStart(2, '0');
    const dbFormattedDate = `${yyyy}-${mm}-${dd}`;

    onSave({
      name,
      startDate: dbFormattedDate,
      principal: Number(principal),
      interestPerInstallment: Number(interestPerInstallment),
      proofImage
    });
  };

  const handleOpenPreviewViewer = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    setIsPreviewViewerOpen(true);
  };

  const handleRequestRemoveProofImage = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsRemoveImageConfirmOpen(true);
  };

  const handleConfirmRemoveProofImage = () => {
    setIsPreviewViewerOpen(false);
    setIsRemoveImageConfirmOpen(false);
    setProofImage(null);
  };

  const modalLoadingFallback = (
    <div className="modal-overlay">
      <div className="modal-content">
        <p className="text-sm text-muted">লোড হচ্ছে...</p>
      </div>
    </div>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="mb-6 flex justify-between items-center">
            <h2 className="text-2xl font-bold text-brand-gradient">{isEditMode ? 'হিসাব এডিট করুন' : 'নতুন লোন দিন'}</h2>
            <button type="button" className="loan-details-close-btn" onClick={onCancel} aria-label="বন্ধ করুন">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">যাকে টাকা দিচ্ছেন তার নাম</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="যেমন: রহিম মিয়া"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group date-picker-wrapper">
            <label className="form-label">টাকা দেওয়ার তারিখ</label>
            <DatePicker 
               selected={startDate} 
               onChange={(date) => setStartDate(date)} 
               className="form-input w-full"
               dateFormat="dd/MM/yyyy"
               placeholderText="তারিখ নির্বাচন করুন"
               required
            />
          </div>

          <div className="form-group">
            <label className="form-label">মোট টাকার পরিমাণ (৳)</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="যেমন: ২০০০০"
              value={principal}
              onChange={e => handlePrincipalChange(e.target.value)}
              required
            />
          </div>

          <div className="form-group mb-8">
            <label className="form-label">প্রতি কিস্তিতে মুনাফা (৳)</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="যেমন: ২০০০"
              value={interestPerInstallment}
              onChange={e => setInterestPerInstallment(e.target.value)}
              required
            />
            <span className="text-xs text-brand-primary" style={{ marginLeft: '0.25rem', marginTop: '0.25rem', opacity: 0.9 }}>
              আপনি চাইলে যেকোনো পরিমাণ বসাতে পারেন, যা আপনি মুনাফা হিসেবে নিবেন।
            </span>
          </div>

          <div className="form-group mb-8">
            <label className="form-label">ডকুমেন্ট প্রুফ ছবি (ঐচ্ছিক)</label>
            <div className="proof-uploader-card">
              <div className="proof-uploader-head">
                <div>
                  <p className="text-sm font-semibold">ডকুমেন্ট প্রুফ</p>
                  <p className="text-xs text-muted">স্ক্যান ফ্রেমে ক্রপ করে পরিষ্কার ছবি সেভ হবে</p>
                </div>
                <span className="proof-pill">ঐচ্ছিক</span>
              </div>

              <div className="proof-actions-row">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessingImage}
                >
                  ক্যামেরা দিয়ে তুলুন
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isProcessingImage}
                >
                  গ্যালারি থেকে নিন
                </button>
              </div>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImagePick}
                style={{ display: 'none' }}
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleImagePick}
                style={{ display: 'none' }}
              />
            </div>
            <span className="text-xs text-muted" style={{ marginLeft: '0.25rem', marginTop: '0.25rem' }}>
              ছবি দিলে কমপ্রেস করে সেভ হবে। ছবি না দিলেও হিসাব সেভ হবে।
            </span>
            {isProcessingImage && (
              <span className="text-xs text-brand-primary" style={{ marginLeft: '0.25rem', marginTop: '0.25rem' }}>
                ছবি প্রস্তুত করা হচ্ছে...
              </span>
            )}
            {imageError && (
              <span className="text-xs" style={{ marginLeft: '0.25rem', marginTop: '0.25rem', color: 'var(--color-danger)' }}>
                {imageError}
              </span>
            )}
            {proofImage?.dataUrl && (
              <div className="proof-preview-wrap">
                <img
                  src={proofImage.dataUrl}
                  alt="Proof preview"
                  className="proof-preview-image clickable-proof-image"
                  onClick={handleOpenPreviewViewer}
                />
                <div className="proof-preview-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleOpenPreviewViewer}
                  >
                    ছবি বড় করে দেখুন
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={handleRequestRemoveProofImage}
                  >
                    ছবি সরান
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full text-lg shadow-glow"
            disabled={isProcessingImage}
          >
             {isEditMode ? 'হিসাব আপডেট করুন' : 'হিসাব সেভ করুন'}
          </button>
        </form>
      </div>

      <Suspense fallback={modalLoadingFallback}>
        {cropSource && (
          <DocumentCropModal
            imageSrc={cropSource}
            onCancel={() => setCropSource(null)}
            onConfirm={handleCropConfirm}
            isProcessing={isProcessingImage}
          />
        )}
      </Suspense>

      <Suspense fallback={modalLoadingFallback}>
        <ZoomableImageViewerModal
          isOpen={isPreviewViewerOpen}
          imageSrc={proofImage?.dataUrl}
          imageAlt="Proof preview zoomed"
          title="ডকুমেন্ট প্রিভিউ"
          onClose={() => setIsPreviewViewerOpen(false)}
        />
      </Suspense>

      {isRemoveImageConfirmOpen && (
        <div className="modal-overlay image-remove-confirm-overlay">
          <div className="image-remove-confirm-card">
            <h3 className="text-lg font-bold text-pure">ছবি সরাতে চান?</h3>
            <p className="text-sm text-muted image-remove-confirm-text">
              এই ডকুমেন্ট প্রুফ ছবি হিসাব থেকে সরানো হবে।
            </p>
            <div className="image-remove-confirm-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsRemoveImageConfirmOpen(false)}
              >
                বাতিল
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleConfirmRemoveProofImage}
              >
                ছবি সরান
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
