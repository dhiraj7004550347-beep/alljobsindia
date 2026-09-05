"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "24px", background: "#f1f5f9", fontFamily: "Arial, sans-serif" }}>
          <section style={{ width: "100%", maxWidth: "560px", borderRadius: "24px", background: "white", padding: "40px", textAlign: "center", boxShadow: "0 10px 30px rgba(15,23,42,.12)" }}>
            <h1 style={{ margin: 0, color: "#0f172a" }}>All Jobs India is temporarily unavailable</h1>
            <p style={{ color: "#475569", lineHeight: 1.7 }}>A critical page error occurred. No job application data was submitted. Please try again.</p>
            <button type="button" onClick={reset} style={{ border: 0, borderRadius: "12px", background: "#1d4ed8", color: "white", padding: "12px 22px", fontWeight: 700, cursor: "pointer" }}>Try Again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
