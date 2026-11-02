"use client";

interface Attachment {
  url?: string;
  filename?: string;
  name?: string;
  content_type?: string;
  type?: string;
  size?: number;
}

interface PaymentProofModalProps {
  visible: boolean;
  paymentProof: {
    proof_of_payment?: {
      type?: string;
      attachment?: Attachment | Attachment[];
      attachments?: Attachment[];
      file?: Attachment | Attachment[];
      files?: Attachment[];
      url?: string;
      content_type?: string;
      filename?: string;
      size?: number;
      notes?: string;
      details?: Record<string, unknown>;
    };
    submitted_at?: string;
    submitted_by_user_id?: number;
    invoice_details?: { amount?: string; currency?: string };
    payment_status?: string;
  } | null;
  // 🎯 Added to pass the original locked currency from the date request
  requestCurrency?: string;
  onClose: () => void;
}

function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://api-v1.consentus.online${path}`;
}

function getCurrencySymbolFromCode(code?: string): string {
  const map: Record<string, string> = {
    USD: "$", ZAR: "R", KES: "KSh", NGN: "₦", GBP: "£", EUR: "€",
    JPY: "¥", CAD: "C$", AUD: "A$", INR: "₹", CNY: "¥", CHF: "CHF",
    SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", RUB: "₽", BRL: "R$",
    MXN: "MX$", SGD: "S$", HKD: "HK$", NZD: "NZ$", KRW: "₩", TRY: "₺",
    AED: "د.إ", SAR: "﷼", ILS: "₪", THB: "฿", VND: "₫", IDR: "Rp",
    PHP: "₱", PKR: "₨", BDT: "৳", LKR: "Rs", NPR: "Rs", EGP: "E£",
    MAD: "DH", GHS: "₵",
  };
  return map[code || "USD"] || "$";
}

function collectAttachments(
  proof?: PaymentProofModalProps["paymentProof"]
): Attachment[] {
  if (!proof?.proof_of_payment) return [];
  const pop = proof.proof_of_payment;
  const raw: Attachment[] = [];
  const pushAll = (x?: Attachment | Attachment[]) => {
    if (!x) return;
    if (Array.isArray(x)) raw.push(...x);
    else raw.push(x);
  };
  pushAll(pop.attachment);
  pushAll(pop.attachments);
  pushAll(pop.file);
  pushAll(pop.files);
  if (pop.url && raw.length === 0) {
    raw.push({
      url: pop.url,
      content_type: pop.content_type,
      filename: pop.filename,
      size: pop.size,
    });
  }
  return raw.filter((a) => a && a.url);
}

function getFileTypeName(fileType?: string): string {
  if (!fileType || fileType === "unknown") return "File";
  if (fileType.startsWith("image/")) {
    if (fileType.includes("jpeg") || fileType.includes("jpg")) return "JPEG Image";
    if (fileType.includes("png")) return "PNG Image";
    if (fileType.includes("gif")) return "GIF Image";
    return "Image File";
  }
  if (fileType === "application/pdf") return "PDF Document";
  if (fileType.includes("word")) return "Word Document";
  if (fileType.includes("excel") || fileType.includes("sheet")) return "Spreadsheet";
  if (fileType.includes("zip") || fileType.includes("compressed")) return "Compressed File";
  return "Document";
}

