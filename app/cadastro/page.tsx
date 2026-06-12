import Link from "next/link";
import { RegisterForm } from "@/components/auth/register-form";
import { Card, CardBody } from "@/components/ui/card";

export const metadata = { title: "Criar conta" };

// Lê variável de ambiente em tempo de requisição (o código de acesso pode ser
// configurado depois do build), por isso a página é dinâmica.
export const dynamic = "force-dynamic";

export default function CadastroPage() {
  const requireCode = Boolean(process.env.REGISTRATION_CODE);

  return (
    <div className="mx-auto w-full max-w-sm pt-6 md:pt-12">
      <h1 className="mb-1 text-center text-2xl font-bold text-field-900">
        Criar conta
      </h1>
      <p className="mb-6 text-center text-sm text-slate-500">
        Cadastre-se para entrar na disputa do bolão.
      </p>

      <Card>
        <CardBody className="py-5">
          <RegisterForm requireCode={requireCode} />
        </CardBody>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-600">
        Já tem conta?{" "}
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
