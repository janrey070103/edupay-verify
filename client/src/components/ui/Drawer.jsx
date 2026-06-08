import { IconX, IconAlertCircle } from "../icons/Icons";

const Drawer = ({
  open,
  onClose,
  title,
  children,
  footer,
  loading = false,
  error = "",
}) => {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-300"
        onClick={onClose}
        aria-label="Close panel"
      />
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md translate-x-0 flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
          <h2 id="drawer-title" className="text-lg font-bold text-gray-800">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-200 bg-white p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-sti-blue/20"
            aria-label="Close drawer"
          >
            <IconX className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-sti-blue" />
              <p className="text-sm font-medium text-gray-400">
                Loading details…
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                <IconAlertCircle className="h-6 w-6" />
              </div>
              <p className="mb-1 text-sm font-bold text-gray-800">
                Could not load details
              </p>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          ) : (
            children
          )}
        </div>

        {footer && !loading && !error && (
          <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </>
  );
};

export default Drawer;
