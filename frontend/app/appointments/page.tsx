import { AppointmentsDesk } from "@/components/AppointmentsDesk";
import { ConnectButton } from "@/components/ConnectButton";
import { getAllCertificates } from "@/lib/certificates";
import { getRoll } from "@/lib/roll";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const [{ officers, partial }, register] = await Promise.all([
    getRoll(),
    getAllCertificates(),
  ]);

  // bigints don't belong in props handed to a client component.
  const certificates = register.map((cert) => ({
    tokenId: cert.tokenId.toString(),
    courseName: cert.courseName,
    recipientName: cert.recipientName,
    issuer: cert.issuer,
    issuerName: cert.issuerName,
    issuedAt: Number(cert.issuedAt),
    revoked: cert.revoked,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-20 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="max-w-xl">
          <h1 className="display text-4xl leading-tight">Appointments</h1>
          <p className="mt-2 text-soft">
            Who may write to the register, and under whose hand. The admin
            appoints registrars, a registrar appoints its issuers, and an issuer
            records certificates.
          </p>
        </div>
        <ConnectButton />
      </div>

      <div className="mt-10">
        <AppointmentsDesk
          officers={officers}
          certificates={certificates}
          partial={partial}
        />
      </div>
    </main>
  );
}
