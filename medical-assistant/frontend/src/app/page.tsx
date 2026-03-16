import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px" }}>
      <header style={{ textAlign: "center", marginBottom: 60 }}>
        <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 16 }}>
          SantIA
        </h1>
        <p
          style={{
            fontSize: 20,
            color: "var(--text-light)",
            maxWidth: 500,
            margin: "0 auto",
          }}
        >
          Votre assistant sante intelligent. Posez vos questions, comprenez vos
          traitements, preparez vos consultations.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 20,
          marginBottom: 40,
        }}
      >
        <FeatureCard
          title="Chat Sante"
          description="Posez vos questions de sante et recevez des informations fiables."
          href="/chat"
          icon="💬"
        />
        <FeatureCard
          title="Mes Medicaments"
          description="Gerez vos traitements et recevez des rappels."
          href="#"
          icon="💊"
          disabled
        />
        <FeatureCard
          title="Resultats Labo"
          description="Comprenez vos analyses de laboratoire."
          href="#"
          icon="🔬"
          disabled
        />
      </div>

      <div
        style={{
          background: "var(--warning-bg)",
          border: "1px solid var(--warning)",
          borderRadius: "var(--radius)",
          padding: 20,
          textAlign: "center",
          fontSize: 14,
          color: "#92400e",
        }}
      >
        <strong>Important :</strong> SantIA ne remplace pas une consultation
        medicale. En cas d&apos;urgence, appelez le 15 (SAMU) ou le 112.
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  description,
  href,
  icon,
  disabled,
}: {
  title: string;
  description: string;
  href: string;
  icon: string;
  disabled?: boolean;
}) {
  const content = (
    <div
      style={{
        background: "var(--bg-white)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 24,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "box-shadow 0.2s, transform 0.2s",
      }}
    >
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <h3 style={{ fontSize: 18, marginBottom: 8 }}>{title}</h3>
      <p style={{ fontSize: 14, color: "var(--text-light)" }}>{description}</p>
      {disabled && (
        <span
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 12,
            background: "var(--bg)",
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          Bientot disponible
        </span>
      )}
    </div>
  );

  if (disabled) return content;
  return (
    <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
      {content}
    </Link>
  );
}