export default function PaymentProofModal({
  visible,
  paymentProof,
  requestCurrency,
  onClose,
}: PaymentProofModalProps) {
  if (!visible || !paymentProof) return null;

  const attachments = collectAttachments(paymentProof);

  // 🎯 Flexible Currency Logic:
  // 1. Original request currency (locked at creation) — most accurate
  // 2. Invoice currency (from backend)
  // 3. USD fallback
  const displayCurrencyCode =
    requestCurrency || paymentProof.invoice_details?.currency || "USD";
  const displayCurrencySymbol = getCurrencySymbolFromCode(displayCurrencyCode);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] bg-[#F8F9FA]">
          <h2 className="text-[20px] font-bold text-[#2D3748]">Payment Proof</h2>
          <button
            onClick={onClose}
            className="text-[#6B46C1] font-bold text-[20px] p-1 active:opacity-70"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Payment method */}
          <div className="bg-[#F7FAFC] border-l-4 border-[#6B46C1] rounded-lg p-4 mb-4">
            <p className="text-[16px] font-bold text-[#2D3748] mb-1">Payment Method</p>
            <p className="text-[16px] text-[#4A5568]">
              {paymentProof.proof_of_payment?.type || "Not specified"}
            </p>
          </div>

          {/* Submission */}
          <div className="bg-[#F7FAFC] border-l-4 border-[#6B46C1] rounded-lg p-4 mb-4">
            <p className="text-[16px] font-bold text-[#2D3748] mb-1">Submitted</p>
            <p className="text-[16px] text-[#4A5568] mb-1">
              {paymentProof.submitted_at
                ? new Date(paymentProof.submitted_at).toLocaleString()
                : "Unknown date"}
            </p>
            <p className="text-[14px] italic text-[#718096]">
              by User ID: {paymentProof.submitted_by_user_id}
            </p>
          </div>

          {/* Attachments */}
          {attachments.length > 0 ? (
            <div className="bg-[#F7FAFC] border-l-4 border-[#6B46C1] rounded-lg p-4 mb-4">
              <p className="text-[16px] font-bold text-[#2D3748] mb-1">
                Attached Files ({attachments.length})
              </p>
              <p className="text-[14px] italic text-[#718096] mb-3">
                Proof documents provided by the payer
              </p>
              <div className="flex flex-col gap-3">
                {attachments.map((att, index) => {
                  const fileType = att.content_type || att.type || "unknown";
                  const fileName = att.filename || att.name || `proof_${index + 1}`;
                  const fileSize = att.size ? ` • ${(att.size / 1024).toFixed(1)}KB` : "";
                  const url = getFullImageUrl(att.url);
                  return (
                    <div
                      key={index}
                      className="bg-white border border-[#E2E8F0] rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-[28px]">
                          {fileType.startsWith("image/") ? "🖼️" : "📄"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-semibold text-[#2D3748] truncate">
                            {fileName}
                          </p>
                          <p className="text-[14px] text-[#718096]">
                            {getFileTypeName(fileType)}
                            {fileSize}
                          </p>
                        </div>
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-3 bg-[#6B46C1] text-white text-center font-semibold rounded-lg py-2.5 active:opacity-80"
                      >
                        👁️ Open File
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-[#F7FAFC] border-l-4 border-[#6B46C1] rounded-lg p-4 mb-4">
              <p className="text-[14px] text-[#718096] text-center mb-1">
                📄 No file attachments provided with this payment proof.
              </p>
              <p className="text-[12px] italic text-[#A0AEC0] text-center">
                The payer did not attach any supporting documents.
              </p>
            </div>
          )}

          {/* Payment details */}
          {paymentProof.proof_of_payment?.details && (
            <div className="bg-[#F7FAFC] border-l-4 border-[#6B46C1] rounded-lg p-4 mb-4">
              <p className="text-[16px] font-bold text-[#2D3748] mb-3">
                Payment Details
              </p>
              {Object.entries(paymentProof.proof_of_payment.details).map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between items-center py-1.5 border-b border-[#EDF2F7] last:border-b-0"
                >
                  <span className="text-[14px] font-medium text-[#4A5568] capitalize">
                    {k.replace(/_/g, " ")}:
                  </span>
                  <span className="text-[14px] font-semibold text-[#2D3748] text-right">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Invoice info */}
          {paymentProof.invoice_details && (
            <div className="bg-[#F7FAFC] border-l-4 border-[#6B46C1] rounded-lg p-4 mb-4">
              <p className="text-[16px] font-bold text-[#2D3748] mb-3">
                Invoice Information
              </p>
              <div className="flex justify-between items-center py-1.5 border-b border-[#EDF2F7]">
                <span className="text-[14px] font-medium text-[#4A5568]">Amount:</span>
                <span className="text-[14px] font-semibold text-[#2D3748]">
                  {displayCurrencySymbol}
                  {paymentProof.invoice_details.amount || "0"}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-[14px] font-medium text-[#4A5568]">Status:</span>
                <span className="text-[14px] font-semibold text-[#D69E2E]">
                  {paymentProof.payment_status || "Unknown"}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          {paymentProof.proof_of_payment?.notes && (
            <div className="bg-[#F7FAFC] border-l-4 border-[#6B46C1] rounded-lg p-4">
              <p className="text-[16px] font-bold text-[#2D3748] mb-2">
                Additional Notes
              </p>
              <p className="text-[14px] italic text-[#4A5568] leading-5">
                {paymentProof.proof_of_payment.notes}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#E2E8F0] bg-white">
          <button
            onClick={onClose}
            className="w-full bg-[#6B46C1] text-white font-bold rounded-lg py-3 active:opacity-80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}