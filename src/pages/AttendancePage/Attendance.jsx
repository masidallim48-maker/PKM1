import { useEffect, useRef, useState } from "react";
import { Check, Clock3, LoaderCircle, X } from "lucide-react";
import {
  attendanceApi,
  ATTENDANCE_TYPES,
  getAttendanceError,
} from "../../services/attendance.js";

const clockFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function Attendance() {
  const [now, setNow] = useState(() => new Date());
  const [kind, setKind] = useState("masuk");
  const [readerOpen, setReaderOpen] = useState(false);
  const [sn, setSn] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const input = useRef(null);
  const pendingRequest = useRef(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => {
      window.clearInterval(timer);
      pendingRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (readerOpen && !submitting) {
      input.current?.focus({ preventScroll: true });
      input.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [readerOpen, submitting]);

  function startReader() {
    if (pendingRequest.current) return;
    setReaderOpen(true);
    setResult(null);
    setError(null);
    input.current?.focus({ preventScroll: true });
  }

  function changeKind(value) {
    if (pendingRequest.current || value === kind) return;
    setKind(value);
    setSn("");
    setReaderOpen(false);
    setResult(null);
    setError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (pendingRequest.current) return;
    const controller = new AbortController();
    pendingRequest.current = controller;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const response = await attendanceApi.submit(
        { sn, jenis_absensi: kind },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      setResult(response);
      setSn("");
      setReaderOpen(false);
    } catch (requestError) {
      if (!controller.signal.aborted)
        setError(getAttendanceError(requestError));
    } finally {
      if (!controller.signal.aborted) {
        pendingRequest.current = null;
        setSubmitting(false);
      }
    }
  }

  const status = submitting
    ? "Menyimpan absensi..."
    : result
      ? "Absensi berhasil!"
      : error
        ? "Absensi belum berhasil"
        : readerOpen
          ? "Tempelkan kartu Anda"
          : "Siap untuk absen?";
  const personName =
    result?.record?.nama_siswa ??
    result?.record?.nama ??
    result?.record?.user?.nama;

  return (
    <section aria-labelledby="attendance-title" className="pb-2 text-[#003D32]">
      <div className="rounded-[24px] px-4 pb-5 pt-3 text-center shadow-[0_3px_5px_rgba(0,0,0,0.3),inset_0_4px_2px_rgba(0,0,0,0.4)] min-[380px]:pb-7 min-[380px]:pt-5">
        <p className="flex items-center justify-center gap-1 text-[11px] font-medium ">
          <Clock3 size={12} aria-hidden="true" />
          <time dateTime={now.toISOString()}>{clockFormat.format(now)}</time>
        </p>
        <h1
          id="attendance-title"
          className="text-[26px] font-bold leading-tight tracking-tight min-[380px]:text-[32px] [text-shadow:2px_3px_4px_rgba(0,0,0,0.4)]"
        >
          Absensi
        </h1>
        <p className="mt-1 text-[11px]">{dateFormat.format(now)}</p>
      </div>

      <div
        role="group"
        aria-label="Jenis absensi"
        className="relative mx-8 -mt-3 grid grid-cols-2 gap-2"
      >
        {ATTENDANCE_TYPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            disabled={submitting}
            onClick={() => changeKind(value)}
            className={`min-h-12 rounded-xl border-2 border-[#003D32] px-2 py-3 text-[13px] font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:opacity-60 ${kind === value ? "bg-[#003D32] text-white" : "bg-white text-[#003D32] hover:bg-emerald-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        aria-busy={submitting}
        className="mx-8 mt-6 text-center min-[380px]:mt-8"
      >
        <button
          type="button"
          onClick={startReader}
          disabled={submitting}
          aria-label="Aktifkan pembaca kartu absensi"
          aria-expanded={readerOpen}
          aria-controls="attendance-reader"
          className="flex aspect-square w-full items-center justify-center rounded-[12px] rounded-tr-[38px] border-[3px] border-[#002d24] bg-[#003D32] p-7 transition hover:bg-[#004c3e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-4 disabled:cursor-wait"
        >
          <ScannerIllustration />
        </button>

        <p
          aria-live="polite"
          className="mt-4 text-[20px] font-medium leading-tight min-[380px]:mt-5 min-[380px]:text-[22px]"
        >
          {status}
        </p>
        <button
          type="submit"
          onClick={(event) => {
            if (!readerOpen) {
              event.preventDefault();
              startReader();
            }
          }}
          disabled={submitting}
          aria-label={readerOpen ? `Kirim absensi ${kind}` : "Mulai scan kartu"}
          className={`mx-auto mt-3 flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-[#003D32] bg-white p-[3px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-wait min-[380px]:mt-4 min-[380px]:h-[66px] min-[380px]:w-[66px] ${error ? "border-red-700" : ""}`}
        >
          <span
            className={`flex h-full w-full items-center justify-center rounded-full text-white ${error ? "bg-red-700" : "bg-[#003D32]"}`}
          >
            {submitting ? (
              <LoaderCircle size={34} className="animate-spin" />
            ) : error ? (
              <X size={34} strokeWidth={1.5} />
            ) : (
              <Check size={36} strokeWidth={1.5} />
            )}
          </span>
        </button>
        <p className="mt-3 text-[12px] min-[380px]:mt-4">
          Pastikan TAP kartu dengan tepat!
        </p>

        <div
          id="attendance-reader"
          hidden={!readerOpen}
          className="mt-5 text-left"
        >
          <label
            htmlFor="attendance-sn"
            className="mb-2 block text-xs font-semibold"
          >
            Nomor kartu (SN)
          </label>
          <input
            ref={input}
            id="attendance-sn"
            name="sn"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required={readerOpen}
            disabled={!readerOpen || submitting}
            value={sn}
            onChange={(event) => setSn(event.target.value)}
            aria-invalid={Boolean(error?.fields.sn)}
            aria-describedby={`attendance-reader-hint${error?.fields.sn ? " attendance-sn-error" : ""}`}
            placeholder="Tempelkan kartu atau ketik nomor"
            className="h-12 w-full rounded-lg border border-emerald-800/30 bg-emerald-50/50 px-3 text-base text-[#003D32] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20 disabled:opacity-60"
          />
          <p
            id="attendance-reader-hint"
            className="mt-2 text-[11px] leading-relaxed text-slate-600"
          >
            Gunakan reader kartu, lalu tekan Enter atau tombol centang untuk
            mengirim.
          </p>
          {error?.fields.sn && (
            <p id="attendance-sn-error" className="mt-1 text-xs text-red-700">
              {error.fields.sn}
            </p>
          )}
          {error?.fields.jenis_absensi && (
            <p className="mt-1 text-xs text-red-700">
              {error.fields.jenis_absensi}
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-xs leading-relaxed text-red-800"
          >
            {error.message}
          </p>
        )}
        {result && (
          <div
            role="status"
            className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs leading-relaxed text-emerald-900"
          >
            <p>{result.message}</p>
            {typeof personName === "string" && (
              <p className="mt-1 font-semibold">{personName}</p>
            )}
          </div>
        )}
      </form>
    </section>
  );
}

function ScannerIllustration() {
  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      className="h-full w-full text-white"
      aria-hidden="true"
    >
      <path
        d="M35 80V42a7 7 0 0 1 7-7h38M160 35h38a7 7 0 0 1 7 7v38M205 160v38a7 7 0 0 1-7 7h-38M80 205H42a7 7 0 0 1-7-7v-38"
        stroke="currentColor"
        strokeWidth="15"
      />
      <path
        d="M65 95V65h110v30M65 145v30h110v-30"
        stroke="currentColor"
        strokeWidth="13"
      />
      <path d="M22 120h196" stroke="currentColor" strokeWidth="17" />
    </svg>
  );
}
