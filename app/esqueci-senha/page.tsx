import Link from "next/link";
import { RequestResetForm } from "@/components/auth/request-reset-form";
import { Card, CardBody } from "@/components/ui/card";

export const metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage() {
  return (
    <div className="mx-auto w-full max-w-sm pt-6 md:pt-12">
      <h1 className="mb-1 text-center text-2xl font-bold text-field-900">
        Esqueci minha senha
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Informe seu e-mail e enviaremos um link para criar uma nova senha.
      </p>

      <Card>
        <CardBody className="py-5">
          <RequestResetForm />
        </CardBody>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-600">
        Lembrou a senha?{" "}
        <Link
          href="/login"
          className="font-semibold text-field-700 hover:underline"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
