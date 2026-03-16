"use client";

interface EmergencyBannerProps {
  level: "vital" | "psychiatric" | "high";
}

export function EmergencyBanner({ level }: EmergencyBannerProps) {
  if (level === "vital") {
    return (
      <div
        style={{
          background: "#dc2626",
          color: "white",
          padding: 16,
          borderRadius: 12,
          marginBottom: 12,
          animation: "pulse 2s infinite",
        }}
      >
        <strong>URGENCE VITALE</strong>
        <p style={{ margin: "8px 0" }}>
          Appelez immediatement le <strong>15 (SAMU)</strong> ou le{" "}
          <strong>112</strong>.
        </p>
        <p>
          Si vous ne pouvez pas parler : SMS au <strong>114</strong>.
        </p>
        <div style={{ marginTop: 12 }}>
          <a
            href="tel:15"
            style={{
              background: "white",
              color: "#dc2626",
              padding: "10px 24px",
              borderRadius: 8,
              fontWeight: 700,
              textDecoration: "none",
              display: "inline-block",
            }}
          >
            Appeler le 15
          </a>
        </div>
      </div>
    );
  }

  if (level === "psychiatric") {
    return (
      <div
        style={{
          background: "#7c3aed",
          color: "white",
          padding: 16,
          borderRadius: 12,
          marginBottom: 12,
        }}
      >
        <strong>Vous n&apos;etes pas seul(e)</strong>
        <p style={{ margin: "8px 0" }}>
          Numero national de prevention du suicide :{" "}
          <strong>3114</strong> (24h/24, 7j/7)
        </p>
        <p>
          En cas de danger immediat : <strong>15 (SAMU)</strong> ou{" "}
          <strong>112</strong>
        </p>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <a
            href="tel:3114"
            style={{
              background: "white",
              color: "#7c3aed",
              padding: "10px 24px",
              borderRadius: 8,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Appeler le 3114
          </a>
          <a
            href="tel:15"
            style={{
              background: "rgba(255,255,255,0.2)",
              color: "white",
              padding: "10px 24px",
              borderRadius: 8,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Appeler le 15
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fffbeb",
        border: "1px solid #f59e0b",
        color: "#92400e",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
      }}
    >
      <strong>Consultation recommandee</strong>
      <p style={{ margin: "8px 0" }}>
        Vos symptomes necessitent une consultation medicale dans les 24 a 48h.
      </p>
      <p>
        Contactez votre medecin traitant ou appelez le{" "}
        <strong>3966 (SOS Medecins)</strong>.
      </p>
    </div>
  );
}
