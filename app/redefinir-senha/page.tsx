import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardBody } from "@/components/ui/card";
import { findValidResetToken } from "@/lib/password-reset";

export const metadata = { title: "Redefinir senha" };

// A validade do token é checada a cada requisição — nunca cacheada.
export const dynamic = "force-dynamic";

export default async function RedefinirSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? await findValidResetToken(token) : null;

  return (
    <div className="mx-auto w-full max-w-sm pt-6 md:pt-12">
      <h1 className="mb-1 text-center text-2xl font-bold text-field-900">
        Redefinir senha
      </h1>

      {valid && token ? (
        <>
          <p className="mb-6 text-center text-sm text-slate-500">
            Crie uma nova senha para sua conta.
          </p>
          <Card>
            <CardBody className="py-5">
              <ResetPasswordForm token={token} />
            </CardBody>
          </Card>
        </>
      ) : (
        <>
          <p className="mb-6 text-center text-sm text-slate-500">
            Este link é inválido ou expirou.
          </p>
          <Card>
            <CardBody className="py-5 text-center text-sm text-slate-600">
              Links de redefinição valem por 1 hora e só podem ser usados uma
              vez.{" "}
              <Link
                href="/esqueci-senha"
                className="font-semibold text-field-700 hover:underline"
              >
                Solicitar um novo link
              </Link>
              .
            </CardBody>
          </Card>
        </>
      )}

      <p className="mt-4 text-center text-sm text-slate-600">
        <Link
          href="/login"
          className="font-semibold text-field-700 hover:underline"
        >
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
