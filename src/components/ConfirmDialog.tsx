interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Egységes visszakérdezés-modal minden törlés / lemondás előtt (KAN: minden
// destruktív műveletnél legyen megerősítés, ne csak a hirdetés-lemondásnál).
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Törlés",
  cancelLabel = "Mégsem",
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl border border-[#DDDDDD] shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-extrabold text-[#222222]">{title}</h2>
        <p className="text-sm text-[#717171] mt-2 leading-relaxed">{message}</p>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-[#DDDDDD] text-[#222222] font-semibold py-2.5 rounded-xl hover:bg-[#F7F7F7] transition-colors text-sm"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              danger
                ? "flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
                : "flex-1 bg-[#FF385C] hover:bg-[#E31C5F] text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
