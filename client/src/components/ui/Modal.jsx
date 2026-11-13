import { useEffect } from "react";

const SIZES = { lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl" };

const Modal = ({ isOpen, onClose, title, children, size = "lg" }) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal panel */}
      <div 
        className={`relative z-10 flex max-h-[90vh] w-full ${SIZES[size] || SIZES.lg} transform flex-col overflow-hidden rounded-2xl bg-white shadow-xl transition-all`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="shrink-0 border-b border-gray-100 bg-gray-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-gray-800" id="modal-title">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100 focus:outline-none transition"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
