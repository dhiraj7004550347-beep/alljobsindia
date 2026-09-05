import Script from "next/script";

function adsenseId() {
  const value = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();
  return value && /^ca-pub-\d+$/.test(value) ? value : null;
}

function analyticsId() {
  const value = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim();
  return value && /^G-[A-Z0-9]+$/.test(value) ? value : null;
}

export default function OptionalScripts() {
  const ads = adsenseId();
  const analytics = analyticsId();
  return (
    <>
      {ads && (
        <Script
          id="adsense-script"
          strategy="afterInteractive"
          async
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ads}`}
        />
      )}
      {analytics && (
        <>
          <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${analytics}`} />
          <Script id="google-analytics" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${analytics}', { anonymize_ip: true });
          `}</Script>
        </>
      )}
    </>
  );
}
